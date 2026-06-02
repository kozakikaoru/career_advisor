import { z } from "zod";

/**
 * 環境変数の読み取り・検証。process.env を直接あちこちで読まず、ここに集約する。
 * すべてサーバー側専用(NEXT_PUBLIC_ を付けない)。
 *
 * - AI_PROVIDER=gemini なら GEMINI_API_KEY 必須
 * - DB_PROVIDER=neon なら DATABASE_URL 必須
 * 不足時は分かりやすいエラーで落とす。
 *
 * レート制限関連:
 * - RATE_LIMIT_ENABLED は "true"/"false"/未設定 の 3 値を受け、未設定なら
 *   NODE_ENV=production のときのみオンになる(本番自動オン・dev 自動オフ)。
 * - MONTHLY_LIMIT(default 2000) / RATE_LIMIT_HOUR(default 10) /
 *   RATE_LIMIT_DAY(default 20) は数値文字列。z.coerce.number で受ける。
 */
const EnvSchema = z
  .object({
    AI_PROVIDER: z.enum(["mock", "gemini"]).default("mock"),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().default("gemini-2.5-flash"),

    DB_PROVIDER: z.enum(["sqlite", "neon", "postgres"]).default("sqlite"),
    DATABASE_URL: z.string().optional(),
    SQLITE_PATH: z.string().default("./data/dev.sqlite"),

    APP_BASE_URL: z.string().default("http://localhost:3000"),

    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    // "true" / "false" / 未設定。未設定時は NODE_ENV で決まる(getRateLimitEnabled() で判定)
    RATE_LIMIT_ENABLED: z.enum(["true", "false"]).optional(),
    MONTHLY_LIMIT: z.coerce.number().int().positive().default(2000),
    RATE_LIMIT_HOUR: z.coerce.number().int().positive().default(10),
    RATE_LIMIT_DAY: z.coerce.number().int().positive().default(20),
  })
  .refine((e) => e.AI_PROVIDER !== "gemini" || !!e.GEMINI_API_KEY, {
    message: "AI_PROVIDER=gemini のときは GEMINI_API_KEY が必須です",
    path: ["GEMINI_API_KEY"],
  })
  .refine(
    (e) => (e.DB_PROVIDER !== "neon" && e.DB_PROVIDER !== "postgres") || !!e.DATABASE_URL,
    {
      message: "DB_PROVIDER=neon/postgres のときは DATABASE_URL が必須です",
      path: ["DATABASE_URL"],
    },
  );

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

/** 検証済みの環境変数を返す(初回のみ検証してキャッシュ) */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`);
    throw new Error(`環境変数の設定に問題があります:\n${issues.join("\n")}`);
  }
  cached = parsed.data;
  return cached;
}

/**
 * レート制限を有効化するか判定する。
 * 優先順位:
 *   1. RATE_LIMIT_ENABLED が明示されていればそれを尊重("true" → 有効 / "false" → 無効)
 *   2. 未設定なら NODE_ENV=production のときのみ有効
 *
 * 障害対応で本番でも一時無効化したいとき: RATE_LIMIT_ENABLED=false
 * dev で検証したいとき: RATE_LIMIT_ENABLED=true
 */
export function getRateLimitEnabled(): boolean {
  const env = getEnv();
  if (env.RATE_LIMIT_ENABLED === "true") return true;
  if (env.RATE_LIMIT_ENABLED === "false") return false;
  return env.NODE_ENV === "production";
}

/** テスト用: getEnv のキャッシュをクリアする(本番では使わない) */
export function _resetEnvCacheForTesting(): void {
  cached = null;
}
