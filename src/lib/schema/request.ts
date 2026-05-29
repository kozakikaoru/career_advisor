import { z } from "zod";
import { AnswerMapSchema } from "./answers";

/**
 * POST /api/generate のリクエストスキーマ。
 * consent は同意必須。true でなければサーバー側で拒否する(security 要件)。
 */
export const GenerateRequestSchema = z.object({
  answers: AnswerMapSchema,
  consent: z.literal(true),
});

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;
