import type { Plan } from "@/lib/schema/result";
import { RoadmapNode } from "./RoadmapNode";

/**
 * A. 段階的ロードマップ(各案ごと)。ノード配列を可変描画する(3〜8 段)。
 * specs §3-3 / §5
 */
export function Roadmap({ roadmap }: { roadmap: Plan["roadmap"] }) {
  return (
    <section className="mb-10">
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
            <RoadmapNode
              key={`${node.timeLabel}-${i}`}
              node={node}
              isLast={i === roadmap.length - 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
