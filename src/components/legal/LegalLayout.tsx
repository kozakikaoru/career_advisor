import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

/** 法務系ページ(PP / 利用規約)の共通レイアウト。本文は children で差し込む。 */
export function LegalLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="relative z-10 border-b border-line/70 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
          <Logo />
          <Link
            href="/"
            className="text-sm font-medium text-mute border border-line rounded-full px-4 py-1.5 hover:text-ice hover:border-cyan transition"
          >
            トップへ
          </Link>
        </div>
      </header>
      <main className="relative z-10 max-w-3xl mx-auto px-5 py-14">
        <h1 className="font-display text-3xl font-bold tracking-tight mb-3">{title}</h1>
        <div className="space-y-6 text-mute text-sm leading-relaxed mt-8">{children}</div>
      </main>
      <footer className="relative z-10 max-w-3xl mx-auto px-5 pb-12">
        <p className="text-center text-xs text-mute/60 font-display tracking-wide">
          NEXUS.path
        </p>
      </footer>
    </>
  );
}

/** 後で差し込むことを示すプレースホルダ枠 */
export function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-panel/40 px-5 py-4 text-mute/80">
      {children}
    </div>
  );
}
