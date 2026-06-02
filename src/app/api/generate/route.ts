import { NextResponse } from "next/server";
import { GenerateRequestSchema } from "@/lib/schema/request";
import { getAIProvider } from "@/lib/ai";
import { getRepository } from "@/lib/db";
import { generateId } from "@/lib/id";
import { getEnv, getRateLimitEnabled } from "@/env";
import {
  checkAndConsume,
  MonthlyLimitError,
  RateLimitError,
  resolveClientIp,
  resolveSession,
} from "@/lib/rate-limit";
import { buildSessionSetCookie } from "@/lib/rate-limit/session";

// AI 生成は数十秒〜数分かかりうる(Pro + thinking + Tier 1 で 503 リトライ込みで延長)。
// 仮設定: 10 分(かおる方針 2026-06-02・Tier 1 の 503 で粘るため)。
// 注: Vercel Hobby は 60s 上限・Pro は 300s・Enterprise なら 900s。本番デプロイ前に再調整。
export const maxDuration = 600;
export const runtime = "nodejs";

/**
 * POST /api/generate
 * レート制限 → consent チェック → AI 生成(Zod 検証 + リトライ)→ 保存 → { id }
 *
 * レート制限は ConsentGate(consent: true 必須・403)より「前」に判定する。
 * 既に上限到達済みの利用者には 429/503 を先に返し、AI 呼び出しのコストを発生させない。
 *
 * 生回答はここで受けるが DB に保存しない。ログにも本文を残さない(security)。
 */
export async function POST(req: Request) {
  const startedAt = Date.now();

  // --- 0. セッション ID 解決(cookie → なければ発行)+ Set-Cookie 用意 ---
  // セッション ID 自体は DB に永続化しない(レート制限カウンタの key としてのみ使う)。
  const cookieHeader = req.headers.get("cookie");
  const { sessionId, isNew } = resolveSession(cookieHeader);
  const env = getEnv();
  const secureCookie = env.NODE_ENV === "production";
  const setCookieValue = isNew
    ? buildSessionSetCookie(sessionId, { secure: secureCookie })
    : null;

  function withSession<T extends NextResponse>(res: T): T {
    if (setCookieValue) res.headers.append("Set-Cookie", setCookieValue);
    return res;
  }

  // --- 1. レート制限(env で無効化されている場合はスキップ) ---
  if (getRateLimitEnabled()) {
    const ip = resolveClientIp(req.headers);
    try {
      await checkAndConsume({ ip, sessionId });
    } catch (e) {
      if (e instanceof MonthlyLimitError) {
        console.warn(
          `[generate] monthly_limit_exceeded count=${e.count} limit=${e.limit}`,
        );
        return withSession(
          NextResponse.json(
            {
              error: "monthly_limit_exceeded",
              limit: e.limit,
              count: e.count,
              resetAt: e.resetAt.toISOString(),
            },
            { status: 503 },
          ),
        );
      }
      if (e instanceof RateLimitError) {
        console.warn(
          `[generate] rate_limit_exceeded scope=${e.scope} window=${e.windowKind} count=${e.count}/${e.limit}`,
        );
        const res = NextResponse.json(
          {
            error: "rate_limit_exceeded",
            scope: e.scope,
            windowKind: e.windowKind,
            limit: e.limit,
            count: e.count,
            retryAfterSec: e.retryAfterSec,
          },
          { status: 429 },
        );
        res.headers.set("Retry-After", String(e.retryAfterSec));
        return withSession(res);
      }
      // 想定外の例外は通常の 500 ハンドリングへ
      console.error(
        `[generate] rate_limit_internal_error name=${e instanceof Error ? e.name : "Unknown"}`,
      );
      return withSession(
        NextResponse.json({ error: "rate_limit_internal_error" }, { status: 500 }),
      );
    }
  }

  // --- 2. JSON パース ---
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return withSession(NextResponse.json({ error: "invalid_json" }, { status: 400 }));
  }

  // --- 3. リクエスト検証(answers の形 + consent: true) ---
  const parsed = GenerateRequestSchema.safeParse(body);
  if (!parsed.success) {
    // consent が true でない場合は同意なしとして 403、それ以外は 400
    const consentIssue = parsed.error.issues.some((i) => i.path[0] === "consent");
    return withSession(
      NextResponse.json(
        { error: consentIssue ? "consent_required" : "invalid_request" },
        { status: consentIssue ? 403 : 400 },
      ),
    );
  }

  const { answers } = parsed.data;

  try {
    // --- 4. AI 生成(内部で Zod 検証 + リトライ) ---
    const provider = await getAIProvider();
    const plan = await provider.generateCareerPlan(answers, {
      timeoutMs: 540_000,
      maxRetries: 1,
    });

    // --- 5. ランダムID生成 → 保存(結果のみ) ---
    const id = generateId();
    const repo = await getRepository();
    await repo.save(id, plan);

    // 非PIIのみログ(プロバイダ名・所要時間・成否)
    console.info(
      `[generate] ok provider=${provider.name} ms=${Date.now() - startedAt}`,
    );

    return withSession(NextResponse.json({ id }, { status: 201 }));
  } catch (e) {
    // 保存失敗とAI失敗をざっくり分ける(分類用にメッセージは参照するが「ログには出さない」)。
    const message = e instanceof Error ? e.message : "";
    const isSave = /save|insert|sqlite|neon|database/i.test(message);

    // ログには回答本文が混入しないよう、e.name と固定の分類文字列のみを残す。
    const errName = e instanceof Error ? e.name : "Unknown";
    const category = isSave ? "save" : "generation";
    console.error(
      `[generate] failed ms=${Date.now() - startedAt} name=${errName} category=${category}`,
    );

    return withSession(
      NextResponse.json(
        { error: isSave ? "save_failed" : "generation_failed" },
        { status: isSave ? 500 : 502 },
      ),
    );
  }
}
