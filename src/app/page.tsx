import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { StarField } from "@/components/ui/StarField";

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
        {/* Hero
            - ambient(layout)に加えて hero variant の StarField を section 内に重ね、
              ヒーロー周辺だけ星座ライン + 流れ星でグッと「占いっぽさ」を盛る。
            - section に position: relative + overflow-hidden で StarField をローカルに閉じ込める。 */}
        <section className="relative pt-20 pb-16 sm:pt-28 rise overflow-hidden">
          <div className="absolute inset-0 -z-0 pointer-events-none">
            <StarField variant="hero" density="normal" />
          </div>

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-panel/60 px-4 py-1.5 mb-8">
              <span className="w-2 h-2 rounded-full bg-lime shadow-[0_0_10px_#a3e635] twinkle" />
              <span className="text-xs tracking-[0.2em] uppercase text-mute font-display">
                Guided by the stars · AI Career Roadmap
              </span>
            </div>

            <h1 className="relative font-display text-4xl sm:text-6xl font-bold leading-[1.1] tracking-tight max-w-3xl">
              <span className="text-ice">今いる場所から、</span>
              <br />
              <span className="neon-text">なりたい自分までの地図を。</span>
              {/* H1 周辺の星屑(装飾・aria-hidden)*/}
              <Sparkles />
            </h1>

            <p className="text-mute mt-7 text-base sm:text-lg leading-relaxed max-w-xl">
              約 35 問に答えるだけ。星々のように散らばったあなたの回答を AI が
              読み解き、業界事情を踏まえた 3 本の進路ロードマップを提示します。
              登録不要・匿名。
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/diagnosis"
                className="star-aura inline-flex items-center gap-2 bg-gradient-to-r from-cyan to-violet text-bg font-bold rounded-full px-8 py-4 hover:scale-[1.03] transition glow-ring"
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
              <span className="text-xs text-mute">所要 約 10 分 / 約 35 問</span>
            </div>
          </div>
        </section>

        {/* 3 軸 + アウトプット説明 */}
        <section className="pb-16">
          <div className="grid sm:grid-cols-3 gap-4 mb-5">
            <Feature
              emoji="🗺️"
              title="3 本のロードマップ"
              text="ひとつの正解に絞らず、複数の進路を並列で提示。タブで切り替えて比較できます。"
            />
            <Feature
              emoji="👥"
              title="10 立場に対応"
              text="学生・社会人・主婦・退職者など、立場に応じて質問が分岐。誰でも答えられます。"
            />
            <Feature
              emoji="🔗"
              title="完全匿名 + URL 保存"
              text="登録・個人情報不要。発行された URL を控えれば別の端末でも再表示できます。"
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

/** H1 周辺の星屑(装飾)。位置は意図的に固定。 */
function Sparkles() {
  // 各 span に独立した遅延を持たせて「ふっと光る」を演出
  const spots = [
    { top: "-10%", left: "92%", size: 6, delay: "0s", hue: "cyan" },
    { top: "12%", left: "98%", size: 4, delay: "1.4s", hue: "pink" },
    { top: "55%", left: "88%", size: 5, delay: "2.6s", hue: "violet" },
    { top: "85%", left: "75%", size: 3, delay: "0.9s", hue: "ice" },
    { top: "-15%", left: "60%", size: 4, delay: "3.2s", hue: "ice" },
  ];
  return (
    <span aria-hidden="true" className="pointer-events-none">
      {spots.map((s, i) => (
        <span
          key={i}
          className="twinkle absolute rounded-full"
          style={{
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            background:
              s.hue === "cyan"
                ? "#22d3ee"
                : s.hue === "pink"
                  ? "#f472b6"
                  : s.hue === "violet"
                    ? "#a855f7"
                    : "#e7ecff",
            boxShadow: `0 0 ${s.size * 2}px ${
              s.hue === "cyan"
                ? "#22d3ee"
                : s.hue === "pink"
                  ? "#f472b6"
                  : s.hue === "violet"
                    ? "#a855f7"
                    : "rgba(231, 236, 255, 0.85)"
            }`,
            animationDelay: s.delay,
          }}
        />
      ))}
    </span>
  );
}

function Feature({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div className="feature-card glow-card rounded-2xl p-6 transition-all duration-500">
      <div className="text-2xl mb-3">{emoji}</div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-mute text-sm leading-relaxed">{text}</p>
    </div>
  );
}
