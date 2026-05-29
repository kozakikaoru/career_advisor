import { neon } from "@neondatabase/serverless";
import { getEnv } from "@/env";
import { CareerPlanSchema, type CareerPlan } from "@/lib/schema/result";
import type { ResultsRepository, StoredResult } from "./repository";

/**
 * 本番用の Neon(Postgres)実装。@neondatabase/serverless は HTTP/エッジ対応で
 * scale-to-zero からも自動復帰する(data-model.md §5)。
 *
 * results テーブルは事前に用意しておく(初回 save 時にも CREATE IF NOT EXISTS を試みる)。
 *   CREATE TABLE IF NOT EXISTS results (
 *     id TEXT PRIMARY KEY,
 *     plan JSONB NOT NULL,
 *     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
 *   );
 */
export class NeonRepository implements ResultsRepository {
  private sql = neon(getEnv().DATABASE_URL!);
  private ensured = false;

  private async ensureTable(): Promise<void> {
    if (this.ensured) return;
    await this.sql`
      CREATE TABLE IF NOT EXISTS results (
        id          TEXT PRIMARY KEY,
        plan        JSONB NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    this.ensured = true;
  }

  async save(id: string, plan: CareerPlan): Promise<void> {
    await this.ensureTable();
    await this.sql`
      INSERT INTO results (id, plan) VALUES (${id}, ${JSON.stringify(plan)}::jsonb)
    `;
  }

  async get(id: string): Promise<StoredResult | null> {
    await this.ensureTable();
    const rows = (await this.sql`
      SELECT id, plan, created_at FROM results WHERE id = ${id}
    `) as Array<{ id: string; plan: unknown; created_at: string | Date }>;
    const row = rows[0];
    if (!row) return null;

    const parsed = CareerPlanSchema.safeParse(row.plan);
    if (!parsed.success) return null;

    const createdAt =
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at);
    return { id: row.id, plan: parsed.data, createdAt };
  }
}
