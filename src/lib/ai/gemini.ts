import { ApiError, GoogleGenAI, Type, type Schema } from "@google/genai";
import type { AIProvider, GenerateOptions } from "./types";
import type { AnswerMap } from "@/lib/schema/answers";
import { CareerPlanSchema, type CareerPlan } from "@/lib/schema/result";
import { buildPrompt } from "./prompt";
import { getEnv } from "@/env";

/**
 * Gemini 実装(v2 / specs §8-3)。
 *
 * 構造化 JSON 出力(responseMimeType + responseSchema)で形を誘導し、
 * 返ってきた JSON を Zod(CareerPlanSchema v2)で最終検証する。
 * 失敗時は 1 回リトライ(既定)。「plans が 3 件でない」等もリトライ対象。
 *
 * ログには回答本文・結果本文を残さない(プロバイダ名・所要時間・成否のみ)。
 */
export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  private client: GoogleGenAI;

  constructor() {
    this.client = new GoogleGenAI({ apiKey: getEnv().GEMINI_API_KEY! });
  }

  async generateCareerPlan(
    answers: AnswerMap,
    opts: GenerateOptions = {},
  ): Promise<CareerPlan> {
    const maxRetries = opts.maxRetries ?? 1;
    const timeoutMs = opts.timeoutMs ?? 90_000;
    const model = getEnv().GEMINI_MODEL;
    const basePrompt = buildPrompt(answers);

    let lastError = "unknown";
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const prompt =
        attempt === 0
          ? basePrompt
          : `${basePrompt}\n\n（前回の出力はスキーマ検証に失敗しました。指定スキーマに厳密に従う JSON のみを再出力してください。plans は必ず 3 件です。)`;

      try {
        const res = await withTimeout(
          this.client.models.generateContent({
            model,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: GEMINI_RESPONSE_SCHEMA,
              temperature: 0.7,
              // 3 案 × 各 plan(roadmap 最大 8 段 + skills 等)で出力サイズが大きい。
              // maxOutputTokens を明示。
              maxOutputTokens: 8192,
              // thinkingBudget=4096 で thinking を中程度に制限(2026-06-02 かおる方針)。
              // 背景:
              // - 旧 -1(動的・無制限)では 115-130s タイムアウト多発。
              //   計測時の thinking は 3000-5000 token で 60s 程度 → 4096 で品質維持 + 速度確保。
              // - Pro 系は thinking 必須(thinking 0 だと 400 INVALID_ARGUMENT)。
              // - Flash 系は本来 thinking 少なめなので 4096 で十分。
              // 将来案: env(THINKING_BUDGET)で外部から調整可能にする(現状はコードで固定)。
              thinkingConfig: { thinkingBudget: 4096 },
            },
          }),
          timeoutMs,
        );

        const text = res.text ?? "";
        const parsed = safeJsonParse(text);
        const validated = CareerPlanSchema.safeParse(parsed);
        if (validated.success) return validated.data;
        lastError = "schema_validation_failed";
        // TODO(temp): スキーマ検証失敗のデバッグログ・原因特定後に削除予定
        // parsed=null は JSON.parse 失敗、parsed!=null は zod 検証失敗
        const issues = validated.error.issues
          .slice(0, 10)
          .map((i) => `${i.path.join(".")}=${i.code}:${i.message}`)
          .join(" | ");
        const textPreview = text.slice(0, 200).replace(/\n/g, " ");
        console.warn(
          `[gemini] attempt=${attempt} kind=SchemaFail parsed=${parsed === null ? "null" : "ok"} issues=[${issues}] textPreview=${textPreview}`,
        );
      } catch (e) {
        lastError = e instanceof Error ? e.name : "request_failed";
        // Gemini からのエラー詳細をログに出す(2026-06-02 強化版・かおる方針)。
        //
        // ログ方針:
        // - エラー本体(API status / 種別 / message)は必ず出す。ApiError 以外
        //   (AbortError / Timeout / TypeError / Network 等)も network/timeout/parse
        //   どの段階で落ちたか分かるように name を出す。
        // - メッセージは 800 字に切詰め。これは Gemini API のエラー文字列
        //   ({"error":{"code":..,"status":"..","message":".."}} 形式)で、
        //   ユーザー回答本文は含まないため安全(SDK 仕様準拠)。
        // - ApiError なら e.status(HTTP コード)も出す。message は JSON 文字列に
        //   `"status":"INVALID_ARGUMENT"` のような種別を含むので、原因特定可能。
        // - ログには prompt / answers / 結果本文を絶対に含めない(プライバシー方針維持)。
        logProviderError(attempt, e);
      }
    }
    throw new Error(`AI 出力の検証に失敗しました (${lastError})`);
  }
}

/**
 * catch で受けたエラーから「ログに必要な属性」を抽出して console.warn / console.error する。
 *
 * 出力フォーマット(統一・2026-06-02 確立):
 *   `[gemini] attempt=<n> kind=<name> status=<httpStatusOrEmpty> msg=<truncated>`
 *
 * - kind: e.name(ApiError / AbortError / TypeError / Error 等)。原因種別の特定に使う。
 * - status: ApiError なら HTTP code(400/429/500/502/503/504)、それ以外は空。
 * - msg: 先頭 800 字に切詰め。API エラー本文は `{"error": {"code":..,"status":"INVALID_ARGUMENT","message":".."}}`
 *   の JSON 文字列(SDK 仕様)で、ユーザー回答本文は含まない。
 * - timeout(自前 withTimeout の "AITimeout")は warn、それ以外は error で出す。
 *   (timeout はリトライ前提・前段の調査では運用上 info 寄りのため。)
 */
function logProviderError(attempt: number, e: unknown): void {
  if (!(e instanceof Error)) {
    console.error(`[gemini] attempt=${attempt} kind=Unknown status= msg=${String(e).slice(0, 800)}`);
    return;
  }
  const kind = e.name || "Error";
  const status = e instanceof ApiError ? String(e.status) : "";
  const msg = (e.message || "").slice(0, 800);
  // タイムアウト(自前で投げてる "AITimeout")はリトライ前提のため warn。
  if (kind === "AITimeout" || e.message === "AITimeout") {
    console.warn(`[gemini] attempt=${attempt} kind=${kind} status=${status} msg=${msg}`);
    return;
  }
  console.error(`[gemini] attempt=${attempt} kind=${kind} status=${status} msg=${msg}`);
}

/** タイムアウト付きで Promise を待つ(maxDuration より短く設定する想定) */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => {
        // name="AITimeout" に揃える(logProviderError 側で warn 振り分けに使う)
        const err = new Error("AITimeout");
        err.name = "AITimeout";
        reject(err);
      }, ms),
    ),
  ]);
}

/** ```json フェンスや前後ノイズを除去してから JSON.parse する防御的パーサ */
export function safeJsonParse(raw: string): unknown {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    s = s.slice(first, last + 1);
  }
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// ============================================================
// Gemini 構造化出力用スキーマ(CareerPlanSchema v2 と一致させる・ai-layer.md §3)
// ============================================================

// 2026-06-02: schema 簡素化 — string の min/maxLength と array の min/maxItems を撤去。
// 件数・長さの上下限は prompt 文と Zod 側で担保する(Gemini 「too many states」エラー回避)。
// enum / required / matchPercent の int 範囲(0..100)など、Gemini の構造誘導に必要な
// 軽い制約は残す。

const ROADMAP_NODE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    timeLabel: { type: Type.STRING },
    periodText: { type: Type.STRING },
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    kind: {
      type: Type.STRING,
      format: "enum",
      enum: ["start", "milestone", "goal"],
    },
    nowActions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ["timeLabel", "periodText", "title", "description", "kind"],
};

const PLAN_CANDIDATE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    shortSummary: { type: Type.STRING },
    detail: { type: Type.STRING },
    matchPercent: { type: Type.INTEGER, minimum: 0, maximum: 100 },
    feasibility: {
      type: Type.STRING,
      format: "enum",
      enum: ["realistic", "challenging", "very_challenging", "extreme_effort"],
    },
    warning: { type: Type.STRING },
    isTop: { type: Type.BOOLEAN },
  },
  required: ["title", "shortSummary", "detail", "matchPercent", "feasibility"],
};

const PLAN_SKILLS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    mustLearn: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
        },
        required: ["title", "description"],
      },
    },
    emergingSkills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    recommendedCerts: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    strengths: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ["mustLearn", "emergingSkills", "recommendedCerts", "strengths"],
};

const AD_SLOT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    kind: {
      type: Type.STRING,
      format: "enum",
      enum: ["ad_recruitment", "affiliate"],
    },
    headline: { type: Type.STRING },
    body: { type: Type.STRING },
    ctaLabel: { type: Type.STRING },
    ctaUrl: { type: Type.STRING },
  },
  required: ["kind"],
};

const PLAN_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    planType: {
      type: Type.STRING,
      format: "enum",
      enum: [
        "specialize",
        "transition",
        "hybrid",
        "advance",
        "new_entry",
        "side_job",
        "employ_then_independent",
        "independent",
        "small_start",
      ],
    },
    candidate: PLAN_CANDIDATE_SCHEMA,
    roadmap: {
      type: Type.ARRAY,
      items: ROADMAP_NODE_SCHEMA,
    },
    skills: PLAN_SKILLS_SCHEMA,
    adSlot: AD_SLOT_SCHEMA,
  },
  required: ["planType", "candidate", "roadmap", "skills", "adSlot"],
};

// 2026-06-02: PersonalityType 撤去(Gemini 502 対応の prompt/schema 簡素化)。
// `personality` プロパティは responseSchema からも削除。required からも外す。
//
// 同日: Gemini が返してきた INVALID_ARGUMENT
// "The specified schema produces a constraint that has too many states for serving"
// 対応として、string の minLength / maxLength と array の minItems / maxItems を
// responseSchema から撤去。長さ・件数制約は prompt 文と Zod 側で担保する設計に切替。
// (`enum` / `required` / `Type.INTEGER minimum/maximum` のような軽い制約は残せる。)
//
// 計測スクリプト(scripts/measure-gemini-tokens.ts)から本番と同条件で使うため export する。
export const GEMINI_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    hero: {
      type: Type.OBJECT,
      properties: {
        tagline: { type: Type.STRING },
        durationText: { type: Type.STRING },
        summary: { type: Type.STRING },
        currentLabel: { type: Type.STRING },
        goalLabel: { type: Type.STRING },
      },
      required: ["tagline", "durationText", "summary"],
    },
    plans: {
      // plans の固定長 3 は prompt と Zod で担保(tuple)。
      type: Type.ARRAY,
      items: PLAN_SCHEMA,
    },
  },
  required: ["hero", "plans"],
};
