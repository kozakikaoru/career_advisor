import type { Plan } from "@/lib/schema/result";
import { CandidateHeader } from "./CandidateHeader";
import { Roadmap } from "./Roadmap";
import { Skills } from "./Skills";
import { AdSlot } from "./AdSlot";

/**
 * タブの中身(specs §3-2 〜 §3-6)。
 * 上から: CandidateHeader → Roadmap → Skills → AdSlot の順。
 */
export function PlanContent({
  plan,
  index,
}: {
  plan: Plan;
  index: number;
}) {
  return (
    <div
      role="tabpanel"
      id={`plan-panel-${index}`}
      aria-labelledby={`plan-tab-${index}`}
    >
      <CandidateHeader candidate={plan.candidate} />
      <Roadmap roadmap={plan.roadmap} />
      <Skills skills={plan.skills} />
      <div className="mt-10">
        <AdSlot adSlot={plan.adSlot} />
      </div>
    </div>
  );
}
