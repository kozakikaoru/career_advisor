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
  it("代表的な employed フルパス(GOAL v2.2)は通る", () => {
    const res = AnswerMapSchema.safeParse({
      age: 28,
      stage: "employed",
      employment_type: "fulltime",
      current_job_field: "Web エンジニア(バックエンド)",
      years_employed: "3to5",
      knowledge_fields: ["software_dev", "it_web", "data_ai"],
      current_income: "500to700",
      education: "uni",
      life_constraint: ["none"],
      location: "metro",
      time_available: "1to3h",
      // GOAL v2 系統 A: change_intent=continue → step_up_target
      change_intent: "continue",
      step_up_target: "specialist",
      // v2.2: goal_workstyle が multi 化(配列)/ goal_avoid は撤去
      goal_workstyle: ["same_as_now"],
      goal_income: "800to1200",
      goal_horizon: "3y",
      goal_start_timing: "now",
      goal_commit: "20to50",
      // MINDSET v2 確定版(全員フラット 15 問)
      leadership_role: "lead_neutral",
      social_pref: "team_strong",
      plan_style: "plan_first",
      unknown_field_jump: "neither",
      change_attitude: "change_neutral",
      value_priority: ["growth", "freedom"],
      meaning_priority: "balance",
      competition_pref: "neither",
      risk_pref: "safe",
      learning_depth: "deep_focus",
      failure_recovery: "neither",
      location_preference: "metro_pref",
      remote_preference: "hybrid_remote",
      wlb_priority: "wlb_balance",
      mindset_freenote: "自由記述テキスト",
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

  it("v1 GOAL 旧 ID(goal_clarity / goal_target / goal_direction)は撤廃済みなので弾かれる(回帰防止)", () => {
    expect(
      AnswerMapSchema.safeParse({ goal_clarity: "clear" }).success,
    ).toBe(false);
    expect(
      AnswerMapSchema.safeParse({ goal_target: "PM" }).success,
    ).toBe(false);
    expect(
      AnswerMapSchema.safeParse({ goal_direction: ["specialist"] }).success,
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

  it("multi に文字列を渡すと弾く(型不一致・v2.2: goal_workstyle が multi 化)", () => {
    const res = AnswerMapSchema.safeParse({ goal_workstyle: "company" });
    expect(res.success).toBe(false);
  });

  it("text/textarea は自由文字列を許可する(MINDSET v2: mindset_freenote)", () => {
    const res = AnswerMapSchema.safeParse({
      student_major: "情報科学",
      origin_freenote: "復職タイミングを模索中",
      goal_freenote: "プログラミングを独学中",
      mindset_freenote: "改行や記号も含む 自由な文章 !?#",
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

describe("AnswerMapSchema — v2.1 / GOAL v2 ペルソナ別フルパス", () => {
  it("housekeeper + prior_work_exp=yes のフルパス(系統 A career_change)は通る", () => {
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
      // GOAL v2: 系統 A
      change_intent: "change",
      change_direction: "career_change",
      chg_target_field: ["it_web", "design_creative"],
      // v2.2: multi 化
      goal_workstyle: ["freelance"],
      goal_income: "400to600",
      goal_horizon: "3y",
      goal_start_timing: "within_1y",
      goal_commit: "20to50",
      value_priority: ["stability"],
      learning_depth: "deep_focus",
      social_pref: "team_strong",
      risk_pref: "safe",
    });
    expect(res.success).toBe(true);
  });

  it("housekeeper + prior_work_exp=no のフルパス(系統 B new_entry_direction)は通る", () => {
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
      // GOAL v2: 系統 B (new_entry_direction)
      new_entry_direction: ["it_web", "design_creative", "undecided"],
      // v2.2: multi 化 / goal_avoid は撤去
      goal_workstyle: ["freelance"],
      goal_income: "same_as_now",
      goal_horizon: "open",
      goal_start_timing: "slow",
      goal_commit: "none",
      value_priority: ["meaning"],
      learning_depth: "wide_explore",
      social_pref: "team_strong",
      risk_pref: "safe",
    });
    expect(res.success).toBe(true);
  });

  it("student/job + student_goal_industry のフルパスは通る(系統 B / 学生)", () => {
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
      // GOAL v2: 学生
      student_goal_track: "job",
      student_goal_industry: ["marketing_pr", "it_web"],
      // v2.2: multi 化
      goal_workstyle: ["company"],
      goal_income: "400to600",
      goal_horizon: "5y",
      goal_start_timing: "now",
      goal_commit: "lt5",
      value_priority: ["growth"],
      learning_depth: "wide_explore",
      social_pref: "team_strong",
      risk_pref: "safe",
    });
    expect(res.success).toBe(true);
  });

  it("student/job + other_field を含むフルパス(other_field_text 派生)は通る", () => {
    const res = AnswerMapSchema.safeParse({
      age: 20,
      stage: "student",
      school_type: "university",
      grade_uni: "u3",
      student_major: "経済学部",
      student_work_exp: ["intern"],
      knowledge_fields: ["marketing_pr"],
      current_income: "none",
      life_constraint: ["none"],
      location: "metro",
      time_available: "1to3h",
      student_goal_track: "job",
      student_goal_industry: ["other_field", "marketing_pr"],
      other_field_text: "eスポーツ業界の運営・大会企画",
      // v2.2: multi 化
      goal_workstyle: ["company"],
      goal_income: "400to600",
      goal_horizon: "5y",
      goal_start_timing: "now",
      goal_commit: "lt5",
      value_priority: ["growth"],
      learning_depth: "wide_explore",
      social_pref: "team_strong",
      risk_pref: "safe",
    });
    expect(res.success).toBe(true);
  });

  it("(v2.1) student/job + student_job_status を含むフルパスは通る", () => {
    const res = AnswerMapSchema.safeParse({
      age: 22,
      stage: "student",
      school_type: "university",
      grade_uni: "u4",
      student_major: "情報",
      student_work_exp: ["intern"],
      knowledge_fields: ["software_dev"],
      current_income: "none",
      life_constraint: ["none"],
      location: "metro",
      time_available: "1to3h",
      student_goal_track: "job",
      student_job_status: "offer_accepted",
      student_goal_industry: ["software_dev"],
      // v2.2: multi 化
      goal_workstyle: ["company"],
      goal_income: "400to600",
      goal_horizon: "5y",
      goal_start_timing: "after_preparation",
      goal_commit: "lt5",
      value_priority: ["growth"],
      learning_depth: "deep_focus",
      social_pref: "team_strong",
      risk_pref: "safe",
    });
    expect(res.success).toBe(true);
  });

  it("(v2.1) student/advance + student_advance_status + student_goal_industry を含むフルパスは通る(admitted × after_preparation)", () => {
    const res = AnswerMapSchema.safeParse({
      age: 18,
      stage: "student",
      school_type: "high_school",
      grade_hs: "hs3",
      student_major: "理系",
      student_work_exp: ["none"],
      knowledge_fields: ["medical_care"],
      current_income: "none",
      life_constraint: ["none"],
      location: "metro",
      time_available: "1to3h",
      student_goal_track: "advance",
      student_advance_status: "admitted",
      student_goal_advance: "医学部",
      student_goal_industry: ["medical_care"],
      // v2.2: multi 化
      goal_workstyle: ["company"],
      goal_income: "600to800",
      goal_horizon: "10y",
      goal_start_timing: "after_preparation",
      goal_commit: "100to300",
      value_priority: ["meaning"],
      learning_depth: "deep_focus",
      social_pref: "team_strong",
      risk_pref: "safe",
    });
    expect(res.success).toBe(true);
  });

  it("retired/early のフルパス(系統 B second_career_intent)は通る", () => {
    const res = AnswerMapSchema.safeParse({
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
      // GOAL v2: 系統 B (second_career_intent)
      second_career_intent: "re_employment",
      // v2.2: multi 化
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
    });
    expect(res.success).toBe(true);
  });
});

// ============================================================
// GOAL v2 専用ホワイトリスト検証(specs/goal-questions-v2.md §8-4)
// ============================================================

describe("AnswerMapSchema — change_intent (系統 A・3 択)", () => {
  it.each(["continue", "change", "undecided"])("change_intent=%s は通る", (v) => {
    expect(AnswerMapSchema.safeParse({ change_intent: v }).success).toBe(true);
  });

  it("不正値は弾く", () => {
    expect(
      AnswerMapSchema.safeParse({ change_intent: "maybe" }).success,
    ).toBe(false);
  });
});

describe("AnswerMapSchema — change_direction (系統 A・3 択)", () => {
  it.each(["step_up", "career_change", "both_unsure"])(
    "change_direction=%s は通る",
    (v) => {
      expect(AnswerMapSchema.safeParse({ change_direction: v }).success).toBe(true);
    },
  );

  it("不正値は弾く", () => {
    expect(
      AnswerMapSchema.safeParse({ change_direction: "career" }).success,
    ).toBe(false);
  });
});

describe("AnswerMapSchema — step_up_target (系統 A・4 択)", () => {
  it.each(["specialist", "management", "independent_same", "better_conditions"])(
    "step_up_target=%s は通る",
    (v) => {
      expect(AnswerMapSchema.safeParse({ step_up_target: v }).success).toBe(true);
    },
  );

  it("不正値(v1 残骸)は弾く", () => {
    expect(
      AnswerMapSchema.safeParse({ step_up_target: "independent" }).success,
    ).toBe(false);
  });
});

describe("AnswerMapSchema — chg_target_field (multi 21 択)", () => {
  it("代表的な選択肢が通る", () => {
    expect(
      AnswerMapSchema.safeParse({
        chg_target_field: ["it_web", "software_dev", "undecided"],
      }).success,
    ).toBe(true);
  });

  it("空配列は弾く(multi MUST)", () => {
    expect(
      AnswerMapSchema.safeParse({ chg_target_field: [] }).success,
    ).toBe(false);
  });

  it("不正キーは弾く", () => {
    expect(
      AnswerMapSchema.safeParse({ chg_target_field: ["bogus"] }).success,
    ).toBe(false);
  });

  it("other_chg(その他キー)は通る", () => {
    expect(
      AnswerMapSchema.safeParse({ chg_target_field: ["other_chg"] }).success,
    ).toBe(true);
  });
});

describe("AnswerMapSchema — student_goal_track (系統 B / 学生・4 択)", () => {
  it.each(["job", "advance", "startup", "undecided"])(
    "student_goal_track=%s は通る",
    (v) => {
      expect(AnswerMapSchema.safeParse({ student_goal_track: v }).success).toBe(true);
    },
  );

  it("不正値は弾く", () => {
    expect(
      AnswerMapSchema.safeParse({ student_goal_track: "phd" }).success,
    ).toBe(false);
  });
});

describe("AnswerMapSchema — student_goal_industry (multi 21 択)", () => {
  it("代表的な選択肢が通る", () => {
    expect(
      AnswerMapSchema.safeParse({
        student_goal_industry: ["marketing_pr", "it_web"],
      }).success,
    ).toBe(true);
  });

  it("other_field を含む配列が通る(派生で other_field_text を要求)", () => {
    expect(
      AnswerMapSchema.safeParse({
        student_goal_industry: ["other_field", "marketing_pr"],
      }).success,
    ).toBe(true);
  });

  it("空配列は弾く(multi MUST)", () => {
    expect(
      AnswerMapSchema.safeParse({ student_goal_industry: [] }).success,
    ).toBe(false);
  });

  it("不正キーは弾く", () => {
    expect(
      AnswerMapSchema.safeParse({ student_goal_industry: ["bogus"] }).success,
    ).toBe(false);
  });
});

describe("AnswerMapSchema — other_field_text (派生 text MUST)", () => {
  it("自由文字列を許可", () => {
    expect(
      AnswerMapSchema.safeParse({
        other_field_text: "eスポーツ運営",
      }).success,
    ).toBe(true);
  });

  // text/textarea は型レベルでは空文字も許容される(Wizard 側で空欄チェック)
  it("空文字は型としては許可される(MUST の空欄チェックは Wizard 側)", () => {
    expect(
      AnswerMapSchema.safeParse({ other_field_text: "" }).success,
    ).toBe(true);
  });

  it("長すぎる文字列は弾く", () => {
    expect(
      AnswerMapSchema.safeParse({
        other_field_text: "あ".repeat(2001),
      }).success,
    ).toBe(false);
  });
});

describe("AnswerMapSchema — student_goal_advance (text MUST)", () => {
  it("自由文字列を許可", () => {
    expect(
      AnswerMapSchema.safeParse({
        student_goal_advance: "大学院(情報科学)",
      }).success,
    ).toBe(true);
  });
});

describe("AnswerMapSchema — new_entry_direction (multi 21 択)", () => {
  it("代表的な選択肢が通る", () => {
    expect(
      AnswerMapSchema.safeParse({
        new_entry_direction: ["it_web", "design_creative", "undecided"],
      }).success,
    ).toBe(true);
  });

  it("空配列は弾く(multi MUST)", () => {
    expect(
      AnswerMapSchema.safeParse({ new_entry_direction: [] }).success,
    ).toBe(false);
  });

  it("other_new(その他)は通る", () => {
    expect(
      AnswerMapSchema.safeParse({ new_entry_direction: ["other_new"] }).success,
    ).toBe(true);
  });
});

describe("AnswerMapSchema — second_career_intent (5 択)", () => {
  it.each([
    "re_employment",
    "independent",
    "community",
    "retire_hobby",
    "undecided",
  ])("second_career_intent=%s は通る", (v) => {
    expect(AnswerMapSchema.safeParse({ second_career_intent: v }).success).toBe(true);
  });

  it("不正値は弾く", () => {
    expect(
      AnswerMapSchema.safeParse({ second_career_intent: "retire" }).success,
    ).toBe(false);
  });
});

describe("AnswerMapSchema — goal_workstyle (multi 7 択・v2.2 で multi 化・「雇用形態に純化」)", () => {
  it.each([
    "company",
    "public",
    "freelance",
    "startup",
    "multi_job",
    "same_as_now",
    "undecided",
  ])("goal_workstyle=[%s] 単独選択は通る(v2.2: multi)", (v) => {
    expect(AnswerMapSchema.safeParse({ goal_workstyle: [v] }).success).toBe(true);
  });

  it("複数選択(company + multi_job)は通る(v2.2 で multi 化)", () => {
    expect(
      AnswerMapSchema.safeParse({ goal_workstyle: ["company", "multi_job"] }).success,
    ).toBe(true);
  });

  it("7 値すべて並べて選択(理論上のケース)も通る", () => {
    expect(
      AnswerMapSchema.safeParse({
        goal_workstyle: [
          "company",
          "public",
          "freelance",
          "startup",
          "multi_job",
          "same_as_now",
          "undecided",
        ],
      }).success,
    ).toBe(true);
  });

  it("空配列は弾く(v2.2: MUST multi = 1 個以上必須)", () => {
    expect(AnswerMapSchema.safeParse({ goal_workstyle: [] }).success).toBe(false);
  });

  it("文字列(旧 single 時代の渡し方)は弾く(v2.2: multi 化で配列必須)", () => {
    expect(
      AnswerMapSchema.safeParse({ goal_workstyle: "company" }).success,
    ).toBe(false);
  });

  it("不正キーは弾く", () => {
    expect(
      AnswerMapSchema.safeParse({ goal_workstyle: ["bogus"] }).success,
    ).toBe(false);
  });

  it("v1 の remote / wlb は撤去済みなので弾かれる", () => {
    expect(
      AnswerMapSchema.safeParse({ goal_workstyle: ["remote"] }).success,
    ).toBe(false);
    expect(
      AnswerMapSchema.safeParse({ goal_workstyle: ["wlb"] }).success,
    ).toBe(false);
  });
});

describe("AnswerMapSchema — goal_income (9 択・no_answer 撤去)", () => {
  it.each([
    "same_as_now",
    "lt200",
    "200to300",
    "300to400",
    "400to600",
    "600to800",
    "800to1200",
    "1200to2000",
    "gt2000",
  ])("goal_income=%s は通る", (v) => {
    expect(AnswerMapSchema.safeParse({ goal_income: v }).success).toBe(true);
  });

  it("v1 の no_answer は撤去済みなので弾かれる", () => {
    expect(
      AnswerMapSchema.safeParse({ goal_income: "no_answer" }).success,
    ).toBe(false);
  });

  it("ドラフト時代の lt400 / gt1200 は撤去済み(細分化された)ので弾かれる", () => {
    expect(
      AnswerMapSchema.safeParse({ goal_income: "lt400" }).success,
    ).toBe(false);
    expect(
      AnswerMapSchema.safeParse({ goal_income: "gt1200" }).success,
    ).toBe(false);
  });
});

describe("AnswerMapSchema — goal_horizon (5 択・10y 追加)", () => {
  it.each(["1y", "3y", "5y", "10y", "open"])("goal_horizon=%s は通る", (v) => {
    expect(AnswerMapSchema.safeParse({ goal_horizon: v }).success).toBe(true);
  });

  it("不正値は弾く", () => {
    expect(
      AnswerMapSchema.safeParse({ goal_horizon: "2y" }).success,
    ).toBe(false);
  });
});

describe("AnswerMapSchema — goal_start_timing (5 択 / v2.1: after_preparation 追加)", () => {
  it.each(["now", "within_3m", "within_1y", "after_preparation", "slow"])(
    "goal_start_timing=%s は通る",
    (v) => {
      expect(AnswerMapSchema.safeParse({ goal_start_timing: v }).success).toBe(true);
    },
  );

  it("不正値は弾く", () => {
    expect(
      AnswerMapSchema.safeParse({ goal_start_timing: "ASAP" }).success,
    ).toBe(false);
  });

  it("v2.1 で追加された after_preparation を受け入れる(v2 確定版から回帰がないか)", () => {
    expect(
      AnswerMapSchema.safeParse({ goal_start_timing: "after_preparation" })
        .success,
    ).toBe(true);
  });
});

// ============================================================
// GOAL v2.1 §8-10-3: 新規ホワイトリスト 3 ケース
// ============================================================
describe("AnswerMapSchema — student_job_status (v2.1 新規 / 7 択)", () => {
  it.each([
    "exploring",
    "researching",
    "entry_started",
    "in_selection",
    "offer_received",
    "offer_accepted",
    "not_started",
  ])("student_job_status=%s は通る", (v) => {
    expect(
      AnswerMapSchema.safeParse({ student_job_status: v }).success,
    ).toBe(true);
  });

  it("7 値以外は弾く", () => {
    for (const v of ["done", "未着手", "started", "applied"]) {
      expect(
        AnswerMapSchema.safeParse({ student_job_status: v }).success,
      ).toBe(false);
    }
  });
});

describe("AnswerMapSchema — student_advance_status (v2.1 新規 / 4 択・reconsidering 撤去)", () => {
  it.each(["searching", "target_decided", "in_exam", "admitted"])(
    "student_advance_status=%s は通る",
    (v) => {
      expect(
        AnswerMapSchema.safeParse({ student_advance_status: v }).success,
      ).toBe(true);
    },
  );

  it("§9-v2.1-2 採択 A: reconsidering(進学迷い)は撤去済みなので弾かれる", () => {
    expect(
      AnswerMapSchema.safeParse({ student_advance_status: "reconsidering" })
        .success,
    ).toBe(false);
  });

  it("その他不正値は弾く", () => {
    for (const v of ["undecided", "applied", "pass"]) {
      expect(
        AnswerMapSchema.safeParse({ student_advance_status: v }).success,
      ).toBe(false);
    }
  });
});

describe("AnswerMapSchema — goal_avoid (v2.2 完全撤去・回帰防止)", () => {
  // v2.2 でほぼ全員が全選択肢にチェック → 差別化情報として機能しなかったため完全撤去。
  // 旧 ID `goal_avoid` を投げると 400(未定義 ID として弾く)。

  it("goal_avoid: [\"long_hours\"] を送ると 400(撤去済み・未定義 ID)", () => {
    expect(
      AnswerMapSchema.safeParse({ goal_avoid: ["long_hours"] }).success,
    ).toBe(false);
  });

  it("goal_avoid: [\"none_avoid\"](旧「特になし」)を送ると 400", () => {
    expect(
      AnswerMapSchema.safeParse({ goal_avoid: ["none_avoid"] }).success,
    ).toBe(false);
  });

  it("goal_avoid: [] を送ると 400(撤去済み・未定義 ID)", () => {
    expect(AnswerMapSchema.safeParse({ goal_avoid: [] }).success).toBe(false);
  });

  it("goal_avoid: \"long_hours\"(文字列でも撤去済み)を送ると 400", () => {
    expect(
      AnswerMapSchema.safeParse({ goal_avoid: "long_hours" }).success,
    ).toBe(false);
  });
});

describe("AnswerMapSchema — goal_commit (7 択・新規・中立表現)", () => {
  it.each([
    "none",
    "lt5",
    "5to20",
    "20to50",
    "50to100",
    "100to300",
    "gt300",
  ])("goal_commit=%s は通る", (v) => {
    expect(AnswerMapSchema.safeParse({ goal_commit: v }).success).toBe(true);
  });

  it("ドラフト時代の zero / lt10 / 10to50 / 50to300 は撤去済みなので弾かれる", () => {
    for (const v of ["zero", "lt10", "10to50", "50to300"]) {
      expect(
        AnswerMapSchema.safeParse({ goal_commit: v }).success,
      ).toBe(false);
    }
  });
});

describe("AnswerMapSchema — goal_freenote (MAY textarea)", () => {
  it("自由文字列を許可", () => {
    expect(
      AnswerMapSchema.safeParse({
        goal_freenote: "起業したいが具体プロダクトは未定",
      }).success,
    ).toBe(true);
  });

  it("長すぎる文字列は弾く", () => {
    expect(
      AnswerMapSchema.safeParse({
        goal_freenote: "あ".repeat(2001),
      }).success,
    ).toBe(false);
  });
});

// ============================================================
// MINDSET v2 確定版(specs/mindset-questions-v2.md §8-4)
// ============================================================

describe("AnswerMapSchema — MINDSET v2 / v1 撤去 ID(回帰防止)", () => {
  // v1 の `work_style_pref` は v2 で `learning_depth` に改名 → 旧 ID で投げると 400
  it("旧 ID `work_style_pref` を投げると 400(MINDSET v2 で learning_depth に改名)", () => {
    expect(
      AnswerMapSchema.safeParse({ work_style_pref: "deep" }).success,
    ).toBe(false);
    expect(
      AnswerMapSchema.safeParse({ work_style_pref: "deep_focus" }).success,
    ).toBe(false);
  });

  // v1 の `free_note` は v2 で `mindset_freenote` に改名 → 旧 ID で投げると 400
  it("旧 ID `free_note` を投げると 400(MINDSET v2 で mindset_freenote に改名)", () => {
    expect(
      AnswerMapSchema.safeParse({ free_note: "自由記述" }).success,
    ).toBe(false);
  });

  // v1 の 2 択値(social_pref=team/solo, risk_pref=risk)は v2 で 3 択化 → 旧値で投げると 400
  it("v1 旧値 `social_pref=team` / `solo` は 400(v2 で 3 択化 / team_strong / mix / solo_strong に再編)", () => {
    expect(
      AnswerMapSchema.safeParse({ social_pref: "team" }).success,
    ).toBe(false);
    expect(
      AnswerMapSchema.safeParse({ social_pref: "solo" }).success,
    ).toBe(false);
  });

  it("v1 旧値 `risk_pref=risk` は 400(v2 で risk_balance / risk_take に分割)", () => {
    expect(
      AnswerMapSchema.safeParse({ risk_pref: "risk" }).success,
    ).toBe(false);
  });
});

describe("AnswerMapSchema — leadership_role (3 択)", () => {
  it.each(["lead_want", "lead_neutral", "lead_avoid"])(
    "leadership_role=%s は通る",
    (v) => {
      expect(AnswerMapSchema.safeParse({ leadership_role: v }).success).toBe(
        true,
      );
    },
  );

  it("不正値は弾く", () => {
    expect(
      AnswerMapSchema.safeParse({ leadership_role: "want" }).success,
    ).toBe(false);
  });
});

describe("AnswerMapSchema — social_pref (3 択 / v2 拡張)", () => {
  it.each(["team_strong", "mix", "solo_strong"])(
    "social_pref=%s は通る",
    (v) => {
      expect(AnswerMapSchema.safeParse({ social_pref: v }).success).toBe(true);
    },
  );
});

describe("AnswerMapSchema — plan_style (3 択)", () => {
  it.each(["plan_first", "plan_balance", "action_first"])(
    "plan_style=%s は通る",
    (v) => {
      expect(AnswerMapSchema.safeParse({ plan_style: v }).success).toBe(true);
    },
  );
});

describe("AnswerMapSchema — unknown_field_jump (3 択 / v2 確定版 neither 追加)", () => {
  it.each(["jump_ok", "neither", "jump_anxious"])(
    "unknown_field_jump=%s は通る",
    (v) => {
      expect(
        AnswerMapSchema.safeParse({ unknown_field_jump: v }).success,
      ).toBe(true);
    },
  );

  it("v2 確定版で追加された neither を受理(中庸シグナル)", () => {
    expect(
      AnswerMapSchema.safeParse({ unknown_field_jump: "neither" }).success,
    ).toBe(true);
  });
});

describe("AnswerMapSchema — change_attitude (3 択)", () => {
  it.each(["change_welcome", "change_neutral", "change_dislike"])(
    "change_attitude=%s は通る",
    (v) => {
      expect(AnswerMapSchema.safeParse({ change_attitude: v }).success).toBe(
        true,
      );
    },
  );
});

describe("AnswerMapSchema — value_priority (multi MUST 1〜3 個 / maxSelect: 3)", () => {
  it.each([
    "stability",
    "growth",
    "freedom",
    "relation",
    "meaning",
    "reward",
  ])("value_priority=[%s] 単独選択は通る(MUST 1 個以上)", (v) => {
    expect(
      AnswerMapSchema.safeParse({ value_priority: [v] }).success,
    ).toBe(true);
  });

  it("2 個選択(growth + freedom)は通る", () => {
    expect(
      AnswerMapSchema.safeParse({ value_priority: ["growth", "freedom"] })
        .success,
    ).toBe(true);
  });

  it("3 個選択(growth + freedom + meaning)は通る(maxSelect 上限内)", () => {
    expect(
      AnswerMapSchema.safeParse({
        value_priority: ["growth", "freedom", "meaning"],
      }).success,
    ).toBe(true);
  });

  it("4 個選択は 400(maxSelect: 3 を超過)", () => {
    expect(
      AnswerMapSchema.safeParse({
        value_priority: ["growth", "freedom", "meaning", "stability"],
      }).success,
    ).toBe(false);
  });

  it("5 個・6 個選択も 400(maxSelect: 3 を超過)", () => {
    expect(
      AnswerMapSchema.safeParse({
        value_priority: ["stability", "growth", "freedom", "relation", "meaning"],
      }).success,
    ).toBe(false);
    expect(
      AnswerMapSchema.safeParse({
        value_priority: [
          "stability",
          "growth",
          "freedom",
          "relation",
          "meaning",
          "reward",
        ],
      }).success,
    ).toBe(false);
  });

  it("空配列は 400(MUST 1 個以上)", () => {
    expect(
      AnswerMapSchema.safeParse({ value_priority: [] }).success,
    ).toBe(false);
  });

  it("文字列(v1 single 時代の渡し方)は 400(v2 で multi 化)", () => {
    expect(
      AnswerMapSchema.safeParse({ value_priority: "growth" }).success,
    ).toBe(false);
  });

  it("不正キー(neither など)は 400", () => {
    expect(
      AnswerMapSchema.safeParse({ value_priority: ["neither"] }).success,
    ).toBe(false);
  });
});

describe("AnswerMapSchema — meaning_priority (3 択)", () => {
  it.each(["meaning_priority", "balance", "success_priority"])(
    "meaning_priority=%s は通る",
    (v) => {
      expect(
        AnswerMapSchema.safeParse({ meaning_priority: v }).success,
      ).toBe(true);
    },
  );
});

describe("AnswerMapSchema — competition_pref (3 択 / v2 確定版 neither 追加)", () => {
  it.each(["compete_motivated", "neither", "compete_drain"])(
    "competition_pref=%s は通る",
    (v) => {
      expect(
        AnswerMapSchema.safeParse({ competition_pref: v }).success,
      ).toBe(true);
    },
  );

  it("v2 確定版で追加された neither を受理", () => {
    expect(
      AnswerMapSchema.safeParse({ competition_pref: "neither" }).success,
    ).toBe(true);
  });
});

describe("AnswerMapSchema — risk_pref (3 択 / v2 拡張)", () => {
  it.each(["safe", "risk_balance", "risk_take"])(
    "risk_pref=%s は通る",
    (v) => {
      expect(AnswerMapSchema.safeParse({ risk_pref: v }).success).toBe(true);
    },
  );
});

describe("AnswerMapSchema — learning_depth (3 択 / v1 work_style_pref を改名拡張)", () => {
  it.each(["deep_focus", "mix_learning", "wide_explore"])(
    "learning_depth=%s は通る",
    (v) => {
      expect(AnswerMapSchema.safeParse({ learning_depth: v }).success).toBe(
        true,
      );
    },
  );

  it("v1 旧値(deep / wide)は 400(v2 で命名規則統一)", () => {
    expect(
      AnswerMapSchema.safeParse({ learning_depth: "deep" }).success,
    ).toBe(false);
    expect(
      AnswerMapSchema.safeParse({ learning_depth: "wide" }).success,
    ).toBe(false);
  });
});

describe("AnswerMapSchema — failure_recovery (3 択 / v2 確定版 neither 追加)", () => {
  it.each(["retry_fast", "neither", "careful_after"])(
    "failure_recovery=%s は通る",
    (v) => {
      expect(
        AnswerMapSchema.safeParse({ failure_recovery: v }).success,
      ).toBe(true);
    },
  );

  it("v2 確定版で追加された neither を受理", () => {
    expect(
      AnswerMapSchema.safeParse({ failure_recovery: "neither" }).success,
    ).toBe(true);
  });
});

describe("AnswerMapSchema — location_preference (5 択 / GOAL v2.2 §7 申し送り)", () => {
  it.each([
    "keep_current",
    "metro_pref",
    "rural_pref",
    "overseas_pref",
    "anywhere",
  ])("location_preference=%s は通る", (v) => {
    expect(
      AnswerMapSchema.safeParse({ location_preference: v }).success,
    ).toBe(true);
  });

  it("不正値は弾く", () => {
    expect(
      AnswerMapSchema.safeParse({ location_preference: "tokyo" }).success,
    ).toBe(false);
  });
});

describe("AnswerMapSchema — remote_preference (5 択 / GOAL v2.2 §7 申し送り)", () => {
  it.each([
    "office_pref",
    "hybrid_office",
    "hybrid_remote",
    "remote_full",
    "flexible",
  ])("remote_preference=%s は通る", (v) => {
    expect(
      AnswerMapSchema.safeParse({ remote_preference: v }).success,
    ).toBe(true);
  });

  it("不正値は弾く", () => {
    expect(
      AnswerMapSchema.safeParse({ remote_preference: "fulltime_office" }).success,
    ).toBe(false);
  });
});

describe("AnswerMapSchema — wlb_priority (3 択)", () => {
  it.each(["wlb_priority", "wlb_balance", "work_priority"])(
    "wlb_priority=%s は通る",
    (v) => {
      expect(AnswerMapSchema.safeParse({ wlb_priority: v }).success).toBe(
        true,
      );
    },
  );
});

describe("AnswerMapSchema — mindset_freenote (MAY textarea)", () => {
  it("自由文字列を許可", () => {
    expect(
      AnswerMapSchema.safeParse({
        mindset_freenote: "完璧主義で時間がかかる",
      }).success,
    ).toBe(true);
  });

  it("空文字は型レベルで許可(MAY)", () => {
    expect(
      AnswerMapSchema.safeParse({ mindset_freenote: "" }).success,
    ).toBe(true);
  });

  it("長すぎる文字列は弾く", () => {
    expect(
      AnswerMapSchema.safeParse({
        mindset_freenote: "あ".repeat(2001),
      }).success,
    ).toBe(false);
  });
});
