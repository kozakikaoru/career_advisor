import type { CareerPlan } from "@/lib/schema/result";

/** ヒーロー: 現在地→目標、想定期間チップ(result-dark.html の Hero 節を移植) */
export function ResultHero({ hero }: { hero: CareerPlan["hero"] }) {
  return (
    <section className="pt-14 pb-14 rise">
      <div className="inline-flex items-center gap-2 rounded-full border border-line bg-panel/60 px-4 py-1.5 mb-7">
        <span className="w-2 h-2 rounded-full bg-lime shadow-[0_0_10px_#a3e635]" />
        <span className="text-xs tracking-[0.2em] uppercase text-mute font-display">
          Your Roadmap · Generated
        </span>
      </div>
      <h1 className="font-display text-4xl sm:text-6xl font-bold leading-[1.1] tracking-tight">
        <span className="neon-text">{hero.currentLabel}</span>
        <br />
        <span className="text-mute text-2xl sm:text-3xl font-medium">から </span>
        <span className="text-ice">{hero.goalLabel}</span>
        <span className="text-mute text-2xl sm:text-3xl font-medium"> へ</span>
      </h1>
      <p className="text-mute mt-6 text-base leading-relaxed max-w-xl">{hero.summary}</p>

      <div className="mt-8 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-full border border-line bg-panel/50 px-4 py-2 text-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan shadow-[0_0_8px_#22d3ee]" />
          <span className="text-mute">現在地</span>
          <span className="font-medium">{hero.currentLabel}</span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-line bg-panel/50 px-4 py-2 text-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-violet shadow-[0_0_8px_#a855f7]" />
          <span className="text-mute">目標</span>
          <span className="font-medium">{hero.goalLabel}</span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-line bg-panel/50 px-4 py-2 text-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-pink shadow-[0_0_8px_#f472b6]" />
          <span className="text-mute">想定期間</span>
          <span className="font-medium">{hero.durationText}</span>
        </div>
      </div>
    </section>
  );
}
