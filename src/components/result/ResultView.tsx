import Link from "next/link";
import type { CareerPlan } from "@/lib/schema/result";
import { Logo } from "@/components/ui/Logo";
import { ResultHero } from "./ResultHero";
import { Roadmap } from "./Roadmap";
import { Candidates } from "./Candidates";
import { Skills } from "./Skills";
import { PersonalityType } from "./PersonalityType";
import { NextAction } from "./NextAction";
import { ShareUrl } from "./ShareUrl";

/** 結果ページ全体の組み立て。CareerPlan と 結果URL を受け取って描画する。 */
export function ResultView({ plan, url }: { plan: CareerPlan; url: string }) {
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
        <Roadmap roadmap={plan.roadmap} />
        <Candidates candidates={plan.candidates} />

        {/* C(スキル) + E(タイプ分析) を 2 カラムで */}
        <section className="grid md:grid-cols-2 gap-5 mb-14">
          <Skills skills={plan.skills} />
          <PersonalityType personality={plan.personality} />
        </section>

        <NextAction nextAction={plan.nextAction} />
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
