"use client";

import type { Question } from "@/lib/questions/definitions";
import type { AnswerValue } from "@/lib/schema/answers";
import { SingleChoice } from "./SingleChoice";
import { MultiChoice } from "./MultiChoice";
import { TextInput } from "./TextInput";
import { TextArea } from "./TextArea";

/** 1 問の表示。質問タイプで入力UIを切り替える。 */
export function QuestionStep({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}) {
  const axisLabel = AXIS_LABEL[question.axis];
  return (
    <div className="rise">
      <p className="text-xs font-display tracking-[0.2em] uppercase text-cyan mb-3">
        {axisLabel}
      </p>
      <h2 className="text-2xl sm:text-3xl font-semibold leading-snug mb-2">
        {question.title}
      </h2>
      {question.description && (
        <p className="text-mute text-sm mb-7 leading-relaxed">{question.description}</p>
      )}
      {!question.description && <div className="mb-7" />}

      {question.type === "single" && (
        <SingleChoice
          choices={question.choices ?? []}
          value={typeof value === "string" ? value : undefined}
          onChange={onChange}
        />
      )}
      {question.type === "multi" && (
        <MultiChoice
          choices={question.choices ?? []}
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
        />
      )}
      {question.type === "text" && (
        <TextInput
          value={typeof value === "string" ? value : ""}
          placeholder={question.placeholder}
          onChange={onChange}
        />
      )}
      {question.type === "textarea" && (
        <TextArea
          value={typeof value === "string" ? value : ""}
          placeholder={question.placeholder}
          sensitiveNotice={question.sensitiveNotice}
          onChange={onChange}
        />
      )}
    </div>
  );
}

const AXIS_LABEL: Record<Question["axis"], string> = {
  current: "現在の状況",
  goal: "目標",
  personality: "性格・価値観",
};
