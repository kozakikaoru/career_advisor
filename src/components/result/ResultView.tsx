"use client";

import { useState } from "react";
import Link from "next/link";
import type { CareerPlan } from "@/lib/schema/result";
import { Logo } from "@/components/ui/Logo";
import { ResultHero } from "./ResultHero";
import { PlanTabs } from "./PlanTabs";
import { PlanContent } from "./PlanContent";
import { PersonalityType } from "./PersonalityType";
import { ShareUrl } from "./ShareUrl";

/**
 * 結果ページ全体の組み立て(v2 / specs §3 / §6-1)。
 *
 * 構造:
 *   Hero(共通) → Tabs → 選択中の Plan(CandidateHeader → Roadmap → Skills → AdSlot)
 *   → PersonalityType(共通) → ShareUrl + 免責
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

        <PlanTabs
          plans={plan.plans}
          activeIndex={activeIndex}
          onChange={setActiveIndex}
        />

        {/* タブ内コンテンツ(クロスフェード) */}
        <div key={activeIndex} className="rise">
          <PlanContent plan={activePlan} index={activeIndex} />
        </div>

        {/* 全案共通の PersonalityType(タブ外・最下部) */}
        <section className="mt-12 mb-10">
          <PersonalityType personality={plan.personality} />
        </section>
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
