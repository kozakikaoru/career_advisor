"use client";

import { useState } from "react";
import Link from "next/link";

/** 開始前の同意ゲート。チェックを入れないと「同意して始める」を押せない(security 要件)。 */
export function ConsentGate({ onConsent }: { onConsent: () => void }) {
  const [checked, setChecked] = useState(false);

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

      <label className="flex items-start gap-3 cursor-pointer mb-7 select-none">
        <span
          className={`mt-0.5 w-6 h-6 rounded-md border-2 shrink-0 flex items-center justify-center transition ${
            checked ? "border-cyan bg-cyan" : "border-mute"
          }`}
          onClick={() => setChecked((v) => !v)}
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
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="sr-only"
        />
        <span className="text-sm leading-relaxed">
          <Link href="/legal/terms" className="text-cyan underline hover:text-pink" target="_blank">
            利用規約
          </Link>
          ・
          <Link href="/legal/privacy" className="text-cyan underline hover:text-pink" target="_blank">
            プライバシーポリシー
          </Link>
          に同意し、上記の注意事項を理解しました。
        </span>
      </label>

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
