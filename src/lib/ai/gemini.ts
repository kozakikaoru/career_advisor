import { GoogleGenAI, Type, type Schema } from "@google/genai";
import type { AIProvider, GenerateOptions } from "./types";
import type { AnswerMap } from "@/lib/schema/answers";
import { CareerPlanSchema, type CareerPlan } from "@/lib/schema/result";
import { buildPrompt } from "./prompt";
import { getEnv } from "@/env";

/**
 * Gemini 実装。構造化JSON出力(responseMimeType + responseSchema)で形を誘導し、
 * 返ってきた JSON を Zod(CareerPlanSchema)で最終検証する。失敗時は1回リトライ(既定)。
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
      // リトライ時は「前回の出力が不正だった」旨を添える
      const prompt =
        attempt === 0
          ? basePrompt
          : `${basePrompt}\n\n（前回の出力はスキーマ検証に失敗しました。指定スキーマに厳密に従う JSON のみを再出力してください。）`;

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
        if (validated.success) return validated.data; // ★ Zod で最終検証
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
  // ```json ... ``` / ``` ... ``` フェンスを除去
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  // 最初の { から最後の } までを抜き出す(前後の説明文対策)
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

/**
 * Gemini が要求する JSON スキーマ形式(Type enum)。
 * CareerPlanSchema と内容を一致させる(ai-layer.md §3)。
 */
const GEMINI_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    hero: {
      type: Type.OBJECT,
      properties: {
        currentLabel: { type: Type.STRING, maxLength: "40" },
        goalLabel: { type: Type.STRING, maxLength: "40" },
        durationText: { type: Type.STRING, maxLength: "20" },
        summary: { type: Type.STRING, maxLength: "160" },
      },
      required: ["currentLabel", "goalLabel", "durationText", "summary"],
    },
    roadmap: {
      type: Type.ARRAY,
      minItems: "2",
      maxItems: "8",
      items: {
        type: Type.OBJECT,
        properties: {
          timeLabel: { type: Type.STRING, maxLength: "12" },
          periodText: { type: Type.STRING, maxLength: "20" },
          title: { type: Type.STRING, maxLength: "40" },
          description: { type: Type.STRING, maxLength: "200" },
          kind: {
            type: Type.STRING,
            format: "enum",
            enum: ["start", "milestone", "goal"],
          },
        },
        required: ["timeLabel", "periodText", "title", "description", "kind"],
      },
    },
    candidates: {
      type: Type.ARRAY,
      minItems: "1",
      maxItems: "5",
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, maxLength: "40" },
          description: { type: Type.STRING, maxLength: "160" },
          matchPercent: { type: Type.INTEGER, minimum: 0, maximum: 100 },
          isTop: { type: Type.BOOLEAN },
        },
        required: ["title", "description", "matchPercent"],
      },
    },
    skills: {
      type: Type.OBJECT,
      properties: {
        learning: {
          type: Type.ARRAY,
          minItems: "1",
          maxItems: "8",
          items: { type: Type.STRING, maxLength: "40" },
        },
        strengths: {
          type: Type.ARRAY,
          minItems: "1",
          maxItems: "8",
          items: { type: Type.STRING, maxLength: "20" },
        },
      },
      required: ["learning", "strengths"],
    },
    nextAction: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, maxLength: "120" },
        detail: { type: Type.STRING, maxLength: "160" },
      },
      required: ["title", "detail"],
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
  },
  required: [
    "hero",
    "roadmap",
    "candidates",
    "skills",
    "nextAction",
    "personality",
  ],
};
