"use client";

import type { Plan } from "@/lib/schema/result";

/**
 * 進路 3 タブ(specs §3-2 / §6-2)。
 * - 各タブのラベルは candidate.title
 * - マッチ度バッジ + 難易度ドット
 * - クライアントコンポーネント(クリックハンドリングのため)
 * - リボン表示なし(specs §6-2 / 論点 7)
 */
export function PlanTabs({
  plans,
  activeIndex,
  onChange,
}: {
  plans: readonly Plan[];
  activeIndex: number;
  onChange: (i: number) => void;
}) {
  return (
    <div className="mb-6" role="tablist" aria-label="進路候補 3 案">
      <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {plans.map((plan, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={i}
              role="tab"
              aria-selected={active}
              aria-controls={`plan-panel-${i}`}
              id={`plan-tab-${i}`}
              onClick={() => onChange(i)}
              className={[
                "relative shrink-0 rounded-2xl border px-4 py-3 text-left transition",
                "min-w-[14rem] sm:min-w-[16rem] max-w-[20rem]",
                active
                  ? "bg-gradient-to-br from-cyan/15 to-violet/10 border-cyan/60 shadow-[0_0_24px_rgba(34,211,238,0.15)]"
                  : "bg-panel/40 border-line hover:border-cyan/40",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span
                  className={[
                    "text-[0.65rem] font-display tracking-wider uppercase",
                    active ? "text-cyan" : "text-mute",
                  ].join(" ")}
                >
                  Plan {i + 1}
                </span>
                <span
                  className={[
                    "text-xs font-display font-bold",
                    active ? "text-cyan" : "text-mute",
                  ].join(" ")}
                >
                  {plan.candidate.matchPercent}%
                </span>
              </div>
              <p className="text-sm font-semibold leading-snug line-clamp-2">
                {plan.candidate.title}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <FeasibilityDot feasibility={plan.candidate.feasibility} />
                <span className="text-[0.65rem] text-mute">
                  {FEASIBILITY_LABEL[plan.candidate.feasibility]}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const FEASIBILITY_LABEL = {
  realistic: "現実的",
  challenging: "挑戦的",
  very_challenging: "かなり厳しい",
  extreme_effort: "超努力が必要",
} as const;

const FEASIBILITY_DOT = {
  realistic: "bg-lime shadow-[0_0_8px_#a3e635]",
  challenging: "bg-amber-300 shadow-[0_0_8px_#fcd34d]",
  very_challenging: "bg-orange-400 shadow-[0_0_8px_#fb923c]",
  extreme_effort: "bg-red-400 shadow-[0_0_8px_#f87171]",
} as const;

function FeasibilityDot({
  feasibility,
}: {
  feasibility: keyof typeof FEASIBILITY_DOT;
}) {
  return (
    <span
      aria-hidden
      className={`inline-block w-2 h-2 rounded-full ${FEASIBILITY_DOT[feasibility]}`}
    />
  );
}
