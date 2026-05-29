import { z } from "zod";

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

export const AnswerMapSchema = z
  .record(z.string().max(64), AnswerValueSchema)
  .refine((m) => Object.keys(m).length <= 40, {
    message: "回答数が多すぎます",
  });

export type AnswerValue = z.infer<typeof AnswerValueSchema>;
export type AnswerMap = z.infer<typeof AnswerMapSchema>;
