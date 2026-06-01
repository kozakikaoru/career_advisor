import { z } from "zod";

/**
 * 進路プラン(CareerPlan v2)— LLM 出力検証の中核。
 * 仕様書: specs/result-v2.md(v2.0 確定版)
 *
 * v1 → v2 の主な変更点(specs §1-1):
 * - `plans: [Plan, Plan, Plan]` 固定長 3(タブ切替の元データ)
 * - `hero.tagline` 新設 / `currentLabel` / `goalLabel` は optional 化(UI 非表示)
 * - 各 Plan に `candidate`(detail + feasibility + warning)/ `roadmap`(3〜8 段)
 *   / `skills`(mustLearn 0〜8 + emergingSkills + recommendedCerts + strengths)
 *   / `adSlot`(広告枠) / `planType` を保持
 * - `RoadmapNode.description` の min を 40 字に引き上げて具体性を担保(§2-4)
 * - `RoadmapNode.nowActions` を NOW ノード用に新設(§3-6-2)
 * - 旧 `roadmap`(単数) / `candidates`(配列) / `skills.learning` / `nextAction` は完全撤去
 *
 * 2026-06-02 PersonalityType 撤去(@engineer):
 * - Gemini 2.5 Flash で 502 が頻発する課題への対応として `personality` セクション
 *   (PersonalitySchema / TraitSchema)を CareerPlan の必須キーから撤去。
 *   prompt 長削減 + responseSchema 単純化が目的。
 * - MINDSET 回答自体は引き続き `inferBigFive` 経由で AI 入力には使う(進路提案には反映)。
 * - 型 export と TraitSchema/PersonalitySchema 定義は将来復活に備えて残置(unused 扱い)。
 *
 * 後方互換性: ゼロ(過去結果は削除する方針・specs §2-5 / §8-6)。
 */

/** プランの方向性タグ(AI が文脈に応じて適切なものを 3 案に振る・specs §3-2)。 */
export const PlanTypeSchema = z.enum([
  "specialize", // 専門深化型
  "transition", // キャリアチェンジ型
  "hybrid", // ハイブリッド型
  "advance", // 進学型(学生・未経験)
  "new_entry", // 未経験就職型(学生・未経験)
  "side_job", // 副業並走型
  "employ_then_independent", // 就職してから独立
  "independent", // 即起業・即独立型
  "small_start", // スモールスタート型(副業 → 独立)
]);

/** 進路の実現可能性(specs §3-4 / 4 段階・最厳は「超努力が必要」)。 */
export const FeasibilitySchema = z.enum([
  "realistic", // 現実的
  "challenging", // 挑戦的
  "very_challenging", // かなり厳しい
  "extreme_effort", // 超努力が必要(specs §3-4・almost_impossible の v2 確定名称)
]);

/** ロードマップの 1 ノード(段数可変 3〜8) */
export const RoadmapNodeSchema = z.object({
  /** 表示する時間ラベル。短い英数表記("3M"/"6M"/"1Y"/"2Y"/"3Y"/"5Y"/"10Y"/"NOW"/"GOAL"・specs §5-3) */
  timeLabel: z.string().min(1).max(12),
  /** バッジ等に出す説明的な期間表現。例: "今すぐ" "3ヶ月後" "目標" */
  periodText: z.string().min(1).max(20),
  title: z.string().min(1).max(40),
  /**
   * 具体性を担保するため min を 40 字に引き上げ(specs §2-4 / §4-1)。
   * 数値・期限・手段のいずれかを必ず含むトーン規範は prompt 側で強制。
   */
  description: z.string().min(40).max(220),
  /** ノードの種類。配色(start=cyan, milestone=violet, goal=pink)に使う */
  kind: z.enum(["start", "milestone", "goal"]),
  /**
   * NOW ノード(timeLabel="NOW" / kind="start")に出す「今すぐの具体アクション」を
   * チェックリストとして集約する。旧 NextAction の代替(specs §3-6-2)。
   */
  nowActions: z.array(z.string().min(1).max(160)).min(1).max(3).optional(),
});

/** 進路候補(各案 1 件・タブのラベル兼ヘッダーになる) */
export const PlanCandidateSchema = z.object({
  /** タブのラベルにもなる(40 字) */
  title: z.string().min(1).max(40),
  /** 一覧での短文(60 字) */
  shortSummary: z.string().min(1).max(60),
  /** 詳細説明(200 字 ± 20・specs §2-4) */
  detail: z.string().min(120).max(220),
  /** マッチ度 0-100。バーの幅と数値表示に使う */
  matchPercent: z.number().int().min(0).max(100),
  /** 4 段階の実現可能性(specs §3-4) */
  feasibility: FeasibilitySchema,
  /**
   * feasibility != realistic のとき任意・very_challenging / extreme_effort で必須
   * トーン規範は prompt 側(§4-4)で強制。
   */
  warning: z.string().min(20).max(160).optional(),
  /** 最有力フラグ(初期表示タブの選択用途のみ・UI にリボンは出さない・specs §6-2) */
  isTop: z.boolean().optional(),
});

/** スキルの 1 項目(mustLearn の各エントリ・specs §3-5) */
export const MustLearnItemSchema = z.object({
  /** 学んでおくべき分野のタイトル(例: 「プログラミング言語(まずは TypeScript or Python)」) */
  title: z.string().min(1).max(40),
  /** なぜそれを学ぶか・どう学ぶかを 80 字前後で(specs §4-2) */
  description: z.string().min(1).max(120),
});

/** スキルセクション(各案ごと・specs §3-5) */
export const PlanSkillsSchema = z.object({
  /** 学んでおくべき分野(0〜8 件可変・進路依存)。0 件時は UI 側で「特になし」表示 */
  mustLearn: z.array(MustLearnItemSchema).min(0).max(8),
  /** 業界の最新トレンド(AI 使いこなし等・1〜4 件) */
  emergingSkills: z.array(z.string().min(1).max(40)).min(1).max(4),
  /** おすすめ資格(0〜3 件・本当に必須なもののみ・0 件 OK) */
  recommendedCerts: z.array(z.string().min(1).max(40)).min(0).max(3),
  /** 既存の強み(MINDSET 由来のタグ・2〜5 件) */
  strengths: z.array(z.string().min(1).max(20)).min(2).max(5),
});

/** 広告枠(各案ごと・MVP は固定バナー / 将来はアフィリエイト案件を流し込む) */
export const AdSlotSchema = z.object({
  /** kind のみ MUST。MVP は ad_recruitment 固定 */
  kind: z.enum(["ad_recruitment", "affiliate"]),
  headline: z.string().min(1).max(80).optional(),
  body: z.string().min(1).max(160).optional(),
  ctaLabel: z.string().min(1).max(40).optional(),
  ctaUrl: z.string().url().max(300).optional(),
});

/** 1 案分の Plan(candidate + roadmap + skills + adSlot) */
export const PlanSchema = z.object({
  /** AI が文脈に応じて選ぶ方向性タグ(specs §3-2) */
  planType: PlanTypeSchema,
  candidate: PlanCandidateSchema,
  /** ロードマップ(基本 8 段固定 / AI 判断で 3〜8 段に短縮可・specs §5) */
  roadmap: z.array(RoadmapNodeSchema).min(3).max(8),
  skills: PlanSkillsSchema,
  adSlot: AdSlotSchema,
});

/**
 * タイプ分析の指標(バー)
 *
 * 2026-06-02: PersonalityType 撤去に伴い CareerPlanSchema からは参照されなくなったが、
 * 将来復活する可能性に備えて型定義は残置(unused)。
 */
export const TraitSchema = z.object({
  label: z.string().min(1).max(16), // 例: "探究心"
  level: z.number().int().min(0).max(100), // バー幅
  comment: z.string().min(1).max(12), // 例: "とても高い"
});

/** ヒーロー(全案共通) */
export const HeroSchema = z.object({
  /** v2 新設: 結果画面メインキャッチ(AI 生成キャッチコピー 8〜40 字・specs §3-1) */
  tagline: z.string().min(8).max(40),
  /** 想定期間。例: "約3年" */
  durationText: z.string().min(1).max(20),
  /** ヒーロー要約(80〜180 字・specs §2-4) */
  summary: z.string().min(80).max(180),
  /** v2: schema 上は残置・UI 非表示(specs §2-5) */
  currentLabel: z.string().min(1).max(40).optional(),
  /** v2: schema 上は残置・UI 非表示(specs §2-5) */
  goalLabel: z.string().min(1).max(40).optional(),
});

/**
 * パーソナリティタイプ(全案共通)
 *
 * 2026-06-02: PersonalityType 撤去に伴い CareerPlanSchema からは参照されなくなったが、
 * 将来復活する可能性に備えて型定義は残置(unused)。
 */
export const PersonalitySchema = z.object({
  typeName: z.string().min(1).max(20), // 例: "探究型ビルダー"
  emoji: z.string().min(1).max(4), // 例: "🦉"
  summary: z.string().min(1).max(220),
  traits: z.array(TraitSchema).min(2).max(4),
});

/**
 * v2 トップレベルスキーマ
 *
 * 2026-06-02: `personality` キーを撤去(Gemini 502 対応の prompt/schema 簡素化)。
 * MINDSET 回答は AI 入力としては引き続き利用(進路提案に暗黙反映)。
 */
export const CareerPlanSchema = z.object({
  /** 全案共通の Hero(tagline / 期間 / サマリ) */
  hero: HeroSchema,
  /** 3 本のプラン(固定長 3・specs §1-4 / §2-2) */
  plans: z.tuple([PlanSchema, PlanSchema, PlanSchema]),
});

// ============================================================
// 型 export
// ============================================================
export type CareerPlan = z.infer<typeof CareerPlanSchema>;
export type Hero = z.infer<typeof HeroSchema>;
export type Personality = z.infer<typeof PersonalitySchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type PlanCandidate = z.infer<typeof PlanCandidateSchema>;
export type PlanSkills = z.infer<typeof PlanSkillsSchema>;
export type RoadmapNode = z.infer<typeof RoadmapNodeSchema>;
export type AdSlot = z.infer<typeof AdSlotSchema>;
export type Trait = z.infer<typeof TraitSchema>;
export type MustLearnItem = z.infer<typeof MustLearnItemSchema>;
export type PlanType = z.infer<typeof PlanTypeSchema>;
export type Feasibility = z.infer<typeof FeasibilitySchema>;
