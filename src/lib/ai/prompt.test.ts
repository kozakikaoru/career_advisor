import { describe, it, expect } from "vitest";
import { buildPrompt } from "./prompt";
import type { AnswerMap } from "@/lib/schema/answers";

/**
 * GOAL v2 §8-5-2 (g)(h) prompt.ts 解釈ガイドの実装確認テスト。
 * - goal_commit の解釈ガイドが必ず含まれていること
 * - 年収トレンドが計算されること
 *
 * v2.2 注記: goal_avoid を完全撤去したため、avoid 関連の解釈ガイド検証テストは削除済み。
 */

describe("buildPrompt — GOAL v2 解釈ガイド", () => {
  it("goal_commit の解釈ガイド(§8-5-2 (g))が含まれる", () => {
    const a: AnswerMap = {
      age: 28,
      stage: "employed",
      goal_commit: "gt300",
    };
    const p = buildPrompt(a);
    // (g) の制約フレーズが全て明文で含まれているか
    expect(p).toContain("使い切るべき金額");
    expect(p).toContain("最低限必要な");
    expect(p).toContain("使わずに済むなら使わない方がよい");
    expect(p).toContain("情報商材");
    expect(p).toContain("100to300");
    expect(p).toContain("gt300");
  });

  it("goal_commit の中立表現(§8-5-2 (h))が含まれる", () => {
    const a: AnswerMap = {
      age: 28,
      stage: "employed",
      goal_commit: "20to50",
    };
    const p = buildPrompt(a);
    expect(p).toContain("中立表現");
    expect(p).toContain("自己投資");
  });

  it("年収トレンド: same_as_now → 現状維持志向", () => {
    const a: AnswerMap = {
      age: 35,
      stage: "employed",
      current_income: "500to700",
      goal_income: "same_as_now",
    };
    const p = buildPrompt(a);
    expect(p).toContain("年収トレンド: 現状維持志向");
  });

  it("年収トレンド: 大幅アップ志向(2段以上)", () => {
    const a: AnswerMap = {
      age: 28,
      stage: "employed",
      current_income: "300to500",
      goal_income: "1200to2000",
    };
    const p = buildPrompt(a);
    expect(p).toContain("年収トレンド: 大幅アップ志向");
  });

  it("年収トレンド: ダウンシフト志向", () => {
    const a: AnswerMap = {
      age: 35,
      stage: "employed",
      current_income: "700to1000",
      goal_income: "300to400",
    };
    const p = buildPrompt(a);
    expect(p).toContain("年収トレンド: ダウンシフト志向");
  });

  it("change_intent=undecided + change_direction=both_unsure で迷い層への対応注釈が出る", () => {
    const a: AnswerMap = {
      age: 35,
      stage: "employed",
      change_intent: "undecided",
      change_direction: "both_unsure",
    };
    const p = buildPrompt(a);
    expect(p).toContain("両方提示");
  });

  it("v2.2: goal_avoid 関連の解釈ガイドは prompt に含まれない(撤去確認)", () => {
    const p = buildPrompt({ age: 28 });
    expect(p).toContain("# 解釈の前提: goal_commit");
    expect(p).toContain("# 解釈の前提: goal_income");
    // v2.2 で goal_avoid を撤去 → avoid セクションと「除外条件」「ネガティブフィルタ」が消えていること
    expect(p).not.toContain("# 解釈の前提: goal_avoid");
    expect(p).not.toContain("避けるべき条件");
    expect(p).not.toContain("ネガティブフィルタ");
    expect(p).not.toContain("none_avoid");
  });

  it("ラベル化された質問文 + 回答が含まれる(全体の構造確認・v2.2 で workstyle multi 化)", () => {
    const a: AnswerMap = {
      age: 28,
      stage: "employed",
      change_intent: "continue",
      step_up_target: "specialist",
      // v2.2: goal_workstyle が multi に変更されたため配列で渡す
      goal_workstyle: ["company", "multi_job"],
      goal_commit: "20to50",
    };
    const p = buildPrompt(a);
    // ラベル化された質問タイトル(definitions.ts 由来)
    expect(p).toContain("これからも続けていきたいですか");
    expect(p).toContain("続けたい");
    expect(p).toContain("専門性を深めたい");
    // v2.2: multi 化された goal_workstyle のラベルが " / " 区切りで並ぶ
    expect(p).toContain("会社員");
    expect(p).toContain("複業・パラレルキャリア");
  });
});

// ============================================================
// v2.1 §8-5-2 (i-1)〜(i-5) AI プロンプト整形ガイドの実装確認
// ============================================================
describe("buildPrompt — GOAL v2.1 学生フロー整形ガイド", () => {
  it("(i-1) student_job_status=offer_accepted で「入社後 3〜5 年のキャリア設計」が含まれる", () => {
    const a: AnswerMap = {
      age: 22,
      stage: "student",
      student_goal_track: "job",
      student_job_status: "offer_accepted",
    };
    const p = buildPrompt(a);
    expect(p).toContain("就活フェーズ");
    expect(p).toContain("入社後");
  });

  it("(i-1) student_job_status=exploring で「業界比較・自己分析」が含まれる", () => {
    const a: AnswerMap = {
      age: 20,
      stage: "student",
      student_goal_track: "job",
      student_job_status: "exploring",
    };
    const p = buildPrompt(a);
    expect(p).toContain("業界比較");
    expect(p).toContain("自己分析");
  });

  it("(i-2) student_advance_status=admitted で「進学後の学習設計と卒業後の業界選択」が含まれる", () => {
    const a: AnswerMap = {
      age: 18,
      stage: "student",
      student_goal_track: "advance",
      student_advance_status: "admitted",
    };
    const p = buildPrompt(a);
    expect(p).toContain("進学フェーズ");
    expect(p).toContain("卒業後の業界選択");
  });

  it("(i-2) student_advance_status=searching で「分野選び・大学比較」が含まれる", () => {
    const a: AnswerMap = {
      age: 17,
      stage: "student",
      student_goal_track: "advance",
      student_advance_status: "searching",
    };
    const p = buildPrompt(a);
    expect(p).toContain("分野選び");
    expect(p).toContain("大学比較");
  });

  it("(i-2 補足) student_goal_track=undecided で「方向性違いの案を並列で提示」整形が出る", () => {
    const a: AnswerMap = {
      age: 19,
      stage: "student",
      student_goal_track: "undecided",
    };
    const p = buildPrompt(a);
    expect(p).toContain("進路探索フェーズ");
    expect(p).toContain("進学した場合");
    expect(p).toContain("就職した場合");
    expect(p).toContain("起業した場合");
  });

  it("(i-3) 進学者の進学先・学部主軸ルールが常時含まれる(undecided でも具体候補提示)", () => {
    const a: AnswerMap = {
      age: 18,
      stage: "student",
      student_goal_track: "advance",
      student_advance_status: "admitted",
      student_goal_advance: "医学部",
      student_goal_industry: ["undecided"],
    };
    const p = buildPrompt(a);
    expect(p).toContain("進学先・学部主軸");
    expect(p).toContain("医学部 → 医療・看護・介護");
    expect(p).toContain("情報工学");
    expect(p).toContain("「分からないので分かりません」と返さない");
    expect(p).toContain("分野クロス志向");
  });

  it("(i-3) 進学者でなくても (i-3) のガイド自体は常に prompt に含まれる(静的ガイド)", () => {
    const p = buildPrompt({ age: 28, stage: "employed" });
    expect(p).toContain("# 解釈の前提: 進学者の「進学先」と「卒業後の業界」の関係性");
  });

  it("(i-4) student_advance_status=admitted + goal_start_timing=after_preparation で進学卒業後スタート解釈が含まれる", () => {
    const a: AnswerMap = {
      age: 18,
      stage: "student",
      student_goal_track: "advance",
      student_advance_status: "admitted",
      student_goal_advance: "大学院(情報系・2年)",
      goal_start_timing: "after_preparation",
      goal_horizon: "5y",
    };
    const p = buildPrompt(a);
    expect(p).toContain("進学合格組");
    expect(p).toContain("admitted × after_preparation");
    expect(p).toContain("進学卒業後");
    expect(p).toContain("カウントダウン");
  });

  it("(i-5) 非進学者(社会人)の after_preparation で相対時期の解釈が含まれる", () => {
    const a: AnswerMap = {
      age: 35,
      stage: "parental_leave",
      life_constraint: ["caring_kids"],
      goal_start_timing: "after_preparation",
    };
    const p = buildPrompt(a);
    expect(p).toContain("after_preparation は学生限定ではない");
    expect(p).toContain("育休");
    expect(p).toContain("相対時期");
  });

  it("(i-5) admitted のときは (i-4) が出て (i-5) が出ない(両方は出さない)", () => {
    const a: AnswerMap = {
      age: 18,
      stage: "student",
      student_goal_track: "advance",
      student_advance_status: "admitted",
      goal_start_timing: "after_preparation",
    };
    const p = buildPrompt(a);
    expect(p).toContain("admitted × after_preparation");
    expect(p).not.toContain("after_preparation は学生限定ではない");
  });
});

// ============================================================
// v2.1: ロードマップ3本提示は本フェーズではスコープ外(TODO コメントの存在確認)
// ============================================================
describe("buildPrompt — v2.1 スコープ外: ロードマップ3本提示", () => {
  it("AI への指示文に「3本提示」「classifyLayer」などが入っていない(本フェーズではスコープ外)", () => {
    const a: AnswerMap = { age: 28, stage: "employed" };
    const p = buildPrompt(a);
    // §8-5-3 のロードマップ 3 本提示は CareerPlanSchema 拡張を伴う別フェーズ。
    // 現スキーマは単一 roadmap のため、AI に「3 本出して」と書かないことを担保。
    expect(p).not.toContain("3 本");
    expect(p).not.toContain("3本");
    expect(p).not.toContain("classifyLayer");
    expect(p).not.toContain("保守案");
    expect(p).not.toContain("チャレンジ案");
  });
});
