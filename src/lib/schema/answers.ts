import { z } from "zod";
import { QUESTIONS } from "@/lib/questions/definitions";

/**
 * 回答(AnswerMap)の Zod スキーマ。
 * single/text/textarea = string、multi = string[]、number = number(整数)。
 * 質問定義(definitions.ts)と整合させる。
 * 巨大入力を弾くため、各値・キー数に上限を設ける(PII/DoS 対策の一次防御)。
 *
 * v2 で `number` 型を追加(age 用)。AnswerMap の値型を string|string[]|number に拡張。
 */
export const AnswerValueSchema = z.union([
  z.string().max(2000),
  z.array(z.string().max(500)).max(30),
  z.number().int(),
]);

/** 質問ID → 許可される選択値集合(single/multi のみ)。text/textarea/number は自由入力。 */
const CHOICE_VALUES: Map<string, Set<string>> = new Map(
  QUESTIONS.filter((q) => q.type === "single" || q.type === "multi").map((q) => [
    q.id,
    new Set((q.choices ?? []).map((c) => c.value)),
  ]),
);
const QUESTION_TYPE: Map<string, string> = new Map(
  QUESTIONS.map((q) => [q.id, q.type]),
);
/** number 型質問の min/max を引くマップ(検証用) */
const NUMBER_BOUNDS: Map<string, { min: number; max: number }> = new Map(
  QUESTIONS.filter((q) => q.type === "number").map((q) => [
    q.id,
    {
      min: q.numberMin ?? Number.NEGATIVE_INFINITY,
      max: q.numberMax ?? Number.POSITIVE_INFINITY,
    },
  ]),
);
/**
 * multi の選択数上限マップ(MINDSET v2 §8-2 / `value_priority` 等)。
 * `definitions.ts` の Question.maxSelect から自動生成。
 * 上限が未指定なら制約なし。
 */
const MULTI_MAX_SELECT: Map<string, number> = new Map(
  QUESTIONS.filter(
    (q) => q.type === "multi" && typeof q.maxSelect === "number",
  ).map((q) => [q.id, q.maxSelect as number]),
);

/** 1 件の回答が「定義済み質問ID + 許可された値」かを検証する。 */
function isAllowedAnswer(id: string, value: AnswerValue): boolean {
  const type = QUESTION_TYPE.get(id);
  if (type === undefined) return false; // 未定義の質問ID
  if (type === "single") {
    if (typeof value !== "string") return false;
    return CHOICE_VALUES.get(id)?.has(value) ?? false;
  }
  if (type === "multi") {
    if (!Array.isArray(value)) return false;
    if (value.length === 0) return false; // 空配列は不可(MUST/MAY 共に「未指定」なら省略する)
    const allowed = CHOICE_VALUES.get(id);
    if (allowed === undefined) return false;
    if (!value.every((v) => allowed.has(v))) return false;
    // MINDSET v2(specs §8-2 / §8-4): maxSelect 上限の Zod 検証。
    // 例: value_priority は max 3。Wizard 側のトースト警告と二重ガード。
    const maxN = MULTI_MAX_SELECT.get(id);
    if (typeof maxN === "number" && value.length > maxN) return false;
    return true;
  }
  if (type === "number") {
    if (typeof value !== "number") return false;
    if (!Number.isInteger(value)) return false;
    const bounds = NUMBER_BOUNDS.get(id);
    if (!bounds) return false;
    return value >= bounds.min && value <= bounds.max;
  }
  // text / textarea は自由文字列(長さ上限は AnswerValueSchema で担保)
  return typeof value === "string";
}

export const AnswerMapSchema = z
  .record(z.string().max(64), AnswerValueSchema)
  .refine((m) => Object.keys(m).length <= 60, {
    message: "回答数が多すぎます",
  })
  // ホワイトリスト検証: 定義済み質問ID + single/multi は定義済み value のみ許可
  // number は範囲・整数を検証
  .refine((m) => Object.entries(m).every(([id, v]) => isAllowedAnswer(id, v)), {
    message: "未定義の質問IDまたは不正な選択値が含まれています",
  });

export type AnswerValue = z.infer<typeof AnswerValueSchema>;
export type AnswerMap = z.infer<typeof AnswerMapSchema>;
