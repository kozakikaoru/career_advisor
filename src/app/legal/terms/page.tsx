import type { Metadata } from "next";
import { LegalLayout, Placeholder } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "利用規約｜NEXUS.path",
};

export default function TermsPage() {
  return (
    <LegalLayout title="利用規約">
      <Placeholder>
        本ページの正式な文面は準備中です(セキュリティ担当がドラフト作成中)。確定後に差し込みます。
      </Placeholder>

      <p>
        本サービス(NEXUS.path)をご利用いただく際の基本的な考え方の概要です(正式版で確定します)。
      </p>

      <ul className="list-disc pl-5 space-y-2">
        <li>本サービスは進路検討の参考情報を提供するものです。</li>
        <li>氏名・連絡先・健康情報・他人の個人情報など、機微な情報は入力しないでください。</li>
        <li>発行されたURLの管理は利用者ご自身の責任で行ってください(URLを知る人は結果を閲覧できます)。</li>
        <li>本サービスの利用により生じた結果について、当方は責任を負いません。</li>
      </ul>

      <p className="text-xs text-mute/70 pt-4 border-t border-line/60">
        ※ 生成される進路プランは AI による参考情報であり、内容の正確性・実現可能性を保証するものではありません。
        進路・就職・転職等の最終判断はご自身の責任で行ってください。
        医療・法律・投資などの専門的助言ではありません。
      </p>
    </LegalLayout>
  );
}
