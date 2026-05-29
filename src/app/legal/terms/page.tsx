import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { LegalMarkdown } from "@/components/legal/LegalMarkdown";
import { TERMS_OF_SERVICE_MD } from "../content";

export const metadata: Metadata = {
  title: "利用規約｜NEXUS.path",
};

export default function TermsPage() {
  return (
    <LegalLayout title="利用規約">
      <LegalMarkdown source={TERMS_OF_SERVICE_MD} />

      <p className="text-xs text-mute/70 pt-4 border-t border-line/60">
        ※ 生成される進路プランは AI による参考情報であり、内容の正確性・実現可能性を保証するものではありません。
        進路・就職・転職等の最終判断はご自身の責任で行ってください。
        医療・法律・投資などの専門的助言ではありません。
      </p>
    </LegalLayout>
  );
}
