"use client";

import { useMemo } from "react";

/**
 * 「星々が占ってくれる」サイトの共通星空レイヤー。
 *
 * - レイアウトの一番奥に position: fixed で敷き、全ページに行き渡らせる
 *   (layout.tsx で <StarField /> を 1 回呼ぶだけで OK)
 * - 静的 SVG にすべて寄せて DOM コストを最小化(canvas / requestAnimationFrame は使わない)
 * - 「twinkle(瞬き)」「漂う星屑」「ごく稀に流れ星」「中央うっすらネビュラ」「星座ライン」の 5 層構成
 *   どれも CSS keyframes に丸投げ — メインスレッドに負荷をかけない
 * - prefers-reduced-motion 時はアニメーションを停止(光点は残す)
 *
 * Props:
 * - density: "low" | "normal" — 星の密度。Hero など大きく見せたい場所だけ "normal"、
 *   通常ページ全体は "low" でも十分にそれっぽい(性能優先)。
 *   ※現状は layout で一括採用するため normal 固定でも問題ない。引数だけ残す。
 * - variant: "ambient" | "hero"
 *   ambient — 画面全体に控えめ。透明度低め、ネビュラ控えめ、星座ライン無し。
 *   hero    — ヒーロー直下用。発光やや強め、星座ライン入り、流れ星出現。
 *
 * 注意: 「やりすぎ厳禁」「ちらつき・気持ち悪さ回避」 — 振幅は控えめに、
 *       透明度の差を浅く、周期を長め(2.4〜5.6s)に設定。
 */
type Props = {
  density?: "low" | "normal";
  variant?: "ambient" | "hero";
};

/**
 * 決定論的なランダム(同じ index で同じ値が返る)。
 * SSR と CSR で結果が一致しないと hydration error になるので、
 * Math.random() ではなく index→fract(sin) で代用する。
 */
function rand(seed: number): number {
  // 0..1 を雑に返す。星空の位置決め程度の用途なので分布が偏っても OK。
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function StarField({
  density = "normal",
  variant = "ambient",
}: Props) {
  const isHero = variant === "hero";

  // 星(光点)— 3 種の大きさを混ぜて層に奥行きを出す
  // 数を絞って軽量化(60 個程度でも視覚的には満たされる)
  const starCount = density === "low" ? 38 : 64;

  const stars = useMemo(() => {
    const out: {
      cx: number;
      cy: number;
      r: number;
      opacity: number;
      delay: number;
      duration: number;
      hue: "ice" | "cyan" | "violet" | "pink";
    }[] = [];
    for (let i = 0; i < starCount; i++) {
      const s = i + 1;
      const r1 = rand(s);
      const r2 = rand(s * 2);
      const r3 = rand(s * 3);
      const r4 = rand(s * 4);
      const r5 = rand(s * 5);

      const r =
        r3 < 0.7
          ? 0.6 + r4 * 0.6 // 大半は極小
          : r3 < 0.92
            ? 1.0 + r4 * 0.8 // 中
            : 1.6 + r4 * 1.0; // 大(まれ)
      const hueRoll = r5;
      const hue: "ice" | "cyan" | "violet" | "pink" =
        hueRoll < 0.72
          ? "ice"
          : hueRoll < 0.86
            ? "cyan"
            : hueRoll < 0.95
              ? "violet"
              : "pink";
      out.push({
        cx: r1 * 100,
        cy: r2 * 100,
        r,
        opacity: 0.35 + r4 * 0.6,
        delay: r5 * 5.6,
        duration: 2.4 + rand(s * 6) * 3.2,
        hue,
      });
    }
    return out;
  }, [starCount]);

  // hero 専用: 星座っぽく線を引く
  // 「動かない・うっすら」を厳守(神秘感のため固定)
  const constellation = useMemo(() => {
    if (!isHero) return null;
    // 数本の薄い折れ線。CSS 描画コストを抑えるため SVG path 1 本にまとめる。
    const lines: { d: string }[] = [
      { d: "M 8 16 L 18 22 L 25 12 L 38 18" },
      { d: "M 62 28 L 70 20 L 80 32 L 88 24" },
      { d: "M 14 70 L 22 78 L 30 72" },
      { d: "M 60 82 L 72 88 L 84 76" },
    ];
    return lines;
  }, [isHero]);

  // 流れ星(hero のみ・2 本・別タイミング)
  const shootingStars = isHero
    ? [
        { top: "22%", left: "8%", delay: "1.5s", duration: "5.8s" },
        { top: "48%", left: "62%", delay: "9.2s", duration: "5.6s" },
      ]
    : [];

  return (
    <div
      className={`star-field ${isHero ? "star-field--hero" : "star-field--ambient"}`}
      aria-hidden="true"
    >
      {/* ネビュラ(うっすら漂う星雲) */}
      <div className="star-field__nebula" />

      {/* 星座ライン(hero のみ) */}
      {constellation && (
        <svg
          className="star-field__constellation"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {constellation.map((c, i) => (
            <path
              key={i}
              d={c.d}
              fill="none"
              stroke="rgba(168, 85, 247, 0.18)"
              strokeWidth="0.12"
              strokeLinecap="round"
            />
          ))}
        </svg>
      )}

      {/* 光点(SVG で 1 本にまとめて DOM コスト削減) */}
      <svg
        className="star-field__stars"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {stars.map((s, i) => (
          <circle
            key={i}
            // SVG 属性とアニメーション値は SSR(React.renderToString)と CSR で
            // 浮動小数の精度が一致しないと hydration mismatch を引き起こすため、
            // 全て toFixed で桁を固定する(rand() の出力幅は十分小さいので 4 桁で OK)。
            cx={Number(s.cx.toFixed(3))}
            cy={Number(s.cy.toFixed(3))}
            r={Number((s.r * 0.18).toFixed(4))}
            fill={
              s.hue === "ice"
                ? "rgba(231, 236, 255, 1)"
                : s.hue === "cyan"
                  ? "rgba(34, 211, 238, 1)"
                  : s.hue === "violet"
                    ? "rgba(168, 85, 247, 1)"
                    : "rgba(244, 114, 182, 1)"
            }
            style={{
              opacity: Number(s.opacity.toFixed(3)),
              animation: `star-twinkle ${s.duration.toFixed(2)}s ease-in-out ${s.delay.toFixed(2)}s infinite`,
              filter:
                s.r > 1.3
                  ? "drop-shadow(0 0 1.2px rgba(255,255,255,0.7))"
                  : undefined,
            }}
          />
        ))}
      </svg>

      {/* 流れ星(hero のみ) */}
      {shootingStars.map((ss, i) => (
        <span
          key={`shoot-${i}`}
          className="star-field__shoot"
          style={{
            top: ss.top,
            left: ss.left,
            animationDelay: ss.delay,
            animationDuration: ss.duration,
          }}
        />
      ))}
    </div>
  );
}
