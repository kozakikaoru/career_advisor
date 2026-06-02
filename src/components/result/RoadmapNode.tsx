import type { RoadmapNode as RoadmapNodeType } from "@/lib/schema/result";

/**
 * ロードマップの 1 ノード(v2 改修)。
 * - timeLabel バッジは min-width で短いラベル("3M" "6M")でも崩れない(specs §5-4)
 * - NOW ノードでは nowActions をチェックリストとして表示(specs §3-6-2)
 * - 8 段まで縦並びで耐える
 */
export function RoadmapNode({
  node,
  isLast,
}: {
  node: RoadmapNodeType;
  isLast: boolean;
}) {
  return (
    <div
      className={`road-item relative pl-16 ${isLast ? "" : "pb-8"}`}
      aria-label={`${node.timeLabel}: ${node.periodText}`}
    >
      <div className="road-line absolute inset-0" />
      <NodeIcon node={node} />
      <Badge node={node} />
      <h3 className="text-lg font-semibold mb-1.5">{node.title}</h3>
      <p className="text-mute text-sm leading-relaxed max-w-2xl">{node.description}</p>
      {node.kind === "start" && node.nowActions && node.nowActions.length > 0 && (
        <ul className="mt-4 space-y-2 max-w-2xl">
          {node.nowActions.map((a, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-sm text-ice/90 leading-relaxed"
            >
              <span
                aria-hidden
                className="mt-1.5 inline-block w-1.5 h-1.5 rounded-full bg-cyan shadow-[0_0_8px_#22d3ee] shrink-0"
              />
              <span>{a}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NodeIcon({ node }: { node: RoadmapNodeType }) {
  if (node.kind === "start") {
    return (
      <div
        className="node-glow node-star absolute left-0 top-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan to-violet flex items-center justify-center"
        style={{ ["--g" as string]: "rgba(34,211,238,0.7)" }}
      >
        <span className="text-bg text-lg">📍</span>
      </div>
    );
  }
  if (node.kind === "goal") {
    return (
      <div
        className="node-glow node-star node-star--goal absolute left-0 top-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-violet to-pink flex items-center justify-center"
        style={{ ["--g" as string]: "rgba(244,114,182,0.8)" }}
      >
        <span className="text-lg">🏆</span>
      </div>
    );
  }
  // milestone — 短いラベルでも崩れないよう min-width 固定(specs §5-4)
  return (
    <div
      className="node-glow node-star absolute left-0 top-0 w-12 h-12 rounded-2xl bg-panel2 border border-line flex items-center justify-center px-1"
      style={{ ["--g" as string]: "rgba(168,85,247,0.4)" }}
    >
      <span className="font-display text-sm font-bold text-violet text-center leading-none">
        {node.timeLabel}
      </span>
    </div>
  );
}

function Badge({ node }: { node: RoadmapNodeType }) {
  // timeLabel と periodText を併記し、短ラベル時もバッジ幅を一定にしないが、
  // 視認性のため min-width を 4rem 程度確保(specs §5-4)
  if (node.kind === "start") {
    return (
      <span className="inline-block text-[0.7rem] font-display tracking-wider text-cyan bg-cyan/10 border border-cyan/30 rounded-full px-3 py-1 mb-2 min-w-[4rem] text-center">
        {node.timeLabel} · {node.periodText}
      </span>
    );
  }
  if (node.kind === "goal") {
    return (
      <span className="inline-block text-[0.7rem] font-display tracking-wider text-bg bg-gradient-to-r from-violet to-pink rounded-full px-3 py-1 mb-2 font-bold min-w-[4rem] text-center">
        GOAL ✦
      </span>
    );
  }
  return (
    <span className="inline-block text-[0.7rem] font-display tracking-wider text-mute bg-panel2 border border-line rounded-full px-3 py-1 mb-2 min-w-[4rem] text-center">
      {node.periodText}
    </span>
  );
}
