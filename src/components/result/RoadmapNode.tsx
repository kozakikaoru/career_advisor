import type { RoadmapNode as RoadmapNodeType } from "@/lib/schema/result";

/**
 * ロードマップの 1 ノード。kind で配色を分岐:
 *   start    = シアン→バイオレットのグラデ円 + 📍
 *   milestone= パネル枠 + timeLabel(violet 文字)
 *   goal     = バイオレット→ピンクのグラデ円 + 🏆
 * road-line は CSS(::before)で次ノードへの縦線を描く。最後の要素は :last-child で消える。
 * 下余白(pb-8)は配列末尾(isLast)で消す。kind が goal 以外で終わっても余白を残さない。
 */
export function RoadmapNode({
  node,
  isLast,
}: {
  node: RoadmapNodeType;
  isLast: boolean;
}) {
  return (
    <div className={`road-item relative pl-16 ${isLast ? "" : "pb-8"}`}>
      <div className="road-line absolute inset-0" />
      <NodeIcon node={node} />
      <Badge node={node} />
      <h3 className="text-lg font-semibold mb-1.5">{node.title}</h3>
      <p className="text-mute text-sm leading-relaxed max-w-2xl">{node.description}</p>
    </div>
  );
}

function NodeIcon({ node }: { node: RoadmapNodeType }) {
  if (node.kind === "start") {
    return (
      <div
        className="node-glow absolute left-0 top-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan to-violet flex items-center justify-center"
        style={{ ["--g" as string]: "rgba(34,211,238,0.7)" }}
      >
        <span className="text-bg text-lg">📍</span>
      </div>
    );
  }
  if (node.kind === "goal") {
    return (
      <div
        className="node-glow absolute left-0 top-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-violet to-pink flex items-center justify-center"
        style={{ ["--g" as string]: "rgba(244,114,182,0.8)" }}
      >
        <span className="text-lg">🏆</span>
      </div>
    );
  }
  // milestone
  return (
    <div
      className="node-glow absolute left-0 top-0 w-12 h-12 rounded-2xl bg-panel2 border border-line flex items-center justify-center"
      style={{ ["--g" as string]: "rgba(168,85,247,0.4)" }}
    >
      <span className="font-display text-sm font-bold text-violet">{node.timeLabel}</span>
    </div>
  );
}

function Badge({ node }: { node: RoadmapNodeType }) {
  if (node.kind === "start") {
    return (
      <span className="inline-block text-[0.7rem] font-display tracking-wider text-cyan bg-cyan/10 border border-cyan/30 rounded-full px-3 py-1 mb-2">
        {node.timeLabel} · {node.periodText}
      </span>
    );
  }
  if (node.kind === "goal") {
    return (
      <span className="inline-block text-[0.7rem] font-display tracking-wider text-bg bg-gradient-to-r from-violet to-pink rounded-full px-3 py-1 mb-2 font-bold">
        GOAL ✦
      </span>
    );
  }
  return (
    <span className="inline-block text-[0.7rem] font-display tracking-wider text-mute bg-panel2 border border-line rounded-full px-3 py-1 mb-2">
      {node.periodText}
    </span>
  );
}
