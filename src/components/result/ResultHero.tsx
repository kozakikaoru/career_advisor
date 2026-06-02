import type { Hero } from "@/lib/schema/result";
import { WarpField } from "@/components/ui/WarpField";

/**
 * ヒーロー(全案共通)。
 * v2: tagline(AI 生成キャッチコピー)を大見出しで表示し、
 *     「○○から××へ」の動的表示は廃止(specs §3-1 / §6-3)。
 * v2.2: 結果画面は「奥→手前に流れる」遠近表現の WarpField を背景に敷く。
 *       「ロードマップを描いた=前に進んでいる」気持ちを演出。
 */
export function ResultHero({ hero }: { hero: Hero }) {
  return (
    <section className="relative pt-14 pb-14 rise overflow-hidden">
      {/* 結果ヒーロー専用の WarpField(奥から手前に流れる遠近表現) */}
      <div className="absolute inset-0 -z-0 pointer-events-none">
        <WarpField />
      </div>

      <div className="relative">
        <div className="inline-flex items-center gap-2 rounded-full border border-line bg-panel/60 px-4 py-1.5 mb-7">
          <span className="w-2 h-2 rounded-full bg-lime shadow-[0_0_10px_#a3e635] twinkle" />
          <span className="text-xs tracking-[0.2em] uppercase text-mute font-display">
            Your Roadmap · Read from the Stars
          </span>
        </div>
        <h1 className="relative font-display text-4xl sm:text-6xl font-bold leading-[1.1] tracking-tight">
          <span className="neon-text break-words">{hero.tagline}</span>
          {/* tagline 周辺の星屑(装飾)*/}
          <ResultSparkles />
        </h1>
        <p className="text-mute mt-6 text-base leading-relaxed max-w-2xl">
          {hero.summary}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-full border border-line bg-panel/50 px-4 py-2 text-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-pink shadow-[0_0_8px_#f472b6] twinkle" />
            <span className="text-mute">想定期間</span>
            <span className="font-medium">{hero.durationText}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-line bg-panel/50 px-4 py-2 text-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan shadow-[0_0_8px_#22d3ee] twinkle" />
            <span className="text-mute">3 つの進路候補をタブで比較できます</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/** tagline 周辺に散らす星屑。位置は固定。 */
function ResultSparkles() {
  const spots = [
    { top: "-12%", left: "88%", size: 5, delay: "0.4s", hue: "cyan" },
    { top: "30%", left: "100%", size: 4, delay: "2.1s", hue: "pink" },
    { top: "78%", left: "12%", size: 3, delay: "1.5s", hue: "ice" },
    { top: "-8%", left: "32%", size: 3, delay: "3.4s", hue: "violet" },
  ];
  return (
    <span aria-hidden="true" className="pointer-events-none">
      {spots.map((s, i) => (
        <span
          key={i}
          className="twinkle absolute rounded-full"
          style={{
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            background:
              s.hue === "cyan"
                ? "#22d3ee"
                : s.hue === "pink"
                  ? "#f472b6"
                  : s.hue === "violet"
                    ? "#a855f7"
                    : "#e7ecff",
            boxShadow: `0 0 ${s.size * 2}px ${
              s.hue === "cyan"
                ? "#22d3ee"
                : s.hue === "pink"
                  ? "#f472b6"
                  : s.hue === "violet"
                    ? "#a855f7"
                    : "rgba(231, 236, 255, 0.85)"
            }`,
            animationDelay: s.delay,
          }}
        />
      ))}
    </span>
  );
}
