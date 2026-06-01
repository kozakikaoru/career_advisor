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

const ROADMAP_NODE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    timeLabel: { type: Type.STRING, maxLength: "12" },
    periodText: { type: Type.STRING, maxLength: "20" },
    title: { type: Type.STRING, maxLength: "40" },
    description: { type: Type.STRING, minLength: "40", maxLength: "220" },
    kind: {
      type: Type.STRING,
      format: "enum",
      enum: ["start", "milestone", "goal"],
    },
    nowActions: {
      type: Type.ARRAY,
      minItems: "1",
      maxItems: "3",
      items: { type: Type.STRING, maxLength: "160" },
    },
  },
  required: ["timeLabel", "periodText", "title", "description", "kind"],
};

const PLAN_CANDIDATE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, maxLength: "40" },
    shortSummary: { type: Type.STRING, maxLength: "60" },
    detail: { type: Type.STRING, minLength: "120", maxLength: "220" },
    matchPercent: { type: Type.INTEGER, minimum: 0, maximum: 100 },
    feasibility: {
      type: Type.STRING,
      format: "enum",
      enum: ["realistic", "challenging", "very_challenging", "extreme_effort"],
    },
    warning: { type: Type.STRING, maxLength: "160" },
    isTop: { type: Type.BOOLEAN },
  },
  required: ["title", "shortSummary", "detail", "matchPercent", "feasibility"],
};

const PLAN_SKILLS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    mustLearn: {
      type: Type.ARRAY,
      minItems: "0",
      maxItems: "8",
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, maxLength: "40" },
          description: { type: Type.STRING, maxLength: "120" },
        },
        required: ["title", "description"],
      },
    },
    emergingSkills: {
      type: Type.ARRAY,
      minItems: "1",
      maxItems: "4",
      items: { type: Type.STRING, maxLength: "40" },
    },
    recommendedCerts: {
      type: Type.ARRAY,
      minItems: "0",
      maxItems: "3",
      items: { type: Type.STRING, maxLength: "40" },
    },
    strengths: {
      type: Type.ARRAY,
      minItems: "2",
      maxItems: "5",
      items: { type: Type.STRING, maxLength: "20" },
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
    headline: { type: Type.STRING, maxLength: "80" },
    body: { type: Type.STRING, maxLength: "160" },
    ctaLabel: { type: Type.STRING, maxLength: "40" },
    ctaUrl: { type: Type.STRING, maxLength: "300" },
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
      minItems: "3",
      maxItems: "8",
      items: ROADMAP_NODE_SCHEMA,
    },
    skills: PLAN_SKILLS_SCHEMA,
    adSlot: AD_SLOT_SCHEMA,
  },
  required: ["planType", "candidate", "roadmap", "skills", "adSlot"],
};

const GEMINI_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    hero: {
      type: Type.OBJECT,
      properties: {
        tagline: { type: Type.STRING, minLength: "8", maxLength: "40" },
        durationText: { type: Type.STRING, maxLength: "20" },
        summary: { type: Type.STRING, minLength: "80", maxLength: "180" },
        currentLabel: { type: Type.STRING, maxLength: "40" },
        goalLabel: { type: Type.STRING, maxLength: "40" },
      },
      required: ["tagline", "durationText", "summary"],
    },
    personality: {
      type: Type.OBJECT,
      properties: {
        typeName: { type: Type.STRING, maxLength: "20" },
        emoji: { type: Type.STRING, maxLength: "4" },
        summary: { type: Type.STRING, maxLength: "220" },
        traits: {
          type: Type.ARRAY,
          minItems: "2",
          maxItems: "4",
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING, maxLength: "16" },
              level: { type: Type.INTEGER, minimum: 0, maximum: 100 },
              comment: { type: Type.STRING, maxLength: "12" },
            },
            required: ["label", "level", "comment"],
          },
        },
      },
      required: ["typeName", "emoji", "summary", "traits"],
    },
    plans: {
      // tuple([Plan, Plan, Plan]) は Gemini Schema に直接対応がないため、
      // minItems / maxItems = 3 で固定長を表現する。zod 側で最終検証(length===3)を担保。
      type: Type.ARRAY,
      minItems: "3",
      maxItems: "3",
      items: PLAN_SCHEMA,
    },
  },
  required: ["hero", "personality", "plans"],
};
