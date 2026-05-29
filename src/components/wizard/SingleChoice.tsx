"use client";

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
  return (
    <div className="space-y-3">
      {choices.map((c) => {
        const selected = value === c.value;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            className={`w-full text-left rounded-2xl border px-5 py-4 transition ${
              selected
                ? "border-cyan bg-cyan/10 glow-ring"
                : "border-line bg-panel/50 hover:border-cyan/50 hover:bg-panel2/60"
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                  selected ? "border-cyan bg-cyan" : "border-mute"
                }`}
              />
              <span className="font-medium">{c.label}</span>
            </div>
            {c.hint && <p className="text-xs text-mute mt-1.5 pl-7">{c.hint}</p>}
          </button>
        );
      })}
    </div>
  );
}
