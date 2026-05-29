"use client";

/** 自由記述(複数行)。sensitiveNotice が true のとき機微情報の注意書きを出す(PII対策)。 */
export function TextArea({
  value,
  placeholder,
  sensitiveNotice,
  onChange,
}: {
  value: string;
  placeholder?: string;
  sensitiveNotice?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      {sensitiveNotice && (
        <p className="text-xs text-pink/90 bg-pink/5 border border-pink/20 rounded-xl px-4 py-3 mb-3 leading-relaxed">
          ⚠ 入力内容は進路生成のため AI(外部API)に送信されます。氏名・連絡先・健康・他人の個人情報など
          機微な情報は入力しないでください。
        </p>
      )}
      <textarea
        value={value}
        placeholder={placeholder}
        rows={4}
        maxLength={1000}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-line bg-panel/60 px-5 py-4 text-ice placeholder:text-mute/60 outline-none focus:border-cyan focus:glow-ring transition resize-none"
      />
    </div>
  );
}
