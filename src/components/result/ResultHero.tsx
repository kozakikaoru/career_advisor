import type { Hero } from "@/lib/schema/result";

/**
 * ヒーロー(全案共通)。
 * v2: tagline(AI 生成キャッチコピー)を大見出しで表示。
 *     「○○から××へ」の動的表示は廃止(specs §3-1 / §6-3)。
 * 2026-06-03: 旧 WarpField / HeroBackdrop / ResultSparkles はすべて廃止。
 *     ベース bg + tagline の neon-text のみで素朴に見せる。
 */
export function ResultHero({ hero }: { hero: Hero }) {
  return (
    <section className="relative pt-14 pb-14 rise">
      <div className="relative">
        <div className="inline-flex items-center gap-2 rounded-full border border-line bg-panel/60 px-4 py-1.5 mb-7">
          <span className="w-2 h-2 rounded-full bg-lime shadow-[0_0_10px_#a3e635]" />
          <span className="text-xs tracking-[0.2em] uppercase text-mute font-display">
            Your Roadmap · Read from the Stars
          </span>
        </div>
        <h1 className="relative font-display text-4xl sm:text-6xl font-bold leading-[1.1] tracking-tight">
          <span className="neon-text break-words">{hero.tagline}</span>
        </h1>
        <p className="text-mute mt-6 text-base leading-relaxed max-w-2xl">
          {hero.summary}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-full border border-line bg-panel/50 px-4 py-2 text-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-pink shadow-[0_0_8px_#f472b6]" />
            <span className="text-mute">想定期間</span>
            <span className="font-medium">{hero.durationText}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-line bg-panel/50 px-4 py-2 text-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan shadow-[0_0_8px_#22d3ee]" />
            <span className="text-mute">3 つの進路候補をタブで比較できます</span>
          </div>
        </div>
      </div>
    </section>
  );
}
