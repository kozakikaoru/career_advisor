import type { CareerPlan } from "@/lib/schema/result";
import { RoadmapNode } from "./RoadmapNode";

/** A. 段階的ロードマップ(メイン)。ノード配列を可変描画する。 */
export function Roadmap({ roadmap }: { roadmap: CareerPlan["roadmap"] }) {
  return (
    <section className="mb-14">
      <div className="glow-card rounded-3xl p-6 sm:p-9">
        <div className="flex items-center gap-3 mb-9">
          <span className="text-xl">🛰️</span>
          <h2 className="font-display text-xl font-semibold tracking-tight">段階的ロードマップ</h2>
          <span className="ml-auto text-xs font-display tracking-wider text-cyan border border-cyan/40 rounded-full px-3 py-1">
            {roadmap.length} STEPS
          </span>
        </div>

        <div className="space-y-0">
          {roadmap.map((node, i) => (
            <RoadmapNode key={`${node.timeLabel}-${i}`} node={node} />
          ))}
        </div>
      </div>
    </section>
  );
}
