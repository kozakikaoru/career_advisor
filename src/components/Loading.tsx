"use client";

/** 生成中のローディング表示。数十秒かかる前提の体験(api-design.md §4)。 */
export function Loading() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center rise">
      <div className="relative w-20 h-20 mb-8">
        <div className="absolute inset-0 rounded-full border-2 border-line" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan border-r-violet animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center text-2xl">🛰️</div>
      </div>
      <h2 className="font-display text-xl font-semibold mb-2 neon-text">
        あなたの進路を組み立てています…
      </h2>
      <p className="text-mute text-sm max-w-sm leading-relaxed">
        AIが回答を読み解いて、現在地から目標までのロードマップを描いています。
        数十秒ほどかかることがあります。
      </p>
    </div>
  );
}
