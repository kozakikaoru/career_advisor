import { describe, it, expect } from "vitest";
import { buildPrompt, inferBigFive } from "./prompt";
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
// 結果 v2: 3 案出力プロンプトガイド(specs/result-v2.md §4)
// ============================================================
describe("buildPrompt — 結果 v2 / 3 案出力ガイド(specs/result-v2.md §4)", () => {
  it("§4-1 業界事情を踏まえた具体提示の指示が含まれる", () => {
    const p = buildPrompt({ age: 28, stage: "employed" });
    expect(p).toContain("業界事情を踏まえた具体提示");
    expect(p).toContain("具体的な数値・期限・手段");
    expect(p).toContain("採用ルート");
    expect(p).toContain("職種の細分");
    expect(p).toContain("雇用形態");
    expect(p).toContain("学習ルート");
  });

  it("§4-2 mustLearn の進路依存(0〜8 件可変)の指示が含まれる", () => {
    const p = buildPrompt({ age: 28, stage: "employed" });
    expect(p).toContain("mustLearn");
    expect(p).toContain("0〜8 件");
    expect(p).toContain("現場で学ぶ");
    expect(p).toContain("emergingSkills");
    expect(p).toContain("recommendedCerts");
  });

  it("§4-3 ロードマップ時間粒度(基本 8 段固定 + 短縮可)の指示が含まれる", () => {
    const p = buildPrompt({ age: 28, stage: "employed" });
    expect(p).toContain("基本は **8 段固定**");
    expect(p).toContain("NOW / 3M / 6M / 1Y / 2Y / 3Y / 5Y / GOAL");
    expect(p).toContain("nowActions");
  });

  it("§4-4 feasibility 4 段階 + warning トーン規範(超努力が必要)の指示が含まれる", () => {
    const p = buildPrompt({ age: 28, stage: "employed" });
    expect(p).toContain("feasibility");
    expect(p).toContain("extreme_effort");
    expect(p).toContain("超努力が必要");
    expect(p).toContain("warning");
    // NG 表現と OK 表現の両方が含まれる
    expect(p).toContain("諦めなさい");
    expect(p).toContain("覚悟が必要");
  });

  it("§4-5 plans を 3 本提示する原則(固定長 3 / 3 パターン)の指示が含まれる", () => {
    const p = buildPrompt({ age: 28, stage: "employed" });
    expect(p).toContain("plans は固定長 3");
    expect(p).toContain("specialize");
    expect(p).toContain("transition");
    expect(p).toContain("hybrid");
    expect(p).toContain("advance");
    expect(p).toContain("new_entry");
    expect(p).toContain("side_job");
    expect(p).toContain("employ_then_independent");
    expect(p).toContain("independent");
    expect(p).toContain("small_start");
  });

  it("§4-6 楽観バイアス排除 + hero.tagline 規範が含まれる", () => {
    const p = buildPrompt({ age: 28, stage: "employed" });
    expect(p).toContain("楽観バイアス");
    expect(p).toContain("未確定情報を理由に逃げない");
    expect(p).toContain("hero.tagline");
    expect(p).toContain("○○から××へ");
  });

  it("§4-7 Few-shot 例(roadmap description / mustLearn / tagline)が含まれる", () => {
    const p = buildPrompt({ age: 28, stage: "employed" });
    // roadmap description の Good 例 10 件のうち主要なものが明文
    expect(p).toContain("開業資金 50 万円を貯める");
    expect(p).toContain("ポートフォリオを 5 件作る");
    expect(p).toContain("TOEIC 700 点取得");
    expect(p).toContain("簿記 2 級");
    // NG 例
    expect(p).toContain("スキルを磨く");
    expect(p).toContain("努力する");
    // mustLearn 進路依存
    expect(p).toContain("接客業");
    expect(p).toContain("エンジニア・士業・起業");
    // tagline Good 例
    expect(p).toContain("3 つの道、どれを選ぶ?");
    expect(p).toContain("未来は、ここから 3 つに広がる");
  });

  it("出力制約: plans は 3 件固定 / hero.tagline が必須 / adSlot kind=ad_recruitment を許容", () => {
    const p = buildPrompt({ age: 28, stage: "employed" });
    expect(p).toContain("ちょうど 3 件");
    expect(p).toContain("hero.tagline");
    expect(p).toContain("ad_recruitment");
  });
});

// ============================================================
// MINDSET v2 確定版 — inferBigFive + プロンプト整形ガイド検証
// (specs/mindset-questions-v2.md §7-1 / §7-1-3 / §7-2 / §7-3 / §8-5-2 (m-1)〜(m-6))
// ============================================================

describe("inferBigFive — MINDSET v2 ビッグファイブ暗黙取得(specs §7-1-1)", () => {
  it("外向性: lead_want + team_strong → high", () => {
    const bf = inferBigFive({
      leadership_role: "lead_want",
      social_pref: "team_strong",
    });
    expect(bf.extraversion).toBe("high");
  });

  it("外向性: lead_avoid + solo_strong → low", () => {
    const bf = inferBigFive({
      leadership_role: "lead_avoid",
      social_pref: "solo_strong",
    });
    expect(bf.extraversion).toBe("low");
  });

  it("外向性: 中間入力(lead_neutral + mix)→ mid", () => {
    const bf = inferBigFive({
      leadership_role: "lead_neutral",
      social_pref: "mix",
    });
    expect(bf.extraversion).toBe("mid");
  });

  it("協調性: team_strong + compete_drain → high", () => {
    const bf = inferBigFive({
      social_pref: "team_strong",
      competition_pref: "compete_drain",
    });
    expect(bf.agreeableness).toBe("high");
  });

  it("協調性: compete_motivated + solo_strong → low", () => {
    const bf = inferBigFive({
      social_pref: "solo_strong",
      competition_pref: "compete_motivated",
    });
    expect(bf.agreeableness).toBe("low");
  });

  it("協調性: competition_pref=neither(中庸入力)は両極判定の根拠にしない → mid", () => {
    const bf = inferBigFive({
      social_pref: "team_strong",
      competition_pref: "neither",
    });
    expect(bf.agreeableness).toBe("mid");
  });

  it("誠実性: plan_first + deep_focus → high", () => {
    const bf = inferBigFive({
      plan_style: "plan_first",
      learning_depth: "deep_focus",
    });
    expect(bf.conscientiousness).toBe("high");
  });

  it("誠実性: action_first + wide_explore → low", () => {
    const bf = inferBigFive({
      plan_style: "action_first",
      learning_depth: "wide_explore",
    });
    expect(bf.conscientiousness).toBe("low");
  });

  it("神経症傾向: jump_anxious + careful_after + safe → high", () => {
    const bf = inferBigFive({
      unknown_field_jump: "jump_anxious",
      failure_recovery: "careful_after",
      risk_pref: "safe",
    });
    expect(bf.neuroticism).toBe("high");
  });

  it("神経症傾向: jump_ok + retry_fast + risk_take → low", () => {
    const bf = inferBigFive({
      unknown_field_jump: "jump_ok",
      failure_recovery: "retry_fast",
      risk_pref: "risk_take",
    });
    expect(bf.neuroticism).toBe("low");
  });

  it("神経症傾向: neither を含むと両極判定にならず mid に倒れる", () => {
    // 1 つでも neither を含めば mid(中庸入力)
    const bf1 = inferBigFive({
      unknown_field_jump: "neither",
      failure_recovery: "careful_after",
      risk_pref: "safe",
    });
    expect(bf1.neuroticism).toBe("mid");
    const bf2 = inferBigFive({
      unknown_field_jump: "jump_ok",
      failure_recovery: "neither",
      risk_pref: "risk_take",
    });
    expect(bf2.neuroticism).toBe("mid");
  });

  it("開放性: change_welcome + (wide_explore or mix_learning) → high", () => {
    const bf1 = inferBigFive({
      change_attitude: "change_welcome",
      learning_depth: "wide_explore",
    });
    expect(bf1.openness).toBe("high");
    const bf2 = inferBigFive({
      change_attitude: "change_welcome",
      learning_depth: "mix_learning",
    });
    expect(bf2.openness).toBe("high");
  });

  it("開放性: change_dislike + deep_focus → low", () => {
    const bf = inferBigFive({
      change_attitude: "change_dislike",
      learning_depth: "deep_focus",
    });
    expect(bf.openness).toBe("low");
  });

  it("全軸: 入力がない場合はすべて mid に倒れる(安全側)", () => {
    const bf = inferBigFive({});
    expect(bf.extraversion).toBe("mid");
    expect(bf.agreeableness).toBe("mid");
    expect(bf.conscientiousness).toBe("mid");
    expect(bf.neuroticism).toBe("mid");
    expect(bf.openness).toBe("mid");
  });
});

describe("buildPrompt — MINDSET v2 プロンプト整形ガイド(specs §8-5-2 (m-1)〜(m-6))", () => {
  // 「MINDSET 回答が 1 件でも含まれる」とき BF サマリが注入される
  const baseMindset: AnswerMap = {
    leadership_role: "lead_want",
    social_pref: "team_strong",
    plan_style: "plan_first",
    unknown_field_jump: "jump_ok",
    change_attitude: "change_welcome",
    value_priority: ["growth", "freedom"],
    meaning_priority: "balance",
    competition_pref: "compete_motivated",
    risk_pref: "risk_take",
    learning_depth: "wide_explore",
    failure_recovery: "retry_fast",
    location_preference: "metro_pref",
    remote_preference: "hybrid_remote",
    wlb_priority: "wlb_balance",
  };

  it("(m-1) MINDSET 回答ありで BF サマリセクションが prompt に注入される", () => {
    const p = buildPrompt(baseMindset);
    expect(p).toContain("# ユーザーの性格傾向(ビッグファイブ的シグナル");
    expect(p).toContain("- 外向性:");
    expect(p).toContain("- 協調性:");
    expect(p).toContain("- 誠実性:");
    expect(p).toContain("- 神経症傾向:");
    expect(p).toContain("- 開放性:");
  });

  it("(m-1) MINDSET 回答なし(ORIGIN/GOAL のみ)では BF サマリは注入されない", () => {
    const p = buildPrompt({ age: 28, stage: "employed" });
    expect(p).not.toContain("# ユーザーの性格傾向(ビッグファイブ的シグナル");
  });

  it("(m-1) BF サマリの値が inferBigFive と一致する(挑戦志向ペルソナ)", () => {
    const p = buildPrompt(baseMindset);
    const bf = inferBigFive(baseMindset);
    // 全 5 軸の判定値が prompt 文字列に含まれる
    expect(p).toContain(`- 外向性: ${bf.extraversion}`);
    expect(p).toContain(`- 協調性: ${bf.agreeableness}`);
    expect(p).toContain(`- 誠実性: ${bf.conscientiousness}`);
    expect(p).toContain(`- 神経症傾向: ${bf.neuroticism}`);
    expect(p).toContain(`- 開放性: ${bf.openness}`);
  });

  it("(m-2) 軸名を結果画面に直接出さない制約が含まれる(§7-1-2)", () => {
    const p = buildPrompt(baseMindset);
    expect(p).toContain("直接的な性格断定をしない");
    expect(p).toContain("ビッグファイブの軸名");
    expect(p).toContain("結果画面に出さない");
  });

  it("(m-2) neither を「明確な傾向なし・中庸」として扱う指示が含まれる(§1-2-1)", () => {
    const p = buildPrompt(baseMindset);
    expect(p).toContain("neither");
    expect(p).toContain("中庸");
  });

  it("(m-2-§7-1-3) 進路文脈の「うっすら」表現ガイドが含まれる(具体例 + NG 表現)", () => {
    const p = buildPrompt(baseMindset);
    // 結果画面冒頭の傾向セクションのガイド
    expect(p).toContain("結果画面冒頭");
    expect(p).toContain("「あなたの傾向」");
    // 具体例 5 個のうち少なくとも 3 個は明文
    expect(p).toContain("挑戦志向タイプ");
    expect(p).toContain("計画的に積み上げるタイプ");
    expect(p).toContain("探索型タイプ");
    // NG 表現の明示
    expect(p).toContain("MBTI");
  });

  it("(m-3) 性格傾向 × 案タイプの対応ガイドが含まれる(§7-2-1)", () => {
    const p = buildPrompt(baseMindset);
    expect(p).toContain("外向性高 + 開放性高");
    expect(p).toContain("スタートアップ");
    expect(p).toContain("段階踏み");
    expect(p).toContain("ミッションドリブン");
  });

  it("(m-4) E 群を「働き方の必須条件」として扱う指示が含まれる(§7-3)", () => {
    const p = buildPrompt(baseMindset);
    expect(p).toContain("MINDSET v2 E 群");
    expect(p).toContain("必須条件");
    expect(p).toContain("location_preference");
    expect(p).toContain("remote_preference");
    expect(p).toContain("wlb_priority");
    // goal_avoid 撤去後の代替フィルタとしての明示
    expect(p).toContain("goal_avoid");
    expect(p).toContain("代替");
  });

  it("(m-5) mindset_freenote の取り扱いガイドが含まれる(§7-4)", () => {
    const p = buildPrompt(baseMindset);
    expect(p).toContain("mindset_freenote");
    expect(p).toContain("自由記述");
  });

  it("(m-6) ORIGIN + GOAL + MINDSET の組み合わせ解釈の代表パターンが含まれる(§7-5)", () => {
    const p = buildPrompt(baseMindset);
    // 5 パターンのうち代表 2 件以上
    expect(p).toContain("矛盾シグナル");
    expect(p).toContain("段階的アプローチ");
    expect(p).toContain("矛盾シグナル");
  });

  it("(m-2 否定) 結果画面で軸名を直接出すよう AI に指示していない(NG 文言が prompt 自体に推奨形で出ない)", () => {
    const p = buildPrompt(baseMindset);
    // NG 表現の「あなたは外向性が高いです」は引用形式で禁止されていることを担保。
    // 一方、prompt 自体は「ビッグファイブの軸名を結果画面に出さない」と書いているので、
    // 「軸名」「外向性」が含まれること自体は OK(指示文として)。
    // ここでは「結果画面に出さない」「直接的な性格断定をしない」「軸名」のような禁止文脈が
    // 一貫していることだけ確認。
    expect(p).toContain("ビッグファイブの軸名");
    expect(p).toContain("結果画面に出さない");
  });
});

// ============================================================
// goal_commit 制約(§8-5-2 (g)(h))は MINDSET v2 でも維持されること
// ============================================================
describe("MINDSET v2 でも goal_commit 制約(情報商材化防止)は維持される", () => {
  it("(g) MINDSET 回答併存時も goal_commit 制約は変わらず含まれる", () => {
    const a: AnswerMap = {
      age: 28,
      stage: "employed",
      goal_commit: "gt300",
      // MINDSET も合わせて投入
      leadership_role: "lead_want",
      social_pref: "team_strong",
      risk_pref: "risk_take",
    };
    const p = buildPrompt(a);
    expect(p).toContain("使い切るべき金額");
    expect(p).toContain("最低限必要な");
    expect(p).toContain("情報商材");
    // MINDSET BF サマリも併存
    expect(p).toContain("# ユーザーの性格傾向(ビッグファイブ的シグナル");
  });
});
