import type { Plan } from "@/lib/schema/result";
import { CandidateHeader } from "./CandidateHeader";
import { Roadmap } from "./Roadmap";
import { Skills } from "./Skills";
import { AdSlot } from "./AdSlot";

/**
 * タブの中身(specs §3-2 〜 §3-6)。
 * 上から: CandidateHeader → Roadmap → Skills → 「他のプランを見る」CTA → AdSlot の順。
 *
 * 2026-06-02 かおる要望 #2:
 * - Skills の直下に「他のプランを見る」ボタンを設置。
 * - 押下時は親(ResultView)が次プランに循環切替し、PlanTabs の位置にスクロールバックする。
 * - 現在 index と総数を受け取って、ラベルに「次プランの番号」を出す(動的)。
 */
export function PlanContent({
  plan,
  index,
  total,
  onNavigateNext,
}: {
  plan: Plan;
  index: number;
  total: number;
  onNavigateNext: () => void;
}) {
  const nextIndex = (index + 1) % total;
  return (
    <div
      role="tabpanel"
      id={`plan-panel-${index}`}
      aria-labelledby={`plan-tab-${index}`}
    >
      <CandidateHeader candidate={plan.candidate} />
      <Roadmap roadmap={plan.roadmap} />
      <Skills skills={plan.skills} />
      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={onNavigateNext}
          className={[
            "group inline-flex items-center gap-2 rounded-full px-5 py-2.5",
            "text-sm font-display tracking-wide font-medium",
            "bg-gradient-to-r from-cyan/10 via-violet/15 to-pink/10",
            "border border-violet/40 text-ice/95",
            "hover:border-cyan/70 hover:text-cyan",
            "shadow-[0_0_18px_rgba(168,85,247,0.18)]",
            "transition",
          ].join(" ")}
          aria-label={`Plan ${nextIndex + 1} を見る`}
        >
          <span>Plan {nextIndex + 1} を見る</span>
          <span
            aria-hidden
            className="inline-block transition-transform group-hover:translate-x-0.5"
          >
            →
          </span>
        </button>
      </div>
      <div className="mt-10">
        <AdSlot adSlot={plan.adSlot} />
      </div>
    </div>
  );
}
