"use client";

import type { Choice } from "@/lib/questions/definitions";

/** 複数選択UI。選択中の項目はネオン枠 + チェック表示。 */
export function MultiChoice({
  choices,
  value,
  onChange,
}: {
  choices: Choice[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  function toggle(v: string) {
    if (value.includes(v)) {
      onChange(value.filter((x) => x !== v));
    } else {
      onChange([...value, v]);
    }
  }

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {choices.map((c) => {
        const selected = value.includes(c.value);
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => toggle(c.value)}
            className={`text-left rounded-2xl border px-5 py-4 transition ${
              selected
                ? "border-violet bg-violet/10 glow-ring"
                : "border-line bg-panel/50 hover:border-violet/50 hover:bg-panel2/60"
            }`}
          >
            <div className="flex items-center gap-3">
              <span
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
          </button>
        );
      })}
    </div>
  );
}
