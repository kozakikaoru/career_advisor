/**
 * レート制限ストアの抽象 IF。
 * ResultsRepository と同じ「DB プロバイダ依存を呼び出し側に持ち込ませない」方針。
 *
 * 設計方針:
 *  - カウンタは「単純な incrementCounter(key, windowSec)」抽象ではなく、
 *    IP / セッション × 時間 / 日 の組合せが小数のため、明示的に
 *    `(scope, scopeValue, windowKind, windowStart)` の 4 つ組で管理する。
 *  - これにより集計クエリは PK ヒットで定数時間、cleanup も windowKind と
 *    時刻で範囲削除できる。
 *  - 月次は別テーブル(year_month を PK)。
 *  - atomic な incr は SQLite/Postgres どちらも UPSERT + RETURNING で実装可能。
 *
 * すべての時刻は UTC でやり取りする(JST 月初判定は上位で行う)。
 */

export type RateLimitScope = "ip" | "session";
export type RateLimitWindow = "hour" | "day";

/**
 * 抽象ストア。実装は SQLite / Neon の 2 つ。
 */
export interface RateLimitStore {
  /**
   * (scope, scopeValue, windowKind, windowStart) のカウンタを atomic に +1 し、
   * 加算後の現在値を返す。
   *
   * windowStart は「その窓の開始時刻(UTC)」を渡す(時間窓なら時刻の分秒を 0 にした時刻、
   * 日窓なら時刻の時分秒を 0 にした時刻)。上位で計算してから渡す。
   */
  incrementCounter(
    scope: RateLimitScope,
    scopeValue: string,
    windowKind: RateLimitWindow,
    windowStart: Date,
  ): Promise<number>;

  /**
   * 月次カウンタを atomic に +1 し、加算後の現在値を返す。
   * yearMonth は "YYYY-MM" 形式(JST 月初リセットの key)。
   */
  incrementMonthly(yearMonth: string): Promise<number>;

  /**
   * 月次カウンタの現在値を返す(なければ 0)。
   * 上限到達判定で「incr する前」に読み取る用途。
   */
  getMonthlyCount(yearMonth: string): Promise<number>;

  /**
   * 古い行を削除する(運用で呼ぶ前提)。
   *  - hour 窓: 25 時間より前を削除
   *  - day 窓: 2 日より前を削除
   *  - 月次は残す(履歴として保持)
   */
  cleanup(now?: Date): Promise<void>;
}

/**
 * 時間窓・日窓の「開始時刻(UTC)」を計算するヘルパ。
 *
 * - hour: その時刻の分秒ミリ秒を 0 にした UTC 時刻
 * - day:  その時刻を UTC の 00:00:00 に揃えた時刻
 *
 * JST 換算は月次のみ。短期窓(1h/24h)は UTC 揃えで実害なし(タイムゾーン跨ぎの
 * 境界で多少のズレがあっても "1 時間以内に N 回" のスコープは保たれる)。
 */
export function windowStartOf(now: Date, windowKind: RateLimitWindow): Date {
  const d = new Date(now);
  d.setUTCMilliseconds(0);
  d.setUTCSeconds(0);
  d.setUTCMinutes(0);
  if (windowKind === "day") {
    d.setUTCHours(0);
  }
  return d;
}

/**
 * JST 月初 "YYYY-MM" を返す(月次カウンタの key 用)。
 * 月初判定は Asia/Tokyo(UTC+9)固定で行う。
 */
export function jstYearMonth(now: Date): string {
  // UTC 時刻に +9h して JST 上の日時を計算
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = (jst.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * 次の月初(JST 1 日 00:00)を UTC Date で返す。
 * 503 画面で「来月 X 月 1 日にリセット」を表示するために使う。
 */
export function jstNextMonthStart(now: Date): Date {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth(); // 0-11
  // 翌月の 1 日 00:00 JST
  const nextJstY = m === 11 ? y + 1 : y;
  const nextJstM = m === 11 ? 0 : m + 1;
  // JST 1 日 00:00 を UTC に直すと前日 15:00
  return new Date(Date.UTC(nextJstY, nextJstM, 1, -9, 0, 0));
}

/**
 * 窓の終了時刻(次の窓の開始時刻)を返す。429 の Retry-After 計算に使う。
 */
export function windowEndOf(windowStart: Date, windowKind: RateLimitWindow): Date {
  const d = new Date(windowStart);
  if (windowKind === "hour") {
    d.setUTCHours(d.getUTCHours() + 1);
  } else {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}
