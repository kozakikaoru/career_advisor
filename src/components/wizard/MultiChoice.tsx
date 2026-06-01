"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Choice } from "@/lib/questions/definitions";

/**
 * 複数選択UI。選択中の項目はネオン枠 + チェック表示。
 *
 * MINDSET v2(specs/mindset-questions-v2.md §8-2)で `maxSelect` を追加。
 * - 上限到達時に追加で選ぼうとしたら **選択を拒否**(disabled でも rotation でもなく拒否)
 * - **トースト警告**を表示(`aria-live="polite"` で読み上げ可能・3 秒で自動消去)
 * - 既存選択の解除はできる(タップで外す)
 * - 既存の MUST=1 個以上ルールは Wizard 側で別途担保(本コンポーネントは関与しない)
 */
export function MultiChoice({
  choices,
  value,
  onChange,
  maxSelect,
}: {
  choices: Choice[];
  value: string[];
  onChange: (value: string[]) => void;
  maxSelect?: number;
}) {
  const [toast, setToast] = useState<string | null>(null);
  // useEffect の cleanup でタイマー破棄するため、ref で保持
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 各選択肢の description 要素に紐付ける ID プレフィックス(aria-describedby 用)
  const idPrefix = useId();

  // アンマウント時にタイマーを掃除
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function showToast(message: string) {
    setToast(message);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), 3000);
  }

  function toggle(v: string) {
    const alreadySelected = value.includes(v);
    if (alreadySelected) {
      // 既存選択の解除は常に許可(上限超過時も外せる)
      onChange(value.filter((x) => x !== v));
      return;
    }
    // 新規選択: 上限チェック
    if (typeof maxSelect === "number" && value.length >= maxSelect) {
      // 上限到達 → 選択を拒否 + トースト警告
      showToast(`最大 ${maxSelect} 個まで選べます`);
      return;
    }
    onChange([...value, v]);
  }

  return (
    <div className="relative">
      <div className="grid sm:grid-cols-2 gap-3" role="group">
        {choices.map((c) => {
          const selected = value.includes(c.value);
          // MINDSET v2(2026-06-02)で導入した description を優先。hint も同じ位置に
          // 表示するが、両方ある場合は description を採用(運用上重複させない)。
          const sub = c.description ?? c.hint;
          const descId = sub ? `${idPrefix}-${c.value}-desc` : undefined;
          return (
            <button
              key={c.value}
              type="button"
              role="checkbox"
              aria-checked={selected}
              aria-describedby={descId}
              onClick={() => toggle(c.value)}
              className={`text-left rounded-2xl border px-5 py-4 transition ${
                selected
                  ? "border-violet bg-violet/10 glow-ring"
                  : "border-line bg-panel/50 hover:border-violet/50 hover:bg-panel2/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={`w-4 h-4 rounded-md border-2 shrink-0 flex items-center justify-center ${
                    selected ? "border-violet bg-violet" : "border-mute"
                  }`}
                >
                  {selected && (
                    <svg
                      width="10"
                      height="10"
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
                <span className="font-medium text-sm">{c.label}</span>
              </div>
              {sub && (
                <p id={descId} className="text-xs text-mute mt-1.5 pl-7">
                  {sub}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/*
        トースト(maxSelect 上限超過時の警告)
        - aria-live="polite" でスクリーンリーダー読み上げ可能
        - role="status" は補助。Tailwind v4 のダークテーマに合わせた警告色
        - 常時 DOM に居て aria-live で更新通知する(出現/消滅で role 領域が変わると読み上げが安定しない)
      */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 sm:px-6"
      >
        {toast && (
          <div className="pointer-events-auto max-w-md rounded-2xl border border-amber-400/60 bg-amber-500/15 px-5 py-3 text-sm font-medium text-amber-100 shadow-lg backdrop-blur">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
