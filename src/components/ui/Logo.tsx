import Link from "next/link";

/** NEXUS.path のロゴ(モックのヘッダー左)。発光リング付きの波形アイコン + ワードマーク。 */
export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan to-violet flex items-center justify-center glow-ring">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#070912"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 12h4l3 8 4-16 3 8h4" />
        </svg>
      </div>
      <span className="font-display font-semibold tracking-tight">
        NEXUS<span className="text-cyan">.path</span>
      </span>
    </Link>
  );
}
