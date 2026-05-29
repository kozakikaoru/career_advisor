"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  QUESTION_SET,
  getQuestion,
  getNextQuestionId,
} from "@/lib/questions";
import type { AnswerMap, AnswerValue } from "@/lib/schema/answers";
import { ConsentGate } from "./ConsentGate";
import { QuestionStep } from "./QuestionStep";
import { ProgressBar } from "./ProgressBar";
import { Logo } from "@/components/ui/Logo";
import { Loading } from "@/components/Loading";

const set = QUESTION_SET;
// 進捗バーの分母(おおよその総質問数。分岐で前後する)
const APPROX_TOTAL = 13;

type Phase = "consent" | "asking" | "generating" | "error";

export function Wizard() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("consent");
  const [consent, setConsent] = useState(false);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [currentId, setCurrentId] = useState<string>(set.firstId);
  const [history, setHistory] = useState<string[]>([]);

  const question = getQuestion(set, currentId);

  function setAnswer(value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [currentId]: value }));
  }

  const currentAnswer = answers[currentId];

  // 入力済みか(必須質問は値が必要。任意は空でも可)
  const answered =
    !question?.required ||
    (Array.isArray(currentAnswer)
      ? currentAnswer.length > 0
      : typeof currentAnswer === "string" && currentAnswer.trim() !== "");

  const nextId = question ? getNextQuestionId(set, currentId, answers) : null;
  const isLast = nextId === null;

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
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, consent: true }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { id?: string };
      if (!data.id) throw new Error("no id");
      router.push(`/r/${data.id}`);
    } catch {
      setPhase("error");
    }
  }

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

        {phase === "asking" && question && (
          <div>
            <div className="mb-9">
              <ProgressBar current={history.length + 1} total={APPROX_TOTAL} />
            </div>

            <QuestionStep question={question} value={currentAnswer} onChange={setAnswer} />

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

            {!question.required && (
              <p className="text-xs text-mute/60 mt-4 text-center">
                この質問は任意です。空のまま進めます。
              </p>
            )}
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
