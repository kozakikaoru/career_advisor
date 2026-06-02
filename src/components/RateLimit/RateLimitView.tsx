"use client";

import { useEffect, useState } from "react";

/**
 * 429 — IP / セッション の短期窓レート制限に到達した時の画面。
 *
 * 表示方針:
 *  - 「短時間に多くのリクエストがありました」
 *  - 「N 分後に再度お試しください」(Retry-After ヘッダの値からカウントダウン)
 *  - ダーク基調・既存 glow-card / rise アニメーション踏襲
 *
 * 残時間は 1 秒ごとに減算表示する(秒→分表記に丸める)。
 *
 * `retryAfterSec` が変わったら親側で `key={retryAfterSec}` を渡して
 * 再マウントしてもらう想定(React 19 の推奨パターン・effect 内で
 * setState する形は ESLint react-hooks/set-state-in-effect で禁止)。
 */
export function RateLimitView({
  retryAfterSec,
  onRetry,
}: {
  retryAfterSec: number;
  /** カウントダウン 0 で表示する「もう一度試す」ボタン用 */
  onRetry?: () => void;
}) {
  // 初期値だけ retryAfterSec を採用。以後は useEffect の interval で減算する。
  // retryAfterSec が変わった場合は親が key={retryAfterSec} で再マウントする。
  const [remaining, setRemaining] = useState(retryAfterSec);

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [remaining]);

  const label = formatRemaining(remaining);

  return (
    <div className="glow-card rounded-3xl p-7 sm:p-10 rise">
      <div className="text-4xl mb-5" aria-hidden="true">
        ⏳
      </div>
      <p className="text-xs font-display tracking-[0.2em] uppercase text-cyan mb-3">
        Too many requests
      </p>
      <h1 className="font-display text-2xl sm:text-3xl font-semibold leading-snug mb-5">
        しばらく時間を置いてから再度お試しください
      </h1>
      <p className="text-mute text-sm sm:text-base leading-relaxed mb-5">
        短時間に多くのリクエストを検出しました。
        無料での提供を継続するためのコスト管理として、一時的に受付を停止しています。
      </p>
      <div className="mt-2 inline-flex items-center gap-3 rounded-2xl border border-line bg-panel/70 px-5 py-3">
        <span className="text-xs tracking-[0.2em] uppercase text-mute font-display">
          Retry in
        </span>
        <span
          className="font-display text-lg font-semibold text-ice tabular-nums"
          aria-live="polite"
        >
          {label}
        </span>
      </div>
      {remaining <= 0 && onRetry && (
        <div className="mt-7">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan to-violet text-bg font-bold rounded-full px-7 py-3.5 hover:scale-105 transition glow-ring"
          >
            もう一度試す
          </button>
        </div>
      )}
      <p className="text-xs text-mute/70 mt-7 leading-relaxed">
        ※ 回答内容は送信されていません。時間を置いて再度お試しください。
      </p>
    </div>
  );
}

/**
 * 残り秒数を「N 分 M 秒」(60 秒未満なら「N 秒」)に整形する。
 */
function formatRemaining(sec: number): string {
  if (sec <= 0) return "再試行できます";
  if (sec < 60) return `${sec} 秒`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (s === 0) return `${m} 分`;
  return `${m} 分 ${s.toString().padStart(2, "0")} 秒`;
}
