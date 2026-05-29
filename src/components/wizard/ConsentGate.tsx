"use client";

import { useState, type KeyboardEvent } from "react";
import Link from "next/link";

/** 開始前の同意ゲート。チェックを入れないと「同意して始める」を押せない(security 要件)。 */
export function ConsentGate({ onConsent }: { onConsent: () => void }) {
  const [checked, setChecked] = useState(false);

  // iOS Safari の <label>→内包 <input type="checkbox"> のクリック委譲は、
  // 端末/バージョン/レイアウトの組合せで不安定に発火しないことがある(過去の修正で
  // input をその場配置にしても再発)。さらに label 内に target="_blank" の <Link> が
  // あると、Safari がそのアンカーをタップ対象とみなして委譲が抑制されるケースがある。
  //
  // 解決: <label>/<input> 構造を捨て、ラッパー <div> 自身を role="checkbox" な
  // クリッカブル要素にして React state を直接トグルする。これで label 委譲問題に
  // 依存しない。内部の <Link>(規約/PP)には stopPropagation を付けて、リンクを
  // タップしてもチェック状態が変わらないようにする(規約を読みたいだけのユーザー保護)。
  function toggle() {
    setChecked((v) => !v);
  }
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      toggle();
    }
  }

  return (
    <div className="glow-card rounded-3xl p-7 sm:p-10 rise">
      <p className="text-xs font-display tracking-[0.2em] uppercase text-cyan mb-3">
        はじめる前に
      </p>
      <h1 className="text-2xl sm:text-3xl font-semibold leading-snug mb-5">
        診断を始める前に、ご確認ください
      </h1>

      <div className="space-y-4 text-sm text-mute leading-relaxed mb-7">
        <p>
          入力内容は進路プランを生成するため、AI(Gemini API 等の外部サービス)に送信されます。
          氏名・連絡先・健康情報・他人の個人情報など、<span className="text-ice">機微なことは入力しないでください</span>。
        </p>
        <p>
          入力した回答そのものは保存しません。生成された結果のみを匿名で保存し、
          推測されにくいURLを発行します。URLを控えておけば、あとから・別の端末でも結果を開けます。
        </p>
        <p className="text-xs text-mute/80">
          ※ 生成される進路プランは AI による参考情報です。内容の正確性・実現可能性を保証するものではありません。
        </p>
      </div>

      {/*
        role="checkbox" の div をクリッカブルに。label/input には依存しない。
        - 装飾 span は pointer-events-none(タップは必ずラッパーに当たる)
        - 内部の <Link> は stopPropagation でラッパーの onClick を発火させない
        - Space/Enter キーでもトグル(キーボードA11y)
      */}
      <div
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onClick={toggle}
        onKeyDown={onKeyDown}
        className="flex items-start gap-3 cursor-pointer mb-7 select-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <span
          aria-hidden="true"
          className={`mt-0.5 w-6 h-6 shrink-0 rounded-md border-2 flex items-center justify-center transition pointer-events-none ${
            checked ? "border-cyan bg-cyan" : "border-mute"
          }`}
        >
          {checked && (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#070912"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </span>
        <span className="text-sm leading-relaxed">
          <Link
            href="/legal/terms"
            className="text-cyan underline hover:text-pink"
            target="_blank"
            onClick={(e) => e.stopPropagation()}
          >
            利用規約
          </Link>
          ・
          <Link
            href="/legal/privacy"
            className="text-cyan underline hover:text-pink"
            target="_blank"
            onClick={(e) => e.stopPropagation()}
          >
            プライバシーポリシー
          </Link>
          に同意し、上記の注意事項を理解しました。
        </span>
      </div>

      <button
        type="button"
        disabled={!checked}
        onClick={onConsent}
        className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 font-bold rounded-full px-8 py-4 transition ${
          checked
            ? "bg-gradient-to-r from-cyan to-violet text-bg hover:scale-[1.02] glow-ring"
            : "bg-panel2 text-mute cursor-not-allowed"
        }`}
      >
        同意して始める
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </button>
    </div>
  );
}
