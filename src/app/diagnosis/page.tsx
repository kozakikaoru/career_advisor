import type { Metadata } from "next";
import { Suspense } from "react";
import { Wizard } from "@/components/wizard/Wizard";

export const metadata: Metadata = {
  title: "診断｜NEXUS.path",
  robots: { index: false, follow: false },
};

export default function DiagnosisPage() {
  // useSearchParams を使う Wizard を Suspense で包む(Next.js 16 / App Router 要件)。
  // TODO(temp): Suspense 自体は通常診断にも必要(無害)。Wizard 内の dev=mindset 直通モード
  //             削除時に useSearchParams も不要になるので、その時点で Suspense も任意。
  return (
    <Suspense fallback={null}>
      <Wizard />
    </Suspense>
  );
}
