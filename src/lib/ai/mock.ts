import type { AIProvider } from "./types";
import type { AnswerMap } from "@/lib/schema/answers";
import { CareerPlanSchema, type CareerPlan, type RoadmapNode } from "@/lib/schema/result";

/**
 * 開発・テスト用の Mock プロバイダ。API キー不要・課金なし・即レス。
 * 回答を軽く反映した「それっぽい」構造化結果を返す。
 * 返す前に CareerPlanSchema で検証し、本物のプロバイダと同じ契約を守る。
 */
export class MockProvider implements AIProvider {
  readonly name = "mock";

  async generateCareerPlan(answers: AnswerMap): Promise<CareerPlan> {
    const field = strOf(answers.field) || "今の分野";
    const goalTarget = strOf(answers.goal_target);
    const stageLabel = STAGE_LABEL[strOf(answers.stage)] ?? "あなた";

    const currentLabel = goalLabelFromField(field, stageLabel);
    const goalLabel = goalTarget || directionGoalLabel(answers);
    const { durationText, roadmap } = buildRoadmap(answers, currentLabel, goalLabel);

    const plan: CareerPlan = {
      hero: {
        currentLabel,
        goalLabel,
        durationText,
        summary: `あなたの回答から最適化した、${durationText}のキャリア・トラジェクトリ。装飾は最小、進む道は最短で。`,
      },
      roadmap,
      candidates: buildCandidates(goalLabel),
      skills: {
        learning: [
          "目標分野の基礎インプット",
          "実務に近い小さな成果物づくり",
          "関連スキルのオンライン講座",
          "ロールモデルの発信を追う",
          "業界の用語・指標に慣れる",
        ],
        strengths: pickStrengths(answers),
      },
      nextAction: {
        title: "今日できる最小の一歩として、目標について15分だけ調べて3行メモを書く。",
        detail: "小さく始めるほど続きます。完璧を目指さず、まず手を動かすことが最短ルートです。",
      },
      personality: buildPersonality(answers),
    };

    // 本物のプロバイダと同じく、返す前に必ず Zod 検証する
    const validated = CareerPlanSchema.parse(plan);
    return validated;
  }
}

const STAGE_LABEL: Record<string, string> = {
  student: "学生",
  working: "社会人",
  changing: "キャリアチェンジ検討中",
  returning: "再スタート中",
};

function strOf(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.join(" / ");
  return "";
}

function clamp(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

function goalLabelFromField(field: string, stageLabel: string): string {
  return clamp(`${field}（${stageLabel}）`, 40);
}

function directionGoalLabel(answers: AnswerMap): string {
  const dir = answers.goal_direction;
  const map: Record<string, string> = {
    specialist: "専門性を極めたプロ",
    management: "チームを率いるリーダー",
    independent: "自立したフリーランス",
    stable: "安定したキャリア",
    social: "社会に貢献する仕事",
    creative: "ものづくりの担い手",
  };
  if (Array.isArray(dir) && dir.length > 0) {
    return clamp(map[dir[0]] ?? "理想のキャリア", 40);
  }
  return "これから見つける理想の姿";
}

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
          { timeLabel: "6M", periodText: "半年後" },
          { timeLabel: "2Y", periodText: "2年後" },
          { timeLabel: "4Y", periodText: "4年後" },
          { timeLabel: "GOAL", periodText: "目標" },
        ],
      };
    case "open":
      return {
        durationText: "自分のペースで",
        steps: [
          { timeLabel: "NOW", periodText: "今すぐ" },
          { timeLabel: "STEP", periodText: "次の段階" },
          { timeLabel: "GROW", periodText: "成長期" },
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
          { timeLabel: "1Y", periodText: "1年後" },
          { timeLabel: "3Y", periodText: "3年後" },
          { timeLabel: "GOAL", periodText: "目標" },
        ],
      };
  }
}

function buildRoadmap(
  answers: AnswerMap,
  currentLabel: string,
  goalLabel: string,
): { durationText: string; roadmap: RoadmapNode[] } {
  const { durationText, steps } = horizonInfo(answers);
  const bodies = [
    {
      title: "現在地を言語化する",
      description: `${currentLabel}としての強みと、これまでの経験を棚卸しして言葉にします。出発点をはっきりさせることが最初の一歩です。`,
    },
    {
      title: "土台となる知識を入れる",
      description: "目標に必要な基礎知識を、無理のない範囲でインプット。毎週少しずつ積み上げます。",
    },
    {
      title: "小さく実践してみる",
      description: "学んだことを使って、小さなアウトプットや実務に近い経験を1つ作ります。",
    },
    {
      title: "実績を広げ、つながりを作る",
      description: "成果を可視化し、目標に近い人とのつながりを増やして次のチャンスを引き寄せます。",
    },
    {
      title: `目標達成 ・ ${goalLabel}`,
      description: "あなたらしい価値の出し方が見えてきます。ここがゴールであり、新しいスタートでもあります。",
    },
  ];

  const n = steps.length;
  const roadmap: RoadmapNode[] = steps.map((s, i) => {
    const body = i === n - 1 ? bodies[bodies.length - 1] : bodies[Math.min(i, bodies.length - 2)];
    const kind: RoadmapNode["kind"] = i === 0 ? "start" : i === n - 1 ? "goal" : "milestone";
    return {
      timeLabel: s.timeLabel,
      periodText: s.periodText,
      title: clamp(body.title, 40),
      description: clamp(body.description, 200),
      kind,
    };
  });

  return { durationText, roadmap };
}

function buildCandidates(goalLabel: string) {
  return [
    {
      title: clamp(goalLabel, 40),
      description: "あなたの回答との相性が最も高い本命の進路。経験と価値観の両面から後押しできます。",
      matchPercent: 90,
      isTop: true,
    },
    {
      title: "関連する専門職",
      description: "目標に隣接する道。今の強みを活かしながら、別の角度から専門性を伸ばせます。",
      matchPercent: 76,
    },
    {
      title: "今の延長で伸ばす道",
      description: "現在の分野を深めて第一人者を目指すルート。安定感を重視するあなたにも向いています。",
      matchPercent: 68,
    },
  ];
}

function pickStrengths(answers: AnswerMap): string[] {
  const base = ["継続力", "学ぶ意欲", "素直さ"];
  const add: string[] = [];
  if (strOf(answers.work_style_pref) === "deep") add.push("探究心");
  if (strOf(answers.work_style_pref) === "wide") add.push("好奇心");
  if (strOf(answers.social_pref) === "team") add.push("協調性");
  if (strOf(answers.social_pref) === "solo") add.push("集中力");
  if (strOf(answers.risk_pref) === "risk") add.push("挑戦心");
  return [...add, ...base].slice(0, 5).map((s) => clamp(s, 20));
}

function buildPersonality(answers: AnswerMap): CareerPlan["personality"] {
  const deep = strOf(answers.work_style_pref) === "deep";
  const team = strOf(answers.social_pref) === "team";
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
