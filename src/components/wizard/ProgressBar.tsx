"use client";

import type { ProgressSnapshot, SectionKey } from "@/lib/questions/engine";

/** セクション表示用ラベル(Space Grotesk 大文字 + 字間広めで描画) */
const SECTION_LABEL: Record<SectionKey, string> = {
  current: "ORIGIN",
  goal: "GOAL",
  personality: "MINDSET",
};

/**
 * 進捗バー(案C・現在セクション拡大型)。
 *
 * - 完了セクション: 満タンピル + ✓ アイコン(コンパクト)
 * - 現在セクション: 拡大ブロック(セクション名 + STEP n/m + 内部バー)
 * - 未着手セクション: 薄いアウトラインピル(コンパクト)
 *
 * モバイル幅でも崩れないよう、ピルは shrink-0 で最小幅を確保、現在セクションは flex-1。
 * 装飾エリアが極端に狭くなった場合はラベルテキストを非表示にし、アイコン/ドットのみで意味を保つ。
 *
 * グラデーション(bar-active)はアニメ無し(かおる指定で flow アニメは外す)。
 */
export function ProgressBar({ snapshot }: { snapshot: ProgressSnapshot }) {
  const { sections, totalPercent } = snapshot;

  return (
    <div aria-label="進捗">
      {/* 上段: PROGRESS / TOTAL % */}
      <div className="flex justify-between items-baseline mb-3">
        <span className="text-[0.65rem] font-display tracking-[0.25em] uppercase text-mute">
          PROGRESS
        </span>
        <span className="font-display text-xs font-semibold">
          <span className="text-mute">TOTAL</span>
          <span className="text-mute mx-1.5">·</span>
          <span className="neon-text font-bold">{totalPercent}%</span>
        </span>
      </div>

      {/* 下段: セクション化バー */}
      <div className="flex items-stretch gap-1.5 sm:gap-2">
        {sections.map((s) => {
          const label = SECTION_LABEL[s.key];
          if (s.status === "done") {
            return <DonePill key={s.key} label={label} />;
          }
          if (s.status === "active") {
            return (
              <ActiveBlock
                key={s.key}
                label={label}
                step={s.step}
                total={s.total}
              />
            );
          }
          return <TodoPill key={s.key} label={label} />;
        })}
      </div>
    </div>
  );
}

/** 完了セクション(コンパクトな満タンピル + ✓) */
function DonePill({ label }: { label: string }) {
  return (
    <div
      className="shrink-0 seg-fill-done rounded-full h-11 px-2.5 sm:px-3 flex items-center gap-1.5 min-w-[2.75rem] sm:min-w-[5rem]"
      title={`${label}: 完了`}
      aria-label={`${label} 完了`}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#070912"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
        aria-hidden="true"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {/* ラベル: 装飾エリアが極端に狭まる端末では非表示にする(hidden xs:inline はない */}
      {/* ため min-w で守りつつ Tailwind の sm:inline で出し分け) */}
      <span className="text-[0.65rem] font-display font-bold tracking-[0.18em] text-bg hidden sm:inline whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}

/** 未着手セクション(薄いアウトラインピル) */
function TodoPill({ label }: { label: string }) {
  return (
    <div
      className="shrink-0 rounded-full h-11 px-2.5 sm:px-3 border border-line bg-panel2/30 flex items-center gap-1.5 min-w-[2.75rem] sm:min-w-[5rem]"
      title={`${label}: 未着手`}
      aria-label={`${label} 未着手`}
    >
      <span
        aria-hidden="true"
        className="w-2.5 h-2.5 rounded-full border border-mute/60 shrink-0"
      />
      <span className="text-[0.65rem] font-display tracking-[0.18em] text-mute/70 hidden sm:inline whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}

/** 現在セクション(拡大ブロック・STEP n/m + 内部バー) */
function ActiveBlock({
  label,
  step,
  total,
}: {
  label: string;
  step: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.min(100, Math.round((step / total) * 100));
  return (
    <div
      className="flex-1 min-w-0 rounded-2xl border border-violet/50 bg-gradient-to-br from-violet/15 via-panel2/60 to-pink/10 px-3 sm:px-3.5 py-2 sm:py-2.5 relative overflow-hidden glow-ring"
      aria-label={`${label} 進行中 ステップ ${step} / ${total}`}
    >
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, rgba(168,85,247,0.35), transparent 70%)",
        }}
        aria-hidden="true"
      />
      <div className="relative flex items-center justify-between mb-1.5 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            aria-hidden="true"
            className="w-1.5 h-1.5 rounded-full bg-pink shadow-[0_0_8px_#f472b6] pulse-dot shrink-0"
          />
          <span className="text-[0.7rem] font-display font-semibold tracking-[0.18em] text-pink truncate">
            NOW · {label}
          </span>
        </div>
        <span className="font-display text-[0.7rem] font-bold whitespace-nowrap shrink-0">
          <span className="text-ice">STEP {step}</span>
          <span className="text-mute"> / {total}</span>
        </span>
      </div>
      <div
        className="relative h-1.5 bg-panel2/80 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={step}
      >
        {/* 静的グラデ(かおる指定でアニメ無し) */}
        <div
          className="absolute inset-y-0 left-0 bar rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
