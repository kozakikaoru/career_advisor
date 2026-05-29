import { QUESTIONS } from "@/lib/questions/definitions";
import type { AnswerMap } from "@/lib/schema/answers";

/**
 * 回答(安定キー)を「人間可読なラベル付き key-value」に整形する(question-flow.md §5)。
 * - 質問文 → 回答ラベル の対応に変換。
 * - single/multi は choice.label に変換、text/textarea はそのまま値を使う。
 * これにより AI が文脈を理解しやすくなり、生の安定キーをログ/プロンプトに出さずに済む。
 */
export function labelizeAnswers(answers: AnswerMap): Record<string, string> {
  const out: Record<string, string> = {};
  for (const q of QUESTIONS) {
    const v = answers[q.id];
    if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) continue;

    let labelValue: string;
    if (q.type === "single") {
      const choice = q.choices?.find((c) => c.value === v);
      labelValue = choice?.label ?? String(v);
    } else if (q.type === "multi") {
      const values = Array.isArray(v) ? v : [v];
      labelValue = values
        .map((val) => q.choices?.find((c) => c.value === val)?.label ?? val)
        .join(" / ");
    } else {
      // text / textarea はユーザーの自由入力をそのまま
      labelValue = Array.isArray(v) ? v.join(" / ") : v;
    }
    out[q.title] = labelValue;
  }
  return out;
}
