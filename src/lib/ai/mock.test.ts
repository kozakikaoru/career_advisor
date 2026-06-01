import { describe, it, expect } from "vitest";
import { MockProvider } from "./mock";
import { CareerPlanSchema } from "@/lib/schema/result";
import type { AnswerMap } from "@/lib/schema/answers";

/**
 * Mock プロバイダの v2 出力検証(specs/result-v2.md §8-3)。
 * - plans は固定長 3
 * - hero.tagline 必須
 * - feasibility は 4 段階のいずれか
 * - NOW ノードには nowActions
 */

describe("MockProvider v2 — 3 案出力", () => {
  it("一般在職者ペルソナ: specialize / transition / hybrid の 3 案", async () => {
    const a: AnswerMap = {
      age: 32,
      stage: "employed",
      current_job_field: "Web デザイナー",
      goal_horizon: "3y",
    };
    const plan = await new MockProvider().generateCareerPlan(a);
    expect(plan.plans).toHaveLength(3);
    expect(plan.plans.map((p) => p.planType)).toEqual([
      "specialize",
      "transition",
      "hybrid",
    ]);
  });

  it("学生ペルソナ: advance / new_entry / side_job の 3 案", async () => {
    const a: AnswerMap = {
      age: 18,
      stage: "student",
      school_type: "high_school",
      goal_horizon: "5y",
    };
    const plan = await new MockProvider().generateCareerPlan(a);
    expect(plan.plans.map((p) => p.planType)).toEqual([
      "advance",
      "new_entry",
      "side_job",
    ]);
  });

  it("起業志向: employ_then_independent / independent / small_start の 3 案", async () => {
    const a: AnswerMap = {
      age: 28,
      stage: "employed",
      goal_workstyle: ["startup"],
      goal_horizon: "5y",
    };
    const plan = await new MockProvider().generateCareerPlan(a);
    expect(plan.plans.map((p) => p.planType)).toEqual([
      "employ_then_independent",
      "independent",
      "small_start",
    ]);
  });

  it("CareerPlanSchema v2 を通過する(各案に candidate / roadmap / skills / adSlot)", async () => {
    const a: AnswerMap = {
      age: 28,
      stage: "employed",
      goal_horizon: "3y",
    };
    const plan = await new MockProvider().generateCareerPlan(a);
    const r = CareerPlanSchema.safeParse(plan);
    expect(r.success).toBe(true);

    for (const p of plan.plans) {
      expect(p.candidate.title).toBeTruthy();
      expect(p.candidate.shortSummary).toBeTruthy();
      expect(p.candidate.detail.length).toBeGreaterThanOrEqual(120);
      expect(p.roadmap.length).toBeGreaterThanOrEqual(3);
      expect(p.adSlot.kind).toBe("ad_recruitment");
    }
  });

  it("hero.tagline が 8〜40 字で「○○から××へ」を含まない", async () => {
    const a: AnswerMap = { age: 28, stage: "employed", goal_horizon: "3y" };
    const plan = await new MockProvider().generateCareerPlan(a);
    expect(plan.hero.tagline.length).toBeGreaterThanOrEqual(8);
    expect(plan.hero.tagline.length).toBeLessThanOrEqual(40);
    expect(plan.hero.tagline).not.toMatch(/から.+へ/);
  });

  it("feasibility は 4 段階のいずれか", async () => {
    const a: AnswerMap = { age: 28, stage: "employed", goal_horizon: "3y" };
    const plan = await new MockProvider().generateCareerPlan(a);
    const valid = ["realistic", "challenging", "very_challenging", "extreme_effort"];
    for (const p of plan.plans) {
      expect(valid).toContain(p.candidate.feasibility);
    }
  });

  it("極端ケース(高校生 × 高年収目標) → 高難易度プランで warning 付き", async () => {
    const a: AnswerMap = {
      age: 17,
      stage: "student",
      school_type: "high_school",
      goal_income: "gt2000",
      goal_horizon: "1y",
      goal_workstyle: ["startup"],
    };
    const plan = await new MockProvider().generateCareerPlan(a);
    const hasHardFeasibility = plan.plans.some(
      (p) =>
        p.candidate.feasibility === "very_challenging" ||
        p.candidate.feasibility === "extreme_effort",
    );
    expect(hasHardFeasibility).toBe(true);
    const hasWarning = plan.plans.some(
      (p) => p.candidate.feasibility !== "realistic" && p.candidate.warning,
    );
    expect(hasWarning).toBe(true);
  });

  it("NOW ノードには nowActions(1〜3 件)が含まれる", async () => {
    const a: AnswerMap = { age: 28, stage: "employed", goal_horizon: "3y" };
    const plan = await new MockProvider().generateCareerPlan(a);
    for (const p of plan.plans) {
      const nowNode = p.roadmap.find((n) => n.kind === "start");
      expect(nowNode).toBeDefined();
      expect(nowNode!.nowActions).toBeDefined();
      expect(nowNode!.nowActions!.length).toBeGreaterThanOrEqual(1);
      expect(nowNode!.nowActions!.length).toBeLessThanOrEqual(3);
    }
  });

  it("先頭の plan には isTop=true が付く(初期表示用)", async () => {
    const a: AnswerMap = { age: 28, stage: "employed", goal_horizon: "3y" };
    const plan = await new MockProvider().generateCareerPlan(a);
    expect(plan.plans[0].candidate.isTop).toBe(true);
  });

  it("8 段以下のロードマップ(goal_horizon=5y で 6 段)", async () => {
    const a: AnswerMap = { age: 28, stage: "employed", goal_horizon: "5y" };
    const plan = await new MockProvider().generateCareerPlan(a);
    for (const p of plan.plans) {
      expect(p.roadmap.length).toBeLessThanOrEqual(8);
      expect(p.roadmap.length).toBeGreaterThanOrEqual(3);
    }
  });
});
