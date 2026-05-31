"use client";

import { useState } from "react";

/**
 * 数値入力(整数)。`<input type="number">` ベース。
 *
 * 仕様(specs/origin-questions-v2.md §8-6):
 * - HTML 属性 min/max/step + inputMode=numeric でモバイルも数値テンキーを出す。
 * - state は文字列で保持(IME や空欄表現を素直に扱うため)。
 * - 解釈できた整数のみ親に number として通知。空欄・非整数・範囲外なら undefined を返す。
 * - エラー時は aria-invalid と赤系のメッセージを直下に表示。
 * - Enter キーで前進可能(IME 変換中は除外)。
 *
 * 親 value(answers[id])が変わったときに input 表示を同期させる必要があるが、
 * useEffect で setState を呼ぶと react-hooks/set-state-in-effect に引っかかるため、
 * **「描画中に props を見て、前回と差分があれば一度だけ text を更新する」** パターンで
 * 同期する(React 公式 "Adjusting state while rendering" パターン)。
 */
export function NumberInput({
  value,
  min,
  max,
  step,
  placeholder,
  onChange,
  onEnter,
}: {
  value: number | undefined;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  onChange: (value: number | undefined) => void;
  onEnter?: () => void;
}) {
  // 表示用の文字列ステート。number に変換できない過渡的な入力(空欄・"-" など)も保持。
  const [text, setText] = useState<string>(() =>
    typeof value === "number" && Number.isFinite(value) ? String(value) : "",
  );
  // 直前に「描画した時の props.value」を保持する state(React 公式
  // "Storing information from previous renders" パターン)。
  // これと現在の props.value がズレた瞬間に派生 state(text)を補正する。
  const [lastValue, setLastValue] = useState<number | undefined>(value);

  if (lastValue !== value) {
    // 親(answers[id])が外部要因(history 戻る、stage 変更で undefined 化など)で変わった場合に同期。
    setLastValue(value);
    const next =
      typeof value === "number" && Number.isFinite(value) ? String(value) : "";
    if (next !== text) {
      setText(next);
    }
  }

  function commit(raw: string) {
    setText(raw);
    const trimmed = raw.trim();
    if (trimmed === "") {
      onChange(undefined);
      setLastValue(undefined);
      return;
    }
    // 整数のみ受理(小数点・指数表記は不可)
    if (!/^-?\d+$/.test(trimmed)) {
      onChange(undefined);
      setLastValue(undefined);
      return;
    }
    const n = Number.parseInt(trimmed, 10);
    if (!Number.isInteger(n)) {
      onChange(undefined);
      setLastValue(undefined);
      return;
    }
    if (typeof min === "number" && n < min) {
      onChange(undefined);
      setLastValue(undefined);
      return;
    }
    if (typeof max === "number" && n > max) {
      onChange(undefined);
      setLastValue(undefined);
      return;
    }
    onChange(n);
    setLastValue(n);
  }

  // 現在のテキストがエラーか(空欄はエラー扱いしない=未入力状態)
  const trimmed = text.trim();
  let errorMsg: string | null = null;
  if (trimmed !== "") {
    if (!/^-?\d+$/.test(trimmed)) {
      errorMsg = `${min ?? 0}〜${max ?? 99} の整数で入力してください`;
    } else {
      const n = Number.parseInt(trimmed, 10);
      if (
        (typeof min === "number" && n < min) ||
        (typeof max === "number" && n > max)
      ) {
        errorMsg = `${min ?? 0}〜${max ?? 99} の整数で入力してください`;
      }
    }
  }
  const invalid = errorMsg !== null;

  return (
    <div>
      <input
        type="number"
        inputMode="numeric"
        value={text}
        min={min}
        max={max}
        step={step ?? 1}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? "number-input-error" : undefined}
        onChange={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onEnter?.();
          }
        }}
        className={`w-full rounded-2xl border bg-panel/60 px-5 py-4 text-ice placeholder:text-mute/60 outline-none transition ${
          invalid
            ? "border-pink/70 focus:border-pink"
            : "border-line focus:border-cyan focus:glow-ring"
        }`}
      />
      {invalid && (
        <p
          id="number-input-error"
          role="alert"
          className="mt-2 text-xs text-pink"
        >
          {errorMsg}
        </p>
      )}
    </div>
  );
}
