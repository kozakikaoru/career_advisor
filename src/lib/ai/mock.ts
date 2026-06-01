import type { AIProvider } from "./types";
import type { AnswerMap } from "@/lib/schema/answers";
import {
  CareerPlanSchema,
  type CareerPlan,
  type Plan,
  type PlanType,
  type RoadmapNode,
  type Feasibility,
} from "@/lib/schema/result";

/**
 * 開発・テスト用の Mock プロバイダ。API キー不要・課金なし・即レス。
 * v2: 3 案(plans 配列)で返す。ペルソナによって plan_type の組み合わせを切り替える。
 *
 * 返す前に CareerPlanSchema で検証し、本物のプロバイダと同じ契約を守る。
 */
export class MockProvider implements AIProvider {
  readonly name = "mock";

  async generateCareerPlan(answers: AnswerMap): Promise<CareerPlan> {
    const stageValue = strOf(answers.stage);
    const stageLabel = STAGE_LABEL[stageValue] ?? "あなた";
    const fieldLabel = pickFieldLabel(answers) || "今の分野";

    const currentLabel = goalLabelFromField(fieldLabel, stageLabel);
    const goalLabel = pickGoalLabel(answers);
    const { durationText, steps } = horizonInfo(answers);

    // ペルソナによる 3 案の振り分け(specs §4-5)
    const planTypes = pickPlanTypeTrio(answers);

    const plans = planTypes.map((pt, idx) =>
      buildPlan({
        planType: pt,
        index: idx,
        steps,
        currentLabel,
        goalLabel,
        answers,
      }),
    ) as [Plan, Plan, Plan];

    const plan: CareerPlan = {
      hero: {
        tagline: pickTagline(answers),
        durationText,
        summary: pad(
          `あなたの回答から最適化した、${durationText}を見据えた進路マップ。3 つの方向(専門深化・キャリアチェンジ・ハイブリッド系)を比べて、ご自身にしっくり来る道から動き出してください。各案で必要な学習と段取りを具体的に提示します。`,
          80,
        ).slice(0, 180),
        currentLabel,
        goalLabel,
      },
      personality: buildPersonality(answers),
      plans,
    };

    // 本物のプロバイダと同じく、返す前に必ず Zod 検証する
    const validated = CareerPlanSchema.parse(plan);
    return validated;
  }
}

// ============================================================
// 共通ユーティリティ
// ============================================================

// v2.1: definitions.ts の stage ラベル(on_leave / retired)に同期。
const STAGE_LABEL: Record<string, string> = {
  student: "学生",
  employed: "在職者",
  freeter: "フリーター",
  freelance: "フリーランス",
  seeking: "求職中",
  housekeeper: "主婦/主夫",
  parental_leave: "育休中",
  on_leave: "休職中",
  retired: "定年退職後",
  other: "あなた",
};

function strOf(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.join(" / ");
  if (typeof v === "number") return String(v);
  return "";
}

function clamp(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

/** 文字列を min 字以上に水増し(Mock テスト用) */
function pad(s: string, min: number, filler = "。"): string {
  if (s.length >= min) return s;
  return s + filler.repeat(min - s.length);
}

function goalLabelFromField(field: string, stageLabel: string): string {
  return clamp(`${field}（${stageLabel}）`, 40);
}

// ============================================================
// hero.tagline 生成(v2 新規・specs §3-1 / §4-7)
// ============================================================
function pickTagline(answers: AnswerMap): string {
  // 学生・未経験寄りなら「3 つの道」系
  const stage = strOf(answers.stage);
  if (stage === "student") return "未来は、ここから 3 つに広がる";
  if (stage === "parental_leave" || stage === "housekeeper")
    return "次の一歩、3 通りの形で";
  if (stage === "retired") return "セカンドキャリア、3 つの行き先";
  return "3 つの道、どれを選ぶ?";
}

// ============================================================
// 現在地ラベル
// ============================================================
/**
 * 「現在地」ラベルに使うフィールド名を回答から優先順に拾う(v2 / v2.1)。
 */
function pickFieldLabel(answers: AnswerMap): string {
  const stage = strOf(answers.stage);
  if (stage === "student") {
    const major = strOf(answers.student_major);
    if (major) return major;
    const schoolType = strOf(answers.school_type);
    return SCHOOL_TYPE_LABEL[schoolType] ?? "学業中";
  }
  if (stage === "freeter") {
    return strOf(answers.freeter_main_work);
  }
  if (stage === "freelance") {
    return strOf(answers.freelance_field);
  }
  const currentJob = strOf(answers.current_job_field);
  if (currentJob) return currentJob;
  const kf = answers.knowledge_fields;
  if (Array.isArray(kf)) {
    const first = kf.find(
      (v) => typeof v === "string" && v !== "none_kn" && v !== "other_kn",
    );
    if (first) return KNOWLEDGE_LABEL[first as string] ?? "";
  }
  return "";
}

const SCHOOL_TYPE_LABEL: Record<string, string> = {
  junior_high: "中学校",
  high_school: "高校",
  voc_school: "専門学校",
  kosen: "高専",
  junior_college: "短大",
  university: "大学",
  graduate: "大学院",
};

const KNOWLEDGE_LABEL: Record<string, string> = {
  it_web: "IT・Web",
  software_dev: "ソフトウェア開発",
  data_ai: "データ・AI",
  design_creative: "デザイン",
  medical_care: "医療・看護・介護",
  education: "教育・保育",
  law_admin: "法律・行政",
  finance_acc: "金融・会計",
  manufacturing: "製造業",
  construction: "建築・土木",
  service: "サービス",
  sales_retail: "営業・販売",
  marketing_pr: "マーケティング",
  hr_org: "人事",
  research: "研究",
  media: "メディア",
  art_music: "芸術",
  agri_fish: "農林水産",
  language: "語学",
};

// ============================================================
// 目標ラベル
// ============================================================
function pickGoalLabel(answers: AnswerMap): string {
  const advance = strOf(answers.student_goal_advance);
  if (advance) return clamp(`進学先候補: ${advance}`, 40);

  const otherText = strOf(answers.other_field_text);
  if (otherText) return clamp(otherText, 40);

  const sgi = answers.student_goal_industry;
  if (Array.isArray(sgi)) {
    const first = sgi.find(
      (v): v is string =>
        typeof v === "string" && v !== "undecided" && v !== "other_field",
    );
    if (first) return clamp(`目指す業界: ${INDUSTRY_LABEL[first] ?? first}`, 40);
  }

  const stu = strOf(answers.step_up_target);
  if (stu) {
    const map: Record<string, string> = {
      specialist: "専門性を深めたプロ",
      management: "チームを率いるマネージャー",
      independent_same: "同分野で独立する道",
      better_conditions: "同分野で待遇改善",
    };
    return clamp(map[stu] ?? "今の分野で次のステップ", 40);
  }

  const chg = answers.chg_target_field;
  if (Array.isArray(chg)) {
    const first = chg.find(
      (v): v is string =>
        typeof v === "string" && v !== "undecided" && v !== "other_chg",
    );
    if (first) return clamp(`新しい挑戦: ${INDUSTRY_LABEL[first] ?? first}`, 40);
  }

  const ned = answers.new_entry_direction;
  if (Array.isArray(ned)) {
    const first = ned.find(
      (v): v is string =>
        typeof v === "string" && v !== "undecided" && v !== "other_new",
    );
    if (first) return clamp(`これから働く分野: ${INDUSTRY_LABEL[first] ?? first}`, 40);
  }

  const sci = strOf(answers.second_career_intent);
  if (sci) {
    const map: Record<string, string> = {
      re_employment: "セカンドキャリア(再就職)",
      independent: "セカンドキャリア(独立・顧問)",
      community: "セカンドキャリア(地域貢献)",
      retire_hobby: "セカンドキャリア(趣味中心)",
      undecided: "これから見つけるセカンドキャリア",
    };
    return clamp(map[sci] ?? "これからの活動", 40);
  }

  const fn = strOf(answers.goal_freenote);
  if (fn) return clamp(fn, 40);

  return "これから見つける理想の姿";
}

const INDUSTRY_LABEL: Record<string, string> = {
  it_web: "IT・Web",
  software_dev: "ソフトウェア開発",
  data_ai: "データ・AI",
  design_creative: "デザイン",
  medical_care: "医療・看護・介護",
  education: "教育・保育",
  law_admin: "法律・行政",
  finance_acc: "金融・会計",
  manufacturing: "製造業",
  construction: "建築・土木",
  service: "サービス",
  sales_retail: "営業・販売",
  marketing_pr: "マーケティング",
  hr_org: "人事",
  research: "研究",
  media: "メディア",
  art_music: "芸術",
  agri_fish: "農林水産",
  language: "語学",
};

// ============================================================
// 時間粒度(specs §5)
// ============================================================
function horizonInfo(answers: AnswerMap): {
  durationText: string;
  steps: Array<{ timeLabel: string; periodText: string }>;
} {
  switch (strOf(answers.goal_horizon)) {
    case "1y":
      return {
        durationText: "約1年",
        steps: [
          { timeLabel: "NOW", periodText: "今すぐ" },
          { timeLabel: "3M", periodText: "3ヶ月後" },
          { timeLabel: "6M", periodText: "半年後" },
          { timeLabel: "GOAL", periodText: "目標" },
        ],
      };
    case "5y":
      return {
        durationText: "約5年",
        steps: [
          { timeLabel: "NOW", periodText: "今すぐ" },
          { timeLabel: "3M", periodText: "3ヶ月後" },
          { timeLabel: "6M", periodText: "半年後" },
          { timeLabel: "1Y", periodText: "1年後" },
          { timeLabel: "3Y", periodText: "3年後" },
          { timeLabel: "GOAL", periodText: "目標" },
        ],
      };
    case "10y":
      return {
        durationText: "約10年",
        steps: [
          { timeLabel: "NOW", periodText: "今すぐ" },
          { timeLabel: "6M", periodText: "半年後" },
          { timeLabel: "1Y", periodText: "1年後" },
          { timeLabel: "3Y", periodText: "3年後" },
          { timeLabel: "5Y", periodText: "5年後" },
          { timeLabel: "GOAL", periodText: "目標" },
        ],
      };
    case "open":
      return {
        durationText: "自分のペースで",
        steps: [
          { timeLabel: "NOW", periodText: "今すぐ" },
          { timeLabel: "短期", periodText: "短期" },
          { timeLabel: "中期", periodText: "中期" },
          { timeLabel: "GOAL", periodText: "目標" },
        ],
      };
    case "3y":
    default:
      return {
        durationText: "約3年",
        steps: [
          { timeLabel: "NOW", periodText: "今すぐ" },
          { timeLabel: "3M", periodText: "3ヶ月後" },
          { timeLabel: "6M", periodText: "半年後" },
          { timeLabel: "1Y", periodText: "1年後" },
          { timeLabel: "2Y", periodText: "2年後" },
          { timeLabel: "GOAL", periodText: "目標" },
        ],
      };
  }
}

// ============================================================
// 3 案の planType 振り分け(specs §4-5)
// ============================================================
function pickPlanTypeTrio(answers: AnswerMap): [PlanType, PlanType, PlanType] {
  const stage = strOf(answers.stage);
  // 学生・未経験
  if (stage === "student") {
    return ["advance", "new_entry", "side_job"];
  }
  // 起業志向(workstyle に startup or freelance)
  const ws = answers.goal_workstyle;
  const startupOriented =
    Array.isArray(ws) && ws.some((v) => v === "startup" || v === "freelance");
  if (startupOriented) {
    return ["employ_then_independent", "independent", "small_start"];
  }
  // 一般(在職者・主婦・休職中など)
  return ["specialize", "transition", "hybrid"];
}

// ============================================================
// 1 案ぶんの Plan を組み立て
// ============================================================
function buildPlan(args: {
  planType: PlanType;
  index: number;
  steps: Array<{ timeLabel: string; periodText: string }>;
  currentLabel: string;
  goalLabel: string;
  answers: AnswerMap;
}): Plan {
  const { planType, index, steps, currentLabel, goalLabel, answers } = args;

  const meta = PLAN_META[planType];
  const feasibility: Feasibility = pickFeasibility(answers, planType);
  const warning = feasibility !== "realistic" ? pickWarning(feasibility) : undefined;
  const matchPercent = index === 0 ? 88 : index === 1 ? 76 : 68;

  return {
    planType,
    candidate: {
      title: clamp(meta.title, 40),
      shortSummary: clamp(meta.shortSummary, 60),
      detail: pad(
        clamp(
          `${meta.detail}現在地「${currentLabel}」から目標「${goalLabel}」へ向かう道筋を、${meta.title}の観点で具体化します。` +
            "業界の選択肢・採用ルート・必要な学習を踏まえ、無理のない順序で積み上げていく前提で組み立てています。",
          220,
        ),
        120,
      ),
      matchPercent,
      feasibility,
      warning,
      isTop: index === 0,
    },
    roadmap: buildRoadmap({ steps, currentLabel, goalLabel, meta }),
    skills: buildSkills(planType, answers),
    adSlot: {
      kind: "ad_recruitment",
    },
  };
}

const PLAN_META: Record<
  PlanType,
  { title: string; shortSummary: string; detail: string }
> = {
  specialize: {
    title: "今の専門を深めて第一人者へ",
    shortSummary: "現職・現知見を活かして専門性を一段深掘りする道",
    detail: "これまでの蓄積を最大の武器に、専門領域を一段掘り下げて市場価値を上げるルート。",
  },
  transition: {
    title: "キャリアチェンジで別分野へ",
    shortSummary: "別領域へ大きく舵を切るキャリアチェンジ案",
    detail: "ここまでの経験を別分野の入口で活かしながら、新しい職種・業界に転身していくルート。",
  },
  hybrid: {
    title: "既存知見 × 新分野のハイブリッド",
    shortSummary: "現在の知見を活かして別分野とクロスする道",
    detail: "今の専門 × 別領域のクロスで希少性を作り、領域横断のプロを目指すルート。",
  },
  advance: {
    title: "進学型 — 学校で体系的に学ぶ",
    shortSummary: "学校・大学で土台から体系的に学んでから就業する道",
    detail: "進学先で基礎理論と実習をまとめて積み、就職市場に強いカードを揃えて踏み出すルート。",
  },
  new_entry: {
    title: "未経験就職型 — 企業で学ぶ",
    shortSummary: "未経験採用の研修・OJT で実務を覚える道",
    detail: "学校に通わず、未経験採用 + 研修制度の整った企業に飛び込み、実務の中で力をつけるルート。",
  },
  side_job: {
    title: "副業並走型 — 独学 + 実務",
    shortSummary: "独学 + 副業・インターンで実務経験を積む道",
    detail: "本業・学業と並走しつつ、副業やインターンで実務経験を積み、転身のタイミングを掴むルート。",
  },
  employ_then_independent: {
    title: "就職してから独立",
    shortSummary: "企業で 2〜3 年経験を積んでから独立する道",
    detail: "まず会社員として実務と人脈を積み、十分な準備が整ってから独立・起業へ踏み出すルート。",
  },
  independent: {
    title: "即独立・即起業型",
    shortSummary: "個人事業主・法人化で最短距離を行く道",
    detail: "勤め人を経由せず、開業届・法人化からスタートし、走りながら学んで形にしていくルート。",
  },
  small_start: {
    title: "スモールスタート型",
    shortSummary: "副業から始め、軌道に乗ったら独立",
    detail: "リスクを抑えて副業から始め、月次の売上が安定したタイミングで本業を切り替えるルート。",
  },
};

function pickFeasibility(answers: AnswerMap, planType: PlanType): Feasibility {
  // 高校生 × 高年収目標などの極端ケースは extreme_effort
  const age = typeof answers.age === "number" ? answers.age : 0;
  const goalIncome = strOf(answers.goal_income);
  if (age > 0 && age < 20 && (goalIncome === "1200to2000" || goalIncome === "gt2000")) {
    return planType === "independent" ? "extreme_effort" : "very_challenging";
  }
  if (planType === "independent") return "challenging";
  if (planType === "transition") return "challenging";
  return "realistic";
}

function pickWarning(f: Feasibility): string {
  switch (f) {
    case "challenging":
      return "短期では届かないため、2〜3 年単位での積み上げを覚悟して進めてください。";
    case "very_challenging":
      return "通常ルートでは届きにくい目標です。それでもやるなら、副業 + 学習を 3 年計画で並走させる覚悟が必要。";
    case "extreme_effort":
      return "この道は競争が激しく、突き抜けるには相当な努力量が必要。代替案として段階的アプローチも併せて検討するのがおすすめです。";
    default:
      return "";
  }
}

// ============================================================
// Roadmap 生成(各案ごとに具体的な description で組む)
// ============================================================
function buildRoadmap(args: {
  steps: Array<{ timeLabel: string; periodText: string }>;
  currentLabel: string;
  goalLabel: string;
  meta: { title: string; shortSummary: string; detail: string };
}): RoadmapNode[] {
  const { steps, currentLabel, goalLabel, meta } = args;
  const n = steps.length;

  const bodies: Array<{ title: string; description: string }> = [
    {
      title: "現在地を言語化する",
      description:
        `${currentLabel}としての強み・実績・残課題を 3 行で書き出す。同時に、目標の${meta.title}案で求められる能力リストと突き合わせ、ギャップを 3 件特定する。今週中に着手。`,
    },
    {
      title: "基礎の集中インプット",
      description:
        "目標分野の入門書を 2 冊 + オンライン講座 1 本(月 5,000 円程度)を 3 ヶ月で完走する。週 5 時間(平日 30 分 + 週末 2 時間)を目安に学習時間を確保する。",
    },
    {
      title: "実務に近い小さな成果物を 1 件作る",
      description:
        "学んだことを使って、ポートフォリオに載せられる成果物を 1 件完成させる。完璧でなく『公開できる最小単位』で OK。GitHub / note / SNS のいずれかに公開し、第三者のフィードバックを 1 件もらう。",
    },
    {
      title: "実績を 3 件まで増やし、つながりを 5 人作る",
      description:
        "成果物を 3 件まで増やす(同質の案件 2 件 + 別角度の挑戦 1 件)。同じ目標を持つ人やすでに到達した人と、勉強会・Wantedly・X 等で 5 人接点を作り、相談できる土台を整える。",
    },
    {
      title: "実践フェーズ — 副業 or 転職活動を開始",
      description:
        "副業案件(クラウドソーシング / 直接打診)で月 3〜5 万の小さな実績を作る、または転職活動を Wantedly / Green / リファラルで開始する。3 ヶ月で 5 件のエントリーが目安。",
    },
    {
      title: "本格的なシフト — 軸足を移す",
      description:
        "副業比率を増やすか、転職して目標分野での実務時間を最大化する。年収・条件・働き方を 6 ヶ月毎に振り返り、必要なら方向修正する。",
    },
    {
      title: `目標達成 ・ ${meta.title}`,
      description:
        `${goalLabel}としての位置に立つフェーズ。ここがゴールであり、新しいスタート。1 年単位で目標を再設定し、さらに先を描き始める。`,
    },
  ];

  return steps.map((s, i) => {
    const isLast = i === n - 1;
    const body = isLast ? bodies[bodies.length - 1] : bodies[Math.min(i, bodies.length - 2)];
    const kind: RoadmapNode["kind"] = i === 0 ? "start" : isLast ? "goal" : "milestone";

    const node: RoadmapNode = {
      timeLabel: s.timeLabel,
      periodText: s.periodText,
      title: clamp(body.title, 40),
      description: clamp(pad(body.description, 40), 220),
      kind,
    };

    if (kind === "start") {
      node.nowActions = [
        `${currentLabel}としての強み・実績を 3 行で言語化し、メモアプリ等に保存する(今週中)。`,
        "目標分野の入門書 1 冊を購入し、今週中に第 1 章を読み終える。",
        "同じ目標を持つコミュニティを 1 つ見つけ、X / Discord / Slack のいずれかで参加する。",
      ];
    }

    return node;
  });
}

// ============================================================
// Skills 生成(planType 依存・specs §3-5)
// ============================================================
function buildSkills(planType: PlanType, answers: AnswerMap): Plan["skills"] {
  const strengths = pickStrengths(answers);
  const baseEmerging = ["生成 AI を仕事に組み込むスキル"];

  switch (planType) {
    case "specialize":
      return {
        mustLearn: [
          { title: "業界の最新動向のキャッチアップ", description: "業界誌・主要メディア・カンファレンスを月に 1 つ追う。情報源の偏りを防ぐため発信源は 3 つ以上分散させる。" },
          { title: "高単価業務の進め方", description: "提案書・見積もり・進行管理の型を学び、単価を上げるための具体的なスキルを身につける。" },
          { title: "領域内の隣接スキル", description: "同分野で第一人者と呼ばれる人のスキルマップを参考に、足りないピースを 2〜3 件補強する。" },
        ],
        emergingSkills: [...baseEmerging, "ドメイン特化 AI ツール活用"],
        recommendedCerts: [],
        strengths,
      };
    case "transition":
      return {
        mustLearn: [
          { title: "新分野の基礎理論", description: "入門書 2 冊 + オンライン講座 1 本で土台を作る。3 ヶ月で完走する目標で進める。" },
          { title: "新分野の実務スキル", description: "実務で必要なツール・言語・手法を、写経 → 自作物 → 副業案件の順で実践に近づける。" },
          { title: "ポートフォリオ作成", description: "新分野での成果物を 3 件公開し、転職・副業の説得材料を揃える。" },
          { title: "業界の用語・指標", description: "業界特有の KPI・専門用語を学び、面接・商談で違和感なく会話できる水準まで持っていく。" },
        ],
        emergingSkills: [...baseEmerging, "業界横断的なデータドリブン思考"],
        recommendedCerts: [],
        strengths,
      };
    case "hybrid":
      return {
        mustLearn: [
          { title: "既存知見の体系化", description: "今の専門領域を改めて整理し、別分野から見た時の『翻訳できる強み』を 3 件書き出す。" },
          { title: "別分野の入門", description: "クロス先の領域の基礎を、実務に近い文脈で 3 ヶ月学ぶ。理論より使える知識を優先。" },
          { title: "クロスポイントの実例研究", description: "両領域を横断している人を 5 人特定し、SNS・登壇・記事から仕事の作り方を学ぶ。" },
        ],
        emergingSkills: [...baseEmerging, "領域横断のコミュニケーションスキル"],
        recommendedCerts: [],
        strengths,
      };
    case "advance":
      return {
        mustLearn: [
          { title: "進学先のカリキュラム把握", description: "シラバス・必修・選択を事前に確認し、関心領域に効く科目を 4 年分の俯瞰で組み立てる。" },
          { title: "受験対策(該当する場合)", description: "受験科目の過去問 3 年分を解き、出題傾向を掴む。週 10 時間の学習時間を確保する。" },
          { title: "在学中のインターン・研究室選び", description: "卒業後の進路に効く実務経験(インターン・研究室・ゼミ)を 2 年次までに 1 件確保する。" },
        ],
        emergingSkills: [...baseEmerging, "学生時代から鍛える発信力(note / X)"],
        recommendedCerts: [],
        strengths,
      };
    case "new_entry":
      return {
        mustLearn: [
          { title: "業界の採用ルートの理解", description: "新卒・第二新卒・未経験採用・研修ありの中途等、各ルートの違いと自分が乗れる枠を整理する。" },
          { title: "面接・ES の基礎", description: "志望動機・自己 PR・逆質問の型を学び、模擬面接で 3 回以上練習する。" },
          { title: "入社後 3 ヶ月の学習計画", description: "配属前提のスキル(基本ツール・業界用語)を入社前に押さえ、立ち上がりを早める。" },
        ],
        emergingSkills: [...baseEmerging, "OJT で学ぶ姿勢の見せ方"],
        recommendedCerts: [],
        strengths,
      };
    case "side_job":
      return {
        mustLearn: [
          { title: "副業案件の取り方", description: "クラウドソーシング・Wantedly・直接打診の 3 ルートを並行で開拓する。最初の 1 件を 3 ヶ月以内に着地させる。" },
          { title: "本業と副業の両立術", description: "週の作業時間配分・体調管理・税務(青色申告 / 経費計上)を学ぶ。" },
          { title: "実務に近い学習", description: "副業案件で求められる実践スキルを優先的に伸ばす。学習と実務の比率は 1:2 を目安に。" },
        ],
        emergingSkills: [...baseEmerging, "個人ブランディング(SNS / ポートフォリオ)"],
        recommendedCerts: [],
        strengths,
      };
    case "employ_then_independent":
      return {
        mustLearn: [
          { title: "業界内の人脈作り", description: "独立時の取引先候補となる人と社内外で 10 人以上接点を作る。SNS / 勉強会 / 紹介を活用。" },
          { title: "案件単価と原価感覚", description: "会社の案件単価・利益率を学び、独立後の値付け基準を理解する。" },
          { title: "個人事業主の基礎知識", description: "会計・税制・契約書・インボイス制度等、独立に必須の周辺知識を学ぶ。" },
          { title: "実績の蓄積と可視化", description: "ポートフォリオ・実績集を継続的に更新し、独立タイミングで提示できる準備をする。" },
        ],
        emergingSkills: [...baseEmerging, "独立後の案件獲得導線(SNS / 紹介)"],
        recommendedCerts: [],
        strengths,
      };
    case "independent":
      return {
        mustLearn: [
          { title: "会社法・税制(法人 vs 個人事業主)", description: "事業規模に応じた法人化の判断軸を学ぶ。インボイス・消費税の扱いも押さえる。" },
          { title: "契約書の基礎", description: "業務委託契約・秘密保持契約・知的財産の扱いを基本テンプレートで学ぶ。" },
          { title: "会計・簿記の基礎", description: "青色申告・経費計上・キャッシュフロー管理の基礎を簿記 3 級レベルで学ぶ。" },
          { title: "資金調達の選択肢", description: "自己資金・融資(日本政策金融公庫等)・VC の違いと使い分けを学ぶ。" },
          { title: "マーケティング基礎", description: "顧客獲得の導線(SNS / 紹介 / 広告)を実例とともに学び、自分の事業に当てはめる。" },
          { title: "採用と組織づくり", description: "外注・パートナー・採用の使い分けを学び、最小規模での運営から始める。" },
        ],
        emergingSkills: [...baseEmerging, "個人事業主向け SaaS の活用"],
        recommendedCerts: [],
        strengths,
      };
    case "small_start":
      return {
        mustLearn: [
          { title: "副業から始める案件設計", description: "本業と並走できる案件規模を見極め、月 3〜5 万から始める。リスクを抑えて段階的に拡大。" },
          { title: "キャッシュフロー管理", description: "副業収入の安定性を測るため、6 ヶ月以上の収入実績を可視化する。" },
          { title: "独立タイミングの判断軸", description: "本業の月収を副業で 6 ヶ月以上連続で上回ったら独立を検討、等の数値ルールを決める。" },
          { title: "個人事業主の基礎知識", description: "開業届・青色申告・インボイス制度等の手続きを早めに把握しておく。" },
        ],
        emergingSkills: [...baseEmerging, "サブスク収益化の設計"],
        recommendedCerts: [],
        strengths,
      };
  }
}

function pickStrengths(answers: AnswerMap): string[] {
  const base = ["継続力", "学ぶ意欲"];
  const add: string[] = [];
  const ld = strOf(answers.learning_depth);
  if (ld === "deep_focus") add.push("探究心");
  if (ld === "wide_explore") add.push("好奇心");
  const sp = strOf(answers.social_pref);
  if (sp === "team_strong") add.push("協調性");
  if (sp === "solo_strong") add.push("集中力");
  const rp = strOf(answers.risk_pref);
  if (rp === "risk_take") add.push("挑戦心");
  const vp = answers.value_priority;
  if (Array.isArray(vp)) {
    if (vp.includes("growth")) add.push("向上心");
    if (vp.includes("meaning")) add.push("使命感");
    if (vp.includes("freedom")) add.push("自律性");
  }
  // strengths は 2〜5 件
  const merged = [...add, ...base].slice(0, 5).map((s) => clamp(s, 20));
  if (merged.length < 2) merged.push("素直さ");
  return merged.slice(0, 5);
}

function buildPersonality(answers: AnswerMap): CareerPlan["personality"] {
  const deep = strOf(answers.learning_depth) === "deep_focus";
  const team = strOf(answers.social_pref) === "team_strong";
  const safe = strOf(answers.risk_pref) === "safe";

  const typeName = deep ? "探究型ビルダー" : "拡張型チャレンジャー";
  const emoji = deep ? "🦉" : "🚀";

  return {
    typeName,
    emoji,
    summary: deep
      ? "「なぜ」を突き詰めながら手も動かせるタイプ。明確な地図のある長距離走で力を発揮します。"
      : "新しいことに次々挑むタイプ。変化の多い環境で実験を重ねながら道を切り拓きます。",
    traits: [
      { label: "探究心", level: deep ? 88 : 70, comment: deep ? "とても高い" : "高い" },
      { label: "慎重さ", level: safe ? 78 : 52, comment: safe ? "やや高い" : "中程度" },
      { label: "協調性", level: team ? 80 : 58, comment: team ? "高い" : "中程度" },
    ],
  };
}
