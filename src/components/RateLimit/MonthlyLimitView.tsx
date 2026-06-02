"use client";

/**
 * 503 — 今月の総量上限(MONTHLY_LIMIT)に到達した時の画面。
 *
 * 表示方針:
 *  - 「今月の利用上限に達しました」
 *  - 「来月 X 月 1 日にリセットされます」(resetAt から JST 年月日を計算)
 *  - 利用状況(count / limit)を併記
 *  - ダーク基調・既存 glow-card / rise アニメーション踏襲
 */
export function MonthlyLimitView({
  limit,
  count,
  resetAt,
}: {
  limit: number;
  count: number;
  /** ISO8601 文字列(API から返ってきた jstNextMonthStart) */
  resetAt: string | null;
}) {
  const resetLabel = resetAt ? formatJstDate(resetAt) : null;
  return (
    <div className="glow-card rounded-3xl p-7 sm:p-10 rise">
      <div className="text-4xl mb-5" aria-hidden="true">
        🛰️
      </div>
      <p className="text-xs font-display tracking-[0.2em] uppercase text-cyan mb-3">
        Monthly limit reached
      </p>
      <h1 className="font-display text-2xl sm:text-3xl font-semibold leading-snug mb-5">
        今月の利用上限に達しました
      </h1>
      <p className="text-mute text-sm sm:text-base leading-relaxed mb-5">
        多くの方にご利用いただいた結果、今月の総量上限に到達しました。
        無料での提供を継続するためのコスト管理として、上限を超えた場合は一時的に
        受付を停止しています。
      </p>
      {resetLabel && (
        <p className="text-ice text-sm sm:text-base leading-relaxed mb-5">
          {resetLabel} 0:00(日本時間)に上限がリセットされます。来月以降に再度お試しください。
        </p>
      )}
      <div className="mt-7 inline-flex items-center gap-3 rounded-2xl border border-line bg-panel/70 px-5 py-3">
        <span className="text-xs tracking-[0.2em] uppercase text-mute font-display">
          Usage
        </span>
        <span className="font-display text-lg font-semibold text-ice">
          {count.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <p className="text-xs text-mute/70 mt-7 leading-relaxed">
        ※ ご不便をおかけして申し訳ありません。回答内容は送信されていません(保存もされていません)。
      </p>
    </div>
  );
}

/**
 * ISO8601(UTC)を JST の "M 月 D 日(曜日)" 表記に整形する。
 * 国際化ライブラリは入れず、自前で JST 換算する。
 */
function formatJstDate(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const m = jst.getUTCMonth() + 1;
  const day = jst.getUTCDate();
  const wd = ["日", "月", "火", "水", "木", "金", "土"][jst.getUTCDay()];
  return `${m} 月 ${day} 日(${wd})`;
}
