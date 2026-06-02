import { describe, it, expect } from "vitest";
import {
  jstNextMonthStart,
  jstYearMonth,
  windowEndOf,
  windowStartOf,
} from "./store";

/**
 * store.ts のヘルパ純関数のテスト(時間窓計算 / JST 換算)。
 * I/O を伴う実装(sqlite.ts)は limiter.test.ts 側で組み合わせて検証する。
 */
describe("windowStartOf", () => {
  it("hour 窓: 分秒ミリ秒を 0 にする", () => {
    const now = new Date("2026-06-02T14:37:42.123Z");
    const start = windowStartOf(now, "hour");
    expect(start.toISOString()).toBe("2026-06-02T14:00:00.000Z");
  });
  it("day 窓: 時分秒ミリ秒を 0 にする(UTC 揃え)", () => {
    const now = new Date("2026-06-02T14:37:42.123Z");
    const start = windowStartOf(now, "day");
    expect(start.toISOString()).toBe("2026-06-02T00:00:00.000Z");
  });
});

describe("windowEndOf", () => {
  it("hour 窓: +1 時間", () => {
    const start = new Date("2026-06-02T14:00:00.000Z");
    expect(windowEndOf(start, "hour").toISOString()).toBe(
      "2026-06-02T15:00:00.000Z",
    );
  });
  it("day 窓: +1 日", () => {
    const start = new Date("2026-06-02T00:00:00.000Z");
    expect(windowEndOf(start, "day").toISOString()).toBe(
      "2026-06-03T00:00:00.000Z",
    );
  });
});

describe("jstYearMonth", () => {
  it("JST 月初(00:00)では当月扱い", () => {
    // 2026-06-01 00:00 JST = 2026-05-31 15:00 UTC
    const utc = new Date("2026-05-31T15:00:00.000Z");
    expect(jstYearMonth(utc)).toBe("2026-06");
  });
  it("JST 月末(23:59)では当月扱い(翌月にならない)", () => {
    // 2026-06-30 23:59 JST = 2026-06-30 14:59 UTC
    const utc = new Date("2026-06-30T14:59:00.000Z");
    expect(jstYearMonth(utc)).toBe("2026-06");
  });
  it("UTC 月初でも JST 上で前月なら前月を返す", () => {
    // 2026-07-01 00:00 UTC = 2026-07-01 09:00 JST(翌月)
    const utc = new Date("2026-07-01T00:00:00.000Z");
    expect(jstYearMonth(utc)).toBe("2026-07");
    // 2026-06-30 23:00 UTC = 2026-07-01 08:00 JST(翌月)
    const utc2 = new Date("2026-06-30T23:00:00.000Z");
    expect(jstYearMonth(utc2)).toBe("2026-07");
  });
  it("年跨ぎ: JST 1 月 1 日 00:00 は当年 1 月", () => {
    const utc = new Date("2026-12-31T15:00:00.000Z");
    expect(jstYearMonth(utc)).toBe("2027-01");
  });
});

describe("jstNextMonthStart", () => {
  it("月中: 翌月 1 日 00:00 JST(= 前日 15:00 UTC)", () => {
    const utc = new Date("2026-06-15T05:00:00.000Z");
    const next = jstNextMonthStart(utc);
    // 2026-07-01 00:00 JST = 2026-06-30 15:00 UTC
    expect(next.toISOString()).toBe("2026-06-30T15:00:00.000Z");
  });
  it("年跨ぎ: 12 月 → 翌年 1 月", () => {
    const utc = new Date("2026-12-20T05:00:00.000Z");
    const next = jstNextMonthStart(utc);
    // 2027-01-01 00:00 JST = 2026-12-31 15:00 UTC
    expect(next.toISOString()).toBe("2026-12-31T15:00:00.000Z");
  });
});
