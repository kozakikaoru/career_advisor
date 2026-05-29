import type { AnswerMap } from "@/lib/schema/answers";
import { labelizeAnswers } from "./labels";

/**
 * 回答からプロンプト本文を組み立てる(ai-layer.md §4)。
 * - 安定キーではなく人間可読ラベルで渡す(labelizeAnswers)。
 * - スキーマと二重に制約を明記する(段数・件数・トーン)。
 * - 占い的な決めつけ、医療・法律・投資助言と誤認される表現は避ける(security の免責方針)。
 */
export function buildPrompt(answers: AnswerMap): string {
  const labeled = labelizeAnswers(answers);
  const qa = Object.entries(labeled)
    .map(([q, a]) => `- ${q}: ${a}`)
    .join("\n");

  return [
    "あなたは進路相談の専門家です。以下の回答をもとに、現実的で前向きな進路プランを日本語で作成してください。",
    "",
    "# ユーザーの回答",
    qa,
    "",
    "# 出力の制約",
    "- 指定されたスキーマに完全に従う JSON のみを出力する(余計な文章・マークダウンは付けない)。",
    "- roadmap は現在地から目標まで段階的に。ノードは2〜8個。ユーザーの目標期間に応じて段数と時間ラベル(timeLabel)を調整する。最初のノードの kind は \"start\"、最後は \"goal\"、途中は \"milestone\"。",
    "- candidates は1〜5件。最有力には isTop=true を付け、matchPercent(0-100)を付ける。",
    "- skills.learning は具体的な学習項目、skills.strengths は活かせる強みのタグ。",
    "- personality.traits は2〜4個。level(0-100)と短いコメントを付ける。",
    "- 各フィールドの文字数上限を必ず守る(超えると無効になる)。",
    "- トーンは前向きで具体的。占い的な決めつけや、医療・法律・投資の助言と誤解される表現は避ける。",
    "- 個人を特定できる情報は結果に含めない。",
  ].join("\n");
}
