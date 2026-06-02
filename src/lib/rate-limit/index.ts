import { getEnv } from "@/env";
import type { RateLimitStore } from "./store";

let cached: RateLimitStore | null = null;

/**
 * 環境変数 DB_PROVIDER で実装を選ぶファクトリ(ResultsRepository と同じ方式)。
 *
 * sqlite 運用時に Neon ドライバを巻き込まないよう動的 import を使う。
 */
export async function getRateLimitStore(): Promise<RateLimitStore> {
  if (cached) return cached;
  const provider = getEnv().DB_PROVIDER;
  switch (provider) {
    case "neon":
    case "postgres": {
      const { NeonRateLimitStore } = await import("./neon");
      cached = new NeonRateLimitStore();
      break;
    }
    case "sqlite":
    default: {
      const { SqliteRateLimitStore } = await import("./sqlite");
      cached = new SqliteRateLimitStore();
      break;
    }
  }
  return cached;
}

/** テスト用: ファクトリ・キャッシュをリセット */
export function _resetRateLimitStoreCacheForTesting(): void {
  cached = null;
}

export type {
  RateLimitStore,
  RateLimitScope,
  RateLimitWindow,
} from "./store";
export {
  windowStartOf,
  windowEndOf,
  jstYearMonth,
  jstNextMonthStart,
} from "./store";
export { checkAndConsume, MonthlyLimitError, RateLimitError } from "./limiter";
export { resolveSession, resolveClientIp } from "./session";
