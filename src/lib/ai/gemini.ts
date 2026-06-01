import { GoogleGenAI, Type, type Schema } from "@google/genai";
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
    const timeoutMs = opts.timeoutMs ?? 45_000;
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
              // maxOutputTokens を明示し、さらに thinkingBudget=0 で
              // 思考フェーズを切って応答時間を短縮する(60s の Vercel maxDuration 内に収めるため)。
              maxOutputTokens: 8192,
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
          timeoutMs,
        );

        const text = res.text ?? "";
        const parsed = safeJsonParse(text);
        const validated = CareerPlanSchema.safeParse(parsed);
        if (validated.success) return validated.data;
        lastError = "schema_validation_failed";
      } catch (e) {
        lastError = e instanceof Error ? e.name : "request_failed";
        // Gemini からのエラー詳細をログに出す。Gemini SDK のエラーメッセージ自体は API 側の
        // 障害種別(timeout / quota / schema 違反等)で、ユーザー回答本文は含まない。
        // 運用時は本ログから ApiError code(429 / 400 等)を見て対応する。
        if (e instanceof Error) {
          console.error(
            `[gemini] attempt=${attempt} name=${e.name} msg=${e.message.slice(0, 600)}`,
          );
        }
      }
    }
    throw new Error(`AI 出力の検証に失敗しました (${lastError})`);
  }
}

/** タイムアウト付きで Promise を待つ(maxDuration より短く設定する想定) */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("AITimeout")), ms),
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
const GEMINI_RESPONSE_SCHEMA: Schema = {
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
