"use client";

import { useState } from "react";

/** 結果URLのコピー導線(フッター)。クリップボードへコピーするため Client Component。 */
export function ShareUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  // 表示用にスキーム(https:// 等)を落として見やすく
  const display = url.replace(/^https?:\/\//, "");

  return (
    <div className="glow-card rounded-2xl p-6 sm:p-7">
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="text-2xl">🔗</div>
        <div className="flex-1">
          <p className="font-medium text-sm mb-1">この結果のURLを保存すれば、あとから見られます</p>
          <p className="text-xs text-mute">
            アカウント登録は不要。このURLを控えておけば別の端末でも開けます。
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex-1 sm:w-64 flex items-center gap-2 border border-line bg-panel2/60 rounded-lg px-3 py-3 text-xs text-mute">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-cyan"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <span className="truncate">{display}</span>
          </div>
          <button
            onClick={copy}
            className="shrink-0 bg-gradient-to-r from-cyan to-violet text-bg text-sm font-bold rounded-lg px-5 py-3 hover:scale-105 transition"
          >
            {copied ? "コピー済" : "コピー"}
          </button>
        </div>
      </div>
    </div>
  );
}
