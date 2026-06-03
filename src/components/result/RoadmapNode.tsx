import type { RoadmapNode as RoadmapNodeType } from "@/lib/schema/result";

/**
 * ロードマップの 1 ノード(2026-06-03 デザイン再構築 / B 案ホロスコープ盤連動)。
 *
 * 変更点(かおる要望):
 * - 従来の「丸ドット / 4-6 芒星 path」型から、シャープな **4 芒星(✦)** へ。
 * - kind ごとに色を変える: start = cyan / milestone = violet / goal = pink。
 *
 * 2026-06-03 追加 FB:
 * - 「もう少し星っぽくして欲しい」=「キラキラエフェクト感」より「明確な星のシルエット」を優先。
 * - 縦横 4 本を**ダイヤ型 polygon(先端尖り)** に置換 → ✦ のシャープなシルエット。
 * - 斜めの短い光線は撤去(光線過多の "キラキラ" 圧を下げる)。
 *   代わりに**斜め 4 方向に微小な点**を置いてキラキラ感を最小限残す。
 * - 中央の白カプセル `timeLabel`(1M/3M/6M …)は削除。横の Badge に同じ情報があるので冗長。
 *   → 星のシルエットがカプセルに分断されず、純粋に「星」として見える。
 *
 * 既存仕様の維持:
 * - timeLabel バッジ(Badge) は min-width 4rem で短いラベルでも崩れない(specs §5-4)。
 * - NOW ノードでは nowActions をチェックリスト表示(specs §3-6-2)。
 * - 8 段まで縦並びで耐える。
 *
 * 注:
 * - 旧 `.node-star` 系の CSS ハロー(::before/::after の十字光条)はこの SVG に内包したので
 *   コンポーネント側ではクラス付与をやめる(class からも除外)。CSS は他で使われていない。
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
 * ノード本体。kind に応じて色 / サイズだけ切り替え、形状は共通の「シャープ 4 芒星」。
 *
 * 2026-06-03 追加 FB:
 * - milestone の中央 timeLabel(白カプセル)は削除。横の Badge に同じ情報があるので冗長。
 * - goal は少し大きめにして光を強める(従来通り)。
 */
function NodeIcon({ node }: { node: RoadmapNodeType }) {
  if (node.kind === "start") {
    return (
      <div className="absolute left-0 top-0 w-12 h-12 flex items-center justify-center">
        <SparkleStar
          color="#22d3ee"
          glow="rgba(34, 211, 238, 0.9)"
          size={48}
        />
      </div>
    );
  }
  if (node.kind === "goal") {
    return (
      <div className="absolute left-0 top-0 w-12 h-12 flex items-center justify-center">
        <SparkleStar
          color="#f472b6"
          glow="rgba(244, 114, 182, 1)"
          size={56}
          large
        />
      </div>
    );
  }
  // milestone
  return (
    <div className="absolute left-0 top-0 w-12 h-12 flex items-center justify-center">
      <SparkleStar
        color="#a855f7"
        glow="rgba(168, 85, 247, 0.9)"
        size={48}
      />
    </div>
  );
}

/**
 * シャープ 4 芒星(✦)SVG。
 *
 * 2026-06-03 リデザイン:
 * - 旧「縦横 4 + 斜め 4」の line ベースの "金平糖" 型は「キラキラエフェクト感」が強すぎたため、
 *   かおる FB を受けて **4 芒星のシルエットを基本** にし、シャープな星型へ。
 * - 縦横 4 本: `<line>` ではなく **細長いダイヤ型 `<polygon>`** にして先端を尖らせる。
 *   → 同じ太さの線より「星」感が出る(✦ ★ のシルエットに寄る)。
 * - 斜め 4 本の光線は撤去。代わりに微小な **点(circle)** を斜め 45° に配置して
 *   キラキラ感を「うっすら」だけ残す(完全に消すと地味すぎる)。
 * - 中心の白いコア + radialGradient の発光 + 外周ハローは維持。
 *
 * 設計:
 * - viewBox 0..100 で構築。size px に拡縮。
 * - `large` で goal 用に外形と中心半径を強める。
 *
 * uniqueId:
 * - radialGradient を SVG 内 defs に置くため、複数ノードで id が衝突しないよう
 *   props.color の hex から派生した短い ID を生成。
 */
function SparkleStar({
  color,
  glow,
  size,
  large = false,
}: {
  color: string;
  glow: string;
  size: number;
  large?: boolean;
}) {
  // 一意なグラデ ID(同一カラーなら同じ id で OK = 重複しても 1 度しか参照されない)
  const gradId = `sparkle-${color.replace("#", "").toLowerCase()}${large ? "-l" : ""}`;
  const haloId = `${gradId}-halo`;

  // 4 芒星の外形(ダイヤ型 polygon)寸法。
  // tip = 先端の中心からの距離 / waist = 中心くびれの幅(細さ)
  // waist を小さくすると "鋭い ✦"、大きくすると "ぷっくりダイヤ"
  const tip = large ? 48 : 44; // 先端
  const waist = large ? 6 : 5; // くびれ
  const centerR = large ? 9 : 7.5; // 中心発光円
  const innerR = large ? 3.2 : 2.6; // 中心の白コア
  const dotR = large ? 1.6 : 1.3; // 斜め微小点(キラキラ感の名残)
  // 斜め点の中心からの距離(細長い 4 芒星の "ヘリ" よりやや外側に置く)
  const dotDist = large ? 18 : 16;

  // 縦長ダイヤ polygon の頂点座標(中心 50,50)
  // 上 / 右くびれ / 下 / 左くびれ
  const vertPoly = [
    `50,${50 - tip}`,
    `${50 + waist},50`,
    `50,${50 + tip}`,
    `${50 - waist},50`,
  ].join(" ");
  // 横長ダイヤ polygon
  const horizPoly = [
    `${50 - tip},50`,
    `50,${50 - waist}`,
    `${50 + tip},50`,
    `50,${50 + waist}`,
  ].join(" ");

  // 斜め 4 点(右上 / 右下 / 左下 / 左上)
  const d = dotDist * 0.707;
  const sparkleDots: Array<[number, number]> = [
    [50 + d, 50 - d],
    [50 + d, 50 + d],
    [50 - d, 50 + d],
    [50 - d, 50 - d],
  ];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
      style={{ filter: `drop-shadow(0 0 6px ${glow}) drop-shadow(0 0 14px ${glow})` }}
    >
      <defs>
        <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor={color} />
          <stop offset="100%" stopColor={color} stopOpacity="0.15" />
        </radialGradient>
        <radialGradient id={haloId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.5" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 外周ハロー(うっすら) */}
      <circle cx="50" cy="50" r="46" fill={`url(#${haloId})`} />

      {/* 4 芒星本体: 縦長 + 横長のダイヤ polygon を重ねる(✦ シルエット) */}
      <g fill={color}>
        <polygon points={vertPoly} />
        <polygon points={horizPoly} />
      </g>

      {/* 斜め 4 方向の微小点(キラキラ感をうっすら残す) */}
      <g fill={color} opacity="0.7">
        {sparkleDots.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={dotR} />
        ))}
      </g>

      {/* 中心の発光円(グラデで内側から光る) */}
      <circle cx="50" cy="50" r={centerR} fill={`url(#${gradId})`} />
      {/* 中心の白いコア(最も明るい点) */}
      <circle cx="50" cy="50" r={innerR} fill="#ffffff" />
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
