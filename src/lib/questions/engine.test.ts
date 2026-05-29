import { describe, it, expect } from "vitest";
import { QUESTION_SET } from "./index";
import {
  getNextQuestionId,
  isComplete,
  getQuestion,
  getVisitedIds,
  pruneAnswers,
} from "./engine";
import type { AnswerMap } from "@/lib/schema/answers";

const set = QUESTION_SET;

/** 開始から終端まで answers に沿って辿り、訪問IDの配列を返すヘルパ */
function walk(answers: AnswerMap): string[] {
  const visited: string[] = [];
  let id: string | null = set.firstId;
  // 無限ループ防止のガード
  for (let i = 0; id && i < 50; i++) {
    visited.push(id);
    id = getNextQuestionId(set, id, answers);
  }
  return visited;
}

describe("質問定義の健全性", () => {
  it("全ての choice.next / question.next が実在の質問IDを指す", () => {
    const ids = new Set(set.questions.map((q) => q.id));
    for (const q of set.questions) {
      if (typeof q.next === "string") {
        expect(ids.has(q.next), `${q.id}.next=${q.next}`).toBe(true);
      }
      for (const c of q.choices ?? []) {
        if (c.next) {
          expect(ids.has(c.next), `${q.id}.choice(${c.value}).next=${c.next}`).toBe(
            true,
          );
        }
      }
    }
  });

  it("firstId が実在する", () => {
    expect(getQuestion(set, set.firstId)).toBeDefined();
  });
});

describe("getNextQuestionId — 線形フォールバック", () => {
  it("next 指定の無い質問は定義配列上の次へ進む", () => {
    // experience は next 指定なし → 次は income
    const answers: AnswerMap = { stage: "working", experience: "3to5" };
    expect(getNextQuestionId(set, "experience", answers)).toBe("income");
  });
});

describe("getNextQuestionId — stage 分岐(学生の experience/income スキップ)", () => {
  it("学生は field の次に experience/income を飛ばして goal_clarity へ", () => {
    const answers: AnswerMap = { stage: "student", field: "情報工学" };
    expect(getNextQuestionId(set, "field", answers)).toBe("goal_clarity");
  });

  it("社会人は field の次に experience へ進む(スキップしない)", () => {
    const answers: AnswerMap = { stage: "working", field: "Webデザイン" };
    expect(getNextQuestionId(set, "field", answers)).toBe("experience");
  });

  it("学生フロー全体に experience / income が含まれない", () => {
    const answers: AnswerMap = {
      stage: "student",
      field: "情報工学",
      goal_clarity: "vague",
      goal_direction: ["specialist"],
      goal_workstyle: "company",
      goal_income: "no_answer",
      goal_horizon: "3y",
      value_priority: "growth",
      work_style_pref: "deep",
      social_pref: "solo",
      risk_pref: "safe",
    };
    const path = walk(answers);
    expect(path).not.toContain("experience");
    expect(path).not.toContain("income");
    expect(path).toContain("field");
    expect(path).toContain("goal_clarity");
  });

  it("社会人フローには experience / income が含まれる", () => {
    const answers: AnswerMap = {
      stage: "working",
      field: "営業",
      experience: "3to5",
      income: "300to500",
      goal_clarity: "clear",
      goal_target: "マーケター",
      goal_workstyle: "company",
      goal_income: "600to800",
      goal_horizon: "3y",
      value_priority: "growth",
      work_style_pref: "wide",
      social_pref: "team",
      risk_pref: "risk",
    };
    const path = walk(answers);
    expect(path).toContain("experience");
    expect(path).toContain("income");
  });
});

describe("getNextQuestionId — goal_clarity 分岐", () => {
  it("clear のとき goal_target へ", () => {
    const answers: AnswerMap = { goal_clarity: "clear" };
    expect(getNextQuestionId(set, "goal_clarity", answers)).toBe("goal_target");
  });

  it("vague のとき goal_direction へ", () => {
    const answers: AnswerMap = { goal_clarity: "vague" };
    expect(getNextQuestionId(set, "goal_clarity", answers)).toBe("goal_direction");
  });

  it("none のとき goal_direction へ", () => {
    const answers: AnswerMap = { goal_clarity: "none" };
    expect(getNextQuestionId(set, "goal_clarity", answers)).toBe("goal_direction");
  });

  it("clear → goal_target の次は goal_workstyle(goal_direction をスキップ)", () => {
    const answers: AnswerMap = { goal_clarity: "clear", goal_target: "PM" };
    expect(getNextQuestionId(set, "goal_target", answers)).toBe("goal_workstyle");
  });

  it("vague → goal_direction の次は goal_workstyle(線形合流)", () => {
    const answers: AnswerMap = {
      goal_clarity: "vague",
      goal_direction: ["management"],
    };
    expect(getNextQuestionId(set, "goal_direction", answers)).toBe("goal_workstyle");
  });

  it("clear フローに goal_direction は含まれない", () => {
    const answers: AnswerMap = {
      stage: "working",
      field: "営業",
      experience: "3to5",
      income: "300to500",
      goal_clarity: "clear",
      goal_target: "マーケター",
      goal_workstyle: "company",
      goal_income: "600to800",
      goal_horizon: "3y",
      value_priority: "growth",
      work_style_pref: "wide",
      social_pref: "team",
      risk_pref: "risk",
    };
    expect(walk(answers)).not.toContain("goal_direction");
  });
});

describe("getVisitedIds / pruneAnswers — 放棄した分岐の回答を刈り取る(Med-1)", () => {
  it("学生フローでは experience / income を訪問しない", () => {
    const answers: AnswerMap = {
      stage: "student",
      field: "情報工学",
      goal_clarity: "vague",
      goal_direction: ["specialist"],
    };
    const visited = getVisitedIds(set, answers);
    expect(visited.has("field")).toBe(true);
    expect(visited.has("goal_clarity")).toBe(true);
    expect(visited.has("experience")).toBe(false);
    expect(visited.has("income")).toBe(false);
  });

  it("working→student に切替後、残存した experience/income を pruneAnswers が落とす", () => {
    // working で experience/income まで答えた後、戻って student に変更したケース
    const answers: AnswerMap = {
      stage: "student",
      field: "情報工学",
      experience: "5to10", // 放棄した枝の残存
      income: "500to700", // 放棄した枝の残存
      goal_clarity: "vague",
      goal_direction: ["specialist"],
    };
    const pruned = pruneAnswers(set, answers);
    expect(pruned.experience).toBeUndefined();
    expect(pruned.income).toBeUndefined();
    expect(pruned.stage).toBe("student");
    expect(pruned.field).toBe("情報工学");
    expect(pruned.goal_clarity).toBe("vague");
  });

  it("goal_clarity clear→vague 切替後、放棄した goal_target を落とし goal_direction を残す", () => {
    const answers: AnswerMap = {
      stage: "working",
      field: "営業",
      experience: "3to5",
      income: "300to500",
      goal_clarity: "vague", // clear から変更
      goal_target: "プロダクトマネージャー", // clear 時の残存(放棄枝)
      goal_direction: ["management"],
    };
    const pruned = pruneAnswers(set, answers);
    expect(pruned.goal_target).toBeUndefined();
    expect(pruned.goal_direction).toEqual(["management"]);
  });

  it("整合した回答は何も落とさない(社会人×明確フロー)", () => {
    const answers: AnswerMap = {
      stage: "working",
      field: "営業",
      experience: "3to5",
      income: "300to500",
      goal_clarity: "clear",
      goal_target: "マーケター",
      goal_workstyle: "company",
      goal_income: "600to800",
      goal_horizon: "3y",
      value_priority: "growth",
      work_style_pref: "wide",
      social_pref: "team",
      risk_pref: "risk",
    };
    expect(pruneAnswers(set, answers)).toEqual(answers);
  });

  it("定義外のキーは訪問できないので pruneAnswers が落とす", () => {
    const answers: AnswerMap = { stage: "working", field: "営業", __evil: "x" };
    const pruned = pruneAnswers(set, answers);
    expect(pruned.__evil).toBeUndefined();
    expect(pruned.stage).toBe("working");
  });
});

describe("isComplete — 終端判定", () => {
  it("free_note は終端(next: null)", () => {
    expect(isComplete(set, "free_note", {})).toBe(true);
  });

  it("途中の質問では終端ではない", () => {
    expect(isComplete(set, "stage", { stage: "working" })).toBe(false);
    expect(isComplete(set, "value_priority", { value_priority: "growth" })).toBe(false);
  });

  it("存在しない質問IDは終端扱い(安全側)", () => {
    expect(isComplete(set, "unknown_id", {})).toBe(true);
  });
});
