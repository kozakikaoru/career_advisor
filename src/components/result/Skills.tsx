import type { CareerPlan } from "@/lib/schema/result";

const TAG_COLORS = [
  "text-cyan bg-cyan/10 border-cyan/25",
  "text-violet bg-violet/10 border-violet/25",
  "text-pink bg-pink/10 border-pink/25",
  "text-lime bg-lime/10 border-lime/25",
  "text-mute bg-panel2 border-line",
];

/** C. 必要なスキル・学習リスト + 活かせる強み(タグ) */
export function Skills({ skills }: { skills: CareerPlan["skills"] }) {
  return (
    <div className="glow-card rounded-2xl p-6 sm:p-7">
      <div className="flex items-center gap-2.5 mb-6">
        <span className="text-lg">📡</span>
        <h2 className="font-display text-lg font-semibold tracking-tight">必要なスキル・学習リスト</h2>
      </div>
      <ul className="space-y-3 mb-6">
        {skills.learning.map((item, i) => (
          <li key={i} className="flex items-center gap-3 text-sm">
            <span className="w-5 h-5 rounded-md border border-line shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs font-display tracking-wider uppercase text-mute mb-3">活かせる強み</p>
      <div className="flex flex-wrap gap-2">
        {skills.strengths.map((s, i) => (
          <span
            key={i}
            className={`text-xs font-medium rounded-full border px-3 py-1.5 ${
              TAG_COLORS[i % TAG_COLORS.length]
            }`}
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
