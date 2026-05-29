import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type Database from "better-sqlite3";
import { getEnv } from "@/env";
import { CareerPlanSchema, type CareerPlan } from "@/lib/schema/result";
import type { ResultsRepository, StoredResult } from "./repository";

/**
 * ローカル開発用の SQLite 実装(better-sqlite3)。
 * ファイル(既定 ./data/dev.sqlite)に保存。本番では使わない
 * (Vercel の Serverless ではローカルファイルが永続しないため。data-model.md §5)。
 *
 * better-sqlite3 はネイティブモジュールなので require で同期ロードする
 * (next.config.ts の serverExternalPackages で外部化済み)。
 */
export class SqliteRepository implements ResultsRepository {
  private db: Database.Database | null = null;

  private getDb(): Database.Database {
    if (this.db) return this.db;
    const path = getEnv().SQLITE_PATH;
    mkdirSync(dirname(path), { recursive: true });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Ctor = require("better-sqlite3") as typeof Database;
    const db = new Ctor(path);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS results (
        id          TEXT PRIMARY KEY,
        plan        TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    this.db = db;
    return db;
  }

  async save(id: string, plan: CareerPlan): Promise<void> {
    const db = this.getDb();
    db.prepare("INSERT INTO results (id, plan) VALUES (?, ?)").run(
      id,
      JSON.stringify(plan),
    );
  }

  async get(id: string): Promise<StoredResult | null> {
    const db = this.getDb();
    const row = db
      .prepare("SELECT id, plan, created_at FROM results WHERE id = ?")
      .get(id) as { id: string; plan: string; created_at: string } | undefined;
    if (!row) return null;

    // 読み出し時にも Zod 再検証(将来のスキーマ変更時の事故検出。data-model.md §2)
    const parsed = CareerPlanSchema.safeParse(JSON.parse(row.plan));
    if (!parsed.success) return null;

    return { id: row.id, plan: parsed.data, createdAt: row.created_at };
  }
}
