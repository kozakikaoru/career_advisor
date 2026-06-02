import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepository } from "@/lib/db";
import { getEnv } from "@/env";
import { ResultView } from "@/components/result/ResultView";
// TODO(temp): ?dev=result プレビュー用 — 確認完了後に削除予定
import { MockProvider } from "@/lib/ai/mock";

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dev?: string }>;
}) {
  const { id } = await params;
  const { dev } = await searchParams;

  // TODO(temp): ?dev=result プレビュー — 確認完了後に削除予定
  // Mock provider の出力を直接表示(DB ルックアップせず)。
  // URL を知っている人だけが使う開発用・本番影響なし。
  if (dev === "result") {
    const mock = new MockProvider();
    // 在職者×キャリアチェンジ志向の Mock answers で生成
    const plan = await mock.generateCareerPlan({
      age: 30,
      stage: "freelance",
      freelance_field: "バックエンドエンジニア",
      years_employed: "5to10",
      knowledge_fields: ["it_web", "software_dev", "data_ai"],
      current_income: "500to700",
      education: "voc",
      life_constraint: ["none"],
      location: "regional_city",
      time_available: "1to3h",
      change_intent: "change",
      change_direction: "career_change",
      chg_target_field: ["software_dev", "data_ai", "design_creative"],
      goal_workstyle: ["startup"],
      goal_income: "1200to2000",
      goal_horizon: "3y",
      goal_start_timing: "within_1y",
      goal_commit: "lt5",
      leadership_role: "lead_want",
      social_pref: "team_strong",
      plan_style: "plan_first",
      unknown_field_jump: "jump_ok",
      change_attitude: "change_welcome",
      value_priority: ["growth", "stability", "reward"],
      meaning_priority: "success_priority",
      competition_pref: "compete_motivated",
      risk_pref: "safe",
      learning_depth: "wide_explore",
      failure_recovery: "careful_after",
      location_preference: "keep_current",
      remote_preference: "flexible",
      wlb_priority: "wlb_balance",
    });
    const baseUrl = getEnv().APP_BASE_URL.replace(/\/$/, "");
    return <ResultView plan={plan} url={`${baseUrl}/r/${id}?dev=result`} />;
  }

  const repo = await getRepository();
  const result = await repo.get(id);
  // v2: 過去結果(v1 schema)は repo.get() 側で zod 検証に失敗して null になる。
  // → notFound() で 404 を返す(specs §8-6 / 論点 8)。
  if (!result) notFound();

  const base = getEnv().APP_BASE_URL.replace(/\/$/, "");
  const url = `${base}/r/${id}`;

  return <ResultView plan={result.plan} url={url} />;
}
