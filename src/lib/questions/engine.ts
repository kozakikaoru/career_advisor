import type { Axis, Question } from "./definitions";
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

// ============================================================
// 進捗バー(セクション化)用ユーティリティ
// ============================================================

/** ORIGIN / GOAL / MINDSET の3軸 → 進捗バーのセクションキーへの対応 */
export type SectionKey = Axis;
export const SECTION_ORDER: readonly SectionKey[] = [
  "current",
  "goal",
  "personality",
] as const;

/**
 * 進捗バーに描画するための、各セクションの状態。
 * - `step`: そのセクション内で「いま何番目か」(完了済みは = total)
 * - `total`: そのセクションの最大想定問数(answers と分岐を踏まえた現フローの値)
 * - `status`: "done" | "active" | "todo"
 */
export interface SectionProgress {
  key: SectionKey;
  step: number;
  total: number;
  status: "done" | "active" | "todo";
}

/** 全セクション分の進捗 + 全体パーセンテージ */
export interface ProgressSnapshot {
  sections: SectionProgress[];
  totalPercent: number;
}

/**
 * 進捗スナップショットを計算する純粋関数。
 *
 * 計算ロジック(仕様メモ準拠):
 * - **total(分母)**: `getVisitedIds(set, answers)` で実際に辿るパスを求め、
 *   そのうちセクション軸に属するIDの数。stage 未確定時など分岐先が空でも、
 *   既知の最大値で 0 にならないよう min=1 を保証する。
 * - **step(分子)**: history(訪問順)+ 現在地 のうち、そのセクションに属するIDの順位。
 *   完了セクションは step=total。未着手セクションは step=0。
 * - **status**: 現在のセクション = "active"、それより前 = "done"、後 = "todo"。
 *
 * 注意:
 * - MAY スキップで分母を超えないよう、`total` は常に `getVisitedIds` から導出する。
 * - history に含まれないが answers にだけ存在するIDは無視(訪問していない判定)。
 *   ただし stage 確定後の total には反映される(これは getVisitedIds が拾うため自動)。
 */
export function getProgress(
  set: QuestionSet,
  currentId: string,
  answers: AnswerMap,
  history: string[],
): ProgressSnapshot {
  // 1) 分母: 訪問予定の全 ID(分岐確定後の最大想定パス)。
  const visited = getVisitedIds(set, answers);
  const totals: Record<SectionKey, number> = { current: 0, goal: 0, personality: 0 };
  for (const id of visited) {
    const q = getQuestion(set, id);
    if (!q) continue;
    totals[q.axis] += 1;
  }
  // 各セクション最低1(stage 未確定時など、未来のセクションは 0 になりうるが
  // 表示上「最低1」にしておく方が UI が破綻しない)。
  for (const k of SECTION_ORDER) if (totals[k] < 1) totals[k] = 1;

  // 2) 現在のセクション
  const currentQ = getQuestion(set, currentId);
  const currentSection: SectionKey = (currentQ?.axis as SectionKey) ?? "current";

  // 3) 分子: history + currentId のうち、各セクションに属する数。
  //    ただし「完了セクション」の step は total 固定(history に取りこぼしがあっても
  //    視覚的な不整合を起こさない)。
  const trail = [...history, currentId];
  const counts: Record<SectionKey, number> = { current: 0, goal: 0, personality: 0 };
  for (const id of trail) {
    const q = getQuestion(set, id);
    if (!q) continue;
    counts[q.axis] += 1;
  }

  const sections: SectionProgress[] = SECTION_ORDER.map((key) => {
    const total = totals[key];
    const orderIdx = SECTION_ORDER.indexOf(key);
    const currentIdx = SECTION_ORDER.indexOf(currentSection);
    let status: SectionProgress["status"];
    let step: number;
    if (orderIdx < currentIdx) {
      status = "done";
      step = total; // 完了は満タン
    } else if (orderIdx === currentIdx) {
      status = "active";
      step = Math.min(counts[key], total);
    } else {
      status = "todo";
      step = 0;
    }
    return { key, step, total, status };
  });

  // 4) 全体パーセンテージ: 全セクションの step 合計 / total 合計。
  const sumStep = sections.reduce((acc, s) => acc + s.step, 0);
  const sumTotal = sections.reduce((acc, s) => acc + s.total, 0);
  const totalPercent =
    sumTotal === 0 ? 0 : Math.min(100, Math.round((sumStep / sumTotal) * 100));

  return { sections, totalPercent };
}
