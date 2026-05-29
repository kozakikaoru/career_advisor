"use client";

/** 記述式(短文・1行)。Enter キーで次へ進める(onEnter)。 */
export function TextInput({
  value,
  placeholder,
  onChange,
  onEnter,
}: {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      maxLength={100}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault();
          onEnter?.();
        }
      }}
      className="w-full rounded-2xl border border-line bg-panel/60 px-5 py-4 text-ice placeholder:text-mute/60 outline-none focus:border-cyan focus:glow-ring transition"
    />
  );
}
