import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepository } from "@/lib/db";
import { getEnv } from "@/env";
import { ResultView } from "@/components/result/ResultView";

/**
 * v2: 結果ページの <head><title> はアプリ名固定(specs §3-8 / §8-5)。
 * 動的 metadata は使わない。OG タグも固定文言。
 */
export const metadata: Metadata = {
  title: "NEXUS.path - 進路ロードマップ",
  description: "あなたの進路ロードマップを 3 本のプランで提示します。",
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
  // v2: 過去結果(v1 schema)は repo.get() 側で zod 検証に失敗して null になる。
  // → notFound() で 404 を返す(specs §8-6 / 論点 8)。
  if (!result) notFound();

  const base = getEnv().APP_BASE_URL.replace(/\/$/, "");
  const url = `${base}/r/${id}`;

  return <ResultView plan={result.plan} url={url} />;
}
