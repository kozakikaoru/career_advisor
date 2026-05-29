import type { CareerPlan, Candidate } from "@/lib/schema/result";

const ACCENTS = [
  {
    bar: "bar",
    text: "text-cyan",
    iconBg: "bg-cyan/10 border-cyan/30",
    glow: "bg-cyan/20",
    emoji: "🚀",
  },
  {
    bar: "bar2",
    text: "text-violet",
    iconBg: "bg-violet/10 border-violet/30",
    glow: "bg-violet/20",
    emoji: "🔍",
  },
  {
    bar: "bar3",
    text: "text-pink",
    iconBg: "bg-pink/10 border-pink/30",
    glow: "bg-pink/20",
    emoji: "🎨",
  },
];

/** B. おすすめの進路候補(match% バー)。最有力には発光バッジ。 */
export function Candidates({ candidates }: { candidates: CareerPlan["candidates"] }) {
  // グリッド列数は件数に合わせる(最大3列)
  const cols = Math.min(candidates.length, 3);
  const gridCols =
    cols >= 3 ? "sm:grid-cols-3" : cols === 2 ? "sm:grid-cols-2" : "sm:grid-cols-1";

  return (
    <section className="mb-14">
      <div className="flex items-center gap-2.5 mb-6 px-1">
        <span className="text-lg">💡</span>
        <h2 className="font-display text-xl font-semibold tracking-tight">おすすめの進路候補</h2>
      </div>
      <div className={`grid ${gridCols} gap-4`}>
        {candidates.map((c, i) => (
          <CandidateCard key={`${c.title}-${i}`} candidate={c} index={i} />
        ))}
      </div>
    </section>
  );
}

function CandidateCard({ candidate, index }: { candidate: Candidate; index: number }) {
  const a = ACCENTS[index % ACCENTS.length];
  const top = candidate.isTop || index === 0;

  return (
    <article className="glow-card rounded-2xl p-6 relative hover:-translate-y-1 transition overflow-hidden">
      {top && (
        <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full ${a.glow} blur-2xl`} />
      )}
      {top && (
        <span className="relative inline-block text-[0.65rem] font-display tracking-wider text-bg bg-gradient-to-r from-cyan to-violet rounded-full px-2.5 py-1 mb-4 font-bold">
          最有力
        </span>
      )}
      <div
        className={`relative w-11 h-11 rounded-xl border ${a.iconBg} flex items-center justify-center text-xl mb-3`}
      >
        {a.emoji}
      </div>
      <h3 className="relative font-semibold mb-2 leading-snug">{candidate.title}</h3>
      <p className="relative text-mute text-xs leading-relaxed mb-4">{candidate.description}</p>
      <div className="relative flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-panel2 rounded-full overflow-hidden">
          <div
            className={`h-1.5 ${a.bar} rounded-full`}
            style={{ width: `${candidate.matchPercent}%` }}
          />
        </div>
        <span className={`font-display text-sm font-bold ${a.text}`}>
          {candidate.matchPercent}%
        </span>
      </div>
    </article>
  );
}
