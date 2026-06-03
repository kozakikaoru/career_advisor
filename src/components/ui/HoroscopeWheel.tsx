"use client";

/**
 * HoroscopeWheel — サイト全体の背景レイヤー(B 案: ホロスコープ盤)。
 *
 * 構造(モック `design/mockups/redesign-v2/B-wheel/{top,result}.html` 由来):
 * - 画面中央に固定された巨大 SVG 盤(min(120vmin, 1100px) 正方形)
 * - 3 重の同心円(半径 30% / 60% / 90% 相当を SVG viewBox -500..500 上で 150 / 300 / 450 に)
 * - 12 分割の極細放射線(中心 → 外周。30° 間隔)
 * - 中心の占星シンボル(GeneratingView 由来の不完全な軌道リング + 衛星ドット + 中央惑星)
 * - 600 秒で 1 回転(`prefers-reduced-motion` 時は停止)
 *
 * 方針メモ(かおる指示):
 * - 黄道記号(♈〜♓)は配置しない
 * - 別レイヤー(回転しない)で画面全体に静的な極小星(光点)を 30-50 個散らす
 *
 * SSR-safe:
 * - 微小星座標は `Math.random()` ではなく、**配列リテラルで固定**(0-1 範囲の決定論的値)
 * - これによりサーバーとクライアントで同一マークアップが生成され、hydration mismatch を回避
 *
 * z-index 設計:
 * - 自身は `-z-10` で body 背景 (`bg-bg`) の手前、コンテンツの背後
 * - `pointer-events-none` で常にスルー
 */

/**
 * 回転する盤上の星屑(SVG viewBox -500..500 上の x/y 座標) × 104 個。
 * - 内側 3 リング(r=200/330/430): 盤面の同心円内
 * - 外側 3 リング(r=560/720/900): viewBox 外。`.horoscope-wheel > svg { overflow: visible }`
 *   設定済みなので、viewBox を超えた座標でも描画される(盤と一緒に回転する)
 * - 等角配置 + 軽い揺らぎ(seed 固定の決定論的乱数)で「自然な散らばり」を表現
 * - ベース白 + 各色アクセント。サイズ 0.6〜1.6px(細かく繊細に)
 * - 2026-06-03 10:34 かおる FB「回転と一緒に回る星をもう少し増やして」対応
 * - 2026-06-03 10:45 かおる FB「盤面外にも散らして欲しい」→ 外側 3 リング追加
 * - SSR/CSR で同一結果になるよう、Math.random ではなく seed 固定の LCG を使用
 */
const WHEEL_STARS: ReadonlyArray<{
  x: number;
  y: number;
  r: number;
  o: number;
  c: string;
}> = (() => {
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  const colors = [
    "#e7ecff",
    "#e7ecff",
    "#e7ecff",
    "#e7ecff",
    "rgba(34,211,238,0.85)",
    "rgba(168,85,247,0.8)",
    "rgba(244,114,182,0.75)",
  ];
  const rings = [
    // 盤面内(同心円 r=150/300/450 内側)
    { count: 14, r: 200, jitter: 50 },
    { count: 18, r: 330, jitter: 60 },
    { count: 14, r: 430, jitter: 30 },
    // 盤面外(viewBox 外。overflow:visible で描画される)
    { count: 16, r: 560, jitter: 50 },
    { count: 20, r: 720, jitter: 70 },
    { count: 22, r: 900, jitter: 100 },
  ];
  const out: { x: number; y: number; r: number; o: number; c: string }[] = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const angle = (i / ring.count) * Math.PI * 2 + (rand() - 0.5) * 0.4;
      const radius = ring.r + (rand() - 0.5) * ring.jitter;
      out.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        r: 0.6 + rand() * 1.0,
        o: 0.4 + rand() * 0.4,
        c: colors[Math.floor(rand() * colors.length)],
      });
    }
  }
  return out;
})();

/**
 * 微小星の固定座標(左 % / 上 % / 半径 px / 色) × 42 個。
 * - 0..100 を等差 + 質感のあるオフセットで散らす
 * - 値は手動で散らした「ホワイトノイズ風」配置。回転しないので並びの偏りも気付かれない
 * - 色は ice 系を基本に、cyan / violet / pink の極薄を混ぜて単調さを消す
 */
const MICRO_STARS: ReadonlyArray<{
  l: number; // left %
  t: number; // top %
  r: number; // radius px
  c: string; // color
}> = [
  { l: 3.2, t: 8.4, r: 1.4, c: "rgba(231, 236, 255, 0.62)" },
  { l: 7.8, t: 22.1, r: 1.0, c: "rgba(231, 236, 255, 0.55)" },
  { l: 11.5, t: 38.7, r: 1.7, c: "rgba(231, 236, 255, 0.68)" },
  { l: 5.1, t: 54.3, r: 1.2, c: "rgba(34, 211, 238, 0.55)" },
  { l: 9.3, t: 71.9, r: 1.5, c: "rgba(231, 236, 255, 0.58)" },
  { l: 14.7, t: 87.2, r: 1.1, c: "rgba(231, 236, 255, 0.5)" },
  { l: 18.4, t: 12.8, r: 1.8, c: "rgba(231, 236, 255, 0.72)" },
  { l: 22.6, t: 29.5, r: 1.0, c: "rgba(168, 85, 247, 0.5)" },
  { l: 25.9, t: 47.1, r: 1.3, c: "rgba(231, 236, 255, 0.58)" },
  { l: 21.3, t: 63.4, r: 1.6, c: "rgba(231, 236, 255, 0.65)" },
  { l: 27.8, t: 79.8, r: 1.0, c: "rgba(231, 236, 255, 0.5)" },
  { l: 32.5, t: 6.2, r: 1.4, c: "rgba(231, 236, 255, 0.6)" },
  { l: 35.1, t: 24.7, r: 1.1, c: "rgba(244, 114, 182, 0.55)" },
  { l: 38.6, t: 42.3, r: 2.0, c: "rgba(231, 236, 255, 0.78)" },
  { l: 36.2, t: 58.6, r: 1.2, c: "rgba(231, 236, 255, 0.55)" },
  { l: 41.4, t: 74.5, r: 1.5, c: "rgba(231, 236, 255, 0.62)" },
  { l: 33.8, t: 91.1, r: 1.0, c: "rgba(231, 236, 255, 0.5)" },
  { l: 45.7, t: 15.3, r: 1.3, c: "rgba(34, 211, 238, 0.58)" },
  { l: 49.2, t: 33.9, r: 1.7, c: "rgba(231, 236, 255, 0.68)" },
  { l: 52.8, t: 50.4, r: 1.1, c: "rgba(231, 236, 255, 0.55)" },
  { l: 47.5, t: 66.7, r: 1.4, c: "rgba(231, 236, 255, 0.6)" },
  { l: 51.3, t: 82.9, r: 1.0, c: "rgba(231, 236, 255, 0.5)" },
  { l: 56.9, t: 9.6, r: 1.6, c: "rgba(231, 236, 255, 0.65)" },
  { l: 59.4, t: 27.1, r: 1.2, c: "rgba(168, 85, 247, 0.55)" },
  { l: 62.8, t: 44.5, r: 1.5, c: "rgba(231, 236, 255, 0.62)" },
  { l: 58.1, t: 60.8, r: 1.0, c: "rgba(231, 236, 255, 0.5)" },
  { l: 63.5, t: 77.3, r: 1.8, c: "rgba(231, 236, 255, 0.72)" },
  { l: 66.7, t: 4.9, r: 1.1, c: "rgba(231, 236, 255, 0.55)" },
  { l: 69.3, t: 21.4, r: 1.4, c: "rgba(244, 114, 182, 0.55)" },
  { l: 73.1, t: 38.8, r: 1.0, c: "rgba(231, 236, 255, 0.5)" },
  { l: 68.6, t: 55.2, r: 2.1, c: "rgba(231, 236, 255, 0.78)" },
  { l: 75.9, t: 71.6, r: 1.2, c: "rgba(231, 236, 255, 0.58)" },
  { l: 70.4, t: 88.0, r: 1.5, c: "rgba(231, 236, 255, 0.62)" },
  { l: 80.2, t: 11.7, r: 1.3, c: "rgba(231, 236, 255, 0.6)" },
  { l: 83.7, t: 30.2, r: 1.6, c: "rgba(34, 211, 238, 0.6)" },
  { l: 86.4, t: 46.8, r: 1.0, c: "rgba(231, 236, 255, 0.5)" },
  { l: 81.9, t: 63.1, r: 1.4, c: "rgba(231, 236, 255, 0.6)" },
  { l: 87.3, t: 79.5, r: 1.1, c: "rgba(231, 236, 255, 0.55)" },
  { l: 90.6, t: 7.3, r: 1.5, c: "rgba(231, 236, 255, 0.62)" },
  { l: 93.1, t: 24.9, r: 1.0, c: "rgba(168, 85, 247, 0.55)" },
  { l: 96.4, t: 42.5, r: 1.2, c: "rgba(231, 236, 255, 0.58)" },
  { l: 94.7, t: 70.1, r: 1.7, c: "rgba(231, 236, 255, 0.68)" },
];

export function HoroscopeWheel() {
  return (
    <div
      className="horoscope-bg fixed inset-0 -z-10 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {/* レイヤー 1: 静的な微小星(画面全体・回転しない) */}
      <svg
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 100 100"
      >
        {MICRO_STARS.map((s, i) => (
          <circle
            key={i}
            cx={s.l}
            cy={s.t}
            r={s.r * 0.18}
            fill={s.c}
          />
        ))}
      </svg>

      {/* レイヤー 2: 中央のホロスコープ盤(600s で 1 回転) */}
      <div className="horoscope-wheel">
        <svg viewBox="-500 -500 1000 1000" width="100%" height="100%">
          <defs>
            <radialGradient id="hw-center" cx="0" cy="0" r="1">
              <stop offset="0" stopColor="rgba(168,85,247,0.16)" />
              <stop offset="1" stopColor="rgba(168,85,247,0)" />
            </radialGradient>
            <linearGradient id="hw-rim" x1="-1" y1="-1" x2="1" y2="1">
              <stop offset="0" stopColor="#22d3ee" stopOpacity="0.5" />
              <stop offset="0.5" stopColor="#a855f7" stopOpacity="0.5" />
              <stop offset="1" stopColor="#f472b6" stopOpacity="0.5" />
            </linearGradient>
          </defs>

          {/* 中央の柔らかいハロー(うっすら) */}
          <circle cx="0" cy="0" r="320" fill="url(#hw-center)" />

          {/* 3 重の同心円(半径 30% / 60% / 90% 相当 = 150 / 300 / 450) */}
          <circle
            cx="0"
            cy="0"
            r="450"
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
          />
          <circle
            cx="0"
            cy="0"
            r="300"
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
          />
          <circle
            cx="0"
            cy="0"
            r="150"
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
          />

          {/* 外輪(リム) - うっすらネオン */}
          <circle
            cx="0"
            cy="0"
            r="460"
            fill="none"
            stroke="url(#hw-rim)"
            strokeWidth="1"
            opacity="0.5"
          />

          {/* 12 分割の極細放射線(中心 → 外周。30° 間隔の 6 本でカバー)
              2026-06-03 かおる FB: 集中線をもう少し色濃く(0.03 → 0.08、約 2.7 倍)。
              同心円(0.04)は維持し、放射線だけ濃くして「12 ハウス分割」の存在感を上げる。 */}
          <g stroke="rgba(34,211,238,0.08)" strokeWidth="0.5">
            <line x1="0" y1="-460" x2="0" y2="460" />
            <line x1="-460" y1="0" x2="460" y2="0" />
            <line x1="-398" y1="-230" x2="398" y2="230" />
            <line x1="-230" y1="-398" x2="230" y2="398" />
            <line x1="-398" y1="230" x2="398" y2="-230" />
            <line x1="-230" y1="398" x2="230" y2="-398" />
          </g>

          {/* 軌道上の惑星ドット(うっすら色付き) */}
          <g>
            <circle
              cx="460"
              cy="0"
              r="3"
              fill="#22d3ee"
              opacity="0.55"
              filter="drop-shadow(0 0 6px rgba(34,211,238,0.6))"
            />
            <circle
              cx="-380"
              cy="0"
              r="2.6"
              fill="#a855f7"
              opacity="0.5"
              filter="drop-shadow(0 0 5px rgba(168,85,247,0.6))"
            />
            <circle
              cx="0"
              cy="280"
              r="2.4"
              fill="#f472b6"
              opacity="0.45"
              filter="drop-shadow(0 0 5px rgba(244,114,182,0.55))"
            />
            <circle
              cx="180"
              cy="-180"
              r="2.0"
              fill="#e7ecff"
              opacity="0.5"
            />
            <circle cx="-260" cy="180" r="1.6" fill="#22d3ee" opacity="0.45" />
            <circle cx="260" cy="-280" r="1.4" fill="#a855f7" opacity="0.4" />
          </g>

          {/* 中心の占星シンボル: 不完全な軌道リング + 中央惑星 + 衛星
              (GeneratingView の「小惑星 + 軌道 + 衛星」表現を踏襲) */}
          <g>
            {/* 不完全な軌道(切れ目あり) */}
            <circle
              cx="0"
              cy="0"
              r="78"
              fill="none"
              stroke="rgba(168,85,247,0.5)"
              strokeWidth="0.9"
              strokeDasharray="180 70"
            />
            <circle
              cx="0"
              cy="0"
              r="56"
              fill="none"
              stroke="rgba(34,211,238,0.45)"
              strokeWidth="0.6"
              strokeDasharray="2 5"
            />
            {/* 惑星本体(中心の小惑星) */}
            <circle cx="0" cy="0" r="22" fill="rgba(168,85,247,0.18)" />
            <circle cx="0" cy="0" r="12" fill="rgba(168,85,247,0.5)" />
            <circle cx="0" cy="0" r="4.5" fill="#e7ecff" />
            {/* 衛星ドット */}
            <circle
              cx="78"
              cy="0"
              r="3"
              fill="#22d3ee"
              filter="drop-shadow(0 0 6px rgba(34,211,238,0.9))"
            />
            <circle
              cx="0"
              cy="-56"
              r="2.4"
              fill="#f472b6"
              filter="drop-shadow(0 0 6px rgba(244,114,182,0.9))"
            />
          </g>

          {/* 盤上に散らす細かな星屑(回転に乗る)— 46 個
              2026-06-03 10:34 かおる FB「回転と一緒に回る星をもう少し増やして」 */}
          <g>
            {WHEEL_STARS.map((s, i) => (
              <circle
                key={i}
                cx={s.x}
                cy={s.y}
                r={s.r}
                fill={s.c}
                opacity={s.o}
              />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}
