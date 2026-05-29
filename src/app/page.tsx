import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export default function Home() {
  return (
    <>
      <header className="relative z-10 border-b border-line/70 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-4 text-sm text-mute">
            <Link href="/legal/terms" className="hover:text-ice transition">
              利用規約
            </Link>
            <Link href="/legal/privacy" className="hover:text-ice transition">
              プライバシー
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-5">
        {/* Hero */}
        <section className="pt-20 pb-16 sm:pt-28 rise">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-panel/60 px-4 py-1.5 mb-8">
            <span className="w-2 h-2 rounded-full bg-lime shadow-[0_0_10px_#a3e635]" />
            <span className="text-xs tracking-[0.2em] uppercase text-mute font-display">
              AI Career Roadmap
            </span>
          </div>

          <h1 className="font-display text-4xl sm:text-6xl font-bold leading-[1.1] tracking-tight max-w-3xl">
            <span className="text-ice">今いる場所から、</span>
            <br />
            <span className="neon-text">なりたい自分までの地図を。</span>
          </h1>

          <p className="text-mute mt-7 text-base sm:text-lg leading-relaxed max-w-xl">
            いくつかの質問に答えるだけ。AI があなたの現在地・目標・価値観を読み解き、
            目標達成までの段階的なロードマップを描きます。登録不要・匿名。
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/diagnosis"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan to-violet text-bg font-bold rounded-full px-8 py-4 hover:scale-[1.03] transition glow-ring"
            >
              診断をはじめる
              <svg
                width="18"
                height="18"
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
            </Link>
            <span className="text-xs text-mute">所要 2〜4 分 / 約 12 問</span>
          </div>
        </section>

        {/* 3 軸 + アウトプット説明 */}
        <section className="pb-16">
          <div className="grid sm:grid-cols-3 gap-4 mb-5">
            <Feature
              emoji="🧭"
              title="3 つの軸で聞く"
              text="現在の状況・目標・性格や価値観。回答に応じて質問が分岐します。"
            />
            <Feature
              emoji="🛰️"
              title="可変ロードマップ"
              text="あなた専用の段数・期間で、現在地から目標までの道のりを可視化。"
            />
            <Feature
              emoji="🔗"
              title="URLで後から再表示"
              text="結果は匿名で保存。発行されたURLを控えれば別の端末でも開けます。"
            />
          </div>
          <p className="text-xs text-mute/70 leading-relaxed max-w-2xl">
            ※ 生成される進路プランは AI による参考情報です。内容の正確性・実現可能性を保証するものではありません。
            進路の最終判断はご自身の責任で行ってください。
          </p>
        </section>
      </main>

      <footer className="relative z-10 max-w-5xl mx-auto px-5 pb-12">
        <p className="text-center text-xs text-mute/60 font-display tracking-wide">
          NEXUS.path
        </p>
      </footer>
    </>
  );
}

function Feature({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div className="glow-card rounded-2xl p-6">
      <div className="text-2xl mb-3">{emoji}</div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-mute text-sm leading-relaxed">{text}</p>
    </div>
  );
}
