import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * env の検証(gemini なら GEMINI_API_KEY 必須 / neon なら DATABASE_URL 必須)。
 * getEnv() は結果をモジュールスコープにキャッシュするため、各テストで
 * モジュールキャッシュをリセットして env.ts を読み直す。
 */
const ORIGINAL = { ...process.env };

async function freshGetEnv() {
  vi.resetModules();
  const mod = await import("./env");
  return mod.getEnv;
}

beforeEach(() => {
  // 関連 env をクリア
  delete process.env.AI_PROVIDER;
  delete process.env.GEMINI_API_KEY;
  delete process.env.DB_PROVIDER;
  delete process.env.DATABASE_URL;
  delete process.env.RATE_LIMIT_ENABLED;
  delete process.env.MONTHLY_LIMIT;
  delete process.env.RATE_LIMIT_HOUR;
  delete process.env.RATE_LIMIT_DAY;
  // NODE_ENV は read-only 型なので unknown 経由でアクセス
  delete (process.env as Record<string, string | undefined>).NODE_ENV;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("getEnv 環境変数の検証", () => {
  it("既定は mock + sqlite", async () => {
    const getEnv = await freshGetEnv();
    const env = getEnv();
    expect(env.AI_PROVIDER).toBe("mock");
    expect(env.DB_PROVIDER).toBe("sqlite");
  });

  it("AI_PROVIDER=gemini で GEMINI_API_KEY が無いと例外", async () => {
    process.env.AI_PROVIDER = "gemini";
    const getEnv = await freshGetEnv();
    expect(() => getEnv()).toThrow(/GEMINI_API_KEY/);
  });

  it("AI_PROVIDER=gemini + キーあり なら通る", async () => {
    process.env.AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-key";
    const getEnv = await freshGetEnv();
    expect(getEnv().AI_PROVIDER).toBe("gemini");
  });

  it("DB_PROVIDER=neon で DATABASE_URL が無いと例外", async () => {
    process.env.DB_PROVIDER = "neon";
    const getEnv = await freshGetEnv();
    expect(() => getEnv()).toThrow(/DATABASE_URL/);
  });

  it("DB_PROVIDER=neon + URLあり なら通る", async () => {
    process.env.DB_PROVIDER = "neon";
    process.env.DATABASE_URL = "postgres://example";
    const getEnv = await freshGetEnv();
    expect(getEnv().DB_PROVIDER).toBe("neon");
  });
});

describe("レート制限関連の env", () => {
  it("既定値: MONTHLY_LIMIT=2000 / hour=10 / day=20", async () => {
    const getEnv = await freshGetEnv();
    const env = getEnv();
    expect(env.MONTHLY_LIMIT).toBe(2000);
    expect(env.RATE_LIMIT_HOUR).toBe(10);
    expect(env.RATE_LIMIT_DAY).toBe(20);
  });

  it("MONTHLY_LIMIT などの数値文字列が coerce される", async () => {
    process.env.MONTHLY_LIMIT = "100";
    process.env.RATE_LIMIT_HOUR = "5";
    process.env.RATE_LIMIT_DAY = "30";
    const getEnv = await freshGetEnv();
    const env = getEnv();
    expect(env.MONTHLY_LIMIT).toBe(100);
    expect(env.RATE_LIMIT_HOUR).toBe(5);
    expect(env.RATE_LIMIT_DAY).toBe(30);
  });

  it("MONTHLY_LIMIT=0 や負値は弾く", async () => {
    process.env.MONTHLY_LIMIT = "0";
    const getEnv = await freshGetEnv();
    expect(() => getEnv()).toThrow();
  });

  it("getRateLimitEnabled: NODE_ENV=production で既定オン", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    vi.resetModules();
    const { getRateLimitEnabled } = await import("./env");
    expect(getRateLimitEnabled()).toBe(true);
  });

  it("getRateLimitEnabled: NODE_ENV=development で既定オフ", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    vi.resetModules();
    const { getRateLimitEnabled } = await import("./env");
    expect(getRateLimitEnabled()).toBe(false);
  });

  it("getRateLimitEnabled: RATE_LIMIT_ENABLED=false で本番でも強制オフ", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.RATE_LIMIT_ENABLED = "false";
    vi.resetModules();
    const { getRateLimitEnabled } = await import("./env");
    expect(getRateLimitEnabled()).toBe(false);
  });

  it("getRateLimitEnabled: RATE_LIMIT_ENABLED=true で dev でも強制オン", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    process.env.RATE_LIMIT_ENABLED = "true";
    vi.resetModules();
    const { getRateLimitEnabled } = await import("./env");
    expect(getRateLimitEnabled()).toBe(true);
  });
});
