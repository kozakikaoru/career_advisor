import type { AnswerMap } from "@/lib/schema/answers";

/** 3 軸 */
export type Axis = "current" | "goal" | "personality";

/** 質問の種類 */
export type QuestionType =
  | "single" // 単一選択(選択肢から 1 つ)
  | "multi" // 複数選択
  | "text" // 短い記述(1 行)
  | "textarea"; // 自由記述(複数行)

/** 選択肢 */
export interface Choice {
  /** 回答値として保存される安定キー(英数字。表示文言とは分離) */
  value: string;
  /** 画面に出すラベル */
  label: string;
  /** 任意: この選択肢を選んだら次に飛ぶ質問 ID(分岐) */
  next?: string;
  /** 任意: 選択肢の補足説明 */
  hint?: string;
}

/** 質問 1 件の定義 */
export interface Question {
  id: string; // 一意な ID(例: "stage")
  axis: Axis; // どの軸の質問か
  type: QuestionType;
  title: string; // 質問文
  description?: string; // 補足説明
  choices?: Choice[]; // single/multi のときの選択肢
  placeholder?: string; // text/textarea のヒント
  required: boolean; // 必須か(MVP は基本必須、自由記述のみ任意可)
  /**
   * 選択肢に next が無い / 記述式のときの既定の次質問 ID。
   * 未指定なら「定義配列の次の質問」へ線形に進む。null なら終端候補。
   */
  next?: string | null;
  /**
   * 回答全体に応じて次の質問を動的に決める分岐(案 B の最小フック)。
   * undefined を返したら通常の優先順位(選択肢 next → 質問 next → 線形)へフォールバック。
   * MVP では学生フローの experience/income スキップにのみ使う。
   */
  branch?: (answers: AnswerMap) => string | null | undefined;
  /** 自由記述で機微情報の注意書きを出すか(PII 対策) */
  sensitiveNotice?: boolean;
}

/** 回答の保存形 */
export type AnswerValue = string | string[];

// ============================================================
// 代表的な質問セット(MVP) — question-flow.md §4
// 軸1 現在の状況 / 軸2 目標 / 軸3 性格・価値観 の 3 軸。おおむね 12〜14 問。
// ============================================================
export const QUESTIONS: Question[] = [
  // ---------- 軸1: 現在の状況(current) ----------
  {
    id: "stage",
    axis: "current",
    type: "single",
    title: "今のあなたに一番近いのは?",
    description: "まずはあなたの立場を教えてください。ここで質問の流れが少し変わります。",
    required: true,
    choices: [
      { value: "student", label: "学生・これから就職", hint: "在学中、就活中など" },
      { value: "working", label: "社会人・現職あり", hint: "今のキャリアを伸ばしたい" },
      { value: "changing", label: "転職・キャリアチェンジ検討", hint: "別の道も考えている" },
      { value: "returning", label: "再就職・ブランクあり", hint: "復職・再スタートしたい" },
    ],
  },
  {
    id: "field",
    axis: "current",
    type: "text",
    title: "今いる分野・職種 / 専攻を教えてください",
    description: "例: Webデザイン、看護、文学部、営業 など",
    placeholder: "例: Webデザイン",
    required: true,
    // 学生は経験年数・年収をスキップして目標軸へ。それ以外は線形(experience へ)。
    branch: (a) => (a.stage === "student" ? "goal_clarity" : undefined),
  },
  {
    id: "experience",
    axis: "current",
    type: "single",
    title: "その分野の経験年数は?",
    required: true,
    choices: [
      { value: "lt1", label: "1年未満" },
      { value: "1to3", label: "1〜3年" },
      { value: "3to5", label: "3〜5年" },
      { value: "5to10", label: "5〜10年" },
      { value: "gt10", label: "10年以上" },
      { value: "blank", label: "ブランクあり / 現在は離れている" },
    ],
  },
  {
    id: "income",
    axis: "current",
    type: "single",
    title: "現在のおおよその年収帯は?(任意)",
    description: "答えたくなければ「答えない」を選んでください。",
    required: true,
    choices: [
      { value: "none", label: "収入なし / アルバイト" },
      { value: "lt300", label: "〜300万円" },
      { value: "300to500", label: "300〜500万円" },
      { value: "500to700", label: "500〜700万円" },
      { value: "700to1000", label: "700〜1000万円" },
      { value: "gt1000", label: "1000万円以上" },
      { value: "no_answer", label: "答えない" },
    ],
  },

  // ---------- 軸2: 目標(goal) ----------
  {
    id: "goal_clarity",
    axis: "goal",
    type: "single",
    title: "目指したい方向は決まっていますか?",
    required: true,
    choices: [
      { value: "clear", label: "明確に決まっている", next: "goal_target" },
      { value: "vague", label: "なんとなくある", next: "goal_direction" },
      { value: "none", label: "まだ無い / これから探したい", next: "goal_direction" },
    ],
  },
  {
    id: "goal_target",
    axis: "goal",
    type: "text",
    title: "目指す職業・働き方は?",
    description: "具体的に思い描いているものを教えてください。",
    placeholder: "例: プロダクトマネージャー",
    required: true,
    next: "goal_workstyle", // goal_direction をスキップして合流
  },
  {
    id: "goal_direction",
    axis: "goal",
    type: "multi",
    title: "惹かれる方向はどれですか?(複数選択可)",
    description: "ピンとくるものを選んでください。",
    required: true,
    choices: [
      { value: "specialist", label: "専門を極める" },
      { value: "management", label: "マネジメント・人を率いる" },
      { value: "independent", label: "独立・フリーランス" },
      { value: "stable", label: "安定した環境" },
      { value: "social", label: "社会貢献・人の役に立つ" },
      { value: "creative", label: "クリエイティブ・ものづくり" },
    ],
  },
  {
    id: "goal_workstyle",
    axis: "goal",
    type: "single",
    title: "理想の働き方は?",
    required: true,
    choices: [
      { value: "company", label: "安定した会社員" },
      { value: "freelance", label: "フリーランス" },
      { value: "startup", label: "起業・スタートアップ" },
      { value: "remote", label: "リモート中心" },
      { value: "wlb", label: "ワークライフバランス重視" },
    ],
  },
  {
    id: "goal_income",
    axis: "goal",
    type: "single",
    title: "目指す年収帯は?(任意)",
    required: true,
    choices: [
      { value: "lt400", label: "〜400万円" },
      { value: "400to600", label: "400〜600万円" },
      { value: "600to800", label: "600〜800万円" },
      { value: "800to1200", label: "800〜1200万円" },
      { value: "gt1200", label: "1200万円以上" },
      { value: "no_answer", label: "こだわらない / 答えない" },
    ],
  },
  {
    id: "goal_horizon",
    axis: "goal",
    type: "single",
    title: "どのくらいの期間で実現したいですか?",
    description: "ロードマップの想定期間の目安にします。",
    required: true,
    choices: [
      { value: "1y", label: "1年くらい" },
      { value: "3y", label: "3年くらい" },
      { value: "5y", label: "5年くらい" },
      { value: "open", label: "期限は決めていない" },
    ],
  },

  // ---------- 軸3: 性格・価値観(personality) ----------
  {
    id: "value_priority",
    axis: "personality",
    type: "single",
    title: "仕事で一番大事にしたいことは?",
    required: true,
    choices: [
      { value: "stability", label: "安定" },
      { value: "growth", label: "成長・挑戦" },
      { value: "freedom", label: "自由・裁量" },
      { value: "relation", label: "人との関わり" },
      { value: "meaning", label: "社会的意義" },
      { value: "reward", label: "報酬" },
    ],
  },
  {
    id: "work_style_pref",
    axis: "personality",
    type: "single",
    title: "どちらが近いですか?",
    required: true,
    choices: [
      { value: "deep", label: "コツコツ一つを深める" },
      { value: "wide", label: "新しいことを次々試す" },
    ],
  },
  {
    id: "social_pref",
    axis: "personality",
    type: "single",
    title: "どちらが近いですか?",
    required: true,
    choices: [
      { value: "team", label: "チームで協働する" },
      { value: "solo", label: "一人で集中する" },
    ],
  },
  {
    id: "risk_pref",
    axis: "personality",
    type: "single",
    title: "どちらが近いですか?",
    required: true,
    choices: [
      { value: "safe", label: "安定を重視する" },
      { value: "risk", label: "リスクを取って大きく狙う" },
    ],
  },
  {
    id: "free_note",
    axis: "personality",
    type: "textarea",
    title: "最後に、伝えておきたいことがあれば自由にどうぞ(任意)",
    placeholder: "例: 家庭の事情で勤務地は限定したい、未経験だけど挑戦したい など",
    required: false,
    sensitiveNotice: true,
    next: null, // 終端
  },
];

export const FIRST_QUESTION_ID = "stage";
