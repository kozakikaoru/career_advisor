"use client";

import { useId } from "react";
import type { Choice } from "@/lib/questions/definitions";

/** 単一選択UI。選んだ選択肢だけネオン枠でハイライト。 */
export function SingleChoice({
  choices,
  value,
  onChange,
}: {
  choices: Choice[];
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  // 各選択肢の description 要素に紐付ける ID プレフィックス(aria-describedby 用)
  const idPrefix = useId();
  return (
    <div className="space-y-3" role="radiogroup">
      {choices.map((c) => {
        const selected = value === c.value;
        // MINDSET v2(2026-06-02)で導入した description を優先。互換のため hint も
        // 同じ位置に表示するが、両方ある場合は description を採用(運用上重複させない)。
        const sub = c.description ?? c.hint;
        const descId = sub ? `${idPrefix}-${c.value}-desc` : undefined;
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-describedby={descId}
            onClick={() => onChange(c.value)}
            className={`w-full text-left rounded-2xl border px-5 py-4 transition ${
              selected
                ? "border-cyan bg-cyan/10 glow-ring"
                : "border-line bg-panel/50 hover:border-cyan/50 hover:bg-panel2/60"
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                  selected ? "border-cyan bg-cyan" : "border-mute"
                }`}
              />
              <span className="font-medium">{c.label}</span>
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
  );
}
