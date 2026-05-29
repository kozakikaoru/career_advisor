import type { Metadata } from "next";
import { LegalLayout, Placeholder } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "プライバシーポリシー｜NEXUS.path",
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="プライバシーポリシー">
      <Placeholder>
        本ページの正式な文面は準備中です(セキュリティ担当がドラフト作成中)。確定後に差し込みます。
      </Placeholder>

      <p>
        本サービスは匿名で利用できます。ログインや氏名・メールアドレスの登録は不要です。
        現時点で想定している取り扱いの概要は以下のとおりです(正式版で確定します)。
      </p>

      <ul className="list-disc pl-5 space-y-2">
        <li>入力された回答そのものはサーバーに保存しません。</li>
        <li>AI が生成した結果(進路プラン)のみを匿名で保存し、推測されにくいURLを発行します。</li>
        <li>結果と、IP アドレスや端末情報などを紐づけて保存することはありません。</li>
        <li>入力内容は進路生成のため、外部の AI サービス(Gemini API 等)に送信されます。</li>
        <li>結果は永続的に保存される想定です(保存期間の詳細は正式版で定めます)。</li>
      </ul>

      <p className="text-xs text-mute/70 pt-4 border-t border-line/60">
        ※ 生成される進路プランは AI による参考情報であり、内容の正確性・実現可能性を保証するものではありません。
        医療・法律・投資などの専門的助言ではありません。
      </p>
    </LegalLayout>
  );
}
