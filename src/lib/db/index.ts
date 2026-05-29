import { getEnv } from "@/env";
import type { ResultsRepository } from "./repository";

let cached: ResultsRepository | null = null;

/**
 * 環境変数 DB_PROVIDER で実装を選ぶファクトリ。
 * 呼び出し側は具体実装(SQLite/Neon)を知らない。
 * neon/postgres の実装は動的 import で遅延ロードし、sqlite 運用時に
 * Postgres ドライバを巻き込まないようにする。
 */
export async function getRepository(): Promise<ResultsRepository> {
  if (cached) return cached;

  const provider = getEnv().DB_PROVIDER;
  switch (provider) {
    case "neon":
    case "postgres": {
      const { NeonRepository } = await import("./neon");
      cached = new NeonRepository();
      break;
    }
    case "sqlite":
    default: {
      const { SqliteRepository } = await import("./sqlite");
      cached = new SqliteRepository();
      break;
    }
  }
  return cached;
}

export type { ResultsRepository, StoredResult } from "./repository";
