import type { AdSlot as AdSlotType } from "@/lib/schema/result";

/**
 * 広告枠(各案ごと・specs §3-6-1 / §6-7)。
 * MVP は kind="ad_recruitment" 固定で、headline/body 等はクライアント側のハードコードを優先表示。
 * 将来のアフィリエイト案件(kind="affiliate")では adSlot から受け取った値を表示する。
 */
export function AdSlot({ adSlot }: { adSlot: AdSlotType }) {
  const isAffiliate = adSlot.kind === "affiliate";
  const headline = isAffiliate
    ? adSlot.headline ?? "おすすめのサービス"
    : "広告掲載企業様募集";
  const body = isAffiliate
    ? adSlot.body ??
      "この案にマッチしたサービスのご紹介です。詳細はリンクからご確認ください。"
    : "この結果画面の各進路ごとに、関連サービス(スクール / 転職エージェント / 教材出版社など)の広告枠をご提供できます。お気軽にお問い合わせください。";
  const ctaLabel = isAffiliate ? adSlot.ctaLabel ?? "詳しく見る" : "お問い合わせはこちら";
  const ctaUrl = adSlot.ctaUrl ?? "mailto:info@nexus.path.example";

  return (
    <section className="mb-10">
      <div className="relative rounded-3xl p-[1.5px] bg-gradient-to-r from-cyan/40 via-violet/40 to-pink/40 overflow-hidden">
        <div className="rounded-[calc(1.5rem-1.5px)] bg-panel/80 p-6 sm:p-7 relative">
          <p className="text-[0.65rem] font-display tracking-[0.3em] uppercase text-mute mb-3">
            PR / 広告
          </p>
          <h3 className="text-lg font-semibold mb-2">{headline}</h3>
          <p className="text-mute text-sm leading-relaxed mb-5 max-w-2xl">{body}</p>
          <a
            href={ctaUrl}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan/80 to-violet/80 text-bg text-sm font-bold rounded-full px-6 py-2.5 hover:scale-105 transition"
            target={ctaUrl.startsWith("mailto:") ? undefined : "_blank"}
            rel={ctaUrl.startsWith("mailto:") ? undefined : "noopener noreferrer"}
          >
            {ctaLabel}
          </a>
        </div>
      </div>
    </section>
  );
}
