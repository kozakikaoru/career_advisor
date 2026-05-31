import type { AnswerMap } from "@/lib/schema/answers";

/** 3 軸 */
export type Axis = "current" | "goal" | "personality";

/** 質問の種類 */
export type QuestionType =
  | "single" // 単一選択(選択肢から 1 つ)
  | "multi" // 複数選択
  | "text" // 短い記述(1 行)
  | "textarea" // 自由記述(複数行)
  | "number"; // 数値入力(整数)

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
  required: boolean; // 必須か
  /**
   * 選択肢に next が無い / 記述式のときの既定の次質問 ID。
   * 未指定なら「定義配列の次の質問」へ線形に進む。null なら終端候補。
   */
  next?: string | null;
  /**
   * 回答全体に応じて次の質問を動的に決める分岐(案 B の最小フック)。
   * undefined を返したら通常の優先順位(選択肢 next → 質問 next → 線形)へフォールバック。
   */
  branch?: (answers: AnswerMap) => string | null | undefined;
  /** 自由記述で機微情報の注意書きを出すか(PII 対策) */
  sensitiveNotice?: boolean;
  // ---------- number 型専用(type === "number" の時のみ使用) ----------
  numberMin?: number;
  numberMax?: number;
  numberStep?: number;
  numberPlaceholder?: string;
}

/** 回答の保存形 */
export type AnswerValue = string | string[] | number;

// ============================================================
// 質問セット(specs/origin-questions-v2.md 最終確定版反映)
// 軸1 ORIGIN(現状, current) v2 / 軸2 GOAL 6問 / 軸3 MINDSET 5問
//
// v2 ORIGIN は立場ごとに枝分かれる 22 問。実際に1人が辿る MUST は 11〜13問。
// MINDSET 側で実装する change_intent / location_preference / remote_preference は
// 本書スコープ外(specs §7 申し送り)。
// ============================================================
export const QUESTIONS: Question[] = [
  // ============================================================
  // 軸1: ORIGIN(現状, current)— v2
  // ============================================================

  // §3-1. age(年齢・MUST・全員・先頭)
  {
    id: "age",
    axis: "current",
    type: "number",
    title: "年齢を教えてください",
    description: "進路設計の現実性(就職/転職の機会・健康・年金など)の参考にします。",
    required: true,
    numberMin: 0,
    numberMax: 99,
    numberStep: 1,
    numberPlaceholder: "例: 28",
    next: "stage",
  },

  // §3-2. stage(立場・MUST・全員・10択)
  {
    id: "stage",
    axis: "current",
    type: "single",
    title: "今の主な活動・立場は?",
    description:
      "いまの生活で一番時間を使っているものに近いものを選んでください。希望や意向ではなく今の事実で選んでください。",
    required: true,
    choices: [
      {
        value: "student",
        label: "学生",
        hint: "中学〜大学院・専門・高専を含む",
        next: "school_type",
      },
      {
        value: "employed",
        label: "在職者",
        hint: "正社員・公務員・契約・派遣・経営者など",
        next: "employment_type",
      },
      {
        value: "freeter",
        label: "フリーター",
        hint: "アルバイト・パート中心",
        next: "freeter_main_work",
      },
      {
        value: "freelance",
        label: "フリーランス・個人事業主",
        next: "freelance_field",
      },
      {
        value: "seeking",
        label: "求職中",
        hint: "無職で活動中",
        next: "seeking_blank",
      },
      {
        value: "housekeeper",
        label: "主婦・主夫",
        hint: "家庭中心",
        next: "prior_work_exp",
      },
      {
        value: "parental_leave",
        label: "育休・産休中",
        next: "parental_child_age",
      },
      {
        value: "on_leave",
        label: "休職中",
        next: "on_leave_reason",
      },
      {
        value: "retired",
        label: "定年退職後",
        hint: "定年・早期退職を含む",
        next: "retired_status",
      },
      {
        value: "other",
        label: "その他",
        hint: "自由記述で補足",
        next: "other_note",
      },
    ],
  },

  // §3-3. school_type(学校種別・MUST・student のみ)
  {
    id: "school_type",
    axis: "current",
    type: "single",
    title: "どの学校に通っていますか?",
    description: "進路設計の起点になります。",
    required: true,
    choices: [
      { value: "junior_high", label: "中学校", next: "grade_jh" },
      { value: "high_school", label: "高校", next: "grade_hs" },
      { value: "voc_school", label: "専門学校", next: "grade_voc" },
      { value: "kosen", label: "高専(高等専門学校)", next: "grade_kosen" },
      { value: "junior_college", label: "短期大学", next: "grade_jcol" },
      { value: "university", label: "大学", next: "grade_uni" },
      { value: "graduate", label: "大学院", next: "grade_grad" },
    ],
  },

  // §3-4-a. grade_jh(中学校の学年)
  {
    id: "grade_jh",
    axis: "current",
    type: "single",
    title: "何年生ですか?",
    required: true,
    choices: [
      { value: "jh1_2", label: "1〜2年" },
      { value: "jh3", label: "3年" },
    ],
    next: "student_work_exp", // 中学生は学科ヒアリングをスキップ
  },

  // §3-4-b. grade_hs(高校の学年)
  {
    id: "grade_hs",
    axis: "current",
    type: "single",
    title: "何年生ですか?",
    required: true,
    choices: [
      { value: "hs1", label: "1年" },
      { value: "hs2", label: "2年" },
      { value: "hs3", label: "3年" },
    ],
    next: "student_major",
  },

  // §3-4-c. grade_voc(専門学校の学年)
  {
    id: "grade_voc",
    axis: "current",
    type: "single",
    title: "何年次ですか?",
    required: true,
    choices: [
      { value: "voc1", label: "1年" },
      { value: "voc2", label: "2年" },
      { value: "voc3", label: "3年以上" },
      { value: "voc_final", label: "卒業見込み" },
    ],
    next: "student_major",
  },

  // §3-4-d. grade_kosen(高専の学年)
  {
    id: "grade_kosen",
    axis: "current",
    type: "single",
    title: "何年生ですか?",
    required: true,
    choices: [
      { value: "kosen_low", label: "1〜3年(本科)" },
      { value: "kosen_high", label: "4〜5年(本科)" },
      { value: "kosen_adv", label: "専攻科" },
    ],
    next: "student_major",
  },

  // §3-4-e. grade_jcol(短大の学年)
  {
    id: "grade_jcol",
    axis: "current",
    type: "single",
    title: "何年生ですか?",
    required: true,
    choices: [
      { value: "jcol1", label: "1年" },
      { value: "jcol2", label: "2年" },
    ],
    next: "student_major",
  },

  // §3-4-f. grade_uni(大学の学年)
  {
    id: "grade_uni",
    axis: "current",
    type: "single",
    title: "何年生ですか?",
    required: true,
    choices: [
      { value: "u1", label: "1年" },
      { value: "u2", label: "2年" },
      { value: "u3", label: "3年" },
      { value: "u4", label: "4年" },
      { value: "u_repeat", label: "5年以上" },
    ],
    next: "student_major",
  },

  // §3-4-g. grade_grad(大学院の学年)
  {
    id: "grade_grad",
    axis: "current",
    type: "single",
    title: "修士・博士のどちらですか?",
    required: true,
    choices: [
      { value: "m1", label: "修士1年" },
      { value: "m2", label: "修士2年" },
      { value: "d1_2", label: "博士1〜2年" },
      { value: "d3plus", label: "博士3年以上" },
    ],
    next: "student_major",
  },

  // §3-5. student_major(学科・専攻・MUST・高校以降の学生)
  {
    id: "student_major",
    axis: "current",
    type: "text",
    title: "学科・専攻を教えてください",
    description:
      "例: 機械工学科、看護学科、文学部英文学科、デザイン専攻 など。一言で OK。",
    placeholder: "例: 情報科学 / 商業科 / 看護",
    required: true,
    next: "student_work_exp",
  },

  // §3-6. student_work_exp(学生の実務経験・MUST multi)
  // v2.1: branch で「none 以外を 1 つでも選んだら student_work_detail へ」を実装。
  {
    id: "student_work_exp",
    axis: "current",
    type: "multi",
    title: "実務に近い経験はありますか?(複数選択可)",
    description: "学業以外で社会との接点になった経験を選んでください。",
    required: true,
    choices: [
      { value: "parttime", label: "アルバイト" },
      { value: "intern", label: "インターン(企業・研究機関)" },
      {
        value: "startup",
        label: "学生起業・サークル運営・コンテスト出場",
      },
      {
        value: "freelance_light",
        label: "個人で受託・販売・発信",
      },
      { value: "none", label: "特になし" },
    ],
    // v2.1: none 以外を 1 つでも含めば自由記述派生へ、none のみは knowledge_fields に直行
    branch: (a) => {
      const v = a.student_work_exp;
      if (Array.isArray(v) && v.some((x) => typeof x === "string" && x !== "none")) {
        return "student_work_detail";
      }
      return "knowledge_fields";
    },
    // フォールバック(branch が undefined を返した場合の安全弁)
    next: "knowledge_fields",
  },

  // §3-6b. student_work_detail(学生実務経験の自由記述・MAY/textarea・v2.1 新規)
  {
    id: "student_work_detail",
    axis: "current",
    type: "textarea",
    title: "その経験について、もう少し具体的に教えてください(任意)",
    description:
      "どんな職場・業務・期間・成果だったかなど、一言で OK。個人を特定できる情報(店舗名・企業名フルネーム等)は書かないでください。",
    placeholder:
      "例: カフェのホールを週3で2年 / 旅行系スタートアップで2ヶ月インターン(マーケ補助)",
    required: false,
    next: "knowledge_fields",
  },

  // §3-7. employment_type(雇用形態・MUST・employed のみ)
  // v2.1: next を current_job_field に変更(雇用形態 → 職種 → 経験年数 の流れ)。
  {
    id: "employment_type",
    axis: "current",
    type: "single",
    title: "雇用形態は?",
    required: true,
    choices: [
      { value: "fulltime", label: "正社員" },
      { value: "public", label: "公務員" },
      { value: "contract", label: "契約社員" },
      { value: "dispatch", label: "派遣社員" },
      { value: "owner", label: "経営者・役員(法人)" },
      {
        value: "multi_job",
        label: "複業・パラレルキャリア(複数で生計)",
      },
      { value: "parttime_main", label: "パート(主たる収入源)" },
      { value: "other_emp", label: "その他" },
    ],
    next: "current_job_field",
  },

  // §3-7b. prior_work_exp(働いた経験ありなしのゲート質問・MUST・v2.1 新規)
  // 対象: housekeeper / parental_leave / on_leave / retired / other(各深掘り後または stage 直後)。
  // yes → current_job_field → years_employed → knowledge_fields
  // no  → 両方スキップして knowledge_fields に直行
  {
    id: "prior_work_exp",
    axis: "current",
    type: "single",
    title: "これまでに働いた経験はありますか?",
    description:
      "正社員に限らず、契約・派遣・アルバイト・副業・専業時代の経験も含めて構いません。",
    required: true,
    choices: [
      { value: "yes", label: "ある", next: "current_job_field" },
      { value: "no", label: "ない", next: "knowledge_fields" },
    ],
  },

  // §3-7c. current_job_field(現職または直近の職業・職種・MUST/text・v2.1 新規)
  // 対象: employed(employment_type の直後) / seeking(seeking_blank の直後) /
  //       housekeeper / parental_leave / on_leave / retired / other で prior_work_exp=yes 経由。
  // freeter / freelance は freeter_main_work / freelance_field で代替済みのため対象外。
  {
    id: "current_job_field",
    axis: "current",
    type: "text",
    title: "いま(または直近)の職業・職種を教えてください",
    description:
      "雇用形態や年数だけだと内容が分からないので一言で教えてください。業種ではなく職種(何の仕事をしているか / していたか)で OK。",
    placeholder: "例: 営業、Webデザイナー、看護師、経理",
    required: true,
    next: "years_employed",
  },

  // §3-8. years_employed(経験年数・MUST)
  {
    id: "years_employed",
    axis: "current",
    type: "single",
    title: "その分野での経験年数は?",
    description:
      "正社員に限らず、契約・派遣・副業・専業時代の経験も含めて構いません。ブランクも含めて通算で。",
    required: true,
    choices: [
      { value: "none", label: "未経験" },
      { value: "lt1", label: "1年未満" },
      { value: "1to3", label: "1〜3年" },
      { value: "3to5", label: "3〜5年" },
      { value: "5to10", label: "5〜10年" },
      { value: "gt10", label: "10年以上" },
    ],
    next: "knowledge_fields",
  },

  // §3-9. freeter_main_work(フリーターの主な仕事・MUST・freeter のみ)
  {
    id: "freeter_main_work",
    axis: "current",
    type: "text",
    title: "主にどんな仕事をしていますか?",
    description:
      "業種・職種を一言で。例: 飲食店ホール、コンビニ、配送、家庭教師 など。",
    placeholder: "例: 飲食店ホール",
    required: true,
    next: "years_employed",
  },

  // §3-10. freelance_field(フリーランスの事業内容・MUST・freelance のみ)
  {
    id: "freelance_field",
    axis: "current",
    type: "text",
    title: "主な事業内容を教えてください",
    description:
      "何で売上を立てているか。例: Web 制作、コンサル、ライティング、デザイン受託 など。",
    placeholder: "例: Web 制作受託",
    required: true,
    next: "years_employed",
  },

  // §3-11. seeking_blank(求職中のブランク期間・MUST・seeking のみ)
  // v2.1: next を current_job_field に変更(ブランク → 直近職種 → 経験年数 の流れ)。
  {
    id: "seeking_blank",
    axis: "current",
    type: "single",
    title: "直近の仕事を離れてからどのくらい経ちますか?",
    required: true,
    choices: [
      {
        value: "none_yet",
        label: "卒業/退職直後",
      },
      { value: "lt3m", label: "3ヶ月未満" },
      { value: "3to12m", label: "3ヶ月〜1年" },
      { value: "1to3y", label: "1〜3年" },
      { value: "gt3y", label: "3年以上" },
    ],
    next: "current_job_field",
  },

  // §3-12. parental_child_age(育休中・子の年齢・MUST・parental_leave のみ・機微)
  // v2.1: next を prior_work_exp に変更(出産前未就労ケースに備えてゲート質問を挟む)。
  {
    id: "parental_child_age",
    axis: "current",
    type: "single",
    title: "一番下のお子さんの年齢に近いのは?",
    description: "復職タイミングの目安の参考にします。",
    required: true,
    sensitiveNotice: true,
    choices: [
      { value: "pregnant", label: "妊娠中(出産前)" },
      { value: "under1", label: "0歳(1歳未満)" },
      { value: "1to2", label: "1〜2歳" },
      { value: "3to5", label: "3〜5歳" },
      { value: "6plus", label: "6歳以上" },
    ],
    next: "prior_work_exp",
  },

  // §3-13. on_leave_reason(休職理由・MUST・on_leave のみ・機微)
  // v2.1: next を prior_work_exp に変更(若年・未就労層に備えてゲート質問を挟む)。
  {
    id: "on_leave_reason",
    axis: "current",
    type: "single",
    title: "差し支えなければ、休職の主な理由は?",
    description:
      "大まかな種別だけ伺います。具体的な病名・続柄は書く必要はありません。",
    required: true,
    sensitiveNotice: true,
    choices: [
      { value: "health_phys", label: "体の健康上の理由" },
      { value: "health_mental", label: "心の健康上の理由" },
      { value: "family_care", label: "家族の事情(介護・看病など)" },
      { value: "other_leave", label: "その他" },
    ],
    next: "prior_work_exp",
  },

  // §3-14. retired_status(退職前後の状況・MUST・retired のみ)
  // v2.1: next を prior_work_exp に変更(専業主婦から定年到達のケースに備えてゲート質問を挟む)。
  {
    id: "retired_status",
    axis: "current",
    type: "single",
    title: "現在の状況は?",
    required: true,
    choices: [
      { value: "pre", label: "まだ在職中(退職予定)" },
      { value: "re_employ", label: "再雇用・嘱託で継続中" },
      { value: "early", label: "早期退職・定年退職済み" },
      { value: "looking", label: "退職後で次を探している" },
    ],
    next: "prior_work_exp",
  },

  // §3-15. other_note(その他の立場補足・MUST・other のみ・機微)
  // v2.1: next を prior_work_exp に変更(立場が多様なため働いた経験ありなしを聞く)。
  {
    id: "other_note",
    axis: "current",
    type: "textarea",
    title: "現在の立場・主な活動を一言で教えてください",
    description:
      "該当する選択肢がなかった方向け。具体的な事情を書ける範囲で。個人を特定できる情報は書かないでください。",
    placeholder:
      "例: 海外留学準備中 / NPO 活動中心 / 学生兼起業家",
    required: true,
    sensitiveNotice: true,
    next: "prior_work_exp",
  },

  // §3-16. knowledge_fields(知見のある分野・MUST multi・全員)
  {
    id: "knowledge_fields",
    axis: "current",
    type: "multi",
    title:
      "これまで学んだ・実務で得た知見のある分野はどれですか?(複数選択可)",
    description:
      "仕事にできるレベルの知識・経験 がある分野を選んでください(学習中・趣味で軽く触っただけのものは含めない)。AI が提案する進路の足場になります。当てはまるものがなければ「特になし」を選んでください。",
    required: true,
    choices: [
      {
        value: "it_web",
        label: "IT・Web(エンジニアリング以外も含む)",
      },
      {
        value: "software_dev",
        label: "ソフトウェア開発・プログラミング",
      },
      { value: "data_ai", label: "データ・AI・統計" },
      { value: "design_creative", label: "デザイン・クリエイティブ" },
      { value: "medical_care", label: "医療・看護・介護" },
      { value: "education", label: "教育・保育" },
      { value: "law_admin", label: "法律・行政" },
      { value: "finance_acc", label: "金融・会計" },
      {
        value: "manufacturing",
        label: "製造・エンジニアリング(機械・電気・化学など)",
      },
      { value: "construction", label: "建築・土木" },
      { value: "service", label: "サービス・接客" },
      { value: "sales_retail", label: "営業・販売" },
      { value: "marketing_pr", label: "マーケティング・PR" },
      { value: "hr_org", label: "人事・組織開発" },
      { value: "research", label: "研究・学術" },
      { value: "media", label: "メディア・出版" },
      { value: "art_music", label: "芸術・音楽" },
      { value: "agri_fish", label: "農林水産" },
      { value: "language", label: "語学" },
      { value: "none_kn", label: "特になし" },
      { value: "other_kn", label: "その他(自由記述)" },
    ],
    // other_kn を含む multi 回答時は派生質問へ、そうでなければ current_income へ
    branch: (a) => {
      const v = a.knowledge_fields;
      if (Array.isArray(v) && v.includes("other_kn")) {
        return "knowledge_fields_other";
      }
      return "current_income";
    },
  },

  // 派生質問: knowledge_fields_other(MAY・textarea)
  {
    id: "knowledge_fields_other",
    axis: "current",
    type: "textarea",
    title: "その他の知見のある分野を教えてください",
    description: "「その他」を選んだ方のみ。一言で OK(任意)。",
    placeholder: "例: 哲学 / 古典 / バイオ素材",
    required: false,
    next: "current_income",
  },

  // §3-17. current_income(現年収・MUST・全員)
  // v2.1: stage=student のとき education をスキップして直接 life_constraint に飛ばす。
  //       (school_type で既に在学中の校種が判明しているため二重質問を回避)
  {
    id: "current_income",
    axis: "current",
    type: "single",
    title: "現在のおおよその年収帯は?",
    description:
      "ロードマップの達成感(現状からの伸びしろ)の参考にします。回答そのものは保存しません。",
    required: true,
    choices: [
      {
        value: "none",
        label: "収入なし",
      },
      { value: "lt300", label: "〜300万円" },
      { value: "300to500", label: "300〜500万円" },
      { value: "500to700", label: "500〜700万円" },
      { value: "700to1000", label: "700〜1000万円" },
      { value: "gt1000", label: "1000万円以上" },
    ],
    // v2.1: 学生は education をスキップ
    branch: (a) => (a.stage === "student" ? "life_constraint" : "education"),
    // 安全弁: branch が undefined を返したときは従来通り education へ
    next: "education",
  },

  // §3-18. education(最終学歴・MUST・全員)
  {
    id: "education",
    axis: "current",
    type: "single",
    title: "最終学歴に近いのは?",
    description:
      "資格や応募要件の参考にします。学歴で進路を決めつけることはしません。",
    required: true,
    choices: [
      { value: "jh", label: "中学卒" },
      { value: "hs", label: "高校卒" },
      { value: "voc", label: "専門・短大・高専卒" },
      { value: "uni", label: "大学卒" },
      { value: "grad", label: "大学院卒" },
      { value: "studying", label: "在学中" },
    ],
    next: "life_constraint",
  },

  // §3-19. life_constraint(働き方の制約・MUST multi・全員・機微)
  {
    id: "life_constraint",
    axis: "current",
    type: "multi",
    title: "働き方に制約のある状況はありますか?(複数選択可)",
    description:
      "ロードマップの現実性(時間・移動可否)の参考にします。具体的な病名・続柄は書かないでください。保存もしません。",
    required: true,
    sensitiveNotice: true,
    choices: [
      { value: "health", label: "健康上の配慮" },
      { value: "caring_kids", label: "育児中" },
      {
        value: "caring_family",
        label: "介護中",
      },
      { value: "other", label: "その他" },
      { value: "none", label: "特になし" },
    ],
    next: "location",
  },

  // §3-20. location(現居住エリア・MUST・全員・機微)
  {
    id: "location",
    axis: "current",
    type: "single",
    title: "今はどのあたりに住んでいますか?",
    description:
      "ざっくりした粒度で大丈夫です。具体的な都道府県・地名は聞きません。",
    required: true,
    sensitiveNotice: true,
    choices: [
      {
        value: "metro",
        label: "三大都市圏(東京・名古屋・大阪)",
      },
      {
        value: "regional_city",
        label: "地方主要都市(政令市・県庁所在地)",
      },
      {
        value: "rural",
        label: "地方・郊外",
      },
      { value: "overseas", label: "海外在住" },
    ],
    next: "time_available",
  },

  // §3-21. time_available(投下できる時間・MUST・全員)
  {
    id: "time_available",
    axis: "current",
    type: "single",
    title: "キャリアのための学習・準備に使える時間は?",
    description: "ロードマップの密度を決めるために必須です。",
    required: true,
    choices: [
      { value: "lt1h", label: "1日1時間未満" },
      { value: "1to3h", label: "1日1〜3時間" },
      {
        value: "weekend",
        label: "週末にまとまって取れる",
      },
      {
        value: "flex",
        label: "フルタイムで集中できる",
      },
      { value: "unsure", label: "分からない" },
    ],
    next: "origin_freenote",
  },

  // §3-22. origin_freenote(現状の補足・MAY・自由記述・全員・機微)
  {
    id: "origin_freenote",
    axis: "current",
    type: "textarea",
    title: "現状について、伝えておきたいことがあれば(任意)",
    description:
      "立場の事情・選択肢に当てはまらないこと・配慮してほしいことなど。個人を特定できる情報は書かないでください。",
    placeholder:
      "例: 育休中で復職タイミングを模索中 / 大学院に進むか就職か迷っている",
    required: false,
    sensitiveNotice: true,
    next: "goal_clarity",
  },

  // ============================================================
  // 軸2: 目標(goal)— 既存維持
  // ============================================================
  {
    id: "goal_clarity",
    axis: "goal",
    type: "single",
    title: "目指したい方向は決まっていますか?",
    required: true,
    choices: [
      { value: "clear", label: "明確に決まっている", next: "goal_target" },
      { value: "vague", label: "なんとなくある", next: "goal_direction" },
      {
        value: "none",
        label: "まだ無い / これから探したい",
        next: "goal_direction",
      },
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

  // ============================================================
  // 軸3: 性格・価値観(personality)— 既存維持
  // ============================================================
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
    placeholder:
      "例: 家庭の事情で勤務地は限定したい、未経験だけど挑戦したい など",
    required: false,
    sensitiveNotice: true,
    next: null, // 終端
  },
];

/** 開始質問 ID。v2 では age が先頭。 */
export const FIRST_QUESTION_ID = "age";
