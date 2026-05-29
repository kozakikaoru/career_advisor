import type { CareerPlan } from "@/lib/schema/result";

/** D. 今すぐやるべき次の一歩。グラデ枠 + 雷アイコンの装飾(result-dark.html の Next action 節)。 */
export function NextAction({ nextAction }: { nextAction: CareerPlan["nextAction"] }) {
  return (
    <section className="mb-12">
      <div className="relative rounded-3xl p-[1.5px] bg-gradient-to-r from-cyan via-violet to-pink overflow-hidden">
        <div className="rounded-[calc(1.5rem-1.5px)] bg-panel p-7 sm:p-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute -right-8 -bottom-10 text-[9rem] opacity-10 select-none">⚡</div>
          <div className="relative">
            <p className="text-xs font-display tracking-[0.2em] uppercase text-cyan mb-2.5">
              今すぐやるべき一歩
            </p>
            <h2 className="text-xl sm:text-2xl font-semibold leading-snug max-w-xl neon-text">
              {nextAction.title}
            </h2>
            <p className="text-mute text-sm mt-3">{nextAction.detail}</p>
          </div>
          <div className="relative shrink-0 bg-gradient-to-r from-cyan to-violet text-bg font-bold rounded-full px-7 py-3.5 inline-flex items-center gap-2 glow-ring select-none">
            ここから
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
