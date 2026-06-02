/**
 * トップヒーロー右下に「画面外に半分はみ出した大きな惑星」+ その周りを公転する星々。
 *
 * デザイン要件(かおる要望):
 * - 右下に巨大惑星(画面の 1/3 ほど・半分は画面外に見切れる)
 * - 紫→深青→ピンクのリング状グラデで輝く
 * - 3〜5 個の星が楕円軌道で公転(20〜60s 周期・速度違い)
 * - スマホでも崩れない(viewport が狭いと半径も縮む)
 *
 * 実装方針:
 * - 惑星: CSS radial-gradient + box-shadow(リング光)
 * - 軌道: ::before で薄い楕円リング(prefers-reduced-motion でも軌道は見える)
 * - 公転星: 軌道の中心(=惑星の中心)を origin にして transform: rotate() で回す。
 *   星本体は逆回転 + translate(軌道半径) で「軌道に乗っている」見た目を作る。
 * - レスポンシブ: 親要素の width/height を vmin で取り、軌道半径も % 指定で自動追従。
 *
 * 性能: 全て CSS keyframes 任せで JS は無し。GPU レイヤを意識して transform/opacity のみ動かす。
 */
export function PlanetField() {
  // 公転衛星(軌道半径 % / 周期 / 開始角度 / 色)
  // 半径は「惑星中心からの距離」を惑星直径に対する % で指定
  const satellites: Sat[] = [
    { radius: 64, duration: 36, phase: 0, hue: "cyan", size: 8 },
    { radius: 78, duration: 52, phase: 130, hue: "pink", size: 6 },
    { radius: 94, duration: 28, phase: 220, hue: "ice", size: 5 },
    { radius: 108, duration: 64, phase: 70, hue: "violet", size: 7 },
    { radius: 120, duration: 44, phase: 310, hue: "ice", size: 4 },
  ];

  return (
    <div className="planet-field" aria-hidden="true">
      {/* 惑星本体 + 軌道リング群 */}
      <div className="planet-field__core">
        {/* 軌道リング(惑星より大きい円・薄い線) */}
        {satellites.map((s, i) => (
          <span
            key={`orbit-${i}`}
            className="planet-field__orbit"
            style={{
              width: `${s.radius * 2}%`,
              height: `${s.radius * 2}%`,
            }}
          />
        ))}

        {/* 惑星 */}
        <span className="planet-field__planet" />

        {/* 公転星 */}
        {satellites.map((s, i) => (
          <span
            key={`sat-${i}`}
            className="planet-field__satellite-wrap"
            style={{
              width: `${s.radius * 2}%`,
              height: `${s.radius * 2}%`,
              animation: `planet-orbit ${s.duration}s linear infinite`,
              animationDelay: `${-(s.duration * s.phase) / 360}s`,
            }}
          >
            <span
              className="planet-field__satellite"
              style={{
                width: s.size,
                height: s.size,
                background: hueToColor(s.hue),
                boxShadow: `0 0 ${s.size * 2}px ${hueToColor(s.hue)}, 0 0 ${
                  s.size * 4
                }px ${hueToColor(s.hue, 0.45)}`,
              }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

type Hue = "cyan" | "violet" | "pink" | "ice";
type Sat = {
  radius: number; // 惑星直径に対する%(50 = 惑星半径と同じ)
  duration: number; // 公転周期(s)
  phase: number; // 0..360 の開始角度
  hue: Hue;
  size: number; // px
};

function hueToColor(hue: Hue, alpha = 1): string {
  switch (hue) {
    case "cyan":
      return `rgba(34, 211, 238, ${alpha})`;
    case "violet":
      return `rgba(168, 85, 247, ${alpha})`;
    case "pink":
      return `rgba(244, 114, 182, ${alpha})`;
    case "ice":
      return `rgba(231, 236, 255, ${alpha})`;
  }
}
