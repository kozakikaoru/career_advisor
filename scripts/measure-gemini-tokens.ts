/**
 * Gemini 2.5 Pro の実トークン数計測スクリプト。
 *
 * 目的: 本番と同条件(同 prompt / 同 responseSchema)で 1〜2 リクエストだけ投げて
 *       usageMetadata から実 token 数を取得し、月コストを正確に試算する。
 *
 * 使い方:
 *   vite-node scripts/measure-gemini-tokens.ts
 *   または
 *   node --import vite-node/register scripts/measure-gemini-tokens.ts
 *
 * 注意:
 * - GEMINI_API_KEY を process.env から読む(.env.local を Next.js は自動読込するが、
 *   このスクリプトは Node 直起動なので手動 export か dotenv 相当の読み込みが必要)。
 * - モデルは引数 or 定数で "gemini-2.5-pro" 直指定。GEMINI_MODEL env は **上書きしない**。
 * - 本番運用には影響なし(計測のみ・1〜2 req)。
 */
import { GoogleGenAI } from "@google/genai";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildPrompt } from "@/lib/ai/prompt";
import { GEMINI_RESPONSE_SCHEMA } from "@/lib/ai/gemini";
import type { AnswerMap } from "@/lib/schema/answers";

// ============================================================
// .env.local を最小読み込み(dotenv 不使用の自前パーサ)
// ============================================================
function loadEnvLocal(): void {
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    const text = readFileSync(envPath, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env.local なくても process.env から取れれば OK
  }
}
loadEnvLocal();

// ============================================================
// 計測対象モデル(env を上書きせず定数で直指定)
// ============================================================
const MODEL = "gemini-2.5-pro";

// ============================================================
// 価格 (2026 確認・USD per 1M tokens)
// ============================================================
const PRICE_INPUT_PER_M = 1.25; // $/1M tokens
const PRICE_OUTPUT_PER_M = 10.0; // $/1M tokens(candidates + thoughts)
const USD_JPY = 155;

// ============================================================
// Sample 1: 在職者(employed・標準的なキャリアチェンジ志向)
//   - ORIGIN/GOAL/MINDSET 全部入りに近い「重め」のリクエスト
// ============================================================
const SAMPLE_EMPLOYED: AnswerMap = {
  // ORIGIN
  age: 32,
  stage: "employed",
  employment_type: "regular",
  current_job_field: "Web エンジニア(バックエンド)",
  years_employed: "5to10",
  knowledge_fields: ["it_web", "software_dev"],
  current_income: "500to700",
  education: "uni_grad",
  life_constraint: ["none_constraint"],
  location: "東京都",
  time_available: "5to10",
  origin_freenote: "今の会社では裁量はあるが、技術的に伸び悩みを感じている",

  // GOAL
  change_intent: "career_change",
  change_direction: "career_change",
  chg_target_field: ["data_ai"],
  goal_workstyle: ["company"],
  goal_income: "800to1200",
  goal_horizon: "3y",
  goal_start_timing: "now",
  goal_commit: "20to50",
  goal_freenote: "AI・データ領域に踏み込んで市場価値を上げたい",

  // MINDSET
  leadership_role: "lead_want",
  social_pref: "team_strong",
  plan_style: "plan_first",
  unknown_field_jump: "jump_ok",
  change_attitude: "change_welcome",
  value_priority: ["growth", "freedom"],
  meaning_priority: "success_priority",
  competition_pref: "compete_motivated",
  risk_pref: "risk_take",
  learning_depth: "deep_focus",
  failure_recovery: "retry_fast",
  location_preference: "metro_pref",
  remote_preference: "hybrid_remote",
  wlb_priority: "wlb_balance",
};

// ============================================================
// Sample 2: 学生(student・進学先未定・キャリア探索中)
//   - 構造が違うフロー(student_*)を通る軽めのリクエスト
// ============================================================
const SAMPLE_STUDENT: AnswerMap = {
  // ORIGIN
  age: 20,
  stage: "student",
  school_type: "university",
  grade_uni: "u2",
  student_major: "経済学部",
  student_work_exp: "none_exp",
  knowledge_fields: ["finance_acc"],
  current_income: "none",
  location: "大阪府",
  time_available: "10plus",
  origin_freenote: "大学では経済を学んでいるが、データ分析や AI にも興味がある",

  // GOAL(学生フロー)
  student_goal_track: "job",
  student_job_status: "exploring",
  student_goal_industry: ["finance_acc", "data_ai"],
  goal_workstyle: ["company"],
  goal_income: "400to600",
  goal_horizon: "5y",
  goal_start_timing: "after_preparation",
  goal_commit: "lt20",
  goal_freenote: "金融とデータの掛け算で勝負したい",

  // MINDSET(部分のみ)
  leadership_role: "lead_neutral",
  social_pref: "team_strong",
  plan_style: "plan_first",
  unknown_field_jump: "jump_ok",
  change_attitude: "change_welcome",
  value_priority: ["growth", "stability"],
  meaning_priority: "success_priority",
  competition_pref: "compete_motivated",
  risk_pref: "balance",
  learning_depth: "wide_explore",
  failure_recovery: "retry_fast",
  location_preference: "metro_pref",
  remote_preference: "flexible",
  wlb_priority: "wlb_balance",
};

// ============================================================
// Sample 3: 主婦/主夫(ブランク 10 年・看護師目指す)
//   - 学生でも在職でもない第 3 のフロー(stage=parental_leave 等)で 503 / safety
//     等の発生を検証する
// ============================================================
const SAMPLE_HOMEMAKER: AnswerMap = {
  // ORIGIN
  age: 38,
  stage: "parental_leave",
  employment_type: "homemaker",
  years_employed: "none_exp",
  knowledge_fields: ["medical_care"],
  current_income: "none",
  education: "uni_grad",
  life_constraint: ["caring_kids"],
  location: "神奈川県",
  time_available: "lt5",
  origin_freenote: "子育てが落ち着いたら医療系の専門職に挑戦したい",

  // GOAL(社会人フロー)
  change_intent: "career_change",
  change_direction: "career_change",
  chg_target_field: ["medical_care"],
  goal_workstyle: ["company"],
  goal_income: "300to400",
  goal_horizon: "5y",
  goal_start_timing: "after_preparation",
  goal_commit: "20to50",
  goal_freenote: "看護師資格を取って病院で働きたい",

  // MINDSET
  leadership_role: "lead_neutral",
  social_pref: "team_strong",
  plan_style: "plan_first",
  unknown_field_jump: "jump_anxious",
  change_attitude: "change_neutral",
  value_priority: ["stability", "meaning"],
  meaning_priority: "meaning_priority",
  competition_pref: "compete_drain",
  risk_pref: "safe",
  learning_depth: "deep_focus",
  failure_recovery: "careful_after",
  location_preference: "keep_current",
  remote_preference: "office_pref",
  wlb_priority: "wlb_priority",
};

// ============================================================
// 計測関数
// ============================================================
interface MeasureResult {
  sampleName: string;
  promptChars: number;
  promptTokenCount: number;
  candidatesTokenCount: number;
  thoughtsTokenCount: number;
  totalTokenCount: number;
  elapsedMs: number;
  costUsd: number;
  costJpy: number;
}

async function measureOne(
  client: GoogleGenAI,
  sampleName: string,
  answers: AnswerMap,
): Promise<MeasureResult> {
  const prompt = buildPrompt(answers);
  const startedAt = Date.now();

  const res = await client.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: GEMINI_RESPONSE_SCHEMA,
      temperature: 0.7,
      maxOutputTokens: 8192,
      // 2026-06-02: 本番(gemini.ts)に合わせて thinkingBudget=4096 を明示。
      // 旧 -1(動的・無制限)では Pro が 115-130s タイムアウト多発のため、
      // 4096 に絞って品質維持 + 速度確保。
      thinkingConfig: { thinkingBudget: 4096 },
    },
  });

  const elapsedMs = Date.now() - startedAt;
  const u = res.usageMetadata ?? {};
  const promptTokenCount = u.promptTokenCount ?? 0;
  const candidatesTokenCount = u.candidatesTokenCount ?? 0;
  const thoughtsTokenCount = u.thoughtsTokenCount ?? 0;
  const totalTokenCount = u.totalTokenCount ?? 0;

  // Pro 価格: 入力 $1.25/1M, 出力 $10/1M(candidates + thoughts が課金対象)
  const inputCostUsd = (promptTokenCount * PRICE_INPUT_PER_M) / 1_000_000;
  const outputCostUsd =
    ((candidatesTokenCount + thoughtsTokenCount) * PRICE_OUTPUT_PER_M) /
    1_000_000;
  const costUsd = inputCostUsd + outputCostUsd;
  const costJpy = costUsd * USD_JPY;

  return {
    sampleName,
    promptChars: prompt.length,
    promptTokenCount,
    candidatesTokenCount,
    thoughtsTokenCount,
    totalTokenCount,
    elapsedMs,
    costUsd,
    costJpy,
  };
}

function fmtJpy(jpy: number): string {
  return `¥${jpy.toFixed(2)}`;
}

function printResult(r: MeasureResult): void {
  console.log("");
  console.log(`━━━ ${r.sampleName} ━━━`);
  console.log(`  prompt(chars):       ${r.promptChars.toLocaleString()}`);
  console.log(`  promptTokenCount:    ${r.promptTokenCount.toLocaleString()}`);
  console.log(`  candidatesTokenCount:${r.candidatesTokenCount.toLocaleString()}`);
  console.log(`  thoughtsTokenCount:  ${r.thoughtsTokenCount.toLocaleString()}`);
  console.log(`  totalTokenCount:     ${r.totalTokenCount.toLocaleString()}`);
  console.log(`  elapsed:             ${r.elapsedMs} ms`);
  console.log(`  cost(USD):           $${r.costUsd.toFixed(5)}`);
  console.log(`  cost(JPY @155):      ${fmtJpy(r.costJpy)}`);
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("ERROR: GEMINI_API_KEY が未設定です。.env.local を確認してください。");
    process.exit(1);
  }

  console.log(`[measure-gemini-tokens] model=${MODEL}`);
  console.log(`[measure-gemini-tokens] 価格: 入力 $${PRICE_INPUT_PER_M}/1M, 出力 $${PRICE_OUTPUT_PER_M}/1M (USD/JPY=${USD_JPY})`);

  const client = new GoogleGenAI({ apiKey });

  const results: MeasureResult[] = [];

  // sample 1: 在職者
  try {
    const r1 = await measureOne(client, "Sample 1: 在職者(employed)", SAMPLE_EMPLOYED);
    results.push(r1);
    printResult(r1);
  } catch (e) {
    console.error("");
    console.error("━━━ Sample 1 FAILED ━━━");
    if (e instanceof Error) {
      console.error(`  name: ${e.name}`);
      console.error(`  msg:  ${e.message}`);
    } else {
      console.error(`  error: ${String(e)}`);
    }
  }

  // sample 2: 学生
  try {
    const r2 = await measureOne(client, "Sample 2: 学生(student)", SAMPLE_STUDENT);
    results.push(r2);
    printResult(r2);
  } catch (e) {
    console.error("");
    console.error("━━━ Sample 2 FAILED ━━━");
    if (e instanceof Error) {
      console.error(`  name: ${e.name}`);
      console.error(`  msg:  ${e.message}`);
    } else {
      console.error(`  error: ${String(e)}`);
    }
  }

  // sample 3: 主婦/主夫(ブランク + 看護師目指す)
  try {
    const r3 = await measureOne(client, "Sample 3: 主婦/主夫(parental_leave)", SAMPLE_HOMEMAKER);
    results.push(r3);
    printResult(r3);
  } catch (e) {
    console.error("");
    console.error("━━━ Sample 3 FAILED ━━━");
    if (e instanceof Error) {
      console.error(`  name: ${e.name}`);
      console.error(`  msg:  ${e.message}`);
    } else {
      console.error(`  error: ${String(e)}`);
    }
  }

  // 平均 + 月コスト試算
  if (results.length > 0) {
    const avgCostJpy =
      results.reduce((acc, r) => acc + r.costJpy, 0) / results.length;
    const avgCostUsd =
      results.reduce((acc, r) => acc + r.costUsd, 0) / results.length;

    console.log("");
    console.log("━━━ 集計 ━━━");
    console.log(`  サンプル数:            ${results.length}`);
    console.log(`  平均 1 req コスト:     $${avgCostUsd.toFixed(5)} / ${fmtJpy(avgCostJpy)}`);
    console.log(`  月 1,000 req 試算:    ${fmtJpy(avgCostJpy * 1000)}`);
    console.log(`  月 2,000 req 試算:    ${fmtJpy(avgCostJpy * 2000)}`);
  } else {
    console.log("");
    console.log("計測成功した sample が無いため集計をスキップします。");
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
