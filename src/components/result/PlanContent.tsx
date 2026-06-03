import type { Plan } from "@/lib/schema/result";
import { CandidateHeader } from "./CandidateHeader";
import { Roadmap } from "./Roadmap";
import { Skills } from "./Skills";
import { AdSlot } from "./AdSlot";

/**
 * タブの中身(specs §3-2 〜 §3-6)。
 * 上から: CandidateHeader → Roadmap → Skills → 「次の航路を読む」CTA → AdSlot の順。
 *
 * 2026-06-02 かおる要望 #2:
 * - Skills の直下に「他のプランを見る」ボタンを設置。
 * - 押下時は親(ResultView)が次プランに循環切替し、PlanTabs の位置にスクロールバックする。
 * - 現在 index と総数を受け取って、ラベルに「次プランの番号」を出す(動的)。
 *
 * 2026-06-03 文言調整(かおる要望 #2 リフィン):
 * - 「Plan N を見る →」は機能的すぎて占い世界観と乖離していたので、
 *   「次の航路を読む(Plan N) ✦ →」に変更。
 *
 * 2026-06-03 追加 FB(カード統合):
 * - 「プラン概要(CandidateHeader)/ ロードマップ(Roadmap)/ 必要スキル(Skills)」の 3 つを、
 *   1 枚の大きな `glow-card` に統合する。各セクションは bare モードで描画し、
 *   間を薄い水平線(`border-t border-line/60` + `pt-7 mt-7`)で区切るだけにする。
 * - 「他のプランを見る」CTA と AdSlot はこの統合カードの **外** に出す(従来と同じ独立配置)。
 * - bare prop 非対応の旧呼び出しが他に無いか念のため意識しつつ、デフォルト false で後方互換。
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
      {/* 統合カード: プラン概要 + ロードマップ + 必要スキル */}
      <section className="mb-8">
        <div className="glow-card rounded-3xl p-6 sm:p-9">
          <CandidateHeader candidate={plan.candidate} bare />

          {/* セクション区切り(薄い水平線) */}
          <div className="mt-8 pt-8 border-t border-line/60">
            <Roadmap roadmap={plan.roadmap} bare />
          </div>

          <div className="mt-8 pt-8 border-t border-line/60">
            <Skills skills={plan.skills} bare />
          </div>
        </div>
      </section>

      {/* 「次のプランを見る」CTA(統合カード外) */}
      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={onNavigateNext}
          className={[
            "group inline-flex items-center gap-3 rounded-full px-8 sm:px-10 py-4 sm:py-5",
            "text-base sm:text-lg font-display tracking-wide font-semibold",
            "bg-gradient-to-r from-cyan/10 via-violet/15 to-pink/10",
            "border border-violet/40 text-ice/95",
            "hover:border-cyan/70 hover:text-cyan hover:scale-[1.02]",
            "shadow-[0_0_28px_rgba(168,85,247,0.22)]",
            "transition",
          ].join(" ")}
          aria-label={`次のプラン(Plan ${nextIndex + 1})を見る`}
        >
          <span aria-hidden className="text-cyan/90 text-xl">✦</span>
          <span>
            次のプランを見る
            <span className="text-mute/80 ml-2 text-sm">
              (Plan {nextIndex + 1})
            </span>
          </span>
          <span
            aria-hidden
            className="inline-block transition-transform group-hover:translate-x-0.5"
          >
            →
          </span>
        </button>
      </div>

      {/* AdSlot(統合カード外) */}
      <div className="mt-10">
        <AdSlot adSlot={plan.adSlot} />
      </div>
    </div>
  );
}
