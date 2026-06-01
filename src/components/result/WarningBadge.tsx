import type { Feasibility } from "@/lib/schema/result";

/**
 * feasibility に応じた警告バッジ(specs §6-5)。
 * - realistic: バッジなし(コンポーネント自体を出さない)
 * - challenging: 黄色
 * - very_challenging: 橙
 * - extreme_effort: 赤(誹謗中傷にならないトーン・「超努力が必要」)
 */
const STYLE: Record<
  Exclude<Feasibility, "realistic">,
  { label: string; cls: string }
> = {
  challenging: {
    label: "挑戦的",
    cls: "text-amber-300 bg-amber-300/10 border-amber-300/30",
  },
  very_challenging: {
    label: "かなり厳しい",
    cls: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  },
  extreme_effort: {
    label: "超努力が必要",
    cls: "text-red-400 bg-red-400/10 border-red-400/30",
  },
};

export function WarningBadge({ feasibility }: { feasibility: Feasibility }) {
  if (feasibility === "realistic") return null;
  const s = STYLE[feasibility];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[0.7rem] font-display tracking-wider rounded-full border px-3 py-1 font-bold ${s.cls}`}
      aria-label={`難易度: ${s.label}`}
    >
      <span aria-hidden>⚠</span>
      {s.label}
    </span>
  );
}
