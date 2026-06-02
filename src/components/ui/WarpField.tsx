/**
 * WarpField — 結果画面用「奥から手前に流れる星空」(ハイパースペース風)
 *
 * デザイン要件(かおる要望):
 * - 結果ヒーロー周辺に「奥(中央)→ 手前(画面端)」に星が流れる遠近表現を敷く
 * - 「車のフロントウィンドウから星空を見てる」「前に進んでいる感じ」
 * - 中央=消失点、外側=手前
 *
 * 実装方針:
 * - 80 個程度の星を SSR 互換の決定論的ランダム配置で散らす
 * - 各星は CSS @keyframes warp-flow で「中央に微小スケール → 外側へ translate + scale 拡大 + 透明化」
 * - 方向は radial(中心 → ランダム角度の外側方向)、距離はビューポートのはみ出しまで
 * - delay を散らしてループを連続化(常に星が湧き出ているように見える)
 * - prefers-reduced-motion 時はアニメ停止(光点のみ静止表示)
 *
 * Note: SSR と CSR でアニメーション開始位置がズレないよう全数値は固定。
 */

import { useMemo } from "react";

type Props = {
  /** 星の数(デフォルト 80) */
  count?: number;
  /** 1 周分の長さ(s)。短いほど高速に流れる */
  duration?: number;
};

function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function WarpField({ count = 80, duration = 5.6 }: Props) {
  const stars = useMemo(() => {
    const out: Star[] = [];
    for (let i = 0; i < count; i++) {
      const s = i + 1;
      // 流れる方向(角度): 0..360°
      const angleDeg = rand(s) * 360;
      // 終点の半径(viewport の対角線の半分 = 70vmax で画面外へ)
      // 個体差: 60〜100vmax(等距離だと不自然なので散らす)
      const endDistance = 60 + rand(s * 2) * 40;
      // 星の最終的なサイズ
      const endScale = 1.6 + rand(s * 3) * 1.8;
      // 開始時の不透明度(基本 0)→ 進行中に 1 → 終端に 0 に keyframes 側で処理
      // duration の個体差(40% 〜 130%)
      const dur = duration * (0.4 + rand(s * 4) * 0.9);
      // delay: 0 〜 duration の範囲で散らす(常に湧き出てる風)
      const delay = -rand(s * 5) * dur;
      // 色相
      const hueRoll = rand(s * 6);
      const hue: Hue =
        hueRoll < 0.55
          ? "ice"
          : hueRoll < 0.78
            ? "cyan"
            : hueRoll < 0.92
              ? "violet"
              : "pink";

      // 終点 (tx, ty) を vmax 単位で算出
      const rad = (angleDeg * Math.PI) / 180;
      const tx = Math.cos(rad) * endDistance;
      const ty = Math.sin(rad) * endDistance;

      out.push({
        tx: Number(tx.toFixed(2)),
        ty: Number(ty.toFixed(2)),
        endScale: Number(endScale.toFixed(2)),
        duration: Number(dur.toFixed(2)),
        delay: Number(delay.toFixed(2)),
        hue,
      });
    }
    return out;
  }, [count, duration]);

  return (
    <div className="warp-field" aria-hidden="true">
      {/* 中央の発光コア(消失点の暗示・控えめ) */}
      <div className="warp-field__core" />

      {/* 流れる星々 */}
      {stars.map((s, i) => (
        <span
          key={i}
          className="warp-field__streak"
          style={
            {
              // CSS 変数で終点座標と最終スケールを keyframes 側に渡す
              "--tx": `${s.tx}vmax`,
              "--ty": `${s.ty}vmax`,
              "--end-scale": String(s.endScale),
              background: hueToColor(s.hue),
              boxShadow: `0 0 6px ${hueToColor(s.hue, 0.9)}, 0 0 14px ${hueToColor(
                s.hue,
                0.4,
              )}`,
              animation: `warp-flow ${s.duration}s linear ${s.delay}s infinite`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

type Hue = "ice" | "cyan" | "violet" | "pink";
type Star = {
  tx: number;
  ty: number;
  endScale: number;
  duration: number;
  delay: number;
  hue: Hue;
};

function hueToColor(hue: Hue, alpha = 1): string {
  switch (hue) {
    case "ice":
      return `rgba(231, 236, 255, ${alpha})`;
    case "cyan":
      return `rgba(34, 211, 238, ${alpha})`;
    case "violet":
      return `rgba(168, 85, 247, ${alpha})`;
    case "pink":
      return `rgba(244, 114, 182, ${alpha})`;
  }
}
