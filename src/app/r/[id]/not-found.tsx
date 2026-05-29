import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

/** /r/[id] で結果が見つからない時の画面。 */
export default function ResultNotFound() {
  return (
    <>
      <header className="relative z-10 border-b border-line/70 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center">
          <Logo />
        </div>
      </header>
      <main className="relative z-10 max-w-2xl mx-auto px-5 py-32 text-center">
        <div className="text-5xl mb-6">🛰️</div>
        <h1 className="font-display text-3xl font-bold mb-4">結果が見つかりませんでした</h1>
        <p className="text-mute leading-relaxed mb-8">
          URLが正しいかご確認ください。結果は発行時のURLでのみ開けます。
          <br />
          URLを控えていない場合は、もう一度診断してください。
        </p>
        <Link
          href="/diagnosis"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan to-violet text-bg font-bold rounded-full px-7 py-3.5 hover:scale-105 transition glow-ring"
        >
          診断をはじめる
        </Link>
      </main>
    </>
  );
}
