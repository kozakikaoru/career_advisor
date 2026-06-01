import type { PlanCandidate } from "@/lib/schema/result";
import { WarningBadge } from "./WarningBadge";

/**
 * タブ直下に表示する選択中の Plan のヘッダー(specs §3-2 / §6-4)。
 * - タイトル / 短い説明 / 詳細(200 字)/ マッチ度バー / 難易度バッジ / 警告メッセージ
 */
export function CandidateHeader({ candidate }: { candidate: PlanCandidate }) {
  return (
    <section className="mb-8">
      <div className="glow-card rounded-3xl p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <WarningBadge feasibility={candidate.feasibility} />
          <span className="ml-auto inline-flex items-center gap-2 text-xs text-mute">
            <span>マッチ度</span>
            <span className="font-display font-bold text-cyan text-sm">
              {candidate.matchPercent}%
            </span>
          </span>
        </div>

        <h2 className="font-display text-2xl sm:text-3xl font-bold leading-tight mb-3 neon-text">
          {candidate.title}
        </h2>
        <p className="text-base font-medium leading-relaxed mb-4 text-ice/90">
          {candidate.shortSummary}
        </p>
        <p className="text-mute text-sm leading-[1.8] mb-5 max-w-3xl">
          {candidate.detail}
        </p>

        {/* マッチ度バー */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-panel2 rounded-full overflow-hidden">
            <div
              className="h-1.5 bar rounded-full"
              style={{ width: `${candidate.matchPercent}%` }}
            />
          </div>
        </div>

        {candidate.warning && (
          <div className="mt-5 rounded-xl border border-orange-400/30 bg-orange-400/5 p-4">
            <p className="text-xs font-display tracking-wider uppercase text-orange-400 mb-2">
              注意・警告
            </p>
            <p className="text-sm text-ice/90 leading-relaxed">{candidate.warning}</p>
          </div>
        )}
      </div>
    </section>
  );
}
