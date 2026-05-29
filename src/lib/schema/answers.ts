import { z } from "zod";
import { QUESTIONS } from "@/lib/questions/definitions";

/**
 * 回答(AnswerMap)の Zod スキーマ。
 * single/text/textarea = string、multi = string[]。
 * 質問定義(definitions.ts)と整合させる。
 * 巨大入力を弾くため、各値・キー数に上限を設ける(PII/DoS 対策の一次防御)。
 */
export const AnswerValueSchema = z.union([
  z.string().max(2000),
  z.array(z.string().max(500)).max(20),
]);

/** 質問ID → 許可される選択値集合(single/multi のみ)。text/textarea は自由入力。 */
const CHOICE_VALUES: Map<string, Set<string>> = new Map(
  QUESTIONS.filter((q) => q.type === "single" || q.type === "multi").map((q) => [
    q.id,
    new Set((q.choices ?? []).map((c) => c.value)),
  ]),
);
const QUESTION_TYPE: Map<string, string> = new Map(QUESTIONS.map((q) => [q.id, q.type]));

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
    const allowed = CHOICE_VALUES.get(id);
    return allowed !== undefined && value.every((v) => allowed.has(v));
  }
  // text / textarea は自由文字列(長さ上限は AnswerValueSchema で担保)
  return typeof value === "string";
}

export const AnswerMapSchema = z
  .record(z.string().max(64), AnswerValueSchema)
  .refine((m) => Object.keys(m).length <= 40, {
    message: "回答数が多すぎます",
  })
  // ホワイトリスト検証: 定義済み質問ID + single/multi は定義済み value のみ許可
  .refine((m) => Object.entries(m).every(([id, v]) => isAllowedAnswer(id, v)), {
    message: "未定義の質問IDまたは不正な選択値が含まれています",
  });

export type AnswerValue = z.infer<typeof AnswerValueSchema>;
export type AnswerMap = z.infer<typeof AnswerMapSchema>;
