import { getEnv } from "@/env";
import { getRateLimitStore } from "./index";
import {
  jstNextMonthStart,
  jstYearMonth,
  windowEndOf,
  windowStartOf,
  type RateLimitStore,
} from "./store";

/**
 * 月次総量上限(2,000 回到達など)に達したことを示すエラー。
 * API ハンドラはこれをキャッチして 503 を返す。
 */
export class MonthlyLimitError extends Error {
  readonly limit: number;
  readonly count: number;
  /** UNIX 秒。Retry-After 等で使う。月初リセット時刻 */
  readonly resetAt: Date;
  constructor(limit: number, count: number, resetAt: Date) {
    super("monthly_limit_exceeded");
    this.name = "MonthlyLimitError";
    this.limit = limit;
    this.count = count;
    this.resetAt = resetAt;
  }
}

/**
 * 短期窓(IP / セッション・時間 / 日)レート制限に達したことを示すエラー。
 * API ハンドラはこれをキャッチして 429 を返す。
 */
export class RateLimitError extends Error {
  readonly scope: "ip" | "session";
  readonly windowKind: "hour" | "day";
  readonly limit: number;
  readonly count: number;
  readonly retryAfterSec: number;
  constructor(args: {
    scope: "ip" | "session";
    windowKind: "hour" | "day";
    limit: number;
    count: number;
    retryAfterSec: number;
  }) {
    super("rate_limit_exceeded");
    this.name = "RateLimitError";
    this.scope = args.scope;
    this.windowKind = args.windowKind;
    this.limit = args.limit;
    this.count = args.count;
    this.retryAfterSec = args.retryAfterSec;
  }
}

interface CheckArgs {
  ip: string;
  sessionId: string;
  /** テスト用に現在時刻を注入できる */
  now?: Date;
  /** テスト用にストアを注入できる(指定なしならファクトリから取得) */
  store?: RateLimitStore;
}

/**
 * 月次・時間・日カウンタをすべて検査し、問題なければ加算する。
 *
 * 仕様(specs §1〜§2):
 *  1. 月次カウンタを先に getMonthlyCount で確認(incr 前)。
 *     `count >= MONTHLY_LIMIT` なら MonthlyLimitError(503 相当)。
 *  2. IP/session × hour/day の 4 カウンタを incr し、
 *     incr 後の値が上限を超えたら RateLimitError(429)。
 *  3. すべて OK なら最後に月次を incr。
 *
 * incr 順序のメモ:
 *  - 短期カウンタを incr → 月次を incr の順にする。
 *    途中で 429 が出た場合、月次は加算しないので「無料枠保護」要件と整合。
 *  - 一方で「月次は上限到達したらそれ以降の incr で count を増やしてしまうが、
 *    503 を返すために incr する必要はない」ので、月次は最後だけ incr する。
 *  - 短期カウンタが超過したリクエスト分も月次にカウントしない(429 が出た時点で
 *    AI 呼び出しは走らないため、コスト的にもカウント不要)。
 */
export async function checkAndConsume(args: CheckArgs): Promise<void> {
  const env = getEnv();
  const monthlyLimit = env.MONTHLY_LIMIT;
  const hourLimit = env.RATE_LIMIT_HOUR;
  const dayLimit = env.RATE_LIMIT_DAY;

  const now = args.now ?? new Date();
  const store = args.store ?? (await getRateLimitStore());

  // --- 1. 月次総量チェック(incr 前に getMonthlyCount で読む) ---
  const ym = jstYearMonth(now);
  const monthlyCount = await store.getMonthlyCount(ym);
  if (monthlyCount >= monthlyLimit) {
    throw new MonthlyLimitError(monthlyLimit, monthlyCount, jstNextMonthStart(now));
  }

  // --- 2. 短期窓チェック(IP / session × hour / day) ---
  const hourStart = windowStartOf(now, "hour");
  const dayStart = windowStartOf(now, "day");

  // 4 カウンタを並列で incr(atomic UPSERT なので race condition は無い)
  const [ipHour, ipDay, sessionHour, sessionDay] = await Promise.all([
    store.incrementCounter("ip", args.ip, "hour", hourStart),
    store.incrementCounter("ip", args.ip, "day", dayStart),
    store.incrementCounter("session", args.sessionId, "hour", hourStart),
    store.incrementCounter("session", args.sessionId, "day", dayStart),
  ]);

  // 超過判定: 「incr 後の値 > 上限」(= 上限を 1 でも超えたら拒否)
  // 例: hourLimit=10 のとき 11 回目で count=11 → 11>10 で 429
  const exceeded: Array<{
    scope: "ip" | "session";
    windowKind: "hour" | "day";
    count: number;
    limit: number;
  }> = [];
  if (ipHour > hourLimit) {
    exceeded.push({ scope: "ip", windowKind: "hour", count: ipHour, limit: hourLimit });
  }
  if (ipDay > dayLimit) {
    exceeded.push({ scope: "ip", windowKind: "day", count: ipDay, limit: dayLimit });
  }
  if (sessionHour > hourLimit) {
    exceeded.push({
      scope: "session",
      windowKind: "hour",
      count: sessionHour,
      limit: hourLimit,
    });
  }
  if (sessionDay > dayLimit) {
    exceeded.push({
      scope: "session",
      windowKind: "day",
      count: sessionDay,
      limit: dayLimit,
    });
  }

  if (exceeded.length > 0) {
    // 複数超過があれば、より長い窓(day を hour より優先)を返して
    // Retry-After をより長く設定する(ユーザーが待つべき時間に揃える)。
    const dayHit = exceeded.find((e) => e.windowKind === "day");
    const pick = dayHit ?? exceeded[0];
    const winStart = pick.windowKind === "hour" ? hourStart : dayStart;
    const winEnd = windowEndOf(winStart, pick.windowKind);
    const retryAfterSec = Math.max(1, Math.ceil((winEnd.getTime() - now.getTime()) / 1000));
    throw new RateLimitError({
      scope: pick.scope,
      windowKind: pick.windowKind,
      limit: pick.limit,
      count: pick.count,
      retryAfterSec,
    });
  }

  // --- 3. すべて OK: 月次を incr して消費を確定 ---
  await store.incrementMonthly(ym);
}
