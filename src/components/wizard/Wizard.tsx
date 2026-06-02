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
  | "error"
  | "monthly_limit"
  | "rate_limit";

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
  // TODO(temp): 確認完了後に削除予定 — `?dev=submit` は最優先(prefill 済みで MINDSET 最後の質問から開始)。
  //   `?dev=mindset`(MINDSET 先頭から開始)と同時指定された場合も submit が優先される。
  const isDevSubmit = devMode === "submit";
  const isDevMindset = !isDevSubmit && devMode === "mindset";
  // レート制限の 503 / 429 画面を単独確認するための dev フラグ。
  // `?dev=ratelimit_monthly` → 月次上限画面 / `?dev=ratelimit_429` → 短期窓レート画面
  // (本番にバレてもダミーデータが表示されるだけで悪用余地なし)
  const isDevMonthly = devMode === "ratelimit_monthly";
  const isDevRate = devMode === "ratelimit_429";

  const [phase, setPhase] = useState<Phase>(() => {
    if (isDevMonthly) return "monthly_limit";
    if (isDevRate) return "rate_limit";
    // TODO(temp): 確認完了後に削除予定 — dev=submit は ConsentGate を自動通過(毎回チェックを入れる手間を省くため)
    if (isDevSubmit) return "asking";
    return "consent";
  });
  // TODO(temp): 確認完了後に削除予定 — dev=submit は consent=true として開始(submit() の二重ガードを通すため)
  const [consent, setConsent] = useState(isDevSubmit);
  // TODO(temp): 確認完了後に削除予定 — dev=submit は MINDSET 最終問まで prefill / dev=mindset は ORIGIN+GOAL のみダミー投入
  const [answers, setAnswers] = useState<AnswerMap>(() => {
    if (isDevSubmit) return { ...DEV_SUBMIT_PREFILL_ANSWERS };
    if (isDevMindset) return { ...DEV_MINDSET_DUMMY_ANSWERS };
    return {};
  });
  // TODO(temp): 確認完了後に削除予定 — dev=submit は mindset_freenote から / dev=mindset は MINDSET 先頭から
  const [currentId, setCurrentId] = useState<string>(() => {
    if (isDevSubmit) return DEV_SUBMIT_START_ID;
    if (isDevMindset) return DEV_MINDSET_START_ID;
    return set.firstId;
  });
  // TODO(temp): 確認完了後に削除予定 — dev=submit のとき history を「ORIGIN→GOAL→MINDSET 14 問」で初期化
  //   (進捗バーの ProgressSnapshot が「ORIGIN/GOAL は完了済み・MINDSET の最後の 1 問だけ残っている」状態を
  //    正しく表示するため。getProgress は history+currentId からセクション内位置を計算する)。
  const [history, setHistory] = useState<string[]>(() => {
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
      router.push(`/r/${data.id}`);
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

        {phase === "generating" && <GeneratingView />}

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
