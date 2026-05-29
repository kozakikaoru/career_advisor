import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { LegalMarkdown } from "@/components/legal/LegalMarkdown";
import { PRIVACY_POLICY_MD } from "../content";

export const metadata: Metadata = {
  title: "プライバシーポリシー｜NEXUS.path",
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="プライバシーポリシー">
      <LegalMarkdown source={PRIVACY_POLICY_MD} />

      <p className="text-xs text-mute/70 pt-4 border-t border-line/60">
        ※ 生成される進路プランは AI による参考情報であり、内容の正確性・実現可能性を保証するものではありません。
        医療・法律・投資などの専門的助言ではありません。
      </p>
    </LegalLayout>
  );
}
