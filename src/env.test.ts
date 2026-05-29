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
