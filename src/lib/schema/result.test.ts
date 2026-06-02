import { describe, it, expect } from "vitest";
import {
  CareerPlanSchema,
  PlanSchema,
  RoadmapNodeSchema,
  PlanCandidateSchema,
  PlanSkillsSchema,
  HeroSchema,
} from "./result";

/**
 * CareerPlanSchema v2 のバリデーション確認(specs/result-v2.md §2)。
 *
 * 2026-06-02: PersonalityType 撤去(Gemini 502 対応)に伴い `personality` キーを
 * CareerPlan の必須から外した。本ファイルの正常系/異常系もそれに追従。
 */

// ============================================================
// テストデータヘルパ
// ============================================================
function pad(s: string, min: number): string {
  return s.length >= min ? s : s + "。".repeat(min - s.length);
}

const validRoadmapNode = {
  timeLabel: "NOW",
  periodText: "今すぐ",
  title: "現在地を言語化する",
  description: pad(
    "今の自分のスキル・経験・現状の不満を 3 行で書き出す。週末までに完了。",
    40,
  ),
  kind: "start" as const,
  nowActions: [
    "今週中に強み・実績を 3 件書き出す。",
    "目標分野の入門書を 1 冊買う。",
  ],
};

const validGoalNode = {
  timeLabel: "GOAL",
  periodText: "目標",
  title: "目標達成",
  description: pad("3 案の中から選んだ道での到達地点。", 40),
  kind: "goal" as const,
};

const validMidNode = {
  timeLabel: "3M",
  periodText: "3ヶ月後",
  title: "基礎学習を完走する",
  description: pad("入門書 2 冊と講座を完走。月 30 時間ペースで進める。", 40),
  kind: "milestone" as const,
};

const validCandidate = {
  title: "今の専門を深めて第一人者へ",
  shortSummary: "現職を起点に専門性を一段掘り下げるルート",
  detail: pad(
    "これまでの蓄積を最大の武器に、専門領域を一段掘り下げて市場価値を上げるルート。具体的には、関連スキルの補強と発信を 1 年で形にする。",
    120,
  ),
  matchPercent: 85,
  feasibility: "realistic" as const,
  isTop: true,
};

const validSkills = {
  mustLearn: [
    { title: "業界の最新動向", description: "業界誌・メディア・カンファレンスを月 1 つ追う。" },
    { title: "高単価業務の進め方", description: "提案書・見積もりの型を学ぶ。" },
  ],
  emergingSkills: ["生成 AI を仕事に組み込む"],
  recommendedCerts: [],
  strengths: ["継続力", "学ぶ意欲"],
};

const validAdSlot = { kind: "ad_recruitment" as const };

const validPlan = {
  planType: "specialize" as const,
  candidate: validCandidate,
  roadmap: [validRoadmapNode, validMidNode, validGoalNode],
  skills: validSkills,
  adSlot: validAdSlot,
};

const validHero = {
  tagline: "3 つの道、どれを選ぶ?",
  durationText: "約3年",
  summary: pad(
    "あなたの回答から最適化した、3 年を見据えた進路マップ。3 つの方向を比べて、しっくり来る道から動き出してください。",
    80,
  ),
};

const validCareerPlan = {
  hero: validHero,
  plans: [validPlan, validPlan, validPlan] as const,
};

// ============================================================
// テスト本体
// ============================================================
describe("CareerPlanSchema v2 — トップレベル", () => {
  it("正常データを parse できる", () => {
    const r = CareerPlanSchema.safeParse(validCareerPlan);
    expect(r.success).toBe(true);
  });

  it("plans が 3 件未満(2 件)だと失敗する(固定長 3)", () => {
    const r = CareerPlanSchema.safeParse({
      ...validCareerPlan,
      plans: [validPlan, validPlan],
    });
    expect(r.success).toBe(false);
  });

  it("plans が 4 件だと失敗する(固定長 3)", () => {
    const r = CareerPlanSchema.safeParse({
      ...validCareerPlan,
      plans: [validPlan, validPlan, validPlan, validPlan],
    });
    expect(r.success).toBe(false);
  });

  it("旧 v1 schema(roadmap 単数 + candidates + skills.learning + nextAction)は失敗する", () => {
    const v1Plan = {
      hero: {
        currentLabel: "Webデザイナー",
        goalLabel: "PM",
        durationText: "約3年",
        summary: "v1 のサマリ。",
      },
      roadmap: [validRoadmapNode, validGoalNode],
      candidates: [
        { title: "PM", description: "...", matchPercent: 90 },
      ],
      skills: { learning: ["A", "B"], strengths: ["継続力"] },
      nextAction: { title: "最初の一歩", detail: "..." },
    };
    const r = CareerPlanSchema.safeParse(v1Plan);
    expect(r.success).toBe(false);
  });

  it("personality キーは廃止(2026-06-02 Gemini 502 対応・撤去確認)", () => {
    // 正常データ(hero + plans のみ)で parse 成功
    const r = CareerPlanSchema.safeParse(validCareerPlan);
    expect(r.success).toBe(true);
    if (r.success) {
      // 型レベルでも personality が含まれていないことを担保
      expect("personality" in r.data).toBe(false);
    }
  });

  it("personality キーを含めて投げても、余剰プロパティとして無視される(zod 既定: passthrough off)", () => {
    // zod のオブジェクトスキーマは既定で「strip(余剰キーは破棄)」のため、personality を
    // 付けた past-format も parse 自体は成功する(出力からは脱落)。
    const withLegacy = {
      ...validCareerPlan,
      personality: {
        typeName: "探究型ビルダー",
        emoji: "🦉",
        summary: "サマリ",
        traits: [
          { label: "探究心", level: 80, comment: "高い" },
          { label: "慎重さ", level: 60, comment: "中程度" },
        ],
      },
    };
    const r = CareerPlanSchema.safeParse(withLegacy);
    expect(r.success).toBe(true);
    if (r.success) {
      expect("personality" in r.data).toBe(false);
    }
  });
});

describe("HeroSchema v2", () => {
  it("tagline は 8 字以上 80 字以下(2026-06-02 緩和)", () => {
    expect(HeroSchema.safeParse({ ...validHero, tagline: "短い" }).success).toBe(
      false,
    );
    expect(
      HeroSchema.safeParse({
        ...validHero,
        tagline: "あ".repeat(81),
      }).success,
    ).toBe(false);
    expect(
      HeroSchema.safeParse({ ...validHero, tagline: "3 つの道、どれを選ぶ?" }).success,
    ).toBe(true);
  });

  it("currentLabel / goalLabel は任意(undefined でも OK)", () => {
    const r = HeroSchema.safeParse(validHero);
    expect(r.success).toBe(true);
  });

  it("summary が 80 字未満だと失敗する", () => {
    const r = HeroSchema.safeParse({ ...validHero, summary: "短い要約。" });
    expect(r.success).toBe(false);
  });
});

describe("PlanCandidateSchema v2", () => {
  it("detail は 80 字以上 500 字以下(2026-06-02 緩和)", () => {
    expect(
      PlanCandidateSchema.safeParse({
        ...validCandidate,
        detail: "短い説明",
      }).success,
    ).toBe(false);
    expect(
      PlanCandidateSchema.safeParse({
        ...validCandidate,
        detail: "あ".repeat(501),
      }).success,
    ).toBe(false);
  });

  it("feasibility は 4 段階のいずれか", () => {
    for (const f of ["realistic", "challenging", "very_challenging", "extreme_effort"] as const) {
      const r = PlanCandidateSchema.safeParse({ ...validCandidate, feasibility: f });
      expect(r.success).toBe(true);
    }
    const bad = PlanCandidateSchema.safeParse({
      ...validCandidate,
      feasibility: "almost_impossible",
    });
    expect(bad.success).toBe(false);
  });

  it("warning は 20〜160 字(任意)", () => {
    const r1 = PlanCandidateSchema.safeParse({
      ...validCandidate,
      feasibility: "extreme_effort",
      warning: "短すぎる",
    });
    expect(r1.success).toBe(false);
    const r2 = PlanCandidateSchema.safeParse({
      ...validCandidate,
      feasibility: "extreme_effort",
      warning: "未経験で 1 年で年収 2000 万は通常ルートでは届かない。",
    });
    expect(r2.success).toBe(true);
  });
});

describe("RoadmapNodeSchema v2", () => {
  it("description は 40 字以上 500 字以下(2026-06-02 緩和)", () => {
    expect(
      RoadmapNodeSchema.safeParse({
        ...validMidNode,
        description: "短い説明",
      }).success,
    ).toBe(false);
    expect(
      RoadmapNodeSchema.safeParse({
        ...validMidNode,
        description: "あ".repeat(501),
      }).success,
    ).toBe(false);
  });

  it("nowActions は 1〜3 件(任意)", () => {
    const r1 = RoadmapNodeSchema.safeParse({ ...validMidNode, nowActions: [] });
    expect(r1.success).toBe(false);
    const r2 = RoadmapNodeSchema.safeParse({
      ...validMidNode,
      nowActions: ["A", "B", "C", "D"],
    });
    expect(r2.success).toBe(false);
    const r3 = RoadmapNodeSchema.safeParse({
      ...validMidNode,
      nowActions: ["A"],
    });
    expect(r3.success).toBe(true);
  });
});

describe("PlanSchema v2 / roadmap 段数", () => {
  it("roadmap は 3 段以上 8 段以下", () => {
    const r1 = PlanSchema.safeParse({
      ...validPlan,
      roadmap: [validRoadmapNode, validGoalNode],
    });
    expect(r1.success).toBe(false); // 2 段 NG

    const r2 = PlanSchema.safeParse({
      ...validPlan,
      roadmap: [
        validRoadmapNode,
        validMidNode,
        validGoalNode,
      ],
    });
    expect(r2.success).toBe(true); // 3 段 OK

    const eightNodes = [
      validRoadmapNode,
      validMidNode,
      validMidNode,
      validMidNode,
      validMidNode,
      validMidNode,
      validMidNode,
      validGoalNode,
    ];
    const r3 = PlanSchema.safeParse({ ...validPlan, roadmap: eightNodes });
    expect(r3.success).toBe(true); // 8 段 OK

    const r4 = PlanSchema.safeParse({
      ...validPlan,
      roadmap: [...eightNodes, validGoalNode],
    });
    expect(r4.success).toBe(false); // 9 段 NG
  });
});

describe("PlanSkillsSchema v2 / mustLearn 0 件可変", () => {
  it("mustLearn は 0 件で OK(接客業ケース)", () => {
    const r = PlanSkillsSchema.safeParse({ ...validSkills, mustLearn: [] });
    expect(r.success).toBe(true);
  });

  it("mustLearn は最大 8 件", () => {
    const item = { title: "T", description: "D" };
    const r = PlanSkillsSchema.safeParse({
      ...validSkills,
      mustLearn: Array(9).fill(item),
    });
    expect(r.success).toBe(false);
  });

  it("strengths は 2〜5 件", () => {
    const r1 = PlanSkillsSchema.safeParse({ ...validSkills, strengths: ["A"] });
    expect(r1.success).toBe(false);
    const r2 = PlanSkillsSchema.safeParse({
      ...validSkills,
      strengths: ["A", "B", "C", "D", "E", "F"],
    });
    expect(r2.success).toBe(false);
  });

  it("recommendedCerts は 0 件で OK", () => {
    const r = PlanSkillsSchema.safeParse({ ...validSkills, recommendedCerts: [] });
    expect(r.success).toBe(true);
  });

  it("emergingSkills は最低 1 件必要", () => {
    const r = PlanSkillsSchema.safeParse({ ...validSkills, emergingSkills: [] });
    expect(r.success).toBe(false);
  });
});
