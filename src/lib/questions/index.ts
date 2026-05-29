import { QUESTIONS, FIRST_QUESTION_ID } from "./definitions";
import type { QuestionSet } from "./engine";

/** MVP の質問セット(定義 + 開始 ID をまとめたもの) */
export const QUESTION_SET: QuestionSet = {
  questions: QUESTIONS,
  firstId: FIRST_QUESTION_ID,
};

export * from "./definitions";
export * from "./engine";
