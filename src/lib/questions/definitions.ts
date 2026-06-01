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
  // ---------- multi 型専用(type === "multi" の時のみ使用) ----------
  /**
   * MINDSET v2(specs/mindset-questions-v2.md §8-2 確定版)で追加した
   * multi の選択数上限。指定があれば Wizard 側で「上限到達時にトースト警告 +
   * 選択を拒否」する。未指定なら上限なし(既存 multi の挙動)。
   * 現状の利用箇所: `value_priority`(MUST 1〜3 個)。
   */
  maxSelect?: number;
}

/** 回答の保存形 */
export type AnswerValue = string | string[] | number;

// ============================================================
// 質問セット(specs/origin-questions-v2.md + specs/goal-questions-v2.md +
//             specs/mindset-questions-v2.md 確定版反映)
// 軸1 ORIGIN(現状, current) v2.1 / 軸2 GOAL v2.2(立場別分岐) /
// 軸3 MINDSET v2 確定版(15 問・全員フラット)
//
// ORIGIN は立場ごとに枝分かれる 32 問。実際に1人が辿る MUST は 11〜19 問。
// GOAL v2.2 は系統 A(現職持ち層)/ 系統 B(現職を持たない層)で分岐し、
// 共通フローと合わせて全 18 定義。1人が辿るのは 7〜13 問。
// MINDSET v2 は分岐なしの 15 問(MUST 14 + MAY 1)。全員同じ。
// 性格・価値観 + GOAL v2.2 §7 申し送り(location_preference / remote_preference /
// wlb_priority)を吸収。詳細は specs/mindset-questions-v2.md 参照。
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
  // GOAL v2 への入り口: stage + prior_work_exp + retired_status で系統 A/B を判定
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
    // GOAL v2 系統判定 (specs/goal-questions-v2.md §8-1)
    branch: (a) => {
      // 系統 B: 学生 → student_goal_track
      if (a.stage === "student") return "student_goal_track";
      // 系統 B: 退職者(完全退職組: early / looking) → second_career_intent
      if (
        a.stage === "retired" &&
        (a.retired_status === "early" || a.retired_status === "looking")
      ) {
        return "second_career_intent";
      }
      // 系統 B: 主婦・主夫等で prior_work_exp=no → new_entry_direction
      const noStageSet = new Set([
        "housekeeper",
        "parental_leave",
        "on_leave",
        "retired",
        "other",
      ]);
      if (
        typeof a.stage === "string" &&
        noStageSet.has(a.stage) &&
        a.prior_work_exp === "no"
      ) {
        return "new_entry_direction";
      }
      // それ以外はすべて系統 A → change_intent
      return "change_intent";
    },
    // フォールバック(stage 未確定時の安全弁): 系統 A の入り口
    next: "change_intent",
  },

  // ============================================================
  // 軸2: 目標(goal)— v2.2 全面再設計(specs/goal-questions-v2.md §3 参照)
  // 系統 A(現職持ち層): change_intent → change_direction → step_up_target / chg_target_field
  // 系統 B(現職を持たない層): student_goal_track / new_entry_direction / second_career_intent
  // 共通フロー: goal_workstyle(multi v2.2)→ goal_income → goal_horizon → goal_start_timing
  //          → goal_commit → goal_freenote
  // v2.2 主な変更: (1) goal_workstyle を single → multi(MUST 1個以上) /
  //                (2) goal_avoid を完全撤去(goal_start_timing.next を goal_commit に直接接続) /
  //                (3) goal_commit ラベルから括弧内の具体例を削除(description は維持)
  // ============================================================

  // §3-1. change_intent(系統 A・3 択 MUST)
  {
    id: "change_intent",
    axis: "goal",
    type: "single",
    title: "今のお仕事(または直近のお仕事)を、これからも続けていきたいですか?",
    description:
      "ここでは大きな方向だけ伺います。次の質問でもう少し具体的に分岐します。",
    required: true,
    choices: [
      {
        value: "continue",
        label: "続けたい(今の道で伸ばしたい)",
      },
      {
        value: "change",
        label: "変えたい(別の選択肢を探したい)",
      },
      { value: "undecided", label: "まだ迷っている" },
    ],
    // continue → step_up_target に直行 / change・undecided → change_direction
    branch: (a) => {
      if (a.change_intent === "continue") return "step_up_target";
      return "change_direction";
    },
  },

  // §3-2. change_direction(系統 A・3 択 MUST・条件付き)
  {
    id: "change_direction",
    axis: "goal",
    type: "single",
    title: "変えたい・迷っている方向はどちらに近いですか?",
    description:
      "大きな方向を選んでください。両方迷っている場合は「両方迷っている」で OK。",
    required: true,
    choices: [
      {
        value: "step_up",
        label: "今の職種・分野の延長で次のステップに進みたい",
        hint: "例: 同職種で別会社・昇進・独立",
      },
      {
        value: "career_change",
        label: "今と違う職種・分野に挑戦したい",
        hint: "例: 営業 → エンジニア / 看護師 → IT",
      },
      {
        value: "both_unsure",
        label: "両方迷っている(まだ決められない)",
      },
    ],
    // step_up → step_up_target / career_change → chg_target_field / both_unsure → 共通フロー直行
    branch: (a) => {
      if (a.change_direction === "step_up") return "step_up_target";
      if (a.change_direction === "career_change") return "chg_target_field";
      return "goal_workstyle";
    },
  },

  // §3-3. step_up_target(系統 A・4 択 MUST・条件付き)
  {
    id: "step_up_target",
    axis: "goal",
    type: "single",
    title: "今の分野で、これからどう伸ばしていきたいですか?",
    description:
      "専門・人をまとめる・独立・処遇改善 のいずれが近いですか。",
    required: true,
    choices: [
      {
        value: "specialist",
        label: "専門性を深めたい(より高度な技術・知見・資格を取りたい)",
      },
      {
        value: "management",
        label: "マネジメント・人をまとめる方向に進みたい",
      },
      {
        value: "independent_same",
        label: "同じ分野で独立・フリーランスに進みたい",
      },
      {
        value: "better_conditions",
        label: "同じ分野で待遇(給与・労働条件)を改善したい",
        hint: "例: 同職種で年収アップを狙う転職",
      },
    ],
    next: "goal_workstyle",
  },

  // §3-4. chg_target_field(系統 A・multi 21 択 MUST・条件付き)
  {
    id: "chg_target_field",
    axis: "goal",
    type: "multi",
    title: "興味のある分野はどれですか?(複数選択可)",
    description:
      "ORIGIN で聞いた「知見のある分野」とは別軸で、これから挑戦したい分野を選んでください。経験ゼロでも構いません。迷っている場合は「未定」を選択。",
    required: true,
    choices: [
      { value: "it_web", label: "IT・Web(エンジニアリング以外も含む)" },
      { value: "software_dev", label: "ソフトウェア開発・プログラミング" },
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
      { value: "other_chg", label: "その他" },
      { value: "undecided", label: "未定・これから探したい" },
    ],
    next: "goal_workstyle",
  },

  // §3-5. student_goal_track(系統 B / 学生・4 択 MUST・条件付き)
  // v2.1 改修: job / advance ともに進捗ステータス(student_job_status / student_advance_status)
  // を先に聞く(specs §8-10-2 / かおる修正2 対応)。
  {
    id: "student_goal_track",
    axis: "goal",
    type: "single",
    title: "卒業後の方向は、どれが一番近いですか?",
    description: "いま考えているもので OK。確定していなくても構いません。",
    required: true,
    choices: [
      { value: "job", label: "就職したい(働き先を探したい)" },
      { value: "advance", label: "進学したい(大学院・専門学校など)" },
      { value: "startup", label: "起業・独立したい" },
      { value: "undecided", label: "まだ決まっていない" },
    ],
    // v2.1: job → student_job_status / advance → student_advance_status /
    //       startup・undecided → 共通フロー直行
    branch: (a) => {
      if (a.student_goal_track === "job") return "student_job_status";
      if (a.student_goal_track === "advance") return "student_advance_status";
      return "goal_workstyle";
    },
  },

  // §3-5a-job. student_job_status(系統 B / 学生・job・7 択 MUST・v2.1 新規)
  // specs §3-5a-job。就活フェーズに応じた提案軸切替に使う(prompt.ts §8-5-2 (i-1))。
  {
    id: "student_job_status",
    axis: "goal",
    type: "single",
    title: "就職活動はどのあたりですか?",
    description:
      "今の進捗に近いものを一つ選んでください。AI 側で「これから絞り込む段階」「内定持ち」など段階に応じた提案を出し分けます。",
    required: true,
    choices: [
      {
        value: "exploring",
        label: "まだ業界・職種選びの段階(これから絞り込みたい)",
      },
      {
        value: "researching",
        label: "業界・職種は絞れてきた(情報収集・自己分析中)",
      },
      {
        value: "entry_started",
        label: "エントリー開始(プレエントリー・OB訪問・ES準備など)",
      },
      {
        value: "in_selection",
        label: "選考中(複数社の面接が進行中)",
      },
      {
        value: "offer_received",
        label: "内定がある(1社以上 確定済み・選考継続中含む)",
      },
      {
        value: "offer_accepted",
        label: "内定承諾済み(入社確定)",
      },
      {
        value: "not_started",
        label: "就活していない・進路未定",
      },
    ],
    next: "student_goal_industry",
  },

  // §3-5a-advance. student_advance_status(系統 B / 学生・advance・4 択 MUST・v2.1 新規)
  // specs §3-5a-advance。進学準備フェーズに応じた提案軸切替に使う(prompt.ts §8-5-2 (i-2))。
  // §9-v2.1-2 採択 A で `reconsidering` を撤去し 4 択化。進学迷いは Q1(student_goal_track)の
  // `undecided` で救済する設計。
  {
    id: "student_advance_status",
    axis: "goal",
    type: "single",
    title: "進学の準備はどのあたりですか?",
    description:
      "今の進捗に近いものを一つ選んでください。AI 側で「これから志望校を選ぶ段階」「合格・入学確定」など段階に応じた提案を出し分けます。",
    required: true,
    choices: [
      {
        value: "searching",
        label: "まだ進学先を検討中(志望分野を探している)",
      },
      {
        value: "target_decided",
        label: "志望校が決まっている(受験準備中)",
      },
      {
        value: "in_exam",
        label: "受験本番中(出願済み・結果待ち含む)",
      },
      {
        value: "admitted",
        label: "合格・入学確定(進学先決定)",
      },
    ],
    next: "student_goal_advance",
  },

  // §3-5b. student_goal_industry(系統 B / 学生・multi 21 択 MUST・条件付き)
  // v2.1 改修: 対象を student_goal_track ∈ {job, advance} に拡大(進学者にも卒業後の業界を聞く /
  // specs §3-5b / かおる修正1)。「その他」(other_field)選択時は other_field_text 派生に進む。
  {
    id: "student_goal_industry",
    axis: "goal",
    type: "multi",
    title: "目指したい業界・職種はどれに近いですか?(複数選択可)",
    description:
      "ORIGIN で聞いた「知見のある分野」と同じカテゴリ体系で選んでください。複数選択可。当てはまるものがなければ「その他」を選んで次の質問で自由記述してください。迷っている場合は「未定」を選択。進学を選んだ方も、卒業後に進みたい方向で構いません(まだ具体的に決まっていなければ「未定」で OK)。",
    required: true,
    choices: [
      { value: "it_web", label: "IT・Web(エンジニアリング以外も含む)" },
      { value: "software_dev", label: "ソフトウェア開発・プログラミング" },
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
      {
        value: "other_field",
        label: "その他(選択時は次の質問で自由記述)",
      },
      { value: "undecided", label: "未定・これから探したい" },
    ],
    // other_field を含む multi 回答時は派生質問へ、それ以外は共通フロー直行
    branch: (a) => {
      const v = a.student_goal_industry;
      if (Array.isArray(v) && v.includes("other_field")) {
        return "other_field_text";
      }
      return "goal_workstyle";
    },
  },

  // §3-5b-other. other_field_text(派生 text MUST / specs §3-5b-other)
  // ORIGIN の knowledge_fields → knowledge_fields_other と同じパターンだが、こちらは MUST。
  {
    id: "other_field_text",
    axis: "goal",
    type: "text",
    title: "「その他」で選んだ業界・職種を具体的に教えてください",
    description: "一言で OK。例: eスポーツ運営 / 公認会計士事務所 / 宇宙開発 など。",
    placeholder: "例: eスポーツ運営",
    required: true,
    next: "goal_workstyle",
  },

  // §3-5c. student_goal_advance(系統 B / 学生・text MUST・条件付き)
  // v2.1 改修: next を "goal_workstyle" → "student_goal_industry" に変更
  // (進学者にも卒業後の業界を聞く / specs §8-10-2 / かおる修正1)。
  {
    id: "student_goal_advance",
    axis: "goal",
    type: "text",
    title: "進学を考えている分野や学校種別を教えてください",
    description:
      "例: 大学院(情報系) / 海外の大学 / 専門学校(看護) / 法科大学院 など。一言で OK。合格・入学確定済みの方は、その学校・分野を書いてください。",
    placeholder: "例: 大学院(機械工学)",
    required: true,
    next: "student_goal_industry",
  },

  // §3-6. new_entry_direction(系統 B / 主婦主夫等 prior_work_exp=no・multi 21 択 MUST・条件付き)
  {
    id: "new_entry_direction",
    axis: "goal",
    type: "multi",
    title: "これから働いてみたい分野はどれに近いですか?(複数選択可)",
    description:
      "経験ゼロでも構いません。興味のあるカテゴリを選んでください。迷っている場合は「未定」を選択。",
    required: true,
    choices: [
      { value: "it_web", label: "IT・Web(エンジニアリング以外も含む)" },
      { value: "software_dev", label: "ソフトウェア開発・プログラミング" },
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
      { value: "other_new", label: "その他" },
      { value: "undecided", label: "未定・これから探したい" },
    ],
    next: "goal_workstyle",
  },

  // §3-7. second_career_intent(系統 B / 退職者 early/looking・5 択 MUST・条件付き)
  {
    id: "second_career_intent",
    axis: "goal",
    type: "single",
    title: "これからのセカンドキャリアでは、どんな方向を考えていますか?",
    description:
      "大きな方向だけ伺います。引退・趣味活動も含めて構いません。",
    required: true,
    choices: [
      {
        value: "re_employment",
        label: "再就職したい(同分野・別分野問わず)",
      },
      {
        value: "independent",
        label: "独立・コンサル・顧問など個人で活動したい",
      },
      {
        value: "community",
        label: "地域活動・NPO・ボランティアなど社会貢献中心に",
      },
      {
        value: "retire_hobby",
        label: "引退して趣味中心に(就労は最小限)",
      },
      { value: "undecided", label: "まだ決まっていない" },
    ],
    next: "goal_workstyle",
  },

  // §3-8. goal_workstyle(共通・7 択 MUST multi・「雇用形態に純化」/ v2.2 で multi 化)
  // v2.2: type を single → multi に変更(複業層・両立模索層を許容するため・MUST 1個以上選択)。
  // 既存 multi MUST(chg_target_field / knowledge_fields / life_constraint)と同じ動作・
  // 「未定・こだわらない」(undecided)は単独選択も OK。
  {
    id: "goal_workstyle",
    axis: "goal",
    type: "multi",
    title: "希望する働き方の形は?(複数選択可)",
    description:
      "雇用形態についての希望です。複数選択可。「リモート/出社」「ワークライフバランス」など環境面は別の質問(MINDSET)で伺います。",
    required: true,
    choices: [
      {
        value: "company",
        label: "会社員(正社員・契約・派遣など被雇用全般)",
      },
      { value: "public", label: "公務員" },
      { value: "freelance", label: "フリーランス・個人事業主" },
      { value: "startup", label: "起業・スタートアップを立ち上げる" },
      {
        value: "multi_job",
        label: "複業・パラレルキャリア(複数の収入源で生計)",
      },
      {
        value: "same_as_now",
        label: "今の雇用形態でOK",
        hint: "在職者・フリーランス・経営者向け",
      },
      { value: "undecided", label: "未定・こだわらない" },
    ],
    next: "goal_income",
  },

  // §3-9. goal_income(共通・9 択 MUST・no_answer 撤去 / 機微)
  {
    id: "goal_income",
    axis: "goal",
    type: "single",
    title: "目指したい年収帯は?",
    description:
      "現年収との比較で「現状維持志向」「大幅アップ志向」を判別してロードマップに反映します。「今と同じくらいで OK」は現年収を維持したい方向けです。",
    required: true,
    sensitiveNotice: true,
    choices: [
      {
        value: "same_as_now",
        label: "今と同じくらいで OK(現年収維持)",
      },
      { value: "lt200", label: "〜200万円" },
      { value: "200to300", label: "200〜300万円" },
      { value: "300to400", label: "300〜400万円" },
      { value: "400to600", label: "400〜600万円" },
      { value: "600to800", label: "600〜800万円" },
      { value: "800to1200", label: "800〜1200万円" },
      { value: "1200to2000", label: "1200〜2000万円" },
      { value: "gt2000", label: "2000万円以上" },
    ],
    next: "goal_horizon",
  },

  // §3-10. goal_horizon(共通・5 択 MUST)
  {
    id: "goal_horizon",
    axis: "goal",
    type: "single",
    title: "目標を実現したい期間はどれくらいですか?",
    description: "ロードマップの想定期間の目安にします。",
    required: true,
    choices: [
      { value: "1y", label: "1年くらい" },
      { value: "3y", label: "3年くらい" },
      { value: "5y", label: "5年くらい" },
      { value: "10y", label: "10年くらい(長期キャリア視野)" },
      { value: "open", label: "期限は決めていない" },
    ],
    next: "goal_start_timing",
  },

  // §3-11. goal_start_timing(共通・5 択 MUST / v2.1 改修・after_preparation 追加)
  // §9-v2.1-4 採択 C で確定ラベル。進学合格組(student_advance_status=admitted)の
  // 卒業後スタートだけでなく、社会人の「資格取得後」「育休明け」など準備期間後を
  // 表現できる汎用選択肢として 4 番目に追加。
  {
    id: "goal_start_timing",
    axis: "goal",
    type: "single",
    title: "動き出すタイミングは、どれが近いですか?",
    description:
      "「いつまでに」(前の質問)とは別に、「いつから動き出すか」を伺います。準備期間の設計に使います。学校の入学・卒業・資格取得・育休明けなど、決まったライフイベントを待ってから動き出す方は「数年後(進学卒業・資格取得・育休明けなど準備期間後)」を選んでください。",
    required: true,
    choices: [
      {
        value: "now",
        label: "今すぐ動きたい(数週間以内に何か始めたい)",
      },
      { value: "within_3m", label: "3ヶ月以内には動き出したい" },
      { value: "within_1y", label: "1年以内には動き出したい" },
      {
        value: "after_preparation",
        label:
          "数年後(進学卒業・資格取得・育休明けなど準備期間後)",
      },
      {
        value: "slow",
        label: "じっくり考えてから(数年スパンで構想中)",
      },
    ],
    // v2.2: goal_avoid 撤去に伴い next を goal_commit に直接接続
    next: "goal_commit",
  },

  // §3-12. goal_avoid — v2.2 で完全撤去
  // 理由: ほとんどの回答者が全選択肢にチェックを入れて差別化情報として機能しなかったため。
  // 旧 ID `goal_avoid` を送られたら answers.ts のホワイトリスト検証で 400(未定義 ID として弾く)。

  // §3-13. goal_commit(共通・7 択 MUST・中立表現 / 機微)
  // 重要: AI プロンプト側で「使い切る必要なし・最低限投資に絞る」制約を明文化する
  // (specs §8-5-2 (g)(h) / src/lib/ai/prompt.ts 参照)。
  {
    id: "goal_commit",
    axis: "goal",
    type: "single",
    title: "進路実現のために、初期投資としてかけられる金額の目安は?",
    description:
      "目標に向けた準備期間中の自己投資(教育・ツール・資格・転居等を含めた目安)です。※ あくまで「使える上限の目安」であり、必ず使い切る必要はありません。AI は最終目標の達成に最低限必要な投資だけを提案するため、余裕を持って多めに申告いただいても問題ありません。実際の支払い情報は保存しません。",
    required: true,
    sensitiveNotice: true,
    // v2.2: 選択肢ラベルから括弧内の具体例を削除(シンプル化)。description は維持。
    choices: [
      { value: "none", label: "0円" },
      { value: "lt5", label: "〜5万円" },
      { value: "5to20", label: "5〜20万円" },
      { value: "20to50", label: "20〜50万円" },
      { value: "50to100", label: "50〜100万円" },
      { value: "100to300", label: "100〜300万円" },
      { value: "gt300", label: "300万円以上" },
    ],
    next: "goal_freenote",
  },

  // §3-14. goal_freenote(共通・MAY/textarea・機微)
  {
    id: "goal_freenote",
    axis: "goal",
    type: "textarea",
    title: "目標について、伝えておきたいことがあれば(任意)",
    description:
      "選択肢に当てはまらないこと・もう少し具体的に書きたいこと・配慮してほしいことなど。個人を特定できる情報は書かないでください。",
    placeholder:
      "例: 起業したいが具体プロダクトは未定 / 看護師から助産師にステップアップしたい / 海外で働きたい",
    required: false,
    sensitiveNotice: true,
    // MINDSET v2 確定版: goal_freenote の次は MINDSET の最初の質問
    // (specs/mindset-questions-v2.md §8-1 / §8-3 接続)。
    next: "leadership_role",
  },

  // ============================================================
  // 軸3: 性格・価値観(personality)— v2 確定版 全面再設計
  // (specs/mindset-questions-v2.md §3 / §4 / §8 確定版 反映)
  //
  // v1 5 問 → v2 15 問(MUST 14 + MAY 1)に総入れ替え。
  // - 全員フラット(立場分岐なし)。
  // - A 群コア性格 5 + B 群価値観 3 + D 群リスク 1 + C 群学習 2 +
  //   E 群働き方 3 + F 群自由記述 1 の 6 群構成。
  // - 2 択 single は全廃 / すべて 3 択以上(`neither` を真ん中に置く)。
  // - `value_priority` は multi(MUST 1〜3 個 / maxSelect: 3 / トースト警告)。
  // - GOAL v2.2 §7 申し送り(location_preference / remote_preference /
  //   wlb_priority)を E 群で吸収。
  // ============================================================

  // §3-1. leadership_role(リーダー役への志向)【MUST・A群・3 択】
  {
    id: "leadership_role",
    axis: "personality",
    type: "single",
    title: "仕事で人をまとめる役は取りたいですか?",
    description:
      "「マネジメント / プロジェクトリード / グループの取りまとめ役」のような立場を想定してください。",
    required: true,
    choices: [
      {
        value: "lead_want",
        label: "取りたい(自分から手を挙げたい)",
      },
      {
        value: "lead_neutral",
        label: "必要なら取る(自分から手は挙げないが、頼まれれば引き受ける)",
      },
      {
        value: "lead_avoid",
        label: "できれば避けたい(個人で動きたい)",
      },
    ],
    next: "social_pref",
  },

  // §3-2. social_pref(チームか一人か)【MUST・A群・3 択 / v1 2 択を拡張】
  {
    id: "social_pref",
    axis: "personality",
    type: "single",
    title: "仕事の進め方として、どちらが力を発揮できますか?",
    description:
      "普段の働き方の好みです。「協働 / 集中」の質を知りたいだけで、コミュニケーション能力の高低を問うものではありません。",
    required: true,
    choices: [
      { value: "team_strong", label: "チームで協働しているとき" },
      { value: "mix", label: "両方(プロジェクトや日によって変えたい)" },
      { value: "solo_strong", label: "一人で集中しているとき" },
    ],
    next: "plan_style",
  },

  // §3-3. plan_style(計画派か行動派か)【MUST・A群・3 択】
  {
    id: "plan_style",
    axis: "personality",
    type: "single",
    title: "新しいことを始める時、どちらが近いですか?",
    description: "キャリアの動き出し方の好みです。",
    required: true,
    choices: [
      { value: "plan_first", label: "先に計画を立ててから動き出したい" },
      { value: "plan_balance", label: "計画と行動を行き来したい" },
      { value: "action_first", label: "まず動いて、走りながら考えたい" },
    ],
    next: "unknown_field_jump",
  },

  // §3-4. unknown_field_jump(未知への飛び込み)【MUST・A群・3 択 / v2 確定版 neither 追加】
  {
    id: "unknown_field_jump",
    axis: "personality",
    type: "single",
    title: "経験のない業界・職種に飛び込むことに、抵抗はありますか?",
    description:
      "「飛び込んだことがない」のと「飛び込みたくない」を分けて聞きます。「どちらともいえない」は「テーマや状況による」「強い傾向はない」を意味します(回答保留ではありません)。",
    required: true,
    choices: [
      { value: "jump_ok", label: "抵抗は少ない(未経験でも興味があれば飛び込める)" },
      {
        value: "neither",
        label: "どちらともいえない(テーマや状況による / 強い傾向はない)",
      },
      {
        value: "jump_anxious",
        label: "抵抗が強い(できれば経験のある分野で進みたい)",
      },
    ],
    next: "change_attitude",
  },

  // §3-5. change_attitude(変化への態度)【MUST・A群・3 択】
  {
    id: "change_attitude",
    axis: "personality",
    type: "single",
    title: "仕事や生活で「変化」が起こることに、どう感じますか?",
    description:
      "制度変更・部署異動・ツール刷新・引っ越し・組織再編 など、外から来る変化を想定してください。",
    required: true,
    choices: [
      { value: "change_welcome", label: "歓迎する(変化があると面白い)" },
      { value: "change_neutral", label: "どちらでもない(変化があれば適応する)" },
      { value: "change_dislike", label: "苦手(なるべく今のままが落ち着く)" },
    ],
    next: "value_priority",
  },

  // §3-6. value_priority(仕事で大事にしたいこと)【MUST・B群・multi MUST 1〜3 個】
  // v1 single → v2 multi 化 + maxSelect 3(かおる論点 v2-2 採択)。
  // Wizard 側で 4 個目選択時にトースト警告 + 選択拒否(specs §8-2-2)。
  {
    id: "value_priority",
    axis: "personality",
    type: "multi",
    title: "仕事で大事にしたいことを 3 つまで選んでください",
    description:
      "1 つでも 2 つでも 3 つでも OK。4 つ以上は選べません(優先順位を絞ってもらうため)。",
    required: true,
    maxSelect: 3,
    choices: [
      { value: "stability", label: "安定(雇用・収入・生活の安定)" },
      { value: "growth", label: "成長・挑戦(スキルや経験を伸ばしたい)" },
      { value: "freedom", label: "自由・裁量(時間や場所・進め方の自由)" },
      { value: "relation", label: "人との関わり(同僚・顧客・社会との接点)" },
      { value: "meaning", label: "社会的意義(役に立っている実感)" },
      { value: "reward", label: "報酬(対価としての高い収入)" },
    ],
    next: "meaning_priority",
  },

  // §3-7. meaning_priority(意義 vs 成功)【MUST・B群・3 択】
  {
    id: "meaning_priority",
    axis: "personality",
    type: "single",
    title: "あえて並べるなら、仕事に求めるのは「意義」と「成功」どちら?",
    description:
      "二者択一を強制するのは「優先順位の傾き」を取りたいため。両立を否定するものではありません。",
    required: true,
    choices: [
      {
        value: "meaning_priority",
        label: "意義(社会の役に立つ・誰かを助ける実感が大事)",
      },
      { value: "balance", label: "両立を狙いたい(どちらも大事)" },
      {
        value: "success_priority",
        label: "成功(経済的・社会的に評価されることが大事)",
      },
    ],
    next: "competition_pref",
  },

  // §3-8. competition_pref(競争心)【MUST・B群・3 択 / v2 確定版 neither 追加】
  {
    id: "competition_pref",
    axis: "personality",
    type: "single",
    title: "他人と比べて評価される環境はどう感じますか?",
    description:
      "営業ノルマ・売上ランキング・年次評価ランキング・コンペ・コンテスト等を想定してください。「どちらともいえない」は「環境や評価軸による」「強い傾向はない」を意味します(回答保留ではありません)。",
    required: true,
    choices: [
      {
        value: "compete_motivated",
        label: "燃える(競争があるほうがやる気が出る)",
      },
      {
        value: "neither",
        label: "どちらともいえない(環境や評価軸による / 強い傾向はない)",
      },
      {
        value: "compete_drain",
        label: "疲れる(マイペースのほうが力を発揮できる)",
      },
    ],
    next: "risk_pref",
  },

  // §3-9. risk_pref(リスク選好)【MUST・D群・3 択 / v1 2 択を拡張】
  {
    id: "risk_pref",
    axis: "personality",
    type: "single",
    title: "進路選択で「安定」と「リスクを取る」、どちらに傾きますか?",
    description:
      "例えば「大手で安定 vs スタートアップ・独立」「資格職で安定 vs 自分のビジネス」など。",
    required: true,
    choices: [
      { value: "safe", label: "安定を重視する(リスクは最小化したい)" },
      {
        value: "risk_balance",
        label: "バランス(リスクは限定したいが、伸び代も欲しい)",
      },
      {
        value: "risk_take",
        label: "リスクを取って大きく狙う(上振れを優先)",
      },
    ],
    next: "learning_depth",
  },

  // §3-10. learning_depth(学習スタイル)【MUST・C群・3 択 / v1 work_style_pref を改名拡張】
  {
    id: "learning_depth",
    axis: "personality",
    type: "single",
    title: "新しいスキルを学ぶ時、どちらに傾きますか?",
    description:
      "スキル習得のスタイルです。今すでに学んでいるかどうかは問いません。",
    required: true,
    choices: [
      {
        value: "deep_focus",
        label: "1 つをコツコツ深掘りしたい(専門家を目指す方向)",
      },
      {
        value: "mix_learning",
        label: "1〜2 個を中心に、関連分野も広げたい",
      },
      {
        value: "wide_explore",
        label: "興味のあるものを次々試したい(広く触れて選びたい)",
      },
    ],
    next: "failure_recovery",
  },

  // §3-11. failure_recovery(失敗からの立ち直り)【MUST・C群・3 択 / v2 確定版 neither 追加】
  {
    id: "failure_recovery",
    axis: "personality",
    type: "single",
    title: "仕事で失敗した時、自分はどちらのタイプですか?",
    description:
      "立ち直る速さや学び方の傾向です。「どちらともいえない」は「失敗の種類による」「両方の側面がある」を意味します(回答保留ではありません)。",
    required: true,
    choices: [
      {
        value: "retry_fast",
        label: "切り替えて次に行ける(失敗は学びと捉えて再挑戦)",
      },
      {
        value: "neither",
        label: "どちらともいえない(失敗の種類による / 両方の側面がある)",
      },
      {
        value: "careful_after",
        label: "一度引きずる(同じ失敗を避けるため慎重になる)",
      },
    ],
    next: "location_preference",
  },

  // §3-12. location_preference(勤務地希望)【MUST・E群・5 択 / GOAL v2.2 §7 申し送り】
  {
    id: "location_preference",
    axis: "personality",
    type: "single",
    title: "働く場所として希望するのはどこですか?",
    description:
      "現在の居住地(ORIGIN の現居住エリア)とは別に、これから働きたい・働き続けたい場所の希望を選んでください。",
    required: true,
    choices: [
      {
        value: "keep_current",
        label: "今住んでいる地域で働きたい(転居はしたくない)",
      },
      {
        value: "metro_pref",
        label: "都市部で働きたい(三大都市圏・地方主要都市)",
      },
      {
        value: "rural_pref",
        label: "地方・郊外で働きたい(現在都市部にいる人の地方移住含む)",
      },
      { value: "overseas_pref", label: "海外で働きたい" },
      { value: "anywhere", label: "場所はこだわらない" },
    ],
    next: "remote_preference",
  },

  // §3-13. remote_preference(リモート / 出社の希望)【MUST・E群・5 択 / GOAL v2.2 §7 申し送り】
  {
    id: "remote_preference",
    axis: "personality",
    type: "single",
    title: "出社 / リモート の希望はどれですか?",
    description: "現職の現状ではなく、これからの希望を選んでください。",
    required: true,
    choices: [
      { value: "office_pref", label: "出社中心がよい(対面で働きたい)" },
      {
        value: "hybrid_office",
        label: "ハイブリッド・出社多め(週 3 以上出社)",
      },
      {
        value: "hybrid_remote",
        label: "ハイブリッド・リモート多め(週 3 以上リモート)",
      },
      { value: "remote_full", label: "完全リモート希望" },
      { value: "flexible", label: "こだわらない(業務都合に合わせられる)" },
    ],
    next: "wlb_priority",
  },

  // §3-14. wlb_priority(仕事と私生活のバランス)【MUST・E群・3 択】
  // GOAL.goal_avoid 撤去(v2.2)の代替フィルタ。長時間労働回避は wlb_priority=wlb_priority で判定。
  {
    id: "wlb_priority",
    axis: "personality",
    type: "single",
    title: "仕事と私生活のバランスは、どちらに傾けたいですか?",
    description: "「バランスを取りたい」を選んでも構いません。",
    required: true,
    choices: [
      {
        value: "wlb_priority",
        label: "私生活を優先したい(時間の余裕・趣味・家族の時間を確保)",
      },
      {
        value: "wlb_balance",
        label: "バランスを取りたい(どちらも犠牲にしたくない)",
      },
      {
        value: "work_priority",
        label: "仕事に没頭したい(プライベートより仕事の時間に投資)",
      },
    ],
    next: "mindset_freenote",
  },

  // §3-15. mindset_freenote(性格・価値観の自由記述)【MAY・F群・textarea / v1 free_note 改名】
  {
    id: "mindset_freenote",
    axis: "personality",
    type: "textarea",
    title: "性格・価値観について、伝えておきたいことがあれば(任意)",
    description:
      "選択肢に当てはまらないこと・補足したいこと・配慮してほしいことなど。個人を特定できる情報・機微情報(政治信条・宗教・健康詳細など)は書かないでください。",
    placeholder:
      "例: 集団行動は苦手だが 1 対 1 では話せる / 完璧主義で時間がかかる / 朝が苦手なので夜型の働き方が合う",
    required: false,
    sensitiveNotice: true,
    next: null, // MINDSET 最終問・終端
  },
];

/** 開始質問 ID。v2 では age が先頭。 */
export const FIRST_QUESTION_ID = "age";
