/**
 * HeroBackdrop — トップ/結果ヒーローの「静止」幻想背景レイヤー。
 *
 * 経緯(2026-06-03 かおる FB):
 * 旧 `PlanetField`(右下の巨大公転惑星)と `WarpField`(80 個流れる星)は
 *  「微妙」「車のフロントウィンドウみたいな動きが要らない」との指摘で廃止。
 * 代わりに、占い/夜空のトーンを残しつつ「動かない」静的レイヤーに置換する。
 *
 * 設計方針(YAGNI 寄り):
 * - 共通 `StarField`(layout レベルの星空)は維持する前提で、その上に
 *   ヒーロー領域だけ薄く彩る静止ネビュラ + ごく弱い装飾光点を重ねる。
 * - アニメーションは一切なし(reduced-motion とも完全一致)。
 * - DOM コストは最小(div 数個 + CSS グラデのみ)、JS は無し。
 * - variant で「top(やや明るめ)」「result(やや渋め・違う配色)」を切り替え。
 *
 * Props:
 * - variant: "top" | "result"
 *   top    — 紫→ピンクのぼんやりオーラ。右上に小さな十字光点
 *   result — シアン→紫のぼんやりオーラ。中央うっすら消失点
 */

type Props = {
  variant: "top" | "result";
};

export function HeroBackdrop({ variant }: Props) {
  const isTop = variant === "top";
  return (
    <div className="hero-backdrop" aria-hidden="true">
      {/* ベースのぼんやり光(占い感の核) */}
      <div
        className="hero-backdrop__aura"
        style={{
          background: isTop
            ? // top: 右下から左上にかけて 紫 → ピンクの幻想ネビュラ
              [
                "radial-gradient(45% 60% at 78% 78%, rgba(168, 85, 247, 0.18), transparent 70%)",
                "radial-gradient(55% 55% at 88% 86%, rgba(244, 114, 182, 0.13), transparent 72%)",
                "radial-gradient(35% 40% at 22% 18%, rgba(34, 211, 238, 0.07), transparent 70%)",
              ].join(", ")
            : // result: 中央うっすら消失点 + 左右に色味を流す
              [
                "radial-gradient(28% 36% at 50% 50%, rgba(231, 236, 255, 0.10), transparent 60%)",
                "radial-gradient(48% 42% at 18% 30%, rgba(34, 211, 238, 0.10), transparent 70%)",
                "radial-gradient(48% 42% at 82% 70%, rgba(168, 85, 247, 0.12), transparent 70%)",
                "radial-gradient(35% 30% at 50% 50%, rgba(244, 114, 182, 0.06), transparent 75%)",
              ].join(", "),
        }}
      />

      {/* 装飾の固定光点(動かない・占いの儀式感) */}
      {isTop ? (
        <>
          {/* 右下惑星の代わりに「遠い 1 等星」を 1 個だけ薄く置く(静止) */}
          <span className="hero-backdrop__sigil hero-backdrop__sigil--planet" />
          {/* 右上に小さな十字光点(静止) */}
          <span className="hero-backdrop__sigil hero-backdrop__sigil--cross" />
        </>
      ) : (
        // result: 中央の消失点ヒント(動かない静止ドット)
        <span className="hero-backdrop__sigil hero-backdrop__sigil--core" />
      )}
    </div>
  );
}
