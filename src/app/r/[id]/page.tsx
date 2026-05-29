import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepository } from "@/lib/db";
import { getEnv } from "@/env";
import { ResultView } from "@/components/result/ResultView";

// 共有URLが検索エンジンにインデックスされないように noindex を付ける(data-model.md §4)。
export const metadata: Metadata = {
  title: "あなたの進路プラン｜NEXUS.path",
  robots: { index: false, follow: false },
};

// 結果は保存済みデータの取得なので動的レンダリング(ビルド時に静的化しない)。
export const dynamic = "force-dynamic";

export default async function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const repo = await getRepository();
  const result = await repo.get(id);
  if (!result) notFound();

  const base = getEnv().APP_BASE_URL.replace(/\/$/, "");
  const url = `${base}/r/${id}`;

  return <ResultView plan={result.plan} url={url} />;
}
