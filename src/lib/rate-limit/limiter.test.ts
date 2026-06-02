import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkAndConsume,
  MonthlyLimitError,
  RateLimitError,
} from "./limiter";
import { SqliteRateLimitStore } from "./sqlite";
import { _resetEnvCacheForTesting } from "@/env";

/**
 * limiter のシナリオテスト。
 *
 * テスト戦略:
 *  - 実際の SQLite に書き込んで動作確認(in-memory ではない一時ファイル)。
 *  - checkAndConsume に store と now を注入できるので、env キャッシュは
 *    MONTHLY_LIMIT / RATE_LIMIT_HOUR / RATE_LIMIT_DAY を変更したいときに
 *    都度リセットする。
 *  - 1 時間/1 日経過は now を変えるだけで再現できる(window_start が変わる)。
 *
 * 注意: NODE_ENV / RATE_LIMIT_ENABLED の挙動(env 側)は env.test.ts と
 * limiter の「無効化時はスキップ」のフロー側に分けてテストする。
 */

const ORIGINAL_ENV = { ...process.env };
let tmpDir: string;
let store: SqliteRateLimitStore;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "rate-limit-test-"));
  process.env = { ...ORIGINAL_ENV };
  // 小さい値で 11 回目に 429 / 21 回目に 429(1 日)を確認できるよう揃える
  process.env.MONTHLY_LIMIT = "2000";
  process.env.RATE_LIMIT_HOUR = "10";
  process.env.RATE_LIMIT_DAY = "20";
  _resetEnvCacheForTesting();
  store = new SqliteRateLimitStore({ dbPath: join(tmpDir, "rl.sqlite") });
});

afterEach(() => {
  store.close();
  rmSync(tmpDir, { recursive: true, force: true });
  process.env = { ...ORIGINAL_ENV };
  _resetEnvCacheForTesting();
});

describe("checkAndConsume — IP 時間窓", () => {
  it("同一 IP で 11 回目に 429(RateLimitError)", async () => {
    const ip = "1.1.1.1";
    const now = new Date("2026-06-02T10:00:00.000Z");
    // 10 回はパス
    for (let i = 0; i < 10; i++) {
      await checkAndConsume({
        ip,
        sessionId: `s${i}-aaaaaaaaaaaaaaaaaa`, // 21 char 各回別セッション
        now,
        store,
      });
    }
    // 11 回目は同 IP の hour カウンタが 11 になり 429
    await expect(
      checkAndConsume({
        ip,
        sessionId: "s11-aaaaaaaaaaaaaaaaaaaa",
        now,
        store,
      }),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it("1 時間経過で IP 時間カウンタがリセット(11 回目相当が通る)", async () => {
    const ip = "1.1.1.1";
    const t0 = new Date("2026-06-02T10:00:00.000Z");
    for (let i = 0; i < 10; i++) {
      await checkAndConsume({
        ip,
        sessionId: `s${i}-bbbbbbbbbbbbbbbbbb`,
        now: t0,
        store,
      });
    }
    // 1 時間 1 分後
    const t1 = new Date("2026-06-02T11:01:00.000Z");
    // 同 IP の 11 回目相当でも別 hour 窓なら通る(day カウンタは 11 でまだ 20 以内)
    await expect(
      checkAndConsume({
        ip,
        sessionId: "s11-bbbbbbbbbbbbbbbbbbbb",
        now: t1,
        store,
      }),
    ).resolves.toBeUndefined();
  });
});

describe("checkAndConsume — IP 日窓", () => {
  it("IP 1 日 21 回目に 429(day カウンタが先に上限)", async () => {
    const ip = "2.2.2.2";
    // 別時間に分散して hour 上限は避けつつ 20 回消費
    for (let i = 0; i < 20; i++) {
      const t = new Date(`2026-06-02T${String(i % 20).padStart(2, "0")}:30:00.000Z`);
      await checkAndConsume({
        ip,
        sessionId: `d${i}-cccccccccccccccccc`,
        now: t,
        store,
      });
    }
    // 21 回目: 別 hour 窓で hour カウンタはセーフだが day カウンタ 21 で NG
    const t21 = new Date("2026-06-02T22:00:00.000Z");
    await expect(
      checkAndConsume({
        ip,
        sessionId: "d21-cccccccccccccccccccc",
        now: t21,
        store,
      }),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it("1 日経過で IP 日カウンタがリセット", async () => {
    const ip = "2.2.2.2";
    for (let i = 0; i < 20; i++) {
      const t = new Date(`2026-06-02T${String(i % 20).padStart(2, "0")}:30:00.000Z`);
      await checkAndConsume({
        ip,
        sessionId: `e${i}-dddddddddddddddddd`,
        now: t,
        store,
      });
    }
    const tNext = new Date("2026-06-03T01:00:00.000Z");
    await expect(
      checkAndConsume({
        ip,
        sessionId: "eNext-dddddddddddddddd",
        now: tNext,
        store,
      }),
    ).resolves.toBeUndefined();
  });
});

describe("checkAndConsume — セッション窓", () => {
  it("同一セッションで 11 回目に 429", async () => {
    const sessionId = "session-abcdefghijklmno"; // 21 char
    const now = new Date("2026-06-02T10:00:00.000Z");
    for (let i = 0; i < 10; i++) {
      await checkAndConsume({
        ip: `10.0.0.${i + 1}`, // 各回別 IP で IP 制限は回避
        sessionId,
        now,
        store,
      });
    }
    await expect(
      checkAndConsume({ ip: "10.0.0.99", sessionId, now, store }),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it("同一セッション 1 日 21 回目に 429", async () => {
    const sessionId = "session-day-bbbbbbbbb"; // 21 char
    for (let i = 0; i < 20; i++) {
      const t = new Date(`2026-06-02T${String(i % 20).padStart(2, "0")}:30:00.000Z`);
      await checkAndConsume({
        ip: `10.1.0.${i + 1}`,
        sessionId,
        now: t,
        store,
      });
    }
    const t21 = new Date("2026-06-02T22:30:00.000Z");
    await expect(
      checkAndConsume({
        ip: "10.1.0.99",
        sessionId,
        now: t21,
        store,
      }),
    ).rejects.toBeInstanceOf(RateLimitError);
  });
});

describe("checkAndConsume — 月次上限", () => {
  beforeEach(() => {
    // テスト時間短縮のため月次上限を 5 に下げる
    process.env.MONTHLY_LIMIT = "5";
    _resetEnvCacheForTesting();
  });

  it("月次 limit+1 回目で 503(MonthlyLimitError)", async () => {
    const now = new Date("2026-06-02T10:00:00.000Z");
    for (let i = 0; i < 5; i++) {
      await checkAndConsume({
        ip: `3.0.0.${i + 1}`,
        sessionId: `m${i}-eeeeeeeeeeeeeeeeee`,
        now,
        store,
      });
    }
    // 6 回目は MonthlyLimitError
    await expect(
      checkAndConsume({
        ip: "3.0.0.99",
        sessionId: "m6-eeeeeeeeeeeeeeeeeeee",
        now,
        store,
      }),
    ).rejects.toBeInstanceOf(MonthlyLimitError);
  });

  it("月跨ぎ(JST 月初)で月次カウンタがリセット", async () => {
    const tJun = new Date("2026-06-15T05:00:00.000Z");
    for (let i = 0; i < 5; i++) {
      await checkAndConsume({
        ip: `3.1.0.${i + 1}`,
        sessionId: `j${i}-ffffffffffffffffff`,
        now: tJun,
        store,
      });
    }
    // 6 月内は 503
    await expect(
      checkAndConsume({
        ip: "3.1.0.99",
        sessionId: "j-jun-ffffffffffffffffff",
        now: tJun,
        store,
      }),
    ).rejects.toBeInstanceOf(MonthlyLimitError);

    // 7 月 1 日 JST(= 6/30 15:00 UTC)以降は別 yearMonth キー
    const tJul = new Date("2026-07-01T00:00:00.000Z"); // JST 7/1 09:00
    await expect(
      checkAndConsume({
        ip: "3.1.1.1",
        sessionId: "j-jul-ggggggggggggggggggg",
        now: tJul,
        store,
      }),
    ).resolves.toBeUndefined();
  });
});

describe("RateLimitError の retryAfterSec", () => {
  it("hour 超過時は窓終端までの秒数(<= 3600)を返す", async () => {
    const ip = "4.4.4.4";
    const now = new Date("2026-06-02T10:30:00.000Z");
    for (let i = 0; i < 10; i++) {
      await checkAndConsume({
        ip,
        sessionId: `r${i}-hhhhhhhhhhhhhhhhhh`,
        now,
        store,
      });
    }
    try {
      await checkAndConsume({
        ip,
        sessionId: "r11-hhhhhhhhhhhhhhhhhhhh",
        now,
        store,
      });
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(RateLimitError);
      const re = e as RateLimitError;
      // 10:30 → 11:00 まで 30 分 = 1800 秒
      expect(re.retryAfterSec).toBeGreaterThan(0);
      expect(re.retryAfterSec).toBeLessThanOrEqual(3600);
      expect(re.retryAfterSec).toBe(1800);
    }
  });

  it("day 超過時は day 窓終端を優先(hour より長い時間を返す)", async () => {
    const ip = "5.5.5.5";
    // hour と day を両方上限超過させる: 同一時間に 21 回打つと両方超過するが、
    // hour が先に超過するので、hour と day を分けて検証する。ここでは day 単独超過。
    for (let i = 0; i < 20; i++) {
      const t = new Date(`2026-06-02T${String(i % 20).padStart(2, "0")}:30:00.000Z`);
      await checkAndConsume({
        ip,
        sessionId: `dh${i}-iiiiiiiiiiiiiiiii`,
        now: t,
        store,
      });
    }
    const t21 = new Date("2026-06-02T22:00:00.000Z");
    try {
      await checkAndConsume({
        ip,
        sessionId: "dh21-iiiiiiiiiiiiiiiiiii",
        now: t21,
        store,
      });
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(RateLimitError);
      const re = e as RateLimitError;
      expect(re.windowKind).toBe("day");
      // 22:00 → 24:00 = 7200 秒
      expect(re.retryAfterSec).toBe(7200);
    }
  });
});
