import type { Metadata } from "next";
import { Space_Grotesk, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { HoroscopeWheel } from "@/components/ui/HoroscopeWheel";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NEXUS.path — AI進路相談",
  description:
    "1問1答に答えるだけで、AIがあなたの現在地から目標までの進路ロードマップを描きます。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${spaceGrotesk.variable} ${notoSansJp.variable}`}>
      <body className="font-sans text-ice bg-bg min-h-screen overflow-x-hidden">
        {/* 2026-06-03 サイト全体の背景: ホロスコープ盤 + 微小星(B 案)。
            全ページ共通で 1 回だけレンダリング。z-10 のコンテンツの背後 (-z-10) に固定配置。 */}
        <HoroscopeWheel />
        {children}
      </body>
    </html>
  );
}
