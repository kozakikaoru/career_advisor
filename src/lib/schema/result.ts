import { z } from "zod";

/**
 * 進路プラン(CareerPlan)— LLM 出力検証の中核。
 * result-dark.html の各セクション(Hero / A ロードマップ / B 候補 / C スキル /
 * D 次の一歩 / E タイプ分析)に 1 対 1 で対応する。
 * 文字数上限(max)は UI 崩れ防止 + LLM の冗長出力抑制のため。
 */

/** ロードマップの 1 ノード(段数可変) */
export const RoadmapNodeSchema = z.object({
  /** 表示する時間ラベル。"NOW" / "3M" / "1Y" / "3Y" / "GOAL" など可変 */
  timeLabel: z.string().min(1).max(12),
  /** バッジ等に出す説明的な期間表現。例: "今すぐ" "3ヶ月後" "目標" */
  periodText: z.string().min(1).max(20),
  title: z.string().min(1).max(40),
  description: z.string().min(1).max(200),
  /** ノードの種類。配色(start=cyan, milestone=violet, goal=pink)に使う */
  kind: z.enum(["start", "milestone", "goal"]),
});

/** B. 進路候補 */
export const CandidateSchema = z.object({
  title: z.string().min(1).max(40),
  description: z.string().min(1).max(160),
  /** マッチ度 0-100。バーの幅と数値表示に使う */
  matchPercent: z.number().int().min(0).max(100),
  /** 最有力フラグ(先頭1件などに付与) */
  isTop: z.boolean().optional(),
});

/** E. タイプ分析の指標(バー) */
export const TraitSchema = z.object({
  label: z.string().min(1).max(16), // 例: "探究心"
  level: z.number().int().min(0).max(100), // バー幅
  comment: z.string().min(1).max(12), // 例: "とても高い"
});

export const CareerPlanSchema = z.object({
  /** Hero 用 */
  hero: z.object({
    currentLabel: z.string().min(1).max(40), // 現在地。例: "Webデザイナー（3年目）"
    goalLabel: z.string().min(1).max(40), // 目標。例: "プロダクトマネージャー"
    durationText: z.string().min(1).max(20), // 想定期間。例: "約3年"
    summary: z.string().min(1).max(160), // 一言サマリー
  }),

  /** A. ロードマップ(段数可変。2〜8件に制約) */
  roadmap: z.array(RoadmapNodeSchema).min(2).max(8),

  /** B. 進路候補(1〜5件) */
  candidates: z.array(CandidateSchema).min(1).max(5),

  /** C. 必要スキル・学習リスト */
  skills: z.object({
    learning: z.array(z.string().min(1).max(40)).min(1).max(8), // 学習リスト
    strengths: z.array(z.string().min(1).max(20)).min(1).max(8), // 活かせる強み(タグ)
  }),

  /** D. 今すぐやるべき次の一歩 */
  nextAction: z.object({
    title: z.string().min(1).max(120), // 主たる一歩
    detail: z.string().min(1).max(160), // 補足
  }),

  /** E. タイプ分析 */
  personality: z.object({
    typeName: z.string().min(1).max(20), // 例: "探究型ビルダー"
    emoji: z.string().min(1).max(4), // 例: "🦉"
    summary: z.string().min(1).max(220),
    traits: z.array(TraitSchema).min(2).max(4),
  }),
});

export type CareerPlan = z.infer<typeof CareerPlanSchema>;
export type RoadmapNode = z.infer<typeof RoadmapNodeSchema>;
export type Candidate = z.infer<typeof CandidateSchema>;
export type Trait = z.infer<typeof TraitSchema>;
