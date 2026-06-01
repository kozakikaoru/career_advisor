import { describe, it, expect } from "vitest";
import { QUESTION_SET } from "./index";
import {
  getNextQuestionId,
  isComplete,
  getQuestion,
  getVisitedIds,
  pruneAnswers,
  getProgress,
} from "./engine";
import type { AnswerMap } from "@/lib/schema/answers";

const set = QUESTION_SET;

/** 開始から終端まで answers に沿って辿り、訪問IDの配列を返すヘルパ */
function walk(answers: AnswerMap): string[] {
  const visited: string[] = [];
  let id: string | null = set.firstId;
  // 無限ループ防止のガード
  for (let i = 0; id && i < 60; i++) {
    visited.push(id);
    id = getNextQuestionId(set, id, answers);
  }
  return visited;
}

/**
 * v2 ペルソナ別 answers ヘルパ。フルパス回答(MAY も適当に埋めるか省略可)。
 * - 基本部分は全員共通(knowledge_fields 以降 + GOAL v2 + MINDSET)。
 * - 立場ごとに追加質問(深掘り質問)を `branch` で差し込む。
 *
 * GOAL v2 では系統 A(現職持ち層)を仮定して change_intent=continue → step_up_target の
 * 最短パスを採用(系統 A の最少問数 = 9 問・continue)。系統 B はテスト毎に上書きする。
 */
function baseTail(): AnswerMap {
  return {
    knowledge_fields: ["sales_retail"],
    current_income: "300to500",
    education: "uni",
    life_constraint: ["none"],
    location: "metro",
    time_available: "1to3h",
    origin_freenote: "",
    // GOAL v2 系統 A: continue → step_up_target → 共通フロー
    change_intent: "continue",
    step_up_target: "specialist",
    // v2.2: goal_workstyle が multi 化 / goal_avoid は撤去
    goal_workstyle: ["company"],
    goal_income: "600to800",
    goal_horizon: "3y",
    goal_start_timing: "now",
    goal_commit: "lt5",
    value_priority: ["growth"],
    learning_depth: "deep_focus",
    social_pref: "team_strong",
    risk_pref: "safe",
    // MINDSET v2 確定版で追加された MUST(baseTail で全立場共通の最小値)
    leadership_role: "lead_neutral",
    plan_style: "plan_balance",
    unknown_field_jump: "neither",
    change_attitude: "change_neutral",
    meaning_priority: "balance",
    competition_pref: "neither",
    failure_recovery: "neither",
    location_preference: "anywhere",
    remote_preference: "flexible",
    wlb_priority: "wlb_balance",
    mindset_freenote: "",
  };
}

describe("質問定義の健全性(v2)", () => {
  it("全ての choice.next / question.next が実在の質問IDを指す", () => {
    const ids = new Set(set.questions.map((q) => q.id));
    for (const q of set.questions) {
      if (typeof q.next === "string") {
        expect(ids.has(q.next), `${q.id}.next=${q.next}`).toBe(true);
      }
      for (const c of q.choices ?? []) {
        if (c.next) {
          expect(
            ids.has(c.next),
            `${q.id}.choice(${c.value}).next=${c.next}`,
          ).toBe(true);
        }
      }
    }
  });

  it("firstId は 'age'(v2 で先頭に変更)", () => {
    expect(set.firstId).toBe("age");
    expect(getQuestion(set, set.firstId)).toBeDefined();
  });

  it("v1 撤去 ID(field / experience / student_grade / senior_status / income)は定義に存在しない", () => {
    for (const id of ["field", "experience", "student_grade", "senior_status", "income"]) {
      expect(getQuestion(set, id), `still exists: ${id}`).toBeUndefined();
    }
  });

  it("v2 / v2.1 新規 ID が定義されている", () => {
    const newIds = [
      "age",
      "school_type",
      "grade_jh",
      "grade_hs",
      "grade_voc",
      "grade_kosen",
      "grade_jcol",
      "grade_uni",
      "grade_grad",
      "student_major",
      "student_work_exp",
      "student_work_detail", // v2.1
      "knowledge_fields",
      "knowledge_fields_other",
      "freeter_main_work",
      "freelance_field",
      "seeking_blank",
      "parental_child_age",
      "on_leave_reason",
      "retired_status",
      "other_note",
      "employment_type",
      "prior_work_exp", // v2.1
      "current_job_field", // v2.1
      "years_employed",
      "current_income",
      "education",
      "life_constraint",
      "location",
      "time_available",
      "origin_freenote",
    ];
    for (const id of newIds) {
      expect(getQuestion(set, id), `missing: ${id}`).toBeDefined();
    }
  });

  it("ORIGIN セクションは 32 問の定義(v2.1: 29 + 3新規)", () => {
    // v2 定義 29 問 + v2.1 新規 3 問(student_work_detail / prior_work_exp / current_job_field)= 32
    const originIds = set.questions.filter((q) => q.axis === "current");
    expect(originIds.length).toBe(32);
  });

  it("v2.1 新規質問の type と required が正しい", () => {
    const swd = getQuestion(set, "student_work_detail");
    expect(swd?.type).toBe("textarea");
    expect(swd?.required).toBe(false); // MAY

    const pwe = getQuestion(set, "prior_work_exp");
    expect(pwe?.type).toBe("single");
    expect(pwe?.required).toBe(true);
    expect(pwe?.choices?.map((c) => c.value).sort()).toEqual(["no", "yes"]);

    const cjf = getQuestion(set, "current_job_field");
    expect(cjf?.type).toBe("text");
    expect(cjf?.required).toBe(true);
  });

  it("v2.1 stage ラベル更新: on_leave='休職中' / retired='定年退職後'", () => {
    const stage = getQuestion(set, "stage");
    const onLeave = stage?.choices?.find((c) => c.value === "on_leave");
    const retired = stage?.choices?.find((c) => c.value === "retired");
    expect(onLeave?.label).toBe("休職中");
    expect(retired?.label).toBe("定年退職後");
    // housekeeper の next が v2.1 で prior_work_exp に変わっていること
    const housekeeper = stage?.choices?.find((c) => c.value === "housekeeper");
    expect(housekeeper?.next).toBe("prior_work_exp");
  });

  it("age は number 型・min=0 max=99 step=1", () => {
    const age = getQuestion(set, "age");
    expect(age?.type).toBe("number");
    expect(age?.numberMin).toBe(0);
    expect(age?.numberMax).toBe(99);
    expect(age?.numberStep).toBe(1);
  });
});

describe("先頭: age → stage の線形遷移", () => {
  it("age の次は stage", () => {
    expect(getNextQuestionId(set, "age", { age: 28 })).toBe("stage");
  });
});

describe("stage 10 分岐 — それぞれの直後の next(v2.1)", () => {
  it.each([
    ["student", "school_type"],
    ["employed", "employment_type"],
    ["freeter", "freeter_main_work"],
    ["freelance", "freelance_field"],
    ["seeking", "seeking_blank"],
    // v2.1: housekeeper は直接 years_employed ではなく prior_work_exp ゲートへ
    ["housekeeper", "prior_work_exp"],
    ["parental_leave", "parental_child_age"],
    ["on_leave", "on_leave_reason"],
    ["retired", "retired_status"],
    ["other", "other_note"],
  ] as const)("stage=%s の次は %s", (stage, expected) => {
    expect(getNextQuestionId(set, "stage", { stage })).toBe(expected);
  });
});

describe("school_type 7 分岐 — 各学年質問への next", () => {
  it.each([
    ["junior_high", "grade_jh"],
    ["high_school", "grade_hs"],
    ["voc_school", "grade_voc"],
    ["kosen", "grade_kosen"],
    ["junior_college", "grade_jcol"],
    ["university", "grade_uni"],
    ["graduate", "grade_grad"],
  ] as const)("school_type=%s の次は %s", (st, expected) => {
    expect(
      getNextQuestionId(set, "school_type", { stage: "student", school_type: st }),
    ).toBe(expected);
  });
});

describe("学年質問の next", () => {
  it("grade_jh は student_work_exp(中学生は学科スキップ)", () => {
    expect(
      getNextQuestionId(set, "grade_jh", { grade_jh: "jh3" }),
    ).toBe("student_work_exp");
  });

  it.each([
    "grade_hs",
    "grade_voc",
    "grade_kosen",
    "grade_jcol",
    "grade_uni",
    "grade_grad",
  ])("%s は student_major へ", (id) => {
    expect(getNextQuestionId(set, id, {})).toBe("student_major");
  });

  it("student_major の次は student_work_exp", () => {
    expect(
      getNextQuestionId(set, "student_major", { student_major: "情報" }),
    ).toBe("student_work_exp");
  });

  it("student_work_exp の次は student_work_detail(none 以外を含む場合・v2.1)", () => {
    expect(
      getNextQuestionId(set, "student_work_exp", {
        student_work_exp: ["parttime"],
      }),
    ).toBe("student_work_detail");
  });

  it("student_work_exp の次は knowledge_fields(none のみの場合・v2.1)", () => {
    expect(
      getNextQuestionId(set, "student_work_exp", {
        student_work_exp: ["none"],
      }),
    ).toBe("knowledge_fields");
  });

  it("student_work_detail の次は knowledge_fields(v2.1 新規・合流)", () => {
    expect(
      getNextQuestionId(set, "student_work_detail", {
        student_work_exp: ["intern"],
        student_work_detail: "2ヶ月マーケインターン",
      }),
    ).toBe("knowledge_fields");
  });
});

describe("各立場の深掘り → 経験年数/ゲートの合流(v2.1)", () => {
  // v2.1: employment_type / seeking_blank の次は current_job_field、
  //       parental_child_age / on_leave_reason / retired_status / other_note の次は prior_work_exp、
  //       freeter_main_work / freelance_field のみ従来通り years_employed。
  it.each([
    ["employment_type", "current_job_field"],
    ["seeking_blank", "current_job_field"],
    ["freeter_main_work", "years_employed"],
    ["freelance_field", "years_employed"],
    ["parental_child_age", "prior_work_exp"],
    ["on_leave_reason", "prior_work_exp"],
    ["retired_status", "prior_work_exp"],
    ["other_note", "prior_work_exp"],
  ] as const)("%s の次は %s", (id, expected) => {
    expect(getNextQuestionId(set, id, {})).toBe(expected);
  });

  it("current_job_field の次は years_employed(v2.1 新規)", () => {
    expect(
      getNextQuestionId(set, "current_job_field", {
        current_job_field: "営業",
      }),
    ).toBe("years_employed");
  });

  it("years_employed の次は knowledge_fields", () => {
    expect(
      getNextQuestionId(set, "years_employed", { years_employed: "3to5" }),
    ).toBe("knowledge_fields");
  });
});

describe("prior_work_exp ゲート分岐(v2.1 新規)", () => {
  it("yes を選ぶと current_job_field へ", () => {
    expect(
      getNextQuestionId(set, "prior_work_exp", { prior_work_exp: "yes" }),
    ).toBe("current_job_field");
  });

  it("no を選ぶと knowledge_fields へ直行(current_job_field と years_employed をスキップ)", () => {
    expect(
      getNextQuestionId(set, "prior_work_exp", { prior_work_exp: "no" }),
    ).toBe("knowledge_fields");
  });
});

describe("current_income.branch — stage=student の education スキップ(v2.1)", () => {
  it("stage=student のときは life_constraint へ直行(education スキップ)", () => {
    expect(
      getNextQuestionId(set, "current_income", {
        stage: "student",
        current_income: "none",
      }),
    ).toBe("life_constraint");
  });

  it.each(["employed", "freeter", "freelance", "seeking", "housekeeper", "parental_leave", "on_leave", "retired", "other"] as const)(
    "stage=%s のときは education へ",
    (stage) => {
      expect(
        getNextQuestionId(set, "current_income", {
          stage,
          current_income: "300to500",
        }),
      ).toBe("education");
    },
  );
});

describe("knowledge_fields branch — other_kn 派生", () => {
  it("other_kn を含むと knowledge_fields_other へ", () => {
    expect(
      getNextQuestionId(set, "knowledge_fields", {
        knowledge_fields: ["it_web", "other_kn"],
      }),
    ).toBe("knowledge_fields_other");
  });

  it("other_kn を含まないと current_income へ直行", () => {
    expect(
      getNextQuestionId(set, "knowledge_fields", {
        knowledge_fields: ["it_web", "data_ai"],
      }),
    ).toBe("current_income");
  });

  it("knowledge_fields_other の次は current_income", () => {
    expect(
      getNextQuestionId(set, "knowledge_fields_other", {
        knowledge_fields: ["other_kn"],
        knowledge_fields_other: "哲学",
      }),
    ).toBe("current_income");
  });
});

describe("末尾の線形遷移(current_income → origin_freenote)", () => {
  it.each([
    ["current_income", "education"],
    ["education", "life_constraint"],
    ["life_constraint", "location"],
    ["location", "time_available"],
    ["time_available", "origin_freenote"],
  ] as const)("%s → %s", (from, to) => {
    expect(getNextQuestionId(set, from, {})).toBe(to);
  });

  it("origin_freenote の next は GOAL v2 系統判定 branch(stage 未確定時は change_intent にフォールバック)", () => {
    expect(getNextQuestionId(set, "origin_freenote", {})).toBe("change_intent");
  });
});

// ============================================================
// GOAL v2: origin_freenote.branch — 系統 A/B 判定(specs §8-1)
// ============================================================
describe("GOAL v2 origin_freenote.branch — 系統 A/B 判定", () => {
  // 系統 A: 在職者・フリーター・フリーランス・求職中・育休・休職 などは change_intent へ
  it.each([
    ["employed"],
    ["freeter"],
    ["freelance"],
    ["seeking"],
    ["parental_leave"],
    ["on_leave"],
  ] as const)("stage=%s は系統 A(change_intent)へ", (stage) => {
    expect(
      getNextQuestionId(set, "origin_freenote", { stage }),
    ).toBe("change_intent");
  });

  // 系統 B: 学生 → student_goal_track
  it("stage=student は系統 B(student_goal_track)へ", () => {
    expect(
      getNextQuestionId(set, "origin_freenote", { stage: "student" }),
    ).toBe("student_goal_track");
  });

  // 系統 B: 退職者 early / looking → second_career_intent
  it.each(["early", "looking"] as const)(
    "stage=retired + retired_status=%s は系統 B(second_career_intent)へ",
    (rs) => {
      expect(
        getNextQuestionId(set, "origin_freenote", {
          stage: "retired",
          retired_status: rs,
        }),
      ).toBe("second_career_intent");
    },
  );

  // 系統 A: 退職者 pre / re_employ → change_intent
  it.each(["pre", "re_employ"] as const)(
    "stage=retired + retired_status=%s は系統 A(change_intent)へ",
    (rs) => {
      expect(
        getNextQuestionId(set, "origin_freenote", {
          stage: "retired",
          retired_status: rs,
          prior_work_exp: "yes",
        }),
      ).toBe("change_intent");
    },
  );

  // 系統 B: 主婦・主夫等 prior_work_exp=no → new_entry_direction
  it.each([
    "housekeeper",
    "parental_leave",
    "on_leave",
    "other",
  ] as const)(
    "stage=%s + prior_work_exp=no は系統 B(new_entry_direction)へ",
    (stage) => {
      expect(
        getNextQuestionId(set, "origin_freenote", {
          stage,
          prior_work_exp: "no",
        }),
      ).toBe("new_entry_direction");
    },
  );

  // 系統 A: 主婦・主夫等 prior_work_exp=yes → change_intent
  it.each([
    "housekeeper",
    "parental_leave",
    "on_leave",
    "other",
  ] as const)(
    "stage=%s + prior_work_exp=yes は系統 A(change_intent)へ",
    (stage) => {
      expect(
        getNextQuestionId(set, "origin_freenote", {
          stage,
          prior_work_exp: "yes",
        }),
      ).toBe("change_intent");
    },
  );
});

// ============================================================
// GOAL v2: change_intent.branch — continue / change / undecided
// ============================================================
describe("GOAL v2 change_intent.branch", () => {
  it("continue → step_up_target に直行", () => {
    expect(
      getNextQuestionId(set, "change_intent", { change_intent: "continue" }),
    ).toBe("step_up_target");
  });

  it("change → change_direction へ深掘り", () => {
    expect(
      getNextQuestionId(set, "change_intent", { change_intent: "change" }),
    ).toBe("change_direction");
  });

  it("undecided → change_direction へ深掘り", () => {
    expect(
      getNextQuestionId(set, "change_intent", { change_intent: "undecided" }),
    ).toBe("change_direction");
  });
});

// ============================================================
// GOAL v2: change_direction.branch
// ============================================================
describe("GOAL v2 change_direction.branch", () => {
  it("step_up → step_up_target", () => {
    expect(
      getNextQuestionId(set, "change_direction", {
        change_direction: "step_up",
      }),
    ).toBe("step_up_target");
  });

  it("career_change → chg_target_field", () => {
    expect(
      getNextQuestionId(set, "change_direction", {
        change_direction: "career_change",
      }),
    ).toBe("chg_target_field");
  });

  it("both_unsure → goal_workstyle(共通フロー直行)", () => {
    expect(
      getNextQuestionId(set, "change_direction", {
        change_direction: "both_unsure",
      }),
    ).toBe("goal_workstyle");
  });
});

// ============================================================
// GOAL v2.1: student_goal_track.branch(進捗ステータス経由に変更)
// ============================================================
describe("GOAL v2.1 student_goal_track.branch", () => {
  it("job → student_job_status(v2.1 改修)", () => {
    expect(
      getNextQuestionId(set, "student_goal_track", {
        student_goal_track: "job",
      }),
    ).toBe("student_job_status");
  });

  it("advance → student_advance_status(v2.1 改修)", () => {
    expect(
      getNextQuestionId(set, "student_goal_track", {
        student_goal_track: "advance",
      }),
    ).toBe("student_advance_status");
  });

  it("startup → goal_workstyle(共通フロー直行)", () => {
    expect(
      getNextQuestionId(set, "student_goal_track", {
        student_goal_track: "startup",
      }),
    ).toBe("goal_workstyle");
  });

  it("undecided → goal_workstyle(共通フロー直行)", () => {
    expect(
      getNextQuestionId(set, "student_goal_track", {
        student_goal_track: "undecided",
      }),
    ).toBe("goal_workstyle");
  });
});

// ============================================================
// GOAL v2.1: student_job_status / student_advance_status 線形遷移
// ============================================================
describe("GOAL v2.1 学生進捗ステータスの線形遷移", () => {
  it("student_job_status → student_goal_industry(7択どれを選んでも線形に進む)", () => {
    for (const v of [
      "exploring",
      "researching",
      "entry_started",
      "in_selection",
      "offer_received",
      "offer_accepted",
      "not_started",
    ]) {
      expect(
        getNextQuestionId(set, "student_job_status", {
          student_job_status: v,
        }),
      ).toBe("student_goal_industry");
    }
  });

  it("student_advance_status → student_goal_advance(4択どれを選んでも線形に進む)", () => {
    for (const v of ["searching", "target_decided", "in_exam", "admitted"]) {
      expect(
        getNextQuestionId(set, "student_advance_status", {
          student_advance_status: v,
        }),
      ).toBe("student_goal_advance");
    }
  });

  it("student_advance_status は 4 択(reconsidering 撤去)", () => {
    const q = getQuestion(set, "student_advance_status");
    expect(q?.choices?.map((c) => c.value).sort()).toEqual(
      ["searching", "target_decided", "in_exam", "admitted"].sort(),
    );
    // §9-v2.1-2 採択 A: reconsidering は撤去済み
    expect(q?.choices?.some((c) => c.value === "reconsidering")).toBe(false);
  });

  it("student_job_status は 7 択", () => {
    const q = getQuestion(set, "student_job_status");
    expect(q?.choices?.map((c) => c.value).sort()).toEqual(
      [
        "exploring",
        "researching",
        "entry_started",
        "in_selection",
        "offer_received",
        "offer_accepted",
        "not_started",
      ].sort(),
    );
  });

  it("student_goal_advance → student_goal_industry(v2.1 改修 / 進学者にも業界を聞く)", () => {
    expect(
      getNextQuestionId(set, "student_goal_advance", {
        student_goal_advance: "大学院(情報科学)",
      }),
    ).toBe("student_goal_industry");
  });
});

// ============================================================
// GOAL v2: student_goal_industry.branch — other_field 派生
// ============================================================
describe("GOAL v2 student_goal_industry.branch", () => {
  it("other_field を含むと other_field_text へ派生", () => {
    expect(
      getNextQuestionId(set, "student_goal_industry", {
        student_goal_industry: ["marketing_pr", "other_field"],
      }),
    ).toBe("other_field_text");
  });

  it("other_field を含まないと goal_workstyle へ直行", () => {
    expect(
      getNextQuestionId(set, "student_goal_industry", {
        student_goal_industry: ["marketing_pr", "it_web"],
      }),
    ).toBe("goal_workstyle");
  });

  it("other_field_text の次は goal_workstyle", () => {
    expect(
      getNextQuestionId(set, "other_field_text", {
        other_field_text: "eスポーツ運営",
      }),
    ).toBe("goal_workstyle");
  });
});

// ============================================================
// GOAL v2: 共通フローの線形遷移
// ============================================================
describe("GOAL v2 共通フローの線形遷移", () => {
  it.each([
    ["step_up_target", "goal_workstyle"],
    ["chg_target_field", "goal_workstyle"],
    // v2.1 改修: student_goal_advance → student_goal_industry(進学者にも業界を聞く)
    ["student_goal_advance", "student_goal_industry"],
    ["new_entry_direction", "goal_workstyle"],
    ["second_career_intent", "goal_workstyle"],
    ["goal_workstyle", "goal_income"],
    ["goal_income", "goal_horizon"],
    ["goal_horizon", "goal_start_timing"],
    // v2.2: goal_avoid 撤去 → goal_start_timing → goal_commit に直接接続
    ["goal_start_timing", "goal_commit"],
    ["goal_commit", "goal_freenote"],
    // MINDSET v2: goal_freenote の次は MINDSET の最初の質問 leadership_role
    ["goal_freenote", "leadership_role"],
  ] as const)("%s → %s", (from, to) => {
    expect(getNextQuestionId(set, from, {})).toBe(to);
  });
});

// ============================================================
// 回帰防止: v1 GOAL の旧 ID が一切残っていないこと
// ============================================================
describe("v1 GOAL 旧 ID 撤去確認(回帰防止)", () => {
  it.each([
    "goal_clarity",
    "goal_target",
    "goal_direction",
  ])("旧 ID '%s' は定義に存在しない", (id) => {
    expect(getQuestion(set, id), `still exists: ${id}`).toBeUndefined();
  });

  it("GOAL v2 / v2.1 で新規 ID が定義されている(v2.2: goal_avoid は撤去)", () => {
    const newGoalIds = [
      "change_intent",
      "change_direction",
      "step_up_target",
      "chg_target_field",
      "student_goal_track",
      // v2.1 新規:
      "student_job_status",
      "student_advance_status",
      "student_goal_industry",
      "other_field_text",
      "student_goal_advance",
      "new_entry_direction",
      "second_career_intent",
      "goal_workstyle",
      "goal_income",
      "goal_horizon",
      "goal_start_timing",
      // v2.2: goal_avoid 撤去
      "goal_commit",
      "goal_freenote",
    ];
    for (const id of newGoalIds) {
      expect(getQuestion(set, id), `missing: ${id}`).toBeDefined();
    }
  });

  it("v2.2: goal_avoid は撤去済み(定義に存在しない)", () => {
    expect(getQuestion(set, "goal_avoid"), "still exists: goal_avoid").toBeUndefined();
  });

  it("GOAL セクションは 18 問の定義(v2.1 の 19 から v2.2 で goal_avoid 撤去で -1)", () => {
    // v2.2: goal_avoid を撤去したため 19 → 18。
    // 内訳:
    //   change_intent / change_direction / step_up_target / chg_target_field
    //   student_goal_track / student_job_status / student_advance_status
    //   student_goal_industry / other_field_text / student_goal_advance
    //   new_entry_direction / second_career_intent
    //   goal_workstyle(v2.2 で multi 化)/ goal_income / goal_horizon / goal_start_timing
    //   goal_commit / goal_freenote
    const goalIds = set.questions.filter((q) => q.axis === "goal");
    expect(goalIds.length).toBe(18);
  });

  it("goal_workstyle は multi 7 択(v2.2 で single → multi 化 / remote / wlb は撤去)", () => {
    const q = getQuestion(set, "goal_workstyle");
    // v2.2: type が multi に変わっている
    expect(q?.type).toBe("multi");
    expect(q?.required).toBe(true);
    expect(q?.choices?.map((c) => c.value).sort()).toEqual(
      [
        "company",
        "public",
        "freelance",
        "startup",
        "multi_job",
        "same_as_now",
        "undecided",
      ].sort(),
    );
  });

  it("goal_income は 9 択(no_answer 撤去・same_as_now 追加・低所得層 3 帯細分化)", () => {
    const q = getQuestion(set, "goal_income");
    expect(q?.choices?.map((c) => c.value).sort()).toEqual(
      [
        "same_as_now",
        "lt200",
        "200to300",
        "300to400",
        "400to600",
        "600to800",
        "800to1200",
        "1200to2000",
        "gt2000",
      ].sort(),
    );
  });

  it("goal_horizon は 5 択(10y 追加)", () => {
    const q = getQuestion(set, "goal_horizon");
    expect(q?.choices?.map((c) => c.value).sort()).toEqual(
      ["1y", "3y", "5y", "10y", "open"].sort(),
    );
  });

  it("goal_start_timing は 5 択(v2.1: after_preparation 追加)", () => {
    const q = getQuestion(set, "goal_start_timing");
    expect(q?.choices?.map((c) => c.value).sort()).toEqual(
      ["now", "within_3m", "within_1y", "after_preparation", "slow"].sort(),
    );
    // 表示順は now → within_3m → within_1y → after_preparation → slow(早い順 → 遅い順)
    expect(q?.choices?.map((c) => c.value)).toEqual([
      "now",
      "within_3m",
      "within_1y",
      "after_preparation",
      "slow",
    ]);
    // §9-v2.1-4 採択 C のラベル文言
    const ap = q?.choices?.find((c) => c.value === "after_preparation");
    expect(ap?.label).toContain("数年後");
    expect(ap?.label).toContain("準備期間後");
  });

  it("goal_commit は 7 択(中立表現)/ v2.2: ラベルから括弧内削除", () => {
    const q = getQuestion(set, "goal_commit");
    expect(q?.choices?.map((c) => c.value).sort()).toEqual(
      ["none", "lt5", "5to20", "20to50", "50to100", "100to300", "gt300"].sort(),
    );
    // タイトル: 中立表現「初期投資にかけられる金額の目安」
    expect(q?.title).toContain("初期投資");
    expect(q?.title).not.toContain("スクール代");
    expect(q?.description).toContain("使い切る必要はありません");
    // v2.2: ラベルから括弧内が削除されていること(例: "0円(無料リソース...)" → "0円")
    const noneChoice = q?.choices?.find((c) => c.value === "none");
    expect(noneChoice?.label).toBe("0円");
    expect(noneChoice?.label).not.toContain("(");
    const lt5Choice = q?.choices?.find((c) => c.value === "lt5");
    expect(lt5Choice?.label).toBe("〜5万円");
    expect(lt5Choice?.label).not.toContain("書籍");
    const gt300Choice = q?.choices?.find((c) => c.value === "gt300");
    expect(gt300Choice?.label).toBe("300万円以上");
    expect(gt300Choice?.label).not.toContain("MBA");
  });

  it("(v2.2) goal_start_timing.next = goal_commit(goal_avoid 撤去で直接接続)", () => {
    // どの選択肢を選んでも線形に goal_commit に飛ぶ
    for (const v of ["now", "within_3m", "within_1y", "after_preparation", "slow"]) {
      expect(
        getNextQuestionId(set, "goal_start_timing", { goal_start_timing: v }),
      ).toBe("goal_commit");
    }
  });
});

describe("立場ごとの完全フロー — 終端まで到達", () => {
  function studentAnswers(schoolType: string, gradeKey: string, gradeVal: string): AnswerMap {
    return {
      age: 20,
      stage: "student",
      school_type: schoolType,
      [gradeKey]: gradeVal,
      student_major: "情報",
      student_work_exp: ["parttime"],
      ...baseTail(),
    };
  }

  it("student/junior_high(中学生・学科スキップ)で mindset_freenote まで到達(v2.1: education もスキップ)", () => {
    const a: AnswerMap = {
      age: 14,
      stage: "student",
      school_type: "junior_high",
      grade_jh: "jh3",
      student_work_exp: ["none"],
      ...baseTail(),
    };
    const path = walk(a);
    expect(path[path.length - 1]).toBe("mindset_freenote");
    expect(path).toContain("grade_jh");
    expect(path).not.toContain("student_major");
    // student_work_exp=[none] のみ → student_work_detail をスキップ
    expect(path).not.toContain("student_work_detail");
    // v2.1: stage=student → education スキップ
    expect(path).not.toContain("education");
  });

  it.each([
    ["high_school", "grade_hs", "hs2"],
    ["voc_school", "grade_voc", "voc2"],
    ["kosen", "grade_kosen", "kosen_high"],
    ["junior_college", "grade_jcol", "jcol1"],
    ["university", "grade_uni", "u3"],
    ["graduate", "grade_grad", "m2"],
  ] as const)(
    "student/%s フローは grade & student_major を含み終端(mindset_freenote)まで到達(v2.1: student_work_detail を含み education スキップ)",
    (st, gk, gv) => {
      const a = studentAnswers(st, gk, gv);
      const path = walk(a);
      expect(path[path.length - 1]).toBe("mindset_freenote");
      expect(path).toContain(gk);
      expect(path).toContain("student_major");
      expect(path).toContain("student_work_exp");
      // v2.1: student_work_exp=[parttime] → student_work_detail へ派生
      expect(path).toContain("student_work_detail");
      expect(path).toContain("knowledge_fields");
      // v2.1: stage=student → education スキップ
      expect(path).not.toContain("education");
    },
  );

  it("student で student_work_exp=[none] のみのときは student_work_detail を経由しない(v2.1)", () => {
    const a: AnswerMap = {
      age: 16,
      stage: "student",
      school_type: "high_school",
      grade_hs: "hs2",
      student_major: "理系コース",
      student_work_exp: ["none"],
      ...baseTail(),
    };
    const path = walk(a);
    expect(path).not.toContain("student_work_detail");
    expect(path).toContain("knowledge_fields");
  });

  it("student で student_work_exp に [parttime, none] が混在しても student_work_detail へ派生する(v2.1)", () => {
    const a: AnswerMap = {
      age: 19,
      stage: "student",
      school_type: "university",
      grade_uni: "u2",
      student_major: "経済学部",
      student_work_exp: ["parttime", "none"],
      ...baseTail(),
    };
    const path = walk(a);
    // none 以外を 1 つでも含めば派生する
    expect(path).toContain("student_work_detail");
  });

  it("employed フローは employment_type → current_job_field → years_employed を含む(v2.1)", () => {
    const a: AnswerMap = {
      age: 28,
      stage: "employed",
      employment_type: "fulltime",
      current_job_field: "Web エンジニア(バックエンド)",
      years_employed: "3to5",
      ...baseTail(),
    };
    const path = walk(a);
    expect(path[path.length - 1]).toBe("mindset_freenote");
    expect(path).toContain("employment_type");
    expect(path).toContain("current_job_field");
    expect(path).toContain("years_employed");
    expect(path).not.toContain("school_type");
    // 順序チェック: employment_type → current_job_field → years_employed
    expect(path.indexOf("employment_type")).toBeLessThan(path.indexOf("current_job_field"));
    expect(path.indexOf("current_job_field")).toBeLessThan(path.indexOf("years_employed"));
  });

  it("freeter フローは freeter_main_work → years_employed を含む(current_job_field 非経由)", () => {
    const a: AnswerMap = {
      age: 23,
      stage: "freeter",
      freeter_main_work: "飲食店ホール",
      years_employed: "1to3",
      ...baseTail(),
    };
    const path = walk(a);
    expect(path[path.length - 1]).toBe("mindset_freenote");
    expect(path).toContain("freeter_main_work");
    expect(path).toContain("years_employed");
    expect(path).not.toContain("employment_type");
    expect(path).not.toContain("current_job_field");
    expect(path).not.toContain("prior_work_exp");
  });

  it("freelance フローは freelance_field → years_employed を含む(current_job_field 非経由)", () => {
    const a: AnswerMap = {
      age: 32,
      stage: "freelance",
      freelance_field: "Web 制作受託",
      years_employed: "3to5",
      ...baseTail(),
    };
    const path = walk(a);
    expect(path[path.length - 1]).toBe("mindset_freenote");
    expect(path).toContain("freelance_field");
    expect(path).not.toContain("current_job_field");
    expect(path).not.toContain("prior_work_exp");
  });

  it("seeking フローは seeking_blank → current_job_field → years_employed を含む(v2.1)", () => {
    const a: AnswerMap = {
      age: 27,
      stage: "seeking",
      seeking_blank: "3to12m",
      current_job_field: "営業",
      years_employed: "1to3",
      ...baseTail(),
    };
    const path = walk(a);
    expect(path[path.length - 1]).toBe("mindset_freenote");
    expect(path).toContain("seeking_blank");
    expect(path).toContain("current_job_field");
    expect(path).toContain("years_employed");
    expect(path.indexOf("seeking_blank")).toBeLessThan(path.indexOf("current_job_field"));
    expect(path.indexOf("current_job_field")).toBeLessThan(path.indexOf("years_employed"));
  });

  it("housekeeper + prior_work_exp=yes フローは current_job_field → years_employed を含む(v2.1)", () => {
    const a: AnswerMap = {
      age: 36,
      stage: "housekeeper",
      prior_work_exp: "yes",
      current_job_field: "経理",
      years_employed: "3to5",
      ...baseTail(),
    };
    const path = walk(a);
    expect(path[path.length - 1]).toBe("mindset_freenote");
    expect(path).toContain("prior_work_exp");
    expect(path).toContain("current_job_field");
    expect(path).toContain("years_employed");
    expect(path).not.toContain("employment_type");
  });

  it("housekeeper + prior_work_exp=no フローは current_job_field と years_employed をスキップ(v2.1)", () => {
    const a: AnswerMap = {
      age: 40,
      stage: "housekeeper",
      prior_work_exp: "no",
      ...baseTail(),
    };
    const path = walk(a);
    expect(path[path.length - 1]).toBe("mindset_freenote");
    expect(path).toContain("prior_work_exp");
    expect(path).not.toContain("current_job_field");
    expect(path).not.toContain("years_employed");
    expect(path).toContain("knowledge_fields");
  });

  it("parental_leave + prior_work_exp=yes フローは current_job_field → years_employed を含む(v2.1)", () => {
    const a: AnswerMap = {
      age: 38,
      stage: "parental_leave",
      parental_child_age: "under1",
      prior_work_exp: "yes",
      current_job_field: "看護師",
      years_employed: "5to10",
      ...baseTail(),
    };
    const path = walk(a);
    expect(path[path.length - 1]).toBe("mindset_freenote");
    expect(path).toContain("parental_child_age");
    expect(path).toContain("prior_work_exp");
    expect(path).toContain("current_job_field");
    expect(path).toContain("years_employed");
  });

  it("parental_leave + prior_work_exp=no フローは job/years をスキップ(v2.1)", () => {
    const a: AnswerMap = {
      age: 28,
      stage: "parental_leave",
      parental_child_age: "pregnant",
      prior_work_exp: "no",
      ...baseTail(),
    };
    const path = walk(a);
    expect(path[path.length - 1]).toBe("mindset_freenote");
    expect(path).toContain("prior_work_exp");
    expect(path).not.toContain("current_job_field");
    expect(path).not.toContain("years_employed");
  });

  it("on_leave + prior_work_exp=yes フローは current_job_field → years_employed を含む(v2.1)", () => {
    const a: AnswerMap = {
      age: 41,
      stage: "on_leave",
      on_leave_reason: "health_mental",
      prior_work_exp: "yes",
      current_job_field: "システムエンジニア",
      years_employed: "5to10",
      ...baseTail(),
    };
    const path = walk(a);
    expect(path[path.length - 1]).toBe("mindset_freenote");
    expect(path).toContain("on_leave_reason");
    expect(path).toContain("prior_work_exp");
    expect(path).toContain("current_job_field");
  });

  it("on_leave + prior_work_exp=no フローは job/years をスキップ(v2.1)", () => {
    const a: AnswerMap = {
      age: 22,
      stage: "on_leave",
      on_leave_reason: "health_mental",
      prior_work_exp: "no",
      ...baseTail(),
    };
    const path = walk(a);
    expect(path[path.length - 1]).toBe("mindset_freenote");
    expect(path).not.toContain("current_job_field");
    expect(path).not.toContain("years_employed");
  });

  it("retired + prior_work_exp=yes フローは current_job_field → years_employed を含む(v2.1)", () => {
    const a: AnswerMap = {
      age: 60,
      stage: "retired",
      retired_status: "early",
      prior_work_exp: "yes",
      current_job_field: "教員",
      years_employed: "gt10",
      ...baseTail(),
    };
    const path = walk(a);
    expect(path[path.length - 1]).toBe("mindset_freenote");
    expect(path).toContain("retired_status");
    expect(path).toContain("prior_work_exp");
    expect(path).toContain("current_job_field");
  });

  it("retired + prior_work_exp=no フローは job/years をスキップ(v2.1)", () => {
    const a: AnswerMap = {
      age: 65,
      stage: "retired",
      retired_status: "early",
      prior_work_exp: "no",
      ...baseTail(),
    };
    const path = walk(a);
    expect(path[path.length - 1]).toBe("mindset_freenote");
    expect(path).not.toContain("current_job_field");
    expect(path).not.toContain("years_employed");
  });

  it("other + prior_work_exp=yes フローは current_job_field → years_employed を含む(v2.1)", () => {
    const a: AnswerMap = {
      age: 30,
      stage: "other",
      other_note: "海外留学準備中",
      prior_work_exp: "yes",
      current_job_field: "現場監督",
      years_employed: "lt1",
      ...baseTail(),
    };
    const path = walk(a);
    expect(path[path.length - 1]).toBe("mindset_freenote");
    expect(path).toContain("other_note");
    expect(path).toContain("prior_work_exp");
    expect(path).toContain("current_job_field");
  });

  it("other + prior_work_exp=no フローは job/years をスキップ(v2.1)", () => {
    const a: AnswerMap = {
      age: 25,
      stage: "other",
      other_note: "NPO 活動中心",
      prior_work_exp: "no",
      ...baseTail(),
    };
    const path = walk(a);
    expect(path[path.length - 1]).toBe("mindset_freenote");
    expect(path).not.toContain("current_job_field");
    expect(path).not.toContain("years_employed");
  });

  it("knowledge_fields に other_kn を入れると knowledge_fields_other を経由する(v2.1: current_job_field 追加)", () => {
    const a: AnswerMap = {
      age: 28,
      stage: "employed",
      employment_type: "fulltime",
      current_job_field: "営業",
      years_employed: "3to5",
      ...baseTail(),
      knowledge_fields: ["other_kn"],
      knowledge_fields_other: "古典",
    };
    const path = walk(a);
    expect(path).toContain("knowledge_fields_other");
    // current_income へ繋がる
    expect(path).toContain("current_income");
  });
});

describe("MAY スキップで終端まで到達(GOAL v2)", () => {
  it("origin_freenote / goal_freenote / mindset_freenote を未回答でも終端に届く(MAY のみスキップ)", () => {
    const a: AnswerMap = {
      age: 28,
      stage: "employed",
      employment_type: "fulltime",
      current_job_field: "営業",
      years_employed: "3to5",
      knowledge_fields: ["it_web"],
      current_income: "500to700",
      education: "uni",
      life_constraint: ["none"],
      location: "metro",
      time_available: "1to3h",
      // GOAL v2 系統 A: continue → step_up_target / v2.2: workstyle multi 化 + avoid 撤去
      change_intent: "continue",
      step_up_target: "specialist",
      goal_workstyle: ["company"],
      goal_income: "600to800",
      goal_horizon: "3y",
      goal_start_timing: "now",
      goal_commit: "lt5",
      // MINDSET v2: MUST 14 を最小回答(MAY: mindset_freenote 未回答で終端まで届くか確認)
      leadership_role: "lead_avoid",
      social_pref: "solo_strong",
      plan_style: "plan_first",
      unknown_field_jump: "jump_anxious",
      change_attitude: "change_neutral",
      value_priority: ["growth"],
      meaning_priority: "balance",
      competition_pref: "compete_drain",
      risk_pref: "safe",
      learning_depth: "deep_focus",
      failure_recovery: "careful_after",
      location_preference: "keep_current",
      remote_preference: "remote_full",
      wlb_priority: "wlb_balance",
    };
    const path = walk(a);
    expect(path[path.length - 1]).toBe("mindset_freenote");
  });
});

describe("getVisitedIds / pruneAnswers — 放棄した分岐の刈り取り", () => {
  it("student フローで answers に残った在職者系の回答(employment_type/years_employed/current_job_field)は落ちる(v2.1)", () => {
    const a: AnswerMap = {
      age: 20,
      stage: "student",
      school_type: "university",
      grade_uni: "u3",
      student_major: "情報",
      student_work_exp: ["parttime"],
      student_work_detail: "Web 制作のバイト",
      // 過去の employed フロー時の残存
      employment_type: "fulltime",
      current_job_field: "営業",
      years_employed: "3to5",
      knowledge_fields: ["it_web"],
      // 過去の education 残存(v2.1: student はスキップ対象なので落ちる)
      education: "uni",
    };
    const pruned = pruneAnswers(set, a);
    expect(pruned.employment_type).toBeUndefined();
    expect(pruned.current_job_field).toBeUndefined();
    expect(pruned.years_employed).toBeUndefined();
    expect(pruned.education).toBeUndefined();
    expect(pruned.grade_uni).toBe("u3");
    expect(pruned.student_major).toBe("情報");
    expect(pruned.student_work_detail).toBe("Web 制作のバイト");
  });

  it("school_type を変更すると別 grade_* は訪問外になり落ちる", () => {
    const a: AnswerMap = {
      age: 18,
      stage: "student",
      school_type: "high_school",
      grade_hs: "hs3",
      // 過去の grade_uni の残存
      grade_uni: "u3",
      student_major: "理系",
      student_work_exp: ["none"],
      knowledge_fields: ["data_ai"],
    };
    const visited = getVisitedIds(set, a);
    expect(visited.has("grade_hs")).toBe(true);
    expect(visited.has("grade_uni")).toBe(false);
    const pruned = pruneAnswers(set, a);
    expect(pruned.grade_uni).toBeUndefined();
  });

  it("stage 切替(employed → freeter)で employment_type / current_job_field が落ち、freeter_main_work が訪問対象に(v2.1)", () => {
    const a: AnswerMap = {
      age: 24,
      stage: "freeter",
      // 過去の employed の残存
      employment_type: "fulltime",
      current_job_field: "営業",
      // 新しい freeter フローの回答
      freeter_main_work: "飲食店ホール",
      years_employed: "lt1",
      knowledge_fields: ["service"],
    };
    const visited = getVisitedIds(set, a);
    expect(visited.has("freeter_main_work")).toBe(true);
    expect(visited.has("employment_type")).toBe(false);
    expect(visited.has("current_job_field")).toBe(false);
    const pruned = pruneAnswers(set, a);
    expect(pruned.employment_type).toBeUndefined();
    expect(pruned.current_job_field).toBeUndefined();
  });

  it("housekeeper で prior_work_exp=no に切り替えると current_job_field / years_employed の残存が落ちる(v2.1)", () => {
    const a: AnswerMap = {
      age: 40,
      stage: "housekeeper",
      prior_work_exp: "no",
      // 過去の yes フロー時の残存
      current_job_field: "経理",
      years_employed: "3to5",
      knowledge_fields: ["finance_acc"],
    };
    const visited = getVisitedIds(set, a);
    expect(visited.has("prior_work_exp")).toBe(true);
    expect(visited.has("current_job_field")).toBe(false);
    expect(visited.has("years_employed")).toBe(false);
    const pruned = pruneAnswers(set, a);
    expect(pruned.current_job_field).toBeUndefined();
    expect(pruned.years_employed).toBeUndefined();
    expect(pruned.prior_work_exp).toBe("no");
  });

  it("housekeeper で prior_work_exp=yes のときは current_job_field / years_employed が訪問対象(v2.1)", () => {
    const a: AnswerMap = {
      age: 40,
      stage: "housekeeper",
      prior_work_exp: "yes",
      current_job_field: "経理",
      years_employed: "3to5",
      knowledge_fields: ["finance_acc"],
    };
    const visited = getVisitedIds(set, a);
    expect(visited.has("prior_work_exp")).toBe(true);
    expect(visited.has("current_job_field")).toBe(true);
    expect(visited.has("years_employed")).toBe(true);
  });

  it("stage=student のとき education は訪問外で pruneAnswers が落とす(v2.1)", () => {
    const a: AnswerMap = {
      age: 20,
      stage: "student",
      school_type: "university",
      grade_uni: "u3",
      student_major: "情報",
      student_work_exp: ["none"],
      knowledge_fields: ["software_dev"],
      current_income: "none",
      education: "studying", // 過去の残存
      life_constraint: ["none"],
      location: "metro",
      time_available: "1to3h",
    };
    const visited = getVisitedIds(set, a);
    expect(visited.has("education")).toBe(false);
    expect(visited.has("life_constraint")).toBe(true);
    const pruned = pruneAnswers(set, a);
    expect(pruned.education).toBeUndefined();
  });

  it("stage を student → employed に切り替えると education が再び訪問対象になる(v2.1 戻る挙動)", () => {
    const a: AnswerMap = {
      age: 28,
      stage: "employed",
      employment_type: "fulltime",
      current_job_field: "営業",
      years_employed: "3to5",
      knowledge_fields: ["sales_retail"],
      current_income: "500to700",
      education: "uni",
      life_constraint: ["none"],
      location: "metro",
      time_available: "1to3h",
    };
    const visited = getVisitedIds(set, a);
    expect(visited.has("education")).toBe(true);
  });

  it("knowledge_fields_other は other_kn を含まないと訪問外(v2.1: current_job_field 追加)", () => {
    const a: AnswerMap = {
      age: 28,
      stage: "employed",
      employment_type: "fulltime",
      current_job_field: "営業",
      years_employed: "3to5",
      knowledge_fields: ["it_web"],
      knowledge_fields_other: "残骸",
    };
    const visited = getVisitedIds(set, a);
    expect(visited.has("knowledge_fields_other")).toBe(false);
    const pruned = pruneAnswers(set, a);
    expect(pruned.knowledge_fields_other).toBeUndefined();
  });

  it("定義外のキーは訪問できないので pruneAnswers が落とす", () => {
    const a: AnswerMap = {
      age: 28,
      stage: "employed",
      __evil: "x",
    };
    const pruned = pruneAnswers(set, a);
    expect(pruned.__evil).toBeUndefined();
    expect(pruned.stage).toBe("employed");
  });

  // ============================================================
  // GOAL v2: 系統 A/B 切替時の pruneAnswers
  // ============================================================
  it("change_intent=continue のとき change_direction / chg_target_field の残存は落ちる", () => {
    const a: AnswerMap = {
      age: 28,
      stage: "employed",
      employment_type: "fulltime",
      current_job_field: "営業",
      years_employed: "3to5",
      knowledge_fields: ["sales_retail"],
      current_income: "500to700",
      education: "uni",
      life_constraint: ["none"],
      location: "metro",
      time_available: "1to3h",
      change_intent: "continue",
      // 過去の change → career_change 経路の残存
      change_direction: "career_change",
      chg_target_field: ["it_web"],
      step_up_target: "specialist",
    };
    const visited = getVisitedIds(set, a);
    expect(visited.has("step_up_target")).toBe(true);
    expect(visited.has("change_direction")).toBe(false);
    expect(visited.has("chg_target_field")).toBe(false);
    const pruned = pruneAnswers(set, a);
    expect(pruned.change_direction).toBeUndefined();
    expect(pruned.chg_target_field).toBeUndefined();
    expect(pruned.step_up_target).toBe("specialist");
  });

  it("change_direction=both_unsure のとき step_up_target / chg_target_field の残存は落ちる", () => {
    const a: AnswerMap = {
      age: 35,
      stage: "employed",
      employment_type: "fulltime",
      current_job_field: "法人営業",
      years_employed: "5to10",
      knowledge_fields: ["sales_retail"],
      current_income: "500to700",
      education: "uni",
      life_constraint: ["caring_kids"],
      location: "metro",
      time_available: "1to3h",
      change_intent: "undecided",
      change_direction: "both_unsure",
      // 過去の step_up / career_change 経路の残存
      step_up_target: "management",
      chg_target_field: ["data_ai"],
    };
    const visited = getVisitedIds(set, a);
    expect(visited.has("step_up_target")).toBe(false);
    expect(visited.has("chg_target_field")).toBe(false);
    const pruned = pruneAnswers(set, a);
    expect(pruned.step_up_target).toBeUndefined();
    expect(pruned.chg_target_field).toBeUndefined();
  });

  it("stage 切替(employed → student)で系統 A 質問群の残存が落ち、系統 B 質問群が訪問対象に(v2.1: student_job_status も訪問)", () => {
    const a: AnswerMap = {
      age: 20,
      stage: "student",
      school_type: "university",
      grade_uni: "u3",
      student_major: "情報",
      student_work_exp: ["parttime"],
      knowledge_fields: ["software_dev"],
      // 過去の系統 A の残存
      change_intent: "continue",
      step_up_target: "specialist",
      // 新しい系統 B 回答
      student_goal_track: "job",
      student_job_status: "exploring",
      student_goal_industry: ["it_web"],
    };
    const visited = getVisitedIds(set, a);
    expect(visited.has("student_goal_track")).toBe(true);
    expect(visited.has("student_job_status")).toBe(true);
    expect(visited.has("student_goal_industry")).toBe(true);
    expect(visited.has("change_intent")).toBe(false);
    expect(visited.has("step_up_target")).toBe(false);
    const pruned = pruneAnswers(set, a);
    expect(pruned.change_intent).toBeUndefined();
    expect(pruned.step_up_target).toBeUndefined();
    expect(pruned.student_goal_track).toBe("job");
    expect(pruned.student_job_status).toBe("exploring");
  });

  it("student_goal_industry から other_field を外すと other_field_text の残存が落ちる", () => {
    const a: AnswerMap = {
      age: 20,
      stage: "student",
      school_type: "university",
      grade_uni: "u3",
      student_major: "情報",
      student_work_exp: ["intern"],
      knowledge_fields: ["software_dev"],
      student_goal_track: "job",
      // other_field なし
      student_goal_industry: ["it_web", "marketing_pr"],
      // 過去の other_field 経路の残存
      other_field_text: "古い記述",
    };
    const visited = getVisitedIds(set, a);
    expect(visited.has("other_field_text")).toBe(false);
    const pruned = pruneAnswers(set, a);
    expect(pruned.other_field_text).toBeUndefined();
  });

  it("student_goal_industry に other_field を含むと other_field_text が訪問対象", () => {
    const a: AnswerMap = {
      age: 20,
      stage: "student",
      school_type: "university",
      grade_uni: "u3",
      student_major: "経済",
      student_work_exp: ["intern"],
      knowledge_fields: ["marketing_pr"],
      student_goal_track: "job",
      student_goal_industry: ["other_field", "marketing_pr"],
      other_field_text: "eスポーツ運営",
    };
    const visited = getVisitedIds(set, a);
    expect(visited.has("other_field_text")).toBe(true);
    const pruned = pruneAnswers(set, a);
    expect(pruned.other_field_text).toBe("eスポーツ運営");
  });

  it("stage=retired+early は系統 B(second_career_intent)、change_intent 系の残存は落ちる", () => {
    const a: AnswerMap = {
      age: 50,
      stage: "retired",
      retired_status: "early",
      prior_work_exp: "yes",
      current_job_field: "経理財務",
      years_employed: "gt10",
      knowledge_fields: ["finance_acc"],
      // 過去の系統 A の残存
      change_intent: "change",
      change_direction: "career_change",
      // 新しい系統 B 回答
      second_career_intent: "re_employment",
    };
    const visited = getVisitedIds(set, a);
    expect(visited.has("second_career_intent")).toBe(true);
    expect(visited.has("change_intent")).toBe(false);
    expect(visited.has("change_direction")).toBe(false);
    const pruned = pruneAnswers(set, a);
    expect(pruned.change_intent).toBeUndefined();
    expect(pruned.change_direction).toBeUndefined();
    expect(pruned.second_career_intent).toBe("re_employment");
  });

  it("stage=retired+re_employ は系統 A(change_intent)、second_career_intent の残存は落ちる", () => {
    const a: AnswerMap = {
      age: 62,
      stage: "retired",
      retired_status: "re_employ",
      prior_work_exp: "yes",
      current_job_field: "教員",
      years_employed: "gt10",
      knowledge_fields: ["education"],
      // 過去の系統 B の残存
      second_career_intent: "community",
      // 新しい系統 A 回答
      change_intent: "continue",
      step_up_target: "better_conditions",
    };
    const visited = getVisitedIds(set, a);
    expect(visited.has("change_intent")).toBe(true);
    expect(visited.has("second_career_intent")).toBe(false);
    const pruned = pruneAnswers(set, a);
    expect(pruned.second_career_intent).toBeUndefined();
  });

  it("housekeeper + prior_work_exp=no は系統 B(new_entry_direction)、change_intent 系の残存は落ちる", () => {
    const a: AnswerMap = {
      age: 28,
      stage: "housekeeper",
      prior_work_exp: "no",
      knowledge_fields: ["none_kn"],
      // 過去の系統 A の残存
      change_intent: "change",
      step_up_target: "specialist",
      // 新しい系統 B 回答
      new_entry_direction: ["it_web", "design_creative"],
    };
    const visited = getVisitedIds(set, a);
    expect(visited.has("new_entry_direction")).toBe(true);
    expect(visited.has("change_intent")).toBe(false);
    expect(visited.has("step_up_target")).toBe(false);
    const pruned = pruneAnswers(set, a);
    expect(pruned.change_intent).toBeUndefined();
    expect(pruned.step_up_target).toBeUndefined();
    expect(pruned.new_entry_direction).toEqual(["it_web", "design_creative"]);
  });

  it("housekeeper + prior_work_exp=yes は系統 A、new_entry_direction の残存は落ちる", () => {
    const a: AnswerMap = {
      age: 32,
      stage: "housekeeper",
      prior_work_exp: "yes",
      current_job_field: "一般事務",
      years_employed: "3to5",
      knowledge_fields: ["sales_retail"],
      // 過去の系統 B 残存
      new_entry_direction: ["it_web"],
      // 新しい系統 A 回答
      change_intent: "change",
      change_direction: "career_change",
      chg_target_field: ["it_web", "design_creative"],
    };
    const visited = getVisitedIds(set, a);
    expect(visited.has("change_intent")).toBe(true);
    expect(visited.has("new_entry_direction")).toBe(false);
    const pruned = pruneAnswers(set, a);
    expect(pruned.new_entry_direction).toBeUndefined();
  });

  it("student_goal_track=startup は student_goal_industry / advance / other_field_text / 進捗ステータス系すべてを訪問外に(v2.1)", () => {
    const a: AnswerMap = {
      age: 22,
      stage: "student",
      school_type: "university",
      grade_uni: "u4",
      student_major: "経営",
      student_work_exp: ["startup"],
      knowledge_fields: ["sales_retail"],
      student_goal_track: "startup",
      // 残存(v2.1 で status 系も追加)
      student_job_status: "exploring",
      student_advance_status: "searching",
      student_goal_industry: ["it_web"],
      student_goal_advance: "大学院",
      other_field_text: "残骸",
    };
    const visited = getVisitedIds(set, a);
    expect(visited.has("student_job_status")).toBe(false);
    expect(visited.has("student_advance_status")).toBe(false);
    expect(visited.has("student_goal_industry")).toBe(false);
    expect(visited.has("student_goal_advance")).toBe(false);
    expect(visited.has("other_field_text")).toBe(false);
    const pruned = pruneAnswers(set, a);
    expect(pruned.student_job_status).toBeUndefined();
    expect(pruned.student_advance_status).toBeUndefined();
    expect(pruned.student_goal_industry).toBeUndefined();
    expect(pruned.student_goal_advance).toBeUndefined();
    expect(pruned.other_field_text).toBeUndefined();
  });

  // ============================================================
  // GOAL v2.1 §8-10-3: 学生フロー差分の最小テストセット(6 ケース)
  // ============================================================
  it("(v2.1-#1) student_goal_track=job → student_job_status を訪問・advance 系は非訪問", () => {
    const a: AnswerMap = {
      age: 20,
      stage: "student",
      school_type: "university",
      grade_uni: "u3",
      student_major: "情報",
      student_work_exp: ["intern"],
      knowledge_fields: ["software_dev"],
      student_goal_track: "job",
      student_job_status: "in_selection",
      student_goal_industry: ["software_dev"],
    };
    const visited = getVisitedIds(set, a);
    expect(visited.has("student_job_status")).toBe(true);
    expect(visited.has("student_advance_status")).toBe(false);
    expect(visited.has("student_goal_advance")).toBe(false);
    expect(visited.has("student_goal_industry")).toBe(true);
  });

  it("(v2.1-#2) student_goal_track=advance → status → advance(text) → industry の順に訪問・job_status は非訪問", () => {
    const a: AnswerMap = {
      age: 18,
      stage: "student",
      school_type: "high_school",
      grade_hs: "hs3",
      student_major: "理系",
      student_work_exp: ["none"],
      knowledge_fields: ["medical_care"],
      student_goal_track: "advance",
      student_advance_status: "admitted",
      student_goal_advance: "医学部",
      student_goal_industry: ["medical_care"],
    };
    const visited = getVisitedIds(set, a);
    expect(visited.has("student_advance_status")).toBe(true);
    expect(visited.has("student_goal_advance")).toBe(true);
    expect(visited.has("student_goal_industry")).toBe(true);
    expect(visited.has("student_job_status")).toBe(false);
    // 順序チェックは walk で path 化して確認
    const path = walk(a);
    expect(path.indexOf("student_advance_status")).toBeLessThan(
      path.indexOf("student_goal_advance"),
    );
    expect(path.indexOf("student_goal_advance")).toBeLessThan(
      path.indexOf("student_goal_industry"),
    );
  });

  it("(v2.1-#3) advance 経路でも student_goal_industry に other_field を含むと other_field_text 派生する", () => {
    const a: AnswerMap = {
      age: 22,
      stage: "student",
      school_type: "university",
      grade_uni: "u4",
      student_major: "経済",
      student_work_exp: ["intern"],
      knowledge_fields: ["finance_acc"],
      student_goal_track: "advance",
      student_advance_status: "target_decided",
      student_goal_advance: "大学院(経済)",
      student_goal_industry: ["other_field", "research"],
      other_field_text: "宇宙経済学",
    };
    const visited = getVisitedIds(set, a);
    expect(visited.has("other_field_text")).toBe(true);
    const pruned = pruneAnswers(set, a);
    expect(pruned.other_field_text).toBe("宇宙経済学");
  });

  it("(v2.1-#4) advance → startup 切替で advance_status / advance(text) / industry / other_field_text がすべて prune される", () => {
    const a: AnswerMap = {
      age: 22,
      stage: "student",
      school_type: "university",
      grade_uni: "u4",
      student_major: "経営",
      student_work_exp: ["startup"],
      knowledge_fields: ["sales_retail"],
      // 切替後
      student_goal_track: "startup",
      // 切替前の残存(advance 系)
      student_advance_status: "searching",
      student_goal_advance: "大学院",
      student_goal_industry: ["it_web"],
      other_field_text: "残骸",
    };
    const visited = getVisitedIds(set, a);
    expect(visited.has("student_advance_status")).toBe(false);
    expect(visited.has("student_goal_advance")).toBe(false);
    expect(visited.has("student_goal_industry")).toBe(false);
    expect(visited.has("other_field_text")).toBe(false);
    const pruned = pruneAnswers(set, a);
    expect(pruned.student_advance_status).toBeUndefined();
    expect(pruned.student_goal_advance).toBeUndefined();
    expect(pruned.student_goal_industry).toBeUndefined();
    expect(pruned.other_field_text).toBeUndefined();
  });

  it("(v2.1-#5) job → advance 切替で student_job_status が prune され advance_status 経路に切り替わる", () => {
    const a: AnswerMap = {
      age: 20,
      stage: "student",
      school_type: "university",
      grade_uni: "u3",
      student_major: "情報",
      student_work_exp: ["intern"],
      knowledge_fields: ["software_dev"],
      // 切替後
      student_goal_track: "advance",
      // 切替前の残存(job 系)
      student_job_status: "in_selection",
      // 切替後の新回答
      student_advance_status: "searching",
      student_goal_advance: "大学院(情報系)",
      student_goal_industry: ["software_dev"],
    };
    const visited = getVisitedIds(set, a);
    expect(visited.has("student_job_status")).toBe(false);
    expect(visited.has("student_advance_status")).toBe(true);
    expect(visited.has("student_goal_advance")).toBe(true);
    const pruned = pruneAnswers(set, a);
    expect(pruned.student_job_status).toBeUndefined();
    expect(pruned.student_advance_status).toBe("searching");
  });

  it("(v2.1-#6 / v2.2 改修) 任意の stage で goal_start_timing=after_preparation → goal_commit に進む(v2.2: avoid 撤去で直接接続)", () => {
    expect(
      getNextQuestionId(set, "goal_start_timing", {
        goal_start_timing: "after_preparation",
      }),
    ).toBe("goal_commit");
  });
});

// ============================================================
// GOAL v2 ペルソナ別フルパス(specs §5 参照)
// ============================================================
describe("GOAL v2 ペルソナ別フルパス — 終端まで到達", () => {
  it("高校生(系統 B / student / advance)で終端まで届く(v2.1: status → advance → industry の順)", () => {
    const a: AnswerMap = {
      age: 16,
      stage: "student",
      school_type: "high_school",
      grade_hs: "hs2",
      student_major: "理系コース",
      student_work_exp: ["none"],
      knowledge_fields: ["software_dev"],
      current_income: "none",
      life_constraint: ["none"],
      location: "metro",
      time_available: "1to3h",
      student_goal_track: "advance",
      // v2.1 新規: 進学進捗ステータス
      student_advance_status: "target_decided",
      student_goal_advance: "大学(情報科学系)",
      // v2.1 改修: 進学者にも業界を聞く
      student_goal_industry: ["software_dev", "undecided"],
      // v2.2: multi 化 / goal_avoid は撤去
      goal_workstyle: ["undecided"],
      goal_income: "300to400",
      goal_horizon: "10y",
      goal_start_timing: "within_1y",
      goal_commit: "20to50",
      value_priority: ["growth"],
      learning_depth: "deep_focus",
      social_pref: "solo_strong",
      risk_pref: "safe",
    };
    const path = walk(a);
    expect(path[path.length - 1]).toBe("mindset_freenote");
    expect(path).toContain("student_goal_track");
    expect(path).toContain("student_advance_status");
    expect(path).toContain("student_goal_advance");
    expect(path).toContain("student_goal_industry");
    expect(path).not.toContain("student_job_status");
    expect(path).not.toContain("change_intent");
    // 順序: status → advance(text) → industry
    expect(path.indexOf("student_advance_status")).toBeLessThan(
      path.indexOf("student_goal_advance"),
    );
    expect(path.indexOf("student_goal_advance")).toBeLessThan(
      path.indexOf("student_goal_industry"),
    );
  });

  it("学生 / job + other_field(派生)で終端まで届く(v2.1: student_job_status を経由)", () => {
    const a: AnswerMap = {
      age: 20,
      stage: "student",
      school_type: "university",
      grade_uni: "u3",
      student_major: "経済",
      student_work_exp: ["intern"],
      knowledge_fields: ["marketing_pr"],
      current_income: "none",
      life_constraint: ["none"],
      location: "metro",
      time_available: "1to3h",
      student_goal_track: "job",
      student_job_status: "researching",
      student_goal_industry: ["other_field", "marketing_pr"],
      other_field_text: "eスポーツ業界の運営・大会企画",
      // v2.2: multi 化 / goal_avoid は撤去
      goal_workstyle: ["company"],
      goal_income: "400to600",
      goal_horizon: "5y",
      goal_start_timing: "now",
      goal_commit: "lt5",
      value_priority: ["growth"],
      learning_depth: "wide_explore",
      social_pref: "team_strong",
      risk_pref: "safe",
    };
    const path = walk(a);
    expect(path[path.length - 1]).toBe("mindset_freenote");
    expect(path).toContain("student_job_status");
    expect(path).toContain("student_goal_industry");
    expect(path).toContain("other_field_text");
    // 順序: job_status → industry → other_field_text → goal_workstyle
    expect(path.indexOf("student_job_status")).toBeLessThan(
      path.indexOf("student_goal_industry"),
    );
    expect(path.indexOf("other_field_text")).toBeLessThan(
      path.indexOf("goal_workstyle"),
    );
    // advance 系を経由していないこと
    expect(path).not.toContain("student_advance_status");
    expect(path).not.toContain("student_goal_advance");
  });

  it("学生 / job + other_field なしは other_field_text をスキップ(v2.1: student_job_status は経由)", () => {
    const a: AnswerMap = {
      age: 20,
      stage: "student",
      school_type: "university",
      grade_uni: "u3",
      student_major: "経済",
      student_work_exp: ["intern"],
      knowledge_fields: ["marketing_pr"],
      current_income: "none",
      life_constraint: ["none"],
      location: "metro",
      time_available: "1to3h",
      student_goal_track: "job",
      student_job_status: "exploring",
      student_goal_industry: ["marketing_pr", "it_web"],
      // v2.2: multi 化 / goal_avoid は撤去
      goal_workstyle: ["company"],
      goal_income: "400to600",
      goal_horizon: "5y",
      goal_start_timing: "now",
      goal_commit: "lt5",
      value_priority: ["growth"],
      learning_depth: "wide_explore",
      social_pref: "team_strong",
      risk_pref: "safe",
    };
    const path = walk(a);
    expect(path[path.length - 1]).toBe("mindset_freenote");
    expect(path).toContain("student_job_status");
    expect(path).toContain("student_goal_industry");
    expect(path).not.toContain("other_field_text");
    expect(path).not.toContain("student_advance_status");
  });

  it("ITエンジニア(系統 A / continue)で終端まで届く", () => {
    const a: AnswerMap = {
      age: 28,
      stage: "employed",
      employment_type: "fulltime",
      current_job_field: "Web エンジニア(バックエンド)",
      years_employed: "3to5",
      knowledge_fields: ["software_dev"],
      current_income: "500to700",
      education: "uni",
      life_constraint: ["none"],
      location: "metro",
      time_available: "1to3h",
      change_intent: "continue",
      step_up_target: "specialist",
      // v2.2: multi 化 / goal_avoid は撤去
      goal_workstyle: ["same_as_now"],
      goal_income: "800to1200",
      goal_horizon: "3y",
      goal_start_timing: "now",
      goal_commit: "20to50",
      value_priority: ["growth"],
      learning_depth: "deep_focus",
      social_pref: "team_strong",
      risk_pref: "safe",
    };
    const path = walk(a);
    expect(path[path.length - 1]).toBe("mindset_freenote");
    expect(path).toContain("change_intent");
    expect(path).toContain("step_up_target");
    expect(path).not.toContain("change_direction");
    expect(path).not.toContain("chg_target_field");
  });

  it("フリーター(系統 A / change → career_change)で終端まで届く", () => {
    const a: AnswerMap = {
      age: 23,
      stage: "freeter",
      freeter_main_work: "飲食店ホール",
      years_employed: "1to3",
      knowledge_fields: ["service"],
      current_income: "lt300",
      education: "hs",
      life_constraint: ["none"],
      location: "metro",
      time_available: "weekend",
      change_intent: "change",
      change_direction: "career_change",
      chg_target_field: ["it_web", "software_dev"],
      // v2.2: multi 化 / goal_avoid は撤去
      goal_workstyle: ["company"],
      goal_income: "400to600",
      goal_horizon: "3y",
      goal_start_timing: "within_3m",
      goal_commit: "20to50",
      goal_freenote: "プログラミングを独学中",
      value_priority: ["growth"],
      learning_depth: "deep_focus",
      social_pref: "team_strong",
      risk_pref: "risk_take",
    };
    const path = walk(a);
    expect(path[path.length - 1]).toBe("mindset_freenote");
    expect(path).toContain("change_intent");
    expect(path).toContain("change_direction");
    expect(path).toContain("chg_target_field");
    expect(path).not.toContain("step_up_target");
  });

  it("育休中(系統 A / continue + better_conditions)で終端まで届く", () => {
    const a: AnswerMap = {
      age: 38,
      stage: "parental_leave",
      parental_child_age: "under1",
      prior_work_exp: "yes",
      current_job_field: "小学校教員",
      years_employed: "gt10",
      knowledge_fields: ["education"],
      current_income: "300to500",
      education: "uni",
      life_constraint: ["caring_kids"],
      location: "regional_city",
      time_available: "lt1h",
      change_intent: "continue",
      step_up_target: "better_conditions",
      // v2.2: multi 化 / goal_avoid は撤去
      goal_workstyle: ["same_as_now"],
      goal_income: "same_as_now",
      goal_horizon: "1y",
      goal_start_timing: "within_1y",
      goal_commit: "none",
      value_priority: ["stability"],
      learning_depth: "deep_focus",
      social_pref: "team_strong",
      risk_pref: "safe",
    };
    const path = walk(a);
    expect(path[path.length - 1]).toBe("mindset_freenote");
    expect(path).toContain("change_intent");
  });

  it("休職中(系統 A / undecided + both_unsure)で終端まで届く", () => {
    const a: AnswerMap = {
      age: 35,
      stage: "on_leave",
      on_leave_reason: "health_mental",
      prior_work_exp: "yes",
      current_job_field: "システムエンジニア",
      years_employed: "5to10",
      knowledge_fields: ["software_dev"],
      current_income: "500to700",
      education: "uni",
      life_constraint: ["health"],
      location: "metro",
      time_available: "weekend",
      change_intent: "undecided",
      change_direction: "both_unsure",
      // v2.2: multi 化 / goal_avoid は撤去
      goal_workstyle: ["undecided"],
      goal_income: "same_as_now",
      goal_horizon: "open",
      goal_start_timing: "slow",
      goal_commit: "none",
      value_priority: ["stability"],
      learning_depth: "deep_focus",
      social_pref: "solo_strong",
      risk_pref: "safe",
    };
    const path = walk(a);
    expect(path[path.length - 1]).toBe("mindset_freenote");
    expect(path).toContain("change_intent");
    expect(path).toContain("change_direction");
    // both_unsure → 共通フロー直行
    expect(path).not.toContain("step_up_target");
    expect(path).not.toContain("chg_target_field");
  });

  it("早期退職(系統 B / second_career_intent)で終端まで届く", () => {
    const a: AnswerMap = {
      age: 50,
      stage: "retired",
      retired_status: "early",
      prior_work_exp: "yes",
      current_job_field: "経理財務マネージャー",
      years_employed: "gt10",
      knowledge_fields: ["finance_acc"],
      current_income: "700to1000",
      education: "uni",
      life_constraint: ["none"],
      location: "metro",
      time_available: "flex",
      second_career_intent: "re_employment",
      // v2.2: multi 化 / goal_avoid は撤去
      goal_workstyle: ["company"],
      goal_income: "600to800",
      goal_horizon: "5y",
      goal_start_timing: "within_3m",
      goal_commit: "lt5",
      goal_freenote: "経理財務の知見を活かしたい",
      value_priority: ["meaning"],
      learning_depth: "deep_focus",
      social_pref: "solo_strong",
      risk_pref: "safe",
    };
    const path = walk(a);
    expect(path[path.length - 1]).toBe("mindset_freenote");
    expect(path).toContain("second_career_intent");
    expect(path).not.toContain("change_intent");
  });

  it("主婦 prior_work_exp=no(系統 B / new_entry_direction)で終端まで届く", () => {
    const a: AnswerMap = {
      age: 28,
      stage: "housekeeper",
      prior_work_exp: "no",
      knowledge_fields: ["none_kn"],
      current_income: "none",
      education: "hs",
      life_constraint: ["caring_kids"],
      location: "rural",
      time_available: "lt1h",
      new_entry_direction: ["it_web", "design_creative", "undecided"],
      // v2.2: multi 化 / goal_avoid は撤去
      goal_workstyle: ["freelance"],
      goal_income: "400to600",
      goal_horizon: "5y",
      goal_start_timing: "within_1y",
      goal_commit: "20to50",
      value_priority: ["meaning"],
      learning_depth: "wide_explore",
      social_pref: "team_strong",
      risk_pref: "safe",
    };
    const path = walk(a);
    expect(path[path.length - 1]).toBe("mindset_freenote");
    expect(path).toContain("new_entry_direction");
    expect(path).not.toContain("change_intent");
    expect(path).not.toContain("second_career_intent");
  });
});

describe("getProgress — セクション化進捗(v2)", () => {
  it("初期表示(age)は ORIGIN がアクティブ", () => {
    const snap = getProgress(set, "age", {}, []);
    expect(snap.sections.map((s) => s.key)).toEqual([
      "current",
      "goal",
      "personality",
    ]);
    expect(snap.sections[0].status).toBe("active");
    expect(snap.sections[1].status).toBe("todo");
    expect(snap.sections[2].status).toBe("todo");
    expect(snap.sections[0].step).toBe(1);
  });

  it("GOAL セクションに入ると ORIGIN は done(v2.1 + GOAL v2: change_intent から開始)", () => {
    const a: AnswerMap = {
      age: 28,
      stage: "employed",
      employment_type: "fulltime",
      current_job_field: "営業",
      years_employed: "3to5",
      knowledge_fields: ["it_web"],
      current_income: "500to700",
      education: "uni",
      life_constraint: ["none"],
      location: "metro",
      time_available: "1to3h",
    };
    const snap = getProgress(set, "change_intent", a, [
      "age",
      "stage",
      "employment_type",
      "current_job_field",
      "years_employed",
      "knowledge_fields",
      "current_income",
      "education",
      "life_constraint",
      "location",
      "time_available",
      "origin_freenote",
    ]);
    const origin = snap.sections.find((s) => s.key === "current")!;
    expect(origin.status).toBe("done");
    expect(origin.step).toBe(origin.total);
    const goal = snap.sections.find((s) => s.key === "goal")!;
    expect(goal.status).toBe("active");
  });

  it("立場ごとに ORIGIN total が変化する(v2.1: current_job_field / prior_work_exp / education スキップ反映)", () => {
    const get = (a: AnswerMap) =>
      getProgress(set, "age", a, []).sections.find((s) => s.key === "current")!
        .total;
    // employed (v2.1): age + stage + employment_type + current_job_field + years_employed
    //   + knowledge_fields + current_income + education + life_constraint + location + time_available + origin_freenote = 12
    expect(get({ stage: "employed" })).toBe(12);
    // housekeeper (v2.1・prior_work_exp 未確定 = 線形フォールバックで current_job_field → years_employed を経由):
    //   age + stage + prior_work_exp + current_job_field + years_employed
    //   + knowledge_fields + current_income + education + life_constraint + location + time_available + origin_freenote = 12
    //   (engine.ts の getNextQuestionId は prior_work_exp 未回答時に choice.next にマッチしないため線形フォールバック → 定義順 next が current_job_field になる)
    expect(get({ stage: "housekeeper" })).toBe(12);
    // housekeeper + prior_work_exp=yes は同じ経路で 12
    expect(get({ stage: "housekeeper", prior_work_exp: "yes" })).toBe(12);
    // housekeeper + prior_work_exp=no: choice.next=knowledge_fields にマッチして current_job_field と years_employed をスキップ → 10
    expect(get({ stage: "housekeeper", prior_work_exp: "no" })).toBe(10);
    // student/junior_high (v2.1): age + stage + school_type + grade_jh + student_work_exp
    //   + knowledge_fields + current_income + life_constraint + location + time_available + origin_freenote = 11
    //   (education は student のためスキップ / student_work_detail は未訪問:branch で knowledge_fields に飛ぶ)
    expect(get({ stage: "student", school_type: "junior_high" })).toBe(11);
    // student/university (v2.1): + student_major = 12
    expect(get({ stage: "student", school_type: "university" })).toBe(12);
  });

  it("totalPercent は 0〜100 に収まる(v2.1 + GOAL v2)", () => {
    const a: AnswerMap = {
      age: 28,
      stage: "employed",
      employment_type: "fulltime",
      current_job_field: "営業",
      years_employed: "3to5",
      knowledge_fields: ["it_web"],
      current_income: "500to700",
      education: "uni",
      life_constraint: ["none"],
      location: "metro",
      time_available: "1to3h",
      change_intent: "continue",
      step_up_target: "specialist",
      // v2.2: multi 化 / goal_avoid は撤去
      goal_workstyle: ["company"],
      goal_income: "600to800",
      goal_horizon: "3y",
      goal_start_timing: "now",
      goal_commit: "lt5",
      value_priority: ["growth"],
      learning_depth: "deep_focus",
      social_pref: "team_strong",
      risk_pref: "safe",
    };
    const snap = getProgress(set, "mindset_freenote", a, []);
    expect(snap.totalPercent).toBeGreaterThanOrEqual(0);
    expect(snap.totalPercent).toBeLessThanOrEqual(100);
  });
});

describe("isComplete — 終端判定", () => {
  it("mindset_freenote は終端(MINDSET v2)", () => {
    expect(isComplete(set, "mindset_freenote", {})).toBe(true);
  });

  it("途中の質問では終端ではない", () => {
    expect(isComplete(set, "stage", { stage: "employed" })).toBe(false);
    // MINDSET v2: value_priority は multi(MUST 1〜3 個)。次は meaning_priority。
    expect(
      isComplete(set, "value_priority", { value_priority: ["growth"] }),
    ).toBe(false);
  });

  it("存在しない質問IDは終端扱い(安全側)", () => {
    expect(isComplete(set, "unknown_id", {})).toBe(true);
  });
});

// ============================================================
// MINDSET v2 確定版(specs/mindset-questions-v2.md §3 / §4 / §8)
// ============================================================
describe("MINDSET v2 — 質問定義 / 線形遷移 / maxSelect", () => {
  it("MINDSET セクションは 15 問の定義(MUST 14 + MAY 1)", () => {
    const mindsetIds = set.questions.filter((q) => q.axis === "personality");
    expect(mindsetIds.length).toBe(15);
  });

  it("v1 撤去 ID(work_style_pref / free_note)は定義に存在しない", () => {
    expect(getQuestion(set, "work_style_pref")).toBeUndefined();
    expect(getQuestion(set, "free_note")).toBeUndefined();
  });

  it("MINDSET v2 新規 / 改名 ID が全て定義されている", () => {
    const ids = [
      // A 群コア性格
      "leadership_role",
      "social_pref",
      "plan_style",
      "unknown_field_jump",
      "change_attitude",
      // B 群価値観
      "value_priority",
      "meaning_priority",
      "competition_pref",
      // D 群リスク
      "risk_pref",
      // C 群学習
      "learning_depth",
      "failure_recovery",
      // E 群働き方
      "location_preference",
      "remote_preference",
      "wlb_priority",
      // F 群自由記述
      "mindset_freenote",
    ];
    for (const id of ids) {
      expect(getQuestion(set, id), `missing: ${id}`).toBeDefined();
    }
  });

  it("goal_freenote.next = 'leadership_role'(GOAL → MINDSET の接続)", () => {
    const q = getQuestion(set, "goal_freenote");
    expect(q?.next).toBe("leadership_role");
  });

  it("mindset_freenote.next = null(MINDSET 最終問・終端)", () => {
    const q = getQuestion(set, "mindset_freenote");
    expect(q?.next).toBeNull();
    expect(isComplete(set, "mindset_freenote", {})).toBe(true);
  });

  it("MINDSET v2 は全員フラット 15 問の線形遷移(分岐なし)", () => {
    const expected: Array<[string, string | null]> = [
      ["leadership_role", "social_pref"],
      ["social_pref", "plan_style"],
      ["plan_style", "unknown_field_jump"],
      ["unknown_field_jump", "change_attitude"],
      ["change_attitude", "value_priority"],
      ["value_priority", "meaning_priority"],
      ["meaning_priority", "competition_pref"],
      ["competition_pref", "risk_pref"],
      ["risk_pref", "learning_depth"],
      ["learning_depth", "failure_recovery"],
      ["failure_recovery", "location_preference"],
      ["location_preference", "remote_preference"],
      ["remote_preference", "wlb_priority"],
      ["wlb_priority", "mindset_freenote"],
      ["mindset_freenote", null],
    ];
    for (const [from, to] of expected) {
      expect(getNextQuestionId(set, from, {})).toBe(to);
    }
  });

  it("value_priority は multi MUST + maxSelect=3", () => {
    const q = getQuestion(set, "value_priority");
    expect(q?.type).toBe("multi");
    expect(q?.required).toBe(true);
    expect(q?.maxSelect).toBe(3);
    expect(q?.choices?.map((c) => c.value).sort()).toEqual(
      [
        "stability",
        "growth",
        "freedom",
        "relation",
        "meaning",
        "reward",
      ].sort(),
    );
  });

  it("v2 確定版で 2 択 single は存在しない(全 single が 3 択以上)", () => {
    const mindsetSingles = set.questions.filter(
      (q) => q.axis === "personality" && q.type === "single",
    );
    for (const q of mindsetSingles) {
      expect(
        (q.choices?.length ?? 0) >= 3,
        `${q.id} has ${q.choices?.length} choices (< 3)`,
      ).toBe(true);
    }
  });

  it("`neither` 値が 3 問(unknown_field_jump / competition_pref / failure_recovery)で受理可能", () => {
    for (const id of [
      "unknown_field_jump",
      "competition_pref",
      "failure_recovery",
    ]) {
      const q = getQuestion(set, id);
      const values = q?.choices?.map((c) => c.value) ?? [];
      expect(values, `${id}.choices`).toContain("neither");
    }
  });

  it("ペルソナ: 28 歳 IT エンジニアの MINDSET 15 問パス(全員フラット線形)", () => {
    // ORIGIN/GOAL は短縮、MINDSET は specs §5-3 のペルソナを再現
    const a: AnswerMap = {
      age: 28,
      stage: "employed",
      employment_type: "fulltime",
      current_job_field: "Web エンジニア",
      years_employed: "3to5",
      knowledge_fields: ["software_dev"],
      current_income: "500to700",
      education: "uni",
      life_constraint: ["none"],
      location: "metro",
      time_available: "1to3h",
      change_intent: "continue",
      step_up_target: "specialist",
      goal_workstyle: ["same_as_now"],
      goal_income: "800to1200",
      goal_horizon: "3y",
      goal_start_timing: "now",
      goal_commit: "20to50",
      // MINDSET v2 ペルソナ §5-3
      leadership_role: "lead_avoid",
      social_pref: "solo_strong",
      plan_style: "plan_first",
      unknown_field_jump: "jump_anxious",
      change_attitude: "change_neutral",
      value_priority: ["growth", "freedom"],
      meaning_priority: "balance",
      competition_pref: "compete_drain",
      risk_pref: "risk_balance",
      learning_depth: "deep_focus",
      failure_recovery: "careful_after",
      location_preference: "keep_current",
      remote_preference: "remote_full",
      wlb_priority: "wlb_balance",
    };
    const path = walk(a);
    expect(path[path.length - 1]).toBe("mindset_freenote");
    // MINDSET 15 問が全て path に登場
    const mindsetExpected = [
      "leadership_role",
      "social_pref",
      "plan_style",
      "unknown_field_jump",
      "change_attitude",
      "value_priority",
      "meaning_priority",
      "competition_pref",
      "risk_pref",
      "learning_depth",
      "failure_recovery",
      "location_preference",
      "remote_preference",
      "wlb_priority",
      "mindset_freenote",
    ];
    for (const id of mindsetExpected) {
      expect(path).toContain(id);
    }
  });

  it("ペルソナ: 育休中 38 歳の neither / value_priority 2 個も終端まで届く(specs §5-6)", () => {
    const a: AnswerMap = {
      age: 38,
      stage: "parental_leave",
      parental_child_age: "under1",
      prior_work_exp: "yes",
      current_job_field: "小学校教員",
      years_employed: "gt10",
      knowledge_fields: ["education"],
      current_income: "300to500",
      education: "uni",
      life_constraint: ["caring_kids"],
      location: "regional_city",
      time_available: "lt1h",
      change_intent: "continue",
      step_up_target: "better_conditions",
      goal_workstyle: ["same_as_now"],
      goal_income: "same_as_now",
      goal_horizon: "1y",
      goal_start_timing: "within_1y",
      goal_commit: "none",
      // MINDSET v2 ペルソナ §5-6(育休中・3 択化を活用 / neither + value 2 個)
      leadership_role: "lead_neutral",
      social_pref: "team_strong",
      plan_style: "plan_first",
      unknown_field_jump: "neither",
      change_attitude: "change_neutral",
      value_priority: ["meaning", "stability"],
      meaning_priority: "meaning_priority",
      competition_pref: "compete_drain",
      risk_pref: "safe",
      learning_depth: "mix_learning",
      failure_recovery: "careful_after",
      location_preference: "keep_current",
      remote_preference: "hybrid_office",
      wlb_priority: "wlb_priority",
      mindset_freenote: "復職後も教育の道で続けたい",
    };
    const path = walk(a);
    expect(path[path.length - 1]).toBe("mindset_freenote");
  });
});
