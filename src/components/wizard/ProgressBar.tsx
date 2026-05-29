"use client";

/** 進捗バー(おおよそ)。current/total で割合を出す。ネオングラデのバー。 */
export function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.min(100, Math.round((current / total) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs text-mute mb-2 font-display tracking-wider">
        <span>STEP {current} / 約{total}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-panel2 rounded-full overflow-hidden">
        <div
          className="h-1.5 bar rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
