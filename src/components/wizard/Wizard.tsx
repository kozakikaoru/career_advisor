"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  QUESTION_SET,
  getQuestion,
  getNextQuestionId,
  getProgress,
  pruneAnswers,
} from "@/lib/questions";
import type { QuestionSet } from "@/lib/questions";
import type { AnswerMap, AnswerValue } from "@/lib/schema/answers";
import { ConsentGate } from "./ConsentGate";
import { QuestionStep } from "./QuestionStep";
import { ProgressBar } from "./ProgressBar";
import { GeneratingView } from "./GeneratingView";
import { Logo } from "@/components/ui/Logo";
import { MonthlyLimitView } from "@/components/RateLimit/MonthlyLimitView";
import { RateLimitView } from "@/components/RateLimit/RateLimitView";

const set = QUESTION_SET;

type Phase =
  | "consent"
  | "asking"
  | "generating"
  | "finalizing"
  | "error"
  | "monthly_limit"
  | "rate_limit";

/** 100% 達成演出から router.push までのホールド秒数(ms)。
 *  「結果完成 → 眩しいフラッシュ → 結果画面」の流れを体感させるため、
 *  バーが 100% に着地する 500ms + 演出を見せる時間として 1.8s 取る。 */
const FINALIZE_HOLD_MS = 1800;

/**
 * /api/generate がレート制限関連エラーで返してきた JSON 形(API 側と一致させる)。
 * 該当しないキーが欠けることもあるので optional。
 */
type RateLimitResponse = {
  error?: string;
  limit?: number;
  count?: number;
  resetAt?: string;
  retryAfterSec?: number;
};

// TODO(temp): MINDSET 確認完了後に削除予定
// (specs/mindset-questions-v2.md §8-9 / 一時機能・URL を知っている人だけが使う開発用)
// MINDSET セクションの最初の質問 ID(direct-start 用)。
const DEV_MINDSET_START_ID = "leadership_role";

// TODO(temp): MINDSET 確認完了後に削除予定
// MINDSET v2 直通モードで自動投入する ORIGIN + GOAL のダミー回答。
// 「最小限の整合性が取れる値」のみ。本番に発見されてもユーザー視点は通常診断と同等。
// 系統 A(employed / continue / specialist)+ 知見=IT・Web の minimal path。
const DEV_MINDSET_DUMMY_ANSWERS: AnswerMap = {
  // ORIGIN
  age: 30,
  stage: "employed",
  employment_type: "fulltime",
  current_job_field: "dev",
  years_employed: "3to5",
  knowledge_fields: ["it_web"],
  current_income: "500to700",
  education: "uni",
  life_constraint: ["none"],
  location: "metro",
  time_available: "1to3h",
  // GOAL v2.2 系統 A: continue → step_up_target=specialist
  change_intent: "continue",
  step_up_target: "specialist",
  goal_workstyle: ["company"],
  goal_income: "600to800",
  goal_horizon: "3y",
  goal_start_timing: "now",
  goal_commit: "lt5",
};

// TODO(temp): 確認完了後に削除予定(?dev=submit ショートカット)
// MINDSET 最後の質問(mindset_freenote)まで自動入力して即「結果を生成する」を押せる状態で開始。
// 既存 `?dev=mindset` が「MINDSET 15 問を手で入力」なのを、毎回の動作確認で更に時短するためのもの。
// かおる本人ペルソナ(2026-06-02 反映):
// 「30 歳・フリーランス・バックエンドエンジニア 5〜10 年 / 福岡 / 起業志向の career_change」
// definitions.ts の branch を実際に辿れる構成のみを含める。
const DEV_SUBMIT_PREFILL_ANSWERS: AnswerMap = {
  // ===== ORIGIN(freelance ルート)=====
  age: 30,
  stage: "freelance",
  freelance_field: "バックエンドエンジニア",
  years_employed: "5to10",
  knowledge_fields: ["it_web", "software_dev", "data_ai"],
  // ORIGIN の current_income(GOAL の goal_income とは値域が違う)
  current_income: "500to700",
  education: "voc", // 専門卒
  life_constraint: ["none"],
  location: "regional_city", // 福岡 = 政令市
  time_available: "1to3h",
  origin_freenote:
    "今の仕事に限界を感じていて、違う仕事がしたいと考えている。知識が活かせればいいが、エンジニアは知識の限界。",

  // ===== GOAL(系統 A: change → career_change → chg_target_field)=====
  change_intent: "change",
  change_direction: "career_change",
  chg_target_field: [
    "software_dev",
    "data_ai",
    "design_creative",
    "other_chg",
    "undecided",
  ],
  goal_workstyle: ["startup"],
  goal_income: "1200to2000",
  goal_horizon: "1y",
  goal_start_timing: "within_1y",
  goal_commit: "lt5",
  goal_freenote:
    "漠然と起業したいと思っているが内容は未定。自分のサービスのためなら開発業務も厭わないが、開発を生業にするのもなぁという感じ。趣味のカードゲームを活かして、デッキケース販売などを考えたこともあるが、資金がないことと、工場がうまく見つからず断念。なんでもやってみたい。",

  // ===== MINDSET(A〜E 群 14 問。最後の mindset_freenote だけ入力画面で表示)=====
  leadership_role: "lead_want", // 取りたい
  social_pref: "team_strong", // チーム
  plan_style: "plan_first", // 計画派
  unknown_field_jump: "jump_ok", // 抵抗少
  change_attitude: "change_welcome", // 歓迎
  value_priority: ["growth", "stability", "reward"], // 成長・安定・報酬
  meaning_priority: "success_priority", // 成功寄り
  competition_pref: "compete_motivated", // 燃える
  risk_pref: "safe", // 安定
  learning_depth: "wide_explore", // 広く試す
  failure_recovery: "careful_after", // 引きずる
  location_preference: "keep_current", // 今の地域維持
  remote_preference: "flexible", // こだわらない
  wlb_priority: "wlb_balance", // 同じくらい
  // mindset_freenote(MAY / 最後の質問)→ ここを入力画面で表示する
};

// TODO(temp): 確認完了後に削除予定 — ?dev=submit 用の開始質問 ID(MINDSET の最終問)
const DEV_SUBMIT_START_ID = "mindset_freenote";

// TODO(temp): 確認完了後に削除予定(?dev=submit_hs ショートカット — 普通科高2・将来未定ペルソナ)
// 既存 `?dev=submit`(30 歳・フリーランス起業志向)の対極として、若年・進路未定の動作確認用に
// MINDSET 最後の質問(mindset_freenote)まで自動入力して即「結果を生成する」を押せる状態で開始。
// ペルソナ:
// 「17 歳・普通科高2・文理未選択 / 地方主要都市 / 進路自体未定(進学・就職・起業すら決められない)」
// 系統 B(学生・student_goal_track=undecided)→ MINDSET 14 問は安定/迷い層プロファイル。
// definitions.ts の branch を実際に辿れる構成のみを含める(辿らない ID = change_intent /
// change_direction 等は意図的に含めない。pruneAnswers で除去されるが Wizard 起動時の history 構築で
// 余計な ID を踏まないようにするため)。
const DEV_SUBMIT_HS_PREFILL_ANSWERS: AnswerMap = {
  // ===== ORIGIN(student → high_school → hs2 ルート)=====
  age: 17,
  stage: "student",
  school_type: "high_school",
  grade_hs: "hs2",
  student_major: "普通科(文理未選択)",
  // 実務経験なし → student_work_detail を踏まずに knowledge_fields に直行
  student_work_exp: ["none"],
  // 仕事にできるレベルの知見は無し
  knowledge_fields: ["none_kn"],
  // 学生なので current_income は「収入なし」。current_income branch で stage=student →
  // education をスキップして直接 life_constraint へ。
  current_income: "none",
  life_constraint: ["none"],
  location: "regional_city",
  time_available: "1to3h",
  origin_freenote:
    "文系か理系かもまだ決められていなくて、進路の話題はちょっと苦手です。",

  // ===== GOAL(系統 B / 学生 → student_goal_track=undecided → 共通フロー直行)=====
  // student_goal_track=undecided は branch で goal_workstyle に直行するため
  // student_job_status / student_advance_status / student_goal_industry 等は通らない。
  student_goal_track: "undecided",
  // 雇用形態の希望(無難な複数選択)
  goal_workstyle: ["company", "public"],
  goal_income: "300to400", // 普通に暮らせる程度
  goal_horizon: "5y", // 高校生は中長期で
  goal_start_timing: "after_preparation", // 進学・卒業後を待つ
  goal_commit: "lt5", // お小遣いレベル
  goal_freenote:
    "親や先生に「将来どうしたいの」と聞かれても、まだ答えられません。やりたいことが見つからなくて焦っています。",

  // ===== MINDSET(A〜E 群 14 問。最後の mindset_freenote だけ入力画面で表示)=====
  leadership_role: "lead_neutral", // 必要なら取る
  social_pref: "mix", // どちらともいえない
  plan_style: "plan_balance", // 計画と行動を行き来する
  unknown_field_jump: "jump_anxious", // 抵抗が強い(未知への不安)
  change_attitude: "change_neutral", // どちらともいえない
  value_priority: ["stability", "freedom"], // 安定 + 自由
  meaning_priority: "balance", // どちらともいえない
  competition_pref: "neither", // どちらともいえない
  risk_pref: "safe", // 安定重視
  learning_depth: "mix_learning", // どちらともいえない
  failure_recovery: "neither", // どちらともいえない
  location_preference: "keep_current", // 地元志向
  remote_preference: "flexible", // こだわらない
  wlb_priority: "wlb_balance", // 同じくらい
  // mindset_freenote(MAY / 最後の質問)→ ここを入力画面で表示する
};

// TODO(temp): 確認完了後に削除予定 — ?dev=submit_hs 用の開始質問 ID(MINDSET の最終問)
const DEV_SUBMIT_HS_START_ID = "mindset_freenote";

// TODO(temp): 確認完了後に削除予定 — ?dev=submit 用の history(訪問済み履歴)を構築。
// firstId から answers を辿り、開始位置の手前までの ID 列を返す(順序付き)。
// 開始位置 ID 自体は含めない(currentId は別途 state で保持される)。
// 開始位置に到達できなかった場合は履歴を返さない(getVisitedIds と同様にループガード付き)。
function buildHistoryUpTo(
  set: QuestionSet,
  answers: AnswerMap,
  targetId: string,
): string[] {
  const out: string[] = [];
  let id: string | null = set.firstId;
  const limit = set.questions.length + 1;
  for (let i = 0; id && i < limit; i++) {
    if (id === targetId) return out;
    if (out.includes(id)) return out; // 循環ガード
    out.push(id);
    id = getNextQuestionId(set, id, answers);
  }
  return out;
}

export function Wizard() {
  const router = useRouter();
  // TODO(temp): MINDSET 確認完了後に削除予定 — searchParams 取得は通常診断には不要
  const searchParams = useSearchParams();
  const devMode = searchParams?.get("dev");
  // TODO(temp): 確認完了後に削除予定 — `?dev=submit_hs`(普通科高2・将来未定ペルソナ)は
  //   `?dev=submit`(30 歳起業志向ペルソナ)よりも具体的なペルソナのため最優先。
  //   同時指定された場合(`?dev=submit_hs&dev=...` の重複や、`?dev=submit` と並べた場合)は
  //   submit_hs が勝つ。`?dev=mindset` と同時指定された場合も submit_hs / submit が優先。
  const isDevSubmitHs = devMode === "submit_hs";
  const isDevSubmit = !isDevSubmitHs && devMode === "submit";
  const isDevAnySubmit = isDevSubmitHs || isDevSubmit;
  const isDevMindset = !isDevAnySubmit && devMode === "mindset";
  // レート制限の 503 / 429 画面を単独確認するための dev フラグ。
  // `?dev=ratelimit_monthly` → 月次上限画面 / `?dev=ratelimit_429` → 短期窓レート画面
  // (本番にバレてもダミーデータが表示されるだけで悪用余地なし)
  const isDevMonthly = devMode === "ratelimit_monthly";
  const isDevRate = devMode === "ratelimit_429";
  // 生成中ローディング画面を単独確認するための dev フラグ。
  // `?dev=loading`  → loading 状態(2.5 分かけて 0→95%)
  // `?dev=success`  → finalizing 状態(95→100% 演出)
  // `?dev=load_err` → エラー停止状態
  // (本番にバレても画面が表示されるだけで悪用余地なし)
  const isDevLoading = devMode === "loading";
  const isDevSuccess = devMode === "success";
  const isDevLoadErr = devMode === "load_err";

  const [phase, setPhase] = useState<Phase>(() => {
    if (isDevMonthly) return "monthly_limit";
    if (isDevRate) return "rate_limit";
    if (isDevLoading || isDevLoadErr) return "generating";
    if (isDevSuccess) return "finalizing";
    // TODO(temp): 確認完了後に削除予定 — dev=submit / submit_hs は ConsentGate を自動通過(毎回チェックを入れる手間を省くため)
    if (isDevAnySubmit) return "asking";
    return "consent";
  });
  // TODO(temp): 確認完了後に削除予定 — dev=submit / submit_hs は consent=true として開始(submit() の二重ガードを通すため)
  const [consent, setConsent] = useState(isDevAnySubmit);
  // TODO(temp): 確認完了後に削除予定 — dev=submit_hs は高校生ペルソナを prefill /
  //   dev=submit は 30 歳ペルソナを prefill / dev=mindset は ORIGIN+GOAL のみダミー投入
  const [answers, setAnswers] = useState<AnswerMap>(() => {
    if (isDevSubmitHs) return { ...DEV_SUBMIT_HS_PREFILL_ANSWERS };
    if (isDevSubmit) return { ...DEV_SUBMIT_PREFILL_ANSWERS };
    if (isDevMindset) return { ...DEV_MINDSET_DUMMY_ANSWERS };
    return {};
  });
  // TODO(temp): 確認完了後に削除予定 — dev=submit / submit_hs は mindset_freenote から /
  //   dev=mindset は MINDSET 先頭から
  const [currentId, setCurrentId] = useState<string>(() => {
    if (isDevSubmitHs) return DEV_SUBMIT_HS_START_ID;
    if (isDevSubmit) return DEV_SUBMIT_START_ID;
    if (isDevMindset) return DEV_MINDSET_START_ID;
    return set.firstId;
  });
  // TODO(temp): 確認完了後に削除予定 — dev=submit / submit_hs のとき history を
  //   「ORIGIN→GOAL→MINDSET 14 問」で初期化(進捗バーの ProgressSnapshot が
  //   「ORIGIN/GOAL は完了済み・MINDSET の最後の 1 問だけ残っている」状態を正しく表示するため。
  //   getProgress は history+currentId からセクション内位置を計算する)。
  const [history, setHistory] = useState<string[]>(() => {
    if (isDevSubmitHs) {
      return buildHistoryUpTo(set, DEV_SUBMIT_HS_PREFILL_ANSWERS, DEV_SUBMIT_HS_START_ID);
    }
    if (isDevSubmit) {
      return buildHistoryUpTo(set, DEV_SUBMIT_PREFILL_ANSWERS, DEV_SUBMIT_START_ID);
    }
    return [];
  });
  // レート制限関連の表示用 state(API から返ってきたデータを保持)
  // dev フラグ時はダミー値を初期投入してその場で 503 / 429 画面を表示する。
  const [monthlyInfo, setMonthlyInfo] = useState<{
    limit: number;
    count: number;
    resetAt: string | null;
  } | null>(
    isDevMonthly
      ? {
          limit: 2000,
          count: 2000,
          resetAt: new Date(
            // JST 翌月 1 日 00:00 を雑にローカル時刻 +35 日で代用(表示確認用)
            Date.now() + 35 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        }
      : null,
  );
  const [rateInfo, setRateInfo] = useState<{ retryAfterSec: number } | null>(
    isDevRate ? { retryAfterSec: 600 } : null,
  );

  // 質問遷移・フェーズ遷移のたびにページトップへスクロール
  // (前の質問のスクロール位置が引き継がれて気持ち悪いのを防ぐ)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentId, phase]);

  // 診断中の離脱防止。
  // - asking / generating / finalizing フェーズで離脱を試みたら警告する
  // - beforeunload(タブを閉じる・リロード)→ ブラウザネイティブの確認ダイアログ
  // - popstate(ブラウザバック)→ confirm() を出し、キャンセル時は history.pushState で URL を戻す
  //
  // 注意点:
  // - consent / monthly_limit / rate_limit / error / 結果画面遷移後 は対象外(ユーザーが意図的に出ようとしている / 出てもよい)
  // - dev=loading / dev=success / dev=load_err はガード無効(画面確認のため何度も URL を切り替える)
  // - dev=submit / dev=mindset は実際の診断フローと近いのでガード有効(開発時に邪魔なら確認ダイアログで「離脱」を選べばよい)
  // - phase 遷移で結果画面 router.push() の直前に「ガードを外す」必要は無い(結果画面に遷移すると Wizard 自体が unmount され useEffect の cleanup でガードが外れるため)
  const isDevGenView = isDevLoading || isDevSuccess || isDevLoadErr;
  const shouldGuardLeave =
    !isDevGenView &&
    (phase === "asking" || phase === "generating" || phase === "finalizing");

  useEffect(() => {
    if (!shouldGuardLeave) return;

    // 1) beforeunload — タブを閉じる・リロード時
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome は returnValue を空文字でも要求する。
      // 表示される文言は最近のブラウザではカスタマイズ不能でブラウザ規定のもの。
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    // 2) popstate — ブラウザバック / 進む
    // history に「現在地」のダミーエントリを 1 つ積んでおき、戻られたら confirm を出し、
    // 取り消しなら pushState で再度ダミーを積み直す。
    // (Next.js Router の back() を奪うのは難しいので、ブラウザ操作レベルでガードする)
    const guardKey = "__nexus_wizard_guard__";
    try {
      window.history.pushState({ [guardKey]: true }, "");
    } catch {
      /* SSR や iframe では失敗するが、その場合は単に保護できないだけ */
    }
    const onPopState = () => {
      const ok = window.confirm(
        "診断中です。離脱すると入力した回答は失われます。本当に戻りますか?",
      );
      if (!ok) {
        // 戻る操作を打ち消すため、再度ダミーを積み直す
        try {
          window.history.pushState({ [guardKey]: true }, "");
        } catch {
          /* 失敗しても致命ではない */
        }
      } else {
        // ユーザーが「OK」(離脱)を選んだので、もう一度戻して履歴から完全に離脱
        // (ダミーを積んだぶんを消費するため pop 相当に戻す)
        window.history.back();
      }
    };
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState);
    };
  }, [shouldGuardLeave]);

  const question = getQuestion(set, currentId);

  function setAnswer(value: AnswerValue | undefined) {
    // value=undefined は「未入力に戻す」=該当 ID を answers から削除する。
    // number 型で入力が空欄/不正に戻った場合に使う。
    setAnswers((prev) => {
      if (value === undefined) {
        if (!(currentId in prev)) return prev;
        const { [currentId]: _drop, ...rest } = prev;
        void _drop;
        return rest;
      }
      return { ...prev, [currentId]: value };
    });
  }

  const currentAnswer = answers[currentId];

  // 入力済みか(必須質問は値が必要。任意は空でも可)
  // - multi: 1個以上必須(specs v2 §8-2)
  // - number: 整数で範囲内であることを NumberInput 側がコミット済みであることが必要
  // - text/textarea: 空白でない文字列が必要
  const answered = (() => {
    if (!question) return false;
    if (!question.required) return true;
    if (question.type === "multi") {
      return Array.isArray(currentAnswer) && currentAnswer.length > 0;
    }
    if (question.type === "number") {
      if (typeof currentAnswer !== "number" || !Number.isInteger(currentAnswer)) {
        return false;
      }
      if (
        question.numberMin !== undefined &&
        currentAnswer < question.numberMin
      ) {
        return false;
      }
      if (
        question.numberMax !== undefined &&
        currentAnswer > question.numberMax
      ) {
        return false;
      }
      return true;
    }
    // single / text / textarea
    return typeof currentAnswer === "string" && currentAnswer.trim() !== "";
  })();

  const nextId = question ? getNextQuestionId(set, currentId, answers) : null;
  const isLast = nextId === null;

  // 進捗バー用スナップショット(セクション化・案C)
  const snapshot = question
    ? getProgress(set, currentId, answers, history)
    : null;

  function goNext() {
    if (!answered) return;
    if (isLast) {
      void submit();
      return;
    }
    if (nextId) {
      setHistory((h) => [...h, currentId]);
      setCurrentId(nextId);
    }
  }

  /**
   * MAY(任意)質問をスキップして次へ進む。
   * - 現在地の回答を削除(放棄として扱う)
   * - 履歴は積む(戻れる)
   * - 次が無ければ submit
   */
  function goSkip() {
    if (!question || question.required) return;
    // 現在地の回答を消す(空欄での通過 = 未指定として扱う)
    setAnswers((prev) => {
      if (!(currentId in prev)) return prev;
      const { [currentId]: _drop, ...rest } = prev;
      void _drop;
      return rest;
    });
    if (isLast) {
      // ラスト MAY (free_note 等) を空でスキップ = そのまま生成へ
      void submit();
      return;
    }
    if (nextId) {
      setHistory((h) => [...h, currentId]);
      setCurrentId(nextId);
    }
  }

  function goBack() {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setCurrentId(prev);
      return h.slice(0, -1);
    });
  }

  async function submit() {
    // 同意ゲートを通過していなければ送信しない(二重ガード)
    if (!consent) {
      setPhase("consent");
      return;
    }
    setPhase("generating");
    // 放棄した分岐の回答(例: working→student に切替後の experience/income)を除去し、
    // 実際に辿った質問の回答のみを送信する(矛盾入力の防止)。
    const cleanAnswers = pruneAnswers(set, answers);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: cleanAnswers, consent: true }),
        // セッション cookie が初回付与されるよう credentials:'same-origin'(既定だが明示)
        credentials: "same-origin",
      });

      // レート制限関連(503 / 429)を専用画面に振り分ける。
      // 通常エラー(500/502 等)は従来通り error フェーズへ。
      if (res.status === 503 || res.status === 429) {
        let body: RateLimitResponse = {};
        try {
          body = (await res.json()) as RateLimitResponse;
        } catch {
          /* JSON 取れなくてもフォールバックで表示 */
        }
        if (res.status === 503) {
          setMonthlyInfo({
            limit: body.limit ?? 0,
            count: body.count ?? 0,
            resetAt: body.resetAt ?? null,
          });
          setPhase("monthly_limit");
          return;
        }
        // 429: Retry-After ヘッダを優先、フォールバックで body.retryAfterSec
        const headerSec = Number(res.headers.get("Retry-After") ?? "");
        const sec =
          Number.isFinite(headerSec) && headerSec > 0
            ? Math.ceil(headerSec)
            : (body.retryAfterSec ?? 60);
        setRateInfo({ retryAfterSec: sec });
        setPhase("rate_limit");
        return;
      }

      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { id?: string };
      if (!data.id) throw new Error("no id");
      // 100% 達成演出を見せてから結果画面に遷移する。
      // - GeneratingView の status を "success" に切り替えると、useFakeProgress が
      //   500ms かけて 100% に着地し、finale 演出(全ノードパルス・道筋フラッシュ・
      //   コンテナ呼吸・タイトルきらめき・画面フラッシュ)が一気に発火する。
      // - その後 FINALIZE_HOLD_MS の間ホールドしてから router.push する。
      setPhase("finalizing");
      window.setTimeout(() => {
        router.push(`/r/${data.id}`);
      }, FINALIZE_HOLD_MS);
    } catch {
      setPhase("error");
    }
  }

  // 必須でない質問では「スキップ」ボタンを表示する
  const showSkip = phase === "asking" && question && !question.required;

  // ----- 描画 -----
  return (
    <>
      <header className="relative z-10 border-b border-line/70 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-5 h-16 flex items-center">
          <Logo />
        </div>
      </header>

      <main className="relative z-10 max-w-2xl mx-auto px-5 py-10 sm:py-14">
        {phase === "consent" && (
          <ConsentGate
            onConsent={() => {
              setConsent(true);
              setPhase("asking");
            }}
          />
        )}

        {phase === "asking" && question && snapshot && (
          <div>
            <div className="mb-9">
              <ProgressBar snapshot={snapshot} />
            </div>

            <QuestionStep
              question={question}
              value={currentAnswer}
              onChange={setAnswer}
              onEnter={goNext}
            />

            <div className="flex items-center justify-between mt-10 gap-3">
              <button
                type="button"
                onClick={goBack}
                disabled={history.length === 0}
                className={`text-sm font-medium rounded-full px-5 py-2.5 border transition ${
                  history.length === 0
                    ? "border-line/50 text-mute/40 cursor-not-allowed"
                    : "border-line text-mute hover:text-ice hover:border-cyan"
                }`}
              >
                戻る
              </button>

              <button
                type="button"
                onClick={goNext}
                disabled={!answered}
                className={`inline-flex items-center gap-2 font-bold rounded-full px-7 py-3 transition ${
                  answered
                    ? "bg-gradient-to-r from-cyan to-violet text-bg hover:scale-[1.03] glow-ring"
                    : "bg-panel2 text-mute cursor-not-allowed"
                }`}
              >
                {isLast ? "結果を生成する" : "次へ"}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>

            {/*
              MAY(required:false)質問の補助:
              - 「スキップして次へ」ボタンを「次へ」の下に薄く配置(見落とされず、かつ目立ちすぎない)。
              - 自由記述(textarea/text)で空欄のまま通過したいユーザーにも有効。
              - 現在地の回答を破棄してから次へ進めるので、戻った時に空欄として再表示される。
            */}
            {showSkip && (
              <div className="mt-4 flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={goSkip}
                  className="text-xs text-mute hover:text-ice transition underline underline-offset-4 decoration-dotted"
                >
                  この質問はスキップして次へ →
                </button>
                <p className="text-[0.65rem] text-mute/60">
                  この質問は任意です。答えなくても結果を生成できます。
                </p>
              </div>
            )}

            {/* iOS Safari でツールバーが消えた状態でも「次へ」ボタンが画面下端に来ず、
                1回タップで反応するよう、ボタン下に余白(次へボタン約2個分)を確保する。 */}
            <div aria-hidden="true" className="h-24" />
          </div>
        )}

        {/* 同じインスタンスを使い回し、フェーズに応じて status を切り替える。
            こうすることで useFakeProgress 内の lastRef / state がリセットされず、
            loading の進捗(例: 96%)から finalizing(success)で 100% にスムーズ着地できる。
            別 jsx 節に分けると React は別コンポーネントとして unmount→mount してしまい、
            fraction が 0 にリセットされてしまう。 */}
        {(phase === "generating" || phase === "finalizing") && (
          <GeneratingView
            status={
              phase === "finalizing"
                ? "success"
                : isDevLoadErr
                  ? "error"
                  : "loading"
            }
          />
        )}

        {phase === "monthly_limit" && monthlyInfo && (
          <MonthlyLimitView
            limit={monthlyInfo.limit}
            count={monthlyInfo.count}
            resetAt={monthlyInfo.resetAt}
          />
        )}

        {phase === "rate_limit" && rateInfo && (
          <RateLimitView
            // retryAfterSec が変わった場合に内部 state(remaining)を再初期化するため
            // key で強制再マウントする。
            key={rateInfo.retryAfterSec}
            retryAfterSec={rateInfo.retryAfterSec}
            onRetry={() => {
              // 残時間 0 で再試行ボタンを押されたら、再度送信を試みる。
              // セッションは維持されるが、IP/session 短期窓は時間が経っていればリセット済み。
              setRateInfo(null);
              void submit();
            }}
          />
        )}

        {phase === "error" && (
          <div className="glow-card rounded-3xl p-7 sm:p-10 text-center rise">
            <div className="text-4xl mb-5">⚠️</div>
            <h2 className="font-display text-xl font-semibold mb-3">
              生成に失敗しました
            </h2>
            <p className="text-mute text-sm leading-relaxed mb-7">
              一時的な問題かもしれません。回答は保持しているので、もう一度お試しください。
            </p>
            <button
              type="button"
              onClick={() => void submit()}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan to-violet text-bg font-bold rounded-full px-7 py-3.5 hover:scale-105 transition glow-ring"
            >
              もう一度生成する
            </button>
          </div>
        )}
      </main>
    </>
  );
}
