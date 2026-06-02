"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { CareerPlan } from "@/lib/schema/result";
import { Logo } from "@/components/ui/Logo";
import { ResultHero } from "./ResultHero";
import { PlanTabs, type PlanTabsHandle } from "./PlanTabs";
import { PlanContent } from "./PlanContent";
import { ShareUrl } from "./ShareUrl";

/**
 * 結果ページ全体の組み立て(v2 / specs §3 / §6-1)。
 *
 * 構造:
 *   Hero(共通) → Tabs → 選択中の Plan(CandidateHeader → Roadmap → Skills → 他プランCTA → AdSlot)
 *   → ShareUrl + 免責
 *
 * 2026-06-02 PersonalityType セクション撤去(Gemini 502 対応):
 *   prompt/responseSchema の単純化のため、結果画面の PersonalityType ブロックを撤去。
 *   MINDSET の回答自体は AI 入力に渡り、各 Plan の説明やロードマップに反映される。
 *
 * 2026-06-02 「他のプランを見る」CTA(かおる要望 #2):
 *   PlanContent から呼ばれる goNextPlan() で
 *   1) 次プラン(循環: 1→2→3→1) 2) Tabs へスクロールバック 3) スマホ用に Tab を中央へ
 *
 * タブ状態は useState で管理(クライアントコンポーネント)。
 * 初期表示は plans[0]、ただし isTop=true が他にあればそれを優先。
 */
export function ResultView({ plan, url }: { plan: CareerPlan; url: string }) {
  const initial = (() => {
    const topIdx = plan.plans.findIndex((p) => p.candidate.isTop);
    return topIdx >= 0 ? topIdx : 0;
  })();
  const [activeIndex, setActiveIndex] = useState(initial);
  const activePlan = plan.plans[activeIndex];

  // PlanTabs の領域。「他のプランを見る」押下時、ここまでスクロールバック。
  const tabsSectionRef = useRef<HTMLDivElement | null>(null);
  // PlanTabs 内部のスクロール制御(スマホでタブが画面外でも中央付近に出す)
  const planTabsHandle = useRef<PlanTabsHandle | null>(null);

  const goNextPlan = () => {
    const next = (activeIndex + 1) % plan.plans.length;
    setActiveIndex(next);

    // 画面: タブ位置までスクロールバック。
    // prefers-reduced-motion 時は smooth を諦めて瞬間移動(ブラウザ側で respect)。
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const sectionEl = tabsSectionRef.current;
    if (sectionEl) {
      sectionEl.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
      });
    }

    // タブ列内: 次タブを中央へ(スマホで横スクロール状態の時に有効)。
    // スクロール完了を待つ必要は薄いので軽い遅延だけ入れる。
    window.setTimeout(() => {
      planTabsHandle.current?.scrollTabIntoCenter(next);
    }, 50);
  };

  return (
    <>
      {/* Header */}
      <header className="relative z-10 border-b border-line/70 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <Logo />
          <Link
            href="/diagnosis"
            className="text-sm font-medium text-mute border border-line rounded-full px-4 py-1.5 hover:text-ice hover:border-cyan transition"
          >
            最初からやり直す
          </Link>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-5 pb-16">
        <ResultHero hero={plan.hero} />

        <div ref={tabsSectionRef} className="scroll-mt-20">
          <PlanTabs
            ref={planTabsHandle}
            plans={plan.plans}
            activeIndex={activeIndex}
            onChange={(i) => {
              setActiveIndex(i);
              // 手動でタブを選んだ時もスマホでは中央に寄せる(チラ見せの右側を踏んだ場合の補正)
              window.setTimeout(() => {
                planTabsHandle.current?.scrollTabIntoCenter(i);
              }, 50);
            }}
          />
        </div>

        {/* タブ内コンテンツ(クロスフェード) */}
        <div key={activeIndex} className="rise">
          <PlanContent
            plan={activePlan}
            index={activeIndex}
            total={plan.plans.length}
            onNavigateNext={goNextPlan}
          />
        </div>
      </main>

      {/* Save / Share + 免責 */}
      <footer className="relative z-10 max-w-5xl mx-auto px-5 pb-12">
        <ShareUrl url={url} />
        <p className="text-center text-xs text-mute/70 mt-6 leading-relaxed max-w-2xl mx-auto">
          ※ この結果は AI が生成した参考情報です。内容の正確性・実現可能性を保証するものではなく、
          進路・就職・転職の最終判断はご自身の責任で行ってください。医療・法律・投資などの専門的助言ではありません。
        </p>
        <p className="text-center text-xs text-mute/60 mt-3 font-display tracking-wide">
          NEXUS.path
        </p>
      </footer>
    </>
  );
}
