import type { CareerPlan } from "@/lib/schema/result";

const BARS = ["bar", "bar2", "bar3", "bar"];

/** E. タイプ分析(タイプ名 + 指標バー) */
export function PersonalityType({
  personality,
}: {
  personality: CareerPlan["personality"];
}) {
  return (
    <div className="glow-card rounded-2xl p-6 sm:p-7">
      <div className="flex items-center gap-2.5 mb-6">
        <span className="text-lg">🧬</span>
        <h2 className="font-display text-lg font-semibold tracking-tight">タイプ分析</h2>
      </div>
      <div className="rounded-2xl border border-line bg-panel2/60 p-5 text-center mb-5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet/10 to-cyan/10" />
        <div className="relative text-4xl mb-2">{personality.emoji}</div>
        <p className="relative text-[0.7rem] font-display tracking-[0.25em] uppercase text-cyan mb-1">
          Type
        </p>
        <h3 className="relative font-semibold text-lg neon-text">{personality.typeName}</h3>
      </div>
      <p className="text-mute text-sm leading-relaxed mb-5">{personality.summary}</p>
      <div className="space-y-3.5">
        {personality.traits.map((t, i) => (
          <div key={i}>
            <div className="flex justify-between text-xs mb-1.5">
              <span>{t.label}</span>
              <span className="text-mute">{t.comment}</span>
            </div>
            <div className="h-1.5 bg-panel2 rounded-full overflow-hidden">
              <div
                className={`h-1.5 ${BARS[i % BARS.length]} rounded-full`}
                style={{ width: `${t.level}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
