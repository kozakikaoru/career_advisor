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
import type { AnswerMap, AnswerValue } from "@/lib/schema/answers";
import { ConsentGate } from "./ConsentGate";
import { QuestionStep } from "./QuestionStep";
import { ProgressBar } from "./ProgressBar";
import { Logo } from "@/components/ui/Logo";
import { Loading } from "@/components/Loading";

const set = QUESTION_SET;

type Phase = "consent" | "asking" | "generating" | "error";

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

export function Wizard() {
  const router = useRouter();
  // TODO(temp): MINDSET 確認完了後に削除予定 — searchParams 取得は通常診断には不要
  const searchParams = useSearchParams();
  const devMode = searchParams?.get("dev");
  const isDevMindset = devMode === "mindset";

  const [phase, setPhase] = useState<Phase>("consent");
  const [consent, setConsent] = useState(false);
  // TODO(temp): MINDSET 確認完了後に削除予定 — dev=mindset 時は ORIGIN/GOAL のダミー値を投入
  const [answers, setAnswers] = useState<AnswerMap>(() =>
    isDevMindset ? { ...DEV_MINDSET_DUMMY_ANSWERS } : {},
  );
  // TODO(temp): MINDSET 確認完了後に削除予定 — dev=mindset 時は MINDSET 先頭から開始
  const [currentId, setCurrentId] = useState<string>(
    isDevMindset ? DEV_MINDSET_START_ID : set.firstId,
  );
  const [history, setHistory] = useState<string[]>([]);

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
      });
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

        {phase === "generating" && <Loading />}

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
