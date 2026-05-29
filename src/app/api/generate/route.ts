import { NextResponse } from "next/server";
import { GenerateRequestSchema } from "@/lib/schema/request";
import { getAIProvider } from "@/lib/ai";
import { getRepository } from "@/lib/db";
import { generateId } from "@/lib/id";

// AI 生成は数十秒かかりうる。Vercel の実行時間上限内で最大化する。
export const maxDuration = 60;
export const runtime = "nodejs";

/**
 * POST /api/generate
 * 回答 → consent チェック → AI 生成(Zod 検証 + リトライ)→ 保存 → { id }
 * 生回答はここで受けるが DB に保存しない。ログにも本文を残さない(security)。
 */
export async function POST(req: Request) {
  const startedAt = Date.now();

  // 1) JSON パース
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // 2) リクエスト検証(answers の形 + consent: true)
  const parsed = GenerateRequestSchema.safeParse(body);
  if (!parsed.success) {
    // consent が true でない場合は同意なしとして 403、それ以外は 400
    const consentIssue = parsed.error.issues.some((i) => i.path[0] === "consent");
    return NextResponse.json(
      { error: consentIssue ? "consent_required" : "invalid_request" },
      { status: consentIssue ? 403 : 400 },
    );
  }

  const { answers } = parsed.data;

  try {
    // 3) AI 生成(内部で Zod 検証 + リトライ)
    const provider = await getAIProvider();
    const plan = await provider.generateCareerPlan(answers, {
      timeoutMs: 45_000,
      maxRetries: 1,
    });

    // 4) ランダムID生成 → 保存(結果のみ)
    const id = generateId();
    const repo = await getRepository();
    await repo.save(id, plan);

    // 非PIIのみログ(プロバイダ名・所要時間・成否)
    console.info(
      `[generate] ok provider=${provider.name} ms=${Date.now() - startedAt}`,
    );

    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    const kind = e instanceof Error ? e.message : "unknown";
    // 本文は残さず、エラー種別と所要時間のみ
    console.error(`[generate] failed ms=${Date.now() - startedAt} kind=${kind}`);

    // 保存失敗とAI失敗をざっくり分ける
    const isSave = /save|insert|sqlite|neon|database/i.test(kind);
    return NextResponse.json(
      { error: isSave ? "save_failed" : "generation_failed" },
      { status: isSave ? 500 : 502 },
    );
  }
}
