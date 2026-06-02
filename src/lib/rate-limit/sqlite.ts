import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type Database from "better-sqlite3";
import { getEnv } from "@/env";
import type {
  RateLimitScope,
  RateLimitStore,
  RateLimitWindow,
} from "./store";

/**
 * SQLite 実装(better-sqlite3)。ローカル開発・テスト用。
 *
 * results テーブルと同じ DB ファイルに rate_limit_counters / monthly_usage
 * テーブルを同居させる。テーブルは初回 getDb() で IF NOT EXISTS 作成。
 *
 * atomic incr: SQLite の UPSERT(INSERT ... ON CONFLICT DO UPDATE)+ RETURNING
 * で 1 クエリで完結する(SQLite 3.35+)。better-sqlite3 12.x は対応済。
 */
export class SqliteRateLimitStore implements RateLimitStore {
  private db: Database.Database | null = null;
  private dbPath: string | null = null;

  /**
   * テスト用のオプション。dbPath を指定すると env を無視してそのパスを使う。
   * 既存 results テーブルと衝突しないように、同じ DB の中に別テーブルを作る運用。
   */
  constructor(opts: { dbPath?: string } = {}) {
    this.dbPath = opts.dbPath ?? null;
  }

  private getDb(): Database.Database {
    if (this.db) return this.db;
    const path = this.dbPath ?? getEnv().SQLITE_PATH;
    mkdirSync(dirname(path), { recursive: true });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Ctor = require("better-sqlite3") as typeof Database;
    const db = new Ctor(path);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS rate_limit_counters (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        scope        TEXT    NOT NULL,
        scope_value  TEXT    NOT NULL,
        window_kind  TEXT    NOT NULL,
        window_start TEXT    NOT NULL,
        count        INTEGER NOT NULL DEFAULT 0,
        UNIQUE (scope, scope_value, window_kind, window_start)
      );
      CREATE INDEX IF NOT EXISTS idx_rlc_lookup
        ON rate_limit_counters (scope, scope_value, window_kind, window_start);
      CREATE INDEX IF NOT EXISTS idx_rlc_cleanup
        ON rate_limit_counters (window_kind, window_start);

      CREATE TABLE IF NOT EXISTS monthly_usage (
        year_month TEXT    PRIMARY KEY,
        count      INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );
    `);
    this.db = db;
    return db;
  }

  async incrementCounter(
    scope: RateLimitScope,
    scopeValue: string,
    windowKind: RateLimitWindow,
    windowStart: Date,
  ): Promise<number> {
    const db = this.getDb();
    const iso = windowStart.toISOString();
    // UPSERT + RETURNING で atomic。既存行があれば count + 1、無ければ 1。
    const row = db
      .prepare(
        `INSERT INTO rate_limit_counters (scope, scope_value, window_kind, window_start, count)
         VALUES (?, ?, ?, ?, 1)
         ON CONFLICT (scope, scope_value, window_kind, window_start)
         DO UPDATE SET count = count + 1
         RETURNING count`,
      )
      .get(scope, scopeValue, windowKind, iso) as { count: number };
    return row.count;
  }

  async incrementMonthly(yearMonth: string): Promise<number> {
    const db = this.getDb();
    const row = db
      .prepare(
        `INSERT INTO monthly_usage (year_month, count, updated_at)
         VALUES (?, 1, datetime('now'))
         ON CONFLICT (year_month)
         DO UPDATE SET count = count + 1, updated_at = datetime('now')
         RETURNING count`,
      )
      .get(yearMonth) as { count: number };
    return row.count;
  }

  async getMonthlyCount(yearMonth: string): Promise<number> {
    const db = this.getDb();
    const row = db
      .prepare("SELECT count FROM monthly_usage WHERE year_month = ?")
      .get(yearMonth) as { count: number } | undefined;
    return row?.count ?? 0;
  }

  async cleanup(now: Date = new Date()): Promise<void> {
    const db = this.getDb();
    // hour 窓: 25 時間より前
    const hourCutoff = new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString();
    // day 窓: 2 日より前
    const dayCutoff = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(
      "DELETE FROM rate_limit_counters WHERE window_kind = 'hour' AND window_start < ?",
    ).run(hourCutoff);
    db.prepare(
      "DELETE FROM rate_limit_counters WHERE window_kind = 'day' AND window_start < ?",
    ).run(dayCutoff);
  }

  /** テスト用: 内部 DB を閉じる */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
