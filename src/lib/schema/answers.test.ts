import { describe, it, expect } from "vitest";
import { AnswerMapSchema } from "./answers";

/**
 * v2 用ホワイトリスト検証テスト。
 * - ORIGIN v2 の質問群(age / stage 10択 / school_type / 7種の grade / knowledge_fields /
 *   freeter_main_work / freelance_field / seeking_blank / parental_child_age /
 *   on_leave_reason / retired_status / other_note / current_income / education /
 *   life_constraint / location / time_available / origin_freenote)を網羅。
 * - `number` 型(age)の境界・整数・型不一致検証。
 * - multi MUST(空配列 NG)の検証。
 */

describe("AnswerMapSchema — 基本動作", () => {
  it("代表的な employed フルパスは通る", () => {
    const res = AnswerMapSchema.safeParse({
      age: 28,
      stage: "employed",
      employment_type: "fulltime",
      years_employed: "3to5",
      knowledge_fields: ["software_dev", "it_web", "data_ai"],
      current_income: "500to700",
      education: "uni",
      life_constraint: ["none"],
      location: "metro",
      time_available: "1to3h",
      goal_clarity: "clear",
      goal_target: "PM",
      goal_workstyle: "remote",
      goal_income: "600to800",
      goal_horizon: "3y",
      value_priority: "growth",
      work_style_pref: "deep",
      social_pref: "team",
      risk_pref: "safe",
      free_note: "自由記述テキスト",
    });
    expect(res.success).toBe(true);
  });

  it("未定義の質問IDは弾く", () => {
    const res = AnswerMapSchema.safeParse({ unknown_id: "x" });
    expect(res.success).toBe(false);
  });

  it("v1 旧 ID(income / field / experience / student_grade / senior_status)は撤廃済みなので弾かれる", () => {
    expect(AnswerMapSchema.safeParse({ income: "500to700" }).success).toBe(false);
    expect(AnswerMapSchema.safeParse({ field: "営業" }).success).toBe(false);
    expect(AnswerMapSchema.safeParse({ experience: "3to5" }).success).toBe(false);
    expect(
      AnswerMapSchema.safeParse({ student_grade: "u_high" }).success,
    ).toBe(false);
    expect(
      AnswerMapSchema.safeParse({ senior_status: "early" }).success,
    ).toBe(false);
  });

  it("single で未定義の選択値は弾く", () => {
    const res = AnswerMapSchema.safeParse({ stage: "not_a_real_value" });
    expect(res.success).toBe(false);
  });

  it("single に配列を渡すと弾く(型不一致)", () => {
    const res = AnswerMapSchema.safeParse({ stage: ["employed"] });
    expect(res.success).toBe(false);
  });

  it("multi に文字列を渡すと弾く(型不一致)", () => {
    const res = AnswerMapSchema.safeParse({ goal_direction: "specialist" });
    expect(res.success).toBe(false);
  });

  it("text/textarea は自由文字列を許可する", () => {
    const res = AnswerMapSchema.safeParse({
      student_major: "情報科学",
      origin_freenote: "復職タイミングを模索中",
      free_note: "改行や記号も含む 自由な文章 !?#",
    });
    expect(res.success).toBe(true);
  });

  it("既存の上限検証(値の長さ)は維持される", () => {
    const res = AnswerMapSchema.safeParse({ student_major: "あ".repeat(2001) });
    expect(res.success).toBe(false);
  });
});

describe("AnswerMapSchema — number 型(age)", () => {
  it("0 は通る(下限)", () => {
    expect(AnswerMapSchema.safeParse({ age: 0 }).success).toBe(true);
  });

  it("99 は通る(上限)", () => {
    expect(AnswerMapSchema.safeParse({ age: 99 }).success).toBe(true);
  });

  it("28 は通る(代表値)", () => {
    expect(AnswerMapSchema.safeParse({ age: 28 }).success).toBe(true);
  });

  it("-1 は弾く(下限割れ)", () => {
    expect(AnswerMapSchema.safeParse({ age: -1 }).success).toBe(false);
  });

  it("100 は弾く(上限超え)", () => {
    expect(AnswerMapSchema.safeParse({ age: 100 }).success).toBe(false);
  });

  it("999 は弾く(範囲外)", () => {
    expect(AnswerMapSchema.safeParse({ age: 999 }).success).toBe(false);
  });

  it("28.5 は弾く(整数でない)", () => {
    expect(AnswerMapSchema.safeParse({ age: 28.5 }).success).toBe(false);
  });

  it("文字列 '28' は弾く(型不一致)", () => {
    expect(AnswerMapSchema.safeParse({ age: "28" }).success).toBe(false);
  });
});

describe("AnswerMapSchema — stage 10択(v2)", () => {
  it.each([
    "student",
    "employed",
    "freeter",
    "freelance",
    "seeking",
    "housekeeper",
    "parental_leave",
    "on_leave",
    "retired",
    "other",
  ])("stage=%s は通る", (v) => {
    expect(AnswerMapSchema.safeParse({ stage: v }).success).toBe(true);
  });

  it("v1 の changing / returning / working / senior は弾かれる(v2 で撤去)", () => {
    for (const v of ["changing", "returning", "working", "senior"]) {
      expect(AnswerMapSchema.safeParse({ stage: v }).success).toBe(false);
    }
  });
});

describe("AnswerMapSchema — school_type と学年(v2 新規)", () => {
  it.each([
    "junior_high",
    "high_school",
    "voc_school",
    "kosen",
    "junior_college",
    "university",
    "graduate",
  ])("school_type=%s は通る", (v) => {
    expect(AnswerMapSchema.safeParse({ school_type: v }).success).toBe(true);
  });

  it("中学校の学年は jh1_2 / jh3 のみ", () => {
    expect(AnswerMapSchema.safeParse({ grade_jh: "jh1_2" }).success).toBe(true);
    expect(AnswerMapSchema.safeParse({ grade_jh: "jh3" }).success).toBe(true);
    expect(AnswerMapSchema.safeParse({ grade_jh: "u3" }).success).toBe(false);
  });

  it("大学の学年(grade_uni)は u1/u2/u3/u4/u_repeat", () => {
    for (const v of ["u1", "u2", "u3", "u4", "u_repeat"]) {
      expect(AnswerMapSchema.safeParse({ grade_uni: v }).success).toBe(true);
    }
    expect(AnswerMapSchema.safeParse({ grade_uni: "bogus" }).success).toBe(false);
  });

  it("大学院(grade_grad)は m1/m2/d1_2/d3plus", () => {
    for (const v of ["m1", "m2", "d1_2", "d3plus"]) {
      expect(AnswerMapSchema.safeParse({ grade_grad: v }).success).toBe(true);
    }
  });

  it("高専(grade_kosen)は kosen_low/kosen_high/kosen_adv", () => {
    for (const v of ["kosen_low", "kosen_high", "kosen_adv"]) {
      expect(AnswerMapSchema.safeParse({ grade_kosen: v }).success).toBe(true);
    }
  });
});

describe("AnswerMapSchema — knowledge_fields(20択 + multi MUST)", () => {
  it("代表的な選択肢が通る", () => {
    const res = AnswerMapSchema.safeParse({
      knowledge_fields: [
        "it_web",
        "software_dev",
        "data_ai",
        "design_creative",
        "medical_care",
        "education",
        "law_admin",
        "finance_acc",
        "manufacturing",
        "construction",
        "service",
        "sales_retail",
        "marketing_pr",
        "hr_org",
        "research",
        "media",
        "art_music",
        "agri_fish",
        "language",
        "none_kn",
        "other_kn",
      ],
    });
    expect(res.success).toBe(true);
  });

  it("空配列は弾く(multi MUST = 1個以上)", () => {
    expect(
      AnswerMapSchema.safeParse({ knowledge_fields: [] }).success,
    ).toBe(false);
  });

  it("未定義のキーが混ざると弾く", () => {
    expect(
      AnswerMapSchema.safeParse({ knowledge_fields: ["it_web", "bogus"] })
        .success,
    ).toBe(false);
  });
});

describe("AnswerMapSchema — life_constraint(MUST multi)", () => {
  it("特になし(none)単独で通る", () => {
    expect(
      AnswerMapSchema.safeParse({ life_constraint: ["none"] }).success,
    ).toBe(true);
  });

  it("5択すべて通る", () => {
    expect(
      AnswerMapSchema.safeParse({
        life_constraint: ["health", "caring_kids", "caring_family", "other", "none"],
      }).success,
    ).toBe(true);
  });

  it("空配列は弾く(multi MUST)", () => {
    expect(
      AnswerMapSchema.safeParse({ life_constraint: [] }).success,
    ).toBe(false);
  });

  it("不正キーは弾く", () => {
    expect(
      AnswerMapSchema.safeParse({ life_constraint: ["bogus"] }).success,
    ).toBe(false);
  });
});

describe("AnswerMapSchema — student_work_exp(MUST multi・新キー含む)", () => {
  it("5択すべて通る", () => {
    expect(
      AnswerMapSchema.safeParse({
        student_work_exp: ["parttime", "intern", "startup", "freelance_light", "none"],
      }).success,
    ).toBe(true);
  });

  it("空配列は弾く", () => {
    expect(
      AnswerMapSchema.safeParse({ student_work_exp: [] }).success,
    ).toBe(false);
  });
});

describe("AnswerMapSchema — current_income / education(no_answer 廃止)", () => {
  it("v2 の current_income 6 択(none〜gt1000)は通る", () => {
    for (const v of ["none", "lt300", "300to500", "500to700", "700to1000", "gt1000"]) {
      expect(AnswerMapSchema.safeParse({ current_income: v }).success).toBe(true);
    }
  });

  it("v1 の current_income.no_answer は弾かれる(v2 で撤去)", () => {
    expect(
      AnswerMapSchema.safeParse({ current_income: "no_answer" }).success,
    ).toBe(false);
  });

  it("v2 の education 6 択(jh/hs/voc/uni/grad/studying)は通る", () => {
    for (const v of ["jh", "hs", "voc", "uni", "grad", "studying"]) {
      expect(AnswerMapSchema.safeParse({ education: v }).success).toBe(true);
    }
  });

  it("v1 の education.no_answer / other は弾かれる(v2 で撤去)", () => {
    expect(
      AnswerMapSchema.safeParse({ education: "no_answer" }).success,
    ).toBe(false);
    expect(AnswerMapSchema.safeParse({ education: "other" }).success).toBe(false);
  });
});

describe("AnswerMapSchema — location / time_available / employment_type(no_answer 廃止)", () => {
  it("location 4 択(overseas 含む)は通り、no_answer は弾かれる", () => {
    for (const v of ["metro", "regional_city", "rural", "overseas"]) {
      expect(AnswerMapSchema.safeParse({ location: v }).success).toBe(true);
    }
    expect(AnswerMapSchema.safeParse({ location: "no_answer" }).success).toBe(
      false,
    );
  });

  it("time_available 5 択(unsure 含む)は通る", () => {
    for (const v of ["lt1h", "1to3h", "weekend", "flex", "unsure"]) {
      expect(AnswerMapSchema.safeParse({ time_available: v }).success).toBe(true);
    }
  });

  it("employment_type 8 択(v2 拡張)は通り、no_answer は弾かれる", () => {
    for (const v of [
      "fulltime",
      "public",
      "contract",
      "dispatch",
      "owner",
      "multi_job",
      "parttime_main",
      "other_emp",
    ]) {
      expect(AnswerMapSchema.safeParse({ employment_type: v }).success).toBe(true);
    }
    expect(
      AnswerMapSchema.safeParse({ employment_type: "no_answer" }).success,
    ).toBe(false);
  });
});

describe("AnswerMapSchema — 各立場の深掘り質問(v2 新規)", () => {
  it("freeter_main_work / freelance_field は自由文字列を許可", () => {
    expect(
      AnswerMapSchema.safeParse({ freeter_main_work: "飲食店ホール" }).success,
    ).toBe(true);
    expect(
      AnswerMapSchema.safeParse({ freelance_field: "Web 制作受託" }).success,
    ).toBe(true);
  });

  it("seeking_blank の 5 択は通る", () => {
    for (const v of ["none_yet", "lt3m", "3to12m", "1to3y", "gt3y"]) {
      expect(AnswerMapSchema.safeParse({ seeking_blank: v }).success).toBe(true);
    }
  });

  it("parental_child_age の 5 択は通る", () => {
    for (const v of ["pregnant", "under1", "1to2", "3to5", "6plus"]) {
      expect(AnswerMapSchema.safeParse({ parental_child_age: v }).success).toBe(true);
    }
  });

  it("on_leave_reason の 4 択は通る", () => {
    for (const v of ["health_phys", "health_mental", "family_care", "other_leave"]) {
      expect(AnswerMapSchema.safeParse({ on_leave_reason: v }).success).toBe(true);
    }
  });

  it("retired_status の 4 択は通る", () => {
    for (const v of ["pre", "re_employ", "early", "looking"]) {
      expect(AnswerMapSchema.safeParse({ retired_status: v }).success).toBe(true);
    }
  });

  it("other_note は textarea(自由記述)を許可", () => {
    expect(
      AnswerMapSchema.safeParse({ other_note: "海外留学準備中" }).success,
    ).toBe(true);
  });

  it("years_employed の 6 択(blank 撤去)は通り、blank/no_answer は弾かれる", () => {
    for (const v of ["none", "lt1", "1to3", "3to5", "5to10", "gt10"]) {
      expect(AnswerMapSchema.safeParse({ years_employed: v }).success).toBe(true);
    }
    expect(
      AnswerMapSchema.safeParse({ years_employed: "blank" }).success,
    ).toBe(false);
    expect(
      AnswerMapSchema.safeParse({ years_employed: "no_answer" }).success,
    ).toBe(false);
  });
});

describe("AnswerMapSchema — knowledge_fields_other(MAY/textarea 派生)", () => {
  it("自由文字列を許可", () => {
    expect(
      AnswerMapSchema.safeParse({ knowledge_fields_other: "哲学" }).success,
    ).toBe(true);
  });
});

// ============================================================
// v2.1 新規質問 3 件のホワイトリスト検証
// ============================================================
describe("AnswerMapSchema — student_work_detail(MAY/textarea・v2.1 新規)", () => {
  it("自由文字列を許可", () => {
    expect(
      AnswerMapSchema.safeParse({
        student_work_detail: "カフェのホールを週3で2年",
      }).success,
    ).toBe(true);
  });

  it("長すぎる文字列(2001 文字)は弾く", () => {
    expect(
      AnswerMapSchema.safeParse({
        student_work_detail: "あ".repeat(2001),
      }).success,
    ).toBe(false);
  });

  it("2000 文字ちょうどは通る(上限)", () => {
    expect(
      AnswerMapSchema.safeParse({
        student_work_detail: "あ".repeat(2000),
      }).success,
    ).toBe(true);
  });
});

describe("AnswerMapSchema — prior_work_exp(MUST/single・v2.1 新規)", () => {
  it("yes は通る", () => {
    expect(AnswerMapSchema.safeParse({ prior_work_exp: "yes" }).success).toBe(true);
  });

  it("no は通る", () => {
    expect(AnswerMapSchema.safeParse({ prior_work_exp: "no" }).success).toBe(true);
  });

  it("yes / no 以外は弾く", () => {
    expect(
      AnswerMapSchema.safeParse({ prior_work_exp: "maybe" }).success,
    ).toBe(false);
    expect(
      AnswerMapSchema.safeParse({ prior_work_exp: "" }).success,
    ).toBe(false);
    expect(
      AnswerMapSchema.safeParse({ prior_work_exp: "no_answer" }).success,
    ).toBe(false);
  });

  it("配列を渡すと弾く(型不一致)", () => {
    expect(
      AnswerMapSchema.safeParse({ prior_work_exp: ["yes"] }).success,
    ).toBe(false);
  });
});

describe("AnswerMapSchema — current_job_field(MUST/text・v2.1 新規)", () => {
  it("自由文字列を許可", () => {
    expect(
      AnswerMapSchema.safeParse({ current_job_field: "営業" }).success,
    ).toBe(true);
    expect(
      AnswerMapSchema.safeParse({ current_job_field: "Web エンジニア(バックエンド)" })
        .success,
    ).toBe(true);
  });

  it("長すぎる文字列は弾く(2001 文字)", () => {
    expect(
      AnswerMapSchema.safeParse({
        current_job_field: "あ".repeat(2001),
      }).success,
    ).toBe(false);
  });

  // text/textarea は型レベルでは空文字も「文字列」として受理される(MUST の空欄判定は Wizard 側で行う)。
  // ここでは「型として string」が通ることだけを確認する。
  it("空文字は型としては許可される(MUST の空欄チェックは Wizard 側)", () => {
    expect(
      AnswerMapSchema.safeParse({ current_job_field: "" }).success,
    ).toBe(true);
  });
});

describe("AnswerMapSchema — v2.1 ペルソナ別フルパス", () => {
  it("housekeeper + prior_work_exp=yes のフルパスは通る", () => {
    const res = AnswerMapSchema.safeParse({
      age: 36,
      stage: "housekeeper",
      prior_work_exp: "yes",
      current_job_field: "経理",
      years_employed: "3to5",
      knowledge_fields: ["finance_acc"],
      current_income: "none",
      education: "uni",
      life_constraint: ["caring_kids"],
      location: "regional_city",
      time_available: "weekend",
      goal_clarity: "vague",
      goal_direction: ["stable"],
      goal_workstyle: "remote",
      goal_income: "400to600",
      goal_horizon: "3y",
      value_priority: "stability",
      work_style_pref: "deep",
      social_pref: "team",
      risk_pref: "safe",
    });
    expect(res.success).toBe(true);
  });

  it("housekeeper + prior_work_exp=no のフルパス(current_job_field / years_employed なし)は通る", () => {
    const res = AnswerMapSchema.safeParse({
      age: 42,
      stage: "housekeeper",
      prior_work_exp: "no",
      knowledge_fields: ["none_kn"],
      current_income: "none",
      education: "hs",
      life_constraint: ["caring_kids"],
      location: "rural",
      time_available: "lt1h",
      goal_clarity: "none",
      goal_direction: ["social"],
      goal_workstyle: "wlb",
      goal_income: "no_answer",
      goal_horizon: "open",
      value_priority: "meaning",
      work_style_pref: "wide",
      social_pref: "team",
      risk_pref: "safe",
    });
    expect(res.success).toBe(true);
  });

  it("student で student_work_detail を含むフルパス(education なし)は通る", () => {
    const res = AnswerMapSchema.safeParse({
      age: 20,
      stage: "student",
      school_type: "university",
      grade_uni: "u3",
      student_major: "文学部英文学科",
      student_work_exp: ["parttime", "intern"],
      student_work_detail:
        "カフェのホールを週3で1年半 / 旅行系スタートアップで2ヶ月マーケインターン",
      knowledge_fields: ["language", "marketing_pr"],
      current_income: "none",
      life_constraint: ["none"],
      location: "metro",
      time_available: "1to3h",
      goal_clarity: "vague",
      goal_direction: ["specialist"],
      goal_workstyle: "company",
      goal_income: "400to600",
      goal_horizon: "3y",
      value_priority: "growth",
      work_style_pref: "wide",
      social_pref: "team",
      risk_pref: "safe",
    });
    expect(res.success).toBe(true);
  });
});
