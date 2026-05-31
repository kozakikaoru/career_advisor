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
 * - 基本部分は全員共通(knowledge_fields 以降 + GOAL + MINDSET)。
 * - 立場ごとに追加質問(深掘り質問)を `branch` で差し込む。
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
    goal_clarity: "clear",
    goal_target: "PM",
    goal_workstyle: "company",
    goal_income: "600to800",
    goal_horizon: "3y",
    value_priority: "growth",
    work_style_pref: "deep",
    social_pref: "team",
    risk_pref: "safe",
    free_note: "",
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

describe("末尾の線形遷移(current_income → goal_clarity)", () => {
  it.each([
    ["current_income", "education"],
    ["education", "life_constraint"],
    ["life_constraint", "location"],
    ["location", "time_available"],
    ["time_available", "origin_freenote"],
    ["origin_freenote", "goal_clarity"],
  ] as const)("%s → %s", (from, to) => {
    expect(getNextQuestionId(set, from, {})).toBe(to);
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

  it("student/junior_high(中学生・学科スキップ)で free_note まで到達(v2.1: education もスキップ)", () => {
    const a: AnswerMap = {
      age: 14,
      stage: "student",
      school_type: "junior_high",
      grade_jh: "jh3",
      student_work_exp: ["none"],
      ...baseTail(),
    };
    const path = walk(a);
    expect(path[path.length - 1]).toBe("free_note");
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
    "student/%s フローは grade & student_major を含み終端まで到達(v2.1: student_work_detail を含み education スキップ)",
    (st, gk, gv) => {
      const a = studentAnswers(st, gk, gv);
      const path = walk(a);
      expect(path[path.length - 1]).toBe("free_note");
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
    expect(path[path.length - 1]).toBe("free_note");
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
    expect(path[path.length - 1]).toBe("free_note");
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
    expect(path[path.length - 1]).toBe("free_note");
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
    expect(path[path.length - 1]).toBe("free_note");
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
    expect(path[path.length - 1]).toBe("free_note");
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
    expect(path[path.length - 1]).toBe("free_note");
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
    expect(path[path.length - 1]).toBe("free_note");
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
    expect(path[path.length - 1]).toBe("free_note");
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
    expect(path[path.length - 1]).toBe("free_note");
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
    expect(path[path.length - 1]).toBe("free_note");
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
    expect(path[path.length - 1]).toBe("free_note");
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
    expect(path[path.length - 1]).toBe("free_note");
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
    expect(path[path.length - 1]).toBe("free_note");
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
    expect(path[path.length - 1]).toBe("free_note");
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

describe("MAY スキップで終端まで到達", () => {
  it("origin_freenote / free_note を未回答でも終端に届く(MAY のみスキップ・v2.1: current_job_field 追加)", () => {
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
    const path = walk(a);
    expect(path[path.length - 1]).toBe("free_note");
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

  it("GOAL セクションに入ると ORIGIN は done(v2.1: current_job_field 追加)", () => {
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
    const snap = getProgress(set, "goal_target", a, [
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
      "goal_clarity",
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

  it("totalPercent は 0〜100 に収まる(v2.1: current_job_field 追加)", () => {
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
      goal_clarity: "clear",
      goal_target: "PM",
      goal_workstyle: "company",
      goal_income: "600to800",
      goal_horizon: "3y",
      value_priority: "growth",
      work_style_pref: "deep",
      social_pref: "team",
      risk_pref: "safe",
    };
    const snap = getProgress(set, "free_note", a, []);
    expect(snap.totalPercent).toBeGreaterThanOrEqual(0);
    expect(snap.totalPercent).toBeLessThanOrEqual(100);
  });
});

describe("isComplete — 終端判定", () => {
  it("free_note は終端", () => {
    expect(isComplete(set, "free_note", {})).toBe(true);
  });

  it("途中の質問では終端ではない", () => {
    expect(isComplete(set, "stage", { stage: "employed" })).toBe(false);
    expect(isComplete(set, "value_priority", { value_priority: "growth" })).toBe(
      false,
    );
  });

  it("存在しない質問IDは終端扱い(安全側)", () => {
    expect(isComplete(set, "unknown_id", {})).toBe(true);
  });
});
