"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import type { Plan } from "@/lib/schema/result";

/**
 * 進路 3 タブ(specs §3-2 / §6-2)。
 * - 各タブのラベルは candidate.title
 * - マッチ度バッジ + 難易度ドット
 * - クライアントコンポーネント(クリックハンドリングのため)
 * - リボン表示なし(specs §6-2 / 論点 7)
 *
 * 2026-06-02 追加(かおる要望 #1 / #2):
 * - スマホでは active タブの幅をコンテナの ~85% に揃え、右側に「次タブの一部」がチラ見えするカルーセル風に。
 * - 親から呼べる `scrollTabIntoCenter(i)` を ref 経由で公開。「他のプランを見る」ボタンでタブ自体が画面外でも、
 *   タブ列を左右スクロールして中央付近に出すために使う。
 */

export type PlanTabsHandle = {
  /** 指定 index のタブをコンテナ内で中央付近にスクロールで合わせる(スマホ用) */
  scrollTabIntoCenter: (i: number) => void;
};

export const PlanTabs = forwardRef<
  PlanTabsHandle,
  {
    plans: readonly Plan[];
    activeIndex: number;
    onChange: (i: number) => void;
  }
>(function PlanTabs({ plans, activeIndex, onChange }, ref) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useImperativeHandle(
    ref,
    () => ({
      scrollTabIntoCenter(i: number) {
        const scroller = scrollerRef.current;
        const target = tabRefs.current[i];
        if (!scroller || !target) return;
        // タブ要素の中心が scroller の中心に来る位置までスクロール
        const targetCenter = target.offsetLeft + target.offsetWidth / 2;
        const left = targetCenter - scroller.clientWidth / 2;
        scroller.scrollTo({ left, behavior: "smooth" });
      },
    }),
    [],
  );

  return (
    <div className="mb-6" role="tablist" aria-label="進路候補 3 案">
      <div
        ref={scrollerRef}
        className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 -mx-1 px-1 plan-tabs-scroller"
      >
        {plans.map((plan, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={i}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              aria-selected={active}
              aria-controls={`plan-panel-${i}`}
              id={`plan-tab-${i}`}
              onClick={() => onChange(i)}
              className={[
                "relative shrink-0 rounded-2xl border px-4 py-3.5 text-center transition",
                // モバイルは「画面幅の ~68%」(右側に次タブをしっかり見せる)。
                // PC は flex-1 で横幅いっぱい等分(2026-06-03 かおる指示)。
                "w-[68%] sm:w-auto sm:flex-1 sm:min-w-0 sm:shrink",
                // backdrop-filter で背景ホロスコープ盤がうっすらにじむ(モック B-wheel/result.html `.tab` 参照)
                "backdrop-blur-md",
                active
                  ? "bg-gradient-to-br from-cyan/15 to-violet/10 border-cyan/60 shadow-[0_0_24px_rgba(34,211,238,0.15)]"
                  : "bg-panel/55 border-line hover:border-cyan/40",
              ].join(" ")}
            >
              {/* 2026-06-03 かおる FB: 右上の % 表示は削除。
                  下のマッチ度カード(CandidateHeader)に同じ情報があるので冗長。
                  タブはプラン名 / 実現可能性ドット だけで構成し、視覚的にスッキリ。 */}

              {/* センタリング: items-center justify-center で縦横とも中央 */}
              <div className="flex flex-col items-center justify-center gap-1.5">
                {/* PLAN ラベル(小・cyan) */}
                <span
                  className={[
                    "text-[0.65rem] font-display tracking-[0.2em] uppercase",
                    active ? "text-cyan" : "text-mute",
                  ].join(" ")}
                >
                  Plan {i + 1}
                </span>

                {/* プラン名(タイトル大) */}
                <p className="text-sm sm:text-[0.95rem] font-semibold leading-snug line-clamp-2 max-w-full">
                  {plan.candidate.title}
                </p>

                {/* 実現可能性ドット + ラベル */}
                <div className="mt-0.5 flex items-center justify-center gap-2">
                  <FeasibilityDot feasibility={plan.candidate.feasibility} />
                  <span className="text-[0.65rem] text-mute">
                    {FEASIBILITY_LABEL[plan.candidate.feasibility]}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});

const FEASIBILITY_LABEL = {
  realistic: "現実的",
  challenging: "挑戦的",
  very_challenging: "かなり厳しい",
  extreme_effort: "超努力が必要",
} as const;

const FEASIBILITY_DOT = {
  realistic: "bg-lime shadow-[0_0_8px_#a3e635]",
  challenging: "bg-amber-300 shadow-[0_0_8px_#fcd34d]",
  very_challenging: "bg-orange-400 shadow-[0_0_8px_#fb923c]",
  extreme_effort: "bg-red-400 shadow-[0_0_8px_#f87171]",
} as const;

function FeasibilityDot({
  feasibility,
}: {
  feasibility: keyof typeof FEASIBILITY_DOT;
}) {
  return (
    <span
      aria-hidden
      className={`inline-block w-2 h-2 rounded-full ${FEASIBILITY_DOT[feasibility]}`}
    />
  );
}
