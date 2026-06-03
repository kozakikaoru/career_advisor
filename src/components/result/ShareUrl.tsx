"use client";

import { useState } from "react";

/**
 * 結果URLのコピー導線(フッター)。クリップボードへコピーするため Client Component。
 *
 * 2026-06-03 スマホクリップボードバグ修正(かおる FB):
 *   `navigator.clipboard.writeText()` は **secure context (HTTPS / localhost) 限定** で、
 *   LAN HTTP(192.168.x.x:3100)では呼び出し自体は走るがブラウザによっては reject される。
 *   特に iOS Safari / Android Chrome では非 secure context だと writeText が
 *   `NotAllowedError` を投げる。
 *
 *   対策: 失敗したら隠した `<textarea>` + `document.execCommand("copy")` にフォールバック。
 *   - iOS Safari は通常の `ta.select()` だけでは Range 選択にならないので
 *     `setSelectionRange(0, 99999)` を併用すると確実。
 *   - 旧 API だが現在も全モダンブラウザでサポートされている("deprecated" だが動く)。
 */

type CopyResult = "ok" | "fail";

async function copyToClipboard(text: string): Promise<CopyResult> {
  // 1) 推奨パス: navigator.clipboard.writeText
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(text);
      return "ok";
    }
  } catch {
    // 続けて fallback へ。secure context じゃない / ユーザー操作扱いされなかった等。
  }

  // 2) フォールバック: 隠した textarea + execCommand("copy")
  //    iOS Safari は readOnly でないと一瞬キーボードが立ち上がる場合があるため readOnly に。
  try {
    if (typeof document === "undefined") return "fail";
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    // 画面外に飛ばさず position: fixed / opacity: 0 で目立たせない
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    ta.style.pointerEvents = "none";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    // iOS Safari 向け: Range 選択を明示
    try {
      ta.setSelectionRange(0, 99999);
    } catch {
      // setSelectionRange 非対応な極一部の環境は無視
    }
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok ? "ok" : "fail";
  } catch {
    return "fail";
  }
}

export function ShareUrl({ url }: { url: string }) {
  // null = まだ押してない / "ok" = 成功 / "fail" = 失敗
  const [state, setState] = useState<CopyResult | null>(null);

  async function copy() {
    const result = await copyToClipboard(url);
    setState(result);
    // 成功・失敗どちらも 2 秒で状態をリセット(再試行を促す)
    window.setTimeout(() => setState(null), 2000);
  }

  // 表示用にスキーム(https:// 等)を落として見やすく
  const display = url.replace(/^https?:\/\//, "");

  // ボタンラベル: 成功 / 失敗 / 通常 で出し分け
  const buttonLabel =
    state === "ok" ? "コピー済" : state === "fail" ? "失敗 — 長押し選択を" : "コピー";

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
          <div className="flex-1 min-w-0 sm:w-64 flex items-center gap-2 border border-line bg-panel2/60 rounded-lg px-3 py-3 text-xs text-mute">
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
            aria-live="polite"
            className={[
              "shrink-0 text-bg text-sm font-bold rounded-lg px-5 py-3 transition hover:scale-105",
              state === "fail"
                ? "bg-gradient-to-r from-orange-400 to-red-400"
                : "bg-gradient-to-r from-cyan to-violet",
            ].join(" ")}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
      {state === "fail" && (
        <p className="mt-3 text-xs text-orange-300/90 leading-relaxed">
          このブラウザではコピー API が拒否されました。URL を長押しして「コピー」を選んでください。
        </p>
      )}
    </div>
  );
}
