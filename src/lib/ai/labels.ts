import { QUESTIONS } from "@/lib/questions/definitions";
import type { AnswerMap } from "@/lib/schema/answers";

/**
 * 「分からない / こだわらない」相当の single 選択肢キー。
 * これらは AI プロンプトに渡さない(項目自体を省略する)ことで、
 * 「答えない」「unsure」をそのままラベルとして AI に渡さない。
 *
 * v2 / GOAL v2 では「答えない」を全廃。残るのは:
 * - ORIGIN の `time_available.unsure`(「分からない」相当)
 *
 * 注意: GOAL v2 の `undecided`(change_intent / change_direction.both_unsure 等)は
 * 「迷い」という意味ある回答シグナルとして AI に渡す(skip しない)。
 */
const SKIP_SINGLE_VALUES: ReadonlySet<string> = new Set(["unsure"]);

/**
 * multi の選択肢のうち「特になし」相当のキー。配列から取り除いた上で、
 * 結果が空配列ならその項目自体を省略する。
 * v2 では `none`(life_constraint / student_work_exp)/ `none_kn`(knowledge_fields)が対象。
 *
 * v2.2 で `goal_avoid` 自体を完全撤去したため、`none_avoid` への言及も削除済み。
 */
const SKIP_MULTI_VALUES: ReadonlySet<string> = new Set(["none", "none_kn"]);

/**
 * 回答(安定キー)を「人間可読なラベル付き key-value」に整形する。
 * - 質問文 → 回答ラベル の対応に変換。
 * - single/multi は choice.label に変換、text/textarea はそのまま値を使う。
 * - number は「N歳」のように単位付きラベルにする(age 用)。
 * - 「分からない/答えない」相当は AI に渡さない(項目自体を省略)。
 * - 空欄(MAYスキップ)も同様に項目自体を省略する。
 *
 * 補足(specs §3-16): `knowledge_fields` は「仕事にできるレベルの知識・経験」
 * という前提情報を AI 側で扱いやすくするため、prompt.ts 側でも示唆を入れる。
 */
export function labelizeAnswers(answers: AnswerMap): Record<string, string> {
  const out: Record<string, string> = {};
  for (const q of QUESTIONS) {
    const v = answers[q.id];
    if (v === undefined) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;

    let labelValue: string;
    if (q.type === "single") {
      if (typeof v !== "string") continue;
      if (SKIP_SINGLE_VALUES.has(v)) continue;
      const choice = q.choices?.find((c) => c.value === v);
      labelValue = choice?.label ?? v;
    } else if (q.type === "multi") {
      const raw = Array.isArray(v) ? v : [v];
      const filtered = raw.filter(
        (val) => typeof val === "string" && !SKIP_MULTI_VALUES.has(val),
      ) as string[];
      if (filtered.length === 0) continue;
      labelValue = filtered
        .map(
          (val) => q.choices?.find((c) => c.value === val)?.label ?? val,
        )
        .join(" / ");
    } else if (q.type === "number") {
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      // age 用: 数値そのままだと AI が age と判別しにくいので「N歳」化
      labelValue = q.id === "age" ? `${v}歳` : String(v);
    } else {
      // text / textarea はユーザーの自由入力をそのまま
      if (typeof v !== "string") continue;
      labelValue = v;
    }
    out[q.title] = labelValue;
  }
  return out;
}
