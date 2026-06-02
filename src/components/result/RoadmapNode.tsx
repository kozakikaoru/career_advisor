import type { RoadmapNode as RoadmapNodeType } from "@/lib/schema/result";

/**
 * ロードマップの 1 ノード(v2.2 / 幻想テーマ刷新)。
 *
 * 変更点(2026-06-02 かおる要望):
 * - ノードを「角丸四角の箱(絵文字)」から「光る星(SVG)」に置換
 * - start  → 青系の 4 芒星 (現在地・地球感)
 * - milestone → 紫系の 4 芒星 + 中央に timeLabel(短い英数表記)
 * - goal   → ピンク系の 6 芒星(大きく輝く目標星)
 * - 各ノードに小さなパーティクル(twinkle)
 * - 配色は既存維持(cyan → violet → pink)
 *
 * 既存仕様:
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

/**
 * ノード本体。kind に応じて星の形・色・サイズを変える。
 *
 * SVG 星型は path 1 本で構成し、グラデーション + ドロップシャドウで発光。
 * 共通の星ハロー(放射光 + 十字光条)は CSS の .node-star::before/::after が担当。
 */
function NodeIcon({ node }: { node: RoadmapNodeType }) {
  if (node.kind === "start") {
    return (
      <div
        className="node-star absolute left-0 top-0 w-12 h-12 flex items-center justify-center"
        style={{ ["--g" as string]: "rgba(34,211,238,0.8)" }}
      >
        <Star4
          fill="url(#node-grad-start)"
          stroke="rgba(34, 211, 238, 0.9)"
          glow="rgba(34, 211, 238, 0.9)"
          size={44}
        />
        <Defs />
      </div>
    );
  }
  if (node.kind === "goal") {
    return (
      <div
        className="node-star node-star--goal absolute left-0 top-0 w-12 h-12 flex items-center justify-center"
        style={{ ["--g" as string]: "rgba(244,114,182,0.95)" }}
      >
        <Star6
          fill="url(#node-grad-goal)"
          stroke="rgba(244, 114, 182, 0.95)"
          glow="rgba(244, 114, 182, 1)"
          size={52}
        />
        <Defs />
      </div>
    );
  }
  // milestone — 4 芒星 + 中央に短い timeLabel
  return (
    <div
      className="node-star absolute left-0 top-0 w-12 h-12 flex items-center justify-center"
      style={{ ["--g" as string]: "rgba(168,85,247,0.75)" }}
    >
      <Star4
        fill="url(#node-grad-milestone)"
        stroke="rgba(168, 85, 247, 0.85)"
        glow="rgba(168, 85, 247, 0.85)"
        size={44}
      />
      <Defs />
      {/*
        2026-06-02 かおる要望 #3:
        星の上に乗る "1M" / "3M" 等のラベルが白文字×紫星で読みにくかったので、
        - 文字の背後に半透明の暗いカプセル(背景パネル色)を敷いて可読性を確保
        - 文字に薄い黒の縁取り(text-shadow を多方向に)も併用してコントラストを底上げ

        2026-06-03 さらに調整:
        - 文字色 ice → cyan/100 寄り(薄い水色)で星色との分離をさらに強める
        - カプセル背景の暗さを bg/65 → bg/80 に上げて視認性を底上げ
        - フチを line/40 → cyan/40 に変えてマイルストーン感を保つ
       */}
      <span
        className="absolute z-10 font-display text-[0.65rem] font-bold leading-none px-1.5 py-0.5 rounded-md bg-bg/80 border border-cyan/40 backdrop-blur-[1px]"
        style={{
          color: "#cffafe",
          textShadow:
            "0 0 2px rgba(7,9,18,1), 0 0 1px rgba(7,9,18,1), 0 1px 2px rgba(7,9,18,0.95)",
        }}
      >
        {node.timeLabel}
      </span>
    </div>
  );
}

/**
 * 共有 <defs>(グラデ定義)。
 * 各ノードに毎回出るがブラウザは同一 id を 1 度だけ参照するため重複表示にはならない。
 * SSR と CSR で同一 markup なので hydration mismatch も起きない。
 */
function Defs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <radialGradient id="node-grad-start" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#e7ecff" />
          <stop offset="45%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0e4a55" />
        </radialGradient>
        <radialGradient id="node-grad-milestone" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#e7ecff" />
          <stop offset="45%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#3a1a66" />
        </radialGradient>
        <radialGradient id="node-grad-goal" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#f472b6" />
          <stop offset="75%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#3a1a66" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/** 4 芒星(start / milestone 用)— path は単位円(viewBox 0 0 100 100)上で構築 */
function Star4({
  fill,
  stroke,
  glow,
  size,
}: {
  fill: string;
  stroke: string;
  glow: string;
  size: number;
}) {
  // 4 芒星: 中心から上下左右に長い針、対角線方向に短い針(8 頂点)
  // 長針: 半径 48 / 短針: 半径 14
  const d =
    "M50 2 L58 36 L92 50 L58 64 L50 98 L42 64 L8 50 L42 36 Z";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{
        filter: `drop-shadow(0 0 6px ${glow}) drop-shadow(0 0 16px ${glow})`,
      }}
      aria-hidden
    >
      <path d={d} fill={fill} stroke={stroke} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

/** 6 芒星(goal 用)— star of david 風の幾何的な大きい星 */
function Star6({
  fill,
  stroke,
  glow,
  size,
}: {
  fill: string;
  stroke: string;
  glow: string;
  size: number;
}) {
  // 6 芒星: 中心から 6 方向に長い針 + 6 方向の短い針(12 頂点)
  // 上 → 右上 → 右 → ... と並ぶ
  // 長針: 半径 48 / 短針: 半径 18
  const points: [number, number][] = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 48 : 18;
    points.push([50 + Math.cos(angle) * r, 50 + Math.sin(angle) * r]);
  }
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`)
    .join(" ") + " Z";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{
        filter: `drop-shadow(0 0 8px ${glow}) drop-shadow(0 0 22px ${glow})`,
      }}
      aria-hidden
    >
      <path d={d} fill={fill} stroke={stroke} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
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
