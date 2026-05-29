import type { Question } from "./definitions";
import type { AnswerMap } from "@/lib/schema/answers";

/** 質問定義の集合(表示順 = 線形フォールバックの順序) */
export interface QuestionSet {
  questions: Question[];
  firstId: string;
}

/** id から質問を引く */
export function getQuestion(set: QuestionSet, id: string): Question | undefined {
  return set.questions.find((q) => q.id === id);
}

/**
 * 現在の質問と回答から「次の質問 ID」を決める純粋関数。
 * 優先順位:
 *   0) 質問の branch(answers) が string/null を返したらそれ(answers 依存の動的分岐)
 *   1) single で選んだ Choice に next があればそれ
 *   2) 質問自身の next(string なら指定先 / null なら終端)
 *   3) 定義配列上の「次の質問」(線形フォールバック)
 *   4) 無ければ終端(null)
 */
export function getNextQuestionId(
  set: QuestionSet,
  currentId: string,
  answers: AnswerMap,
): string | null {
  const q = getQuestion(set, currentId);
  if (!q) return null;

  // 0) answers 依存の動的分岐(undefined は「指定なし」でフォールバック)
  if (q.branch) {
    const b = q.branch(answers);
    if (b !== undefined) return b;
  }

  // 1) 選択肢ごとの分岐(single のみ)
  if (q.type === "single" && q.choices) {
    const v = answers[currentId];
    const chosen = q.choices.find((c) => c.value === v);
    if (chosen?.next) return chosen.next;
  }

  // 2) 質問自身の next(明示指定 / 終端)
  if (q.next !== undefined) return q.next; // null は終端

  // 3) 線形フォールバック
  const idx = set.questions.findIndex((x) => x.id === currentId);
  const nextQ = set.questions[idx + 1];
  return nextQ ? nextQ.id : null;
}

/** 終端判定(これ以上質問が無い = 生成可能) */
export function isComplete(
  set: QuestionSet,
  currentId: string,
  answers: AnswerMap,
): boolean {
  return getNextQuestionId(set, currentId, answers) === null;
}

/**
 * firstId から answers に沿って実際に辿れる質問ID集合を返す。
 * 分岐(stage=student のスキップ等)で通らなくなった質問は含まれない。
 * 無限ループはガード(訪問済みIDの再訪 / 上限回数)で防ぐ。
 */
export function getVisitedIds(set: QuestionSet, answers: AnswerMap): Set<string> {
  const visited = new Set<string>();
  let id: string | null = set.firstId;
  // questions.length を上限に(余裕分 +1)。重複IDも検知して打ち切る。
  const limit = set.questions.length + 1;
  for (let i = 0; id && i < limit; i++) {
    if (visited.has(id)) break; // 万一の循環ガード
    visited.add(id);
    id = getNextQuestionId(set, id, answers);
  }
  return visited;
}

/**
 * 実際に辿った質問の回答のみを残し、放棄した分岐の回答を落とす。
 * (例: working で答えた experience/income を student に切替後に除去)
 */
export function pruneAnswers(set: QuestionSet, answers: AnswerMap): AnswerMap {
  const visited = getVisitedIds(set, answers);
  const out: AnswerMap = {};
  for (const id of Object.keys(answers)) {
    if (visited.has(id)) out[id] = answers[id];
  }
  return out;
}
