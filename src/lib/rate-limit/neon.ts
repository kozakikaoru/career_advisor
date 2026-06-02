import { neon } from "@neondatabase/serverless";
import { getEnv } from "@/env";
import type {
  RateLimitScope,
  RateLimitStore,
  RateLimitWindow,
} from "./store";

/**
 * Neon(Postgres)実装。本番用。
 *
 * Postgres でも UPSERT(INSERT ... ON CONFLICT DO UPDATE)+ RETURNING で
 * atomic な incr が可能。@neondatabase/serverless は HTTP ベースなので
 * scale-to-zero からも自動復帰する。
 *
 * results テーブルとは別に rate_limit_counters / monthly_usage を初回作成。
 */
export class NeonRateLimitStore implements RateLimitStore {
  private sql = neon(getEnv().DATABASE_URL!);
  private ensured = false;

  private async ensureTables(): Promise<void> {
    if (this.ensured) return;
    await this.sql`
      CREATE TABLE IF NOT EXISTS rate_limit_counters (
        id           BIGSERIAL PRIMARY KEY,
        scope        TEXT      NOT NULL,
        scope_value  TEXT      NOT NULL,
        window_kind  TEXT      NOT NULL,
        window_start TIMESTAMPTZ NOT NULL,
        count        INTEGER   NOT NULL DEFAULT 0,
        UNIQUE (scope, scope_value, window_kind, window_start)
      )
    `;
    await this.sql`
      CREATE INDEX IF NOT EXISTS idx_rlc_lookup
        ON rate_limit_counters (scope, scope_value, window_kind, window_start)
    `;
    await this.sql`
      CREATE INDEX IF NOT EXISTS idx_rlc_cleanup
        ON rate_limit_counters (window_kind, window_start)
    `;
    await this.sql`
      CREATE TABLE IF NOT EXISTS monthly_usage (
        year_month TEXT    PRIMARY KEY,
        count      INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    this.ensured = true;
  }

  async incrementCounter(
    scope: RateLimitScope,
    scopeValue: string,
    windowKind: RateLimitWindow,
    windowStart: Date,
  ): Promise<number> {
    await this.ensureTables();
    const iso = windowStart.toISOString();
    const rows = (await this.sql`
      INSERT INTO rate_limit_counters (scope, scope_value, window_kind, window_start, count)
      VALUES (${scope}, ${scopeValue}, ${windowKind}, ${iso}, 1)
      ON CONFLICT (scope, scope_value, window_kind, window_start)
      DO UPDATE SET count = rate_limit_counters.count + 1
      RETURNING count
    `) as Array<{ count: number }>;
    return rows[0]?.count ?? 1;
  }

  async incrementMonthly(yearMonth: string): Promise<number> {
    await this.ensureTables();
    const rows = (await this.sql`
      INSERT INTO monthly_usage (year_month, count, updated_at)
      VALUES (${yearMonth}, 1, now())
      ON CONFLICT (year_month)
      DO UPDATE SET count = monthly_usage.count + 1, updated_at = now()
      RETURNING count
    `) as Array<{ count: number }>;
    return rows[0]?.count ?? 1;
  }

  async getMonthlyCount(yearMonth: string): Promise<number> {
    await this.ensureTables();
    const rows = (await this.sql`
      SELECT count FROM monthly_usage WHERE year_month = ${yearMonth}
    `) as Array<{ count: number }>;
    return rows[0]?.count ?? 0;
  }

  async cleanup(now: Date = new Date()): Promise<void> {
    await this.ensureTables();
    const hourCutoff = new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString();
    const dayCutoff = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    await this.sql`
      DELETE FROM rate_limit_counters
      WHERE window_kind = 'hour' AND window_start < ${hourCutoff}
    `;
    await this.sql`
      DELETE FROM rate_limit_counters
      WHERE window_kind = 'day' AND window_start < ${dayCutoff}
    `;
  }
}
