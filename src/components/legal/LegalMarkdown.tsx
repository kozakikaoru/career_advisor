import Link from "next/link";
import { Children, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";

/**
 * 法務文書(プライバシーポリシー / 利用規約)の Markdown 本文を
 * ダーク基調のページ内で読みやすく描画する共通コンポーネント。
 *
 * - 本文は security 担当が作成した .md をそのまま反映する。
 * - `[要記入: ...]` プレースホルダは強調表示し、未記入と一目で分かるようにする。
 * - 文書内の相互リンクは `/privacy` `/terms` の短縮形で書かれているため、
 *   実際のルート `/legal/privacy` `/legal/terms` に正規化してから描画する。
 */

/** Markdown 内の `/privacy` `/terms` を実ルートへ正規化する。 */
function normalizeHref(href: string): string {
  if (href === "/privacy") return "/legal/privacy";
  if (href === "/terms") return "/legal/terms";
  return href;
}

const PLACEHOLDER = /\[要記入(?::[^\]]*)?\]/g;

/**
 * 文字列内の `[要記入: ...]` / `[要記入]` を <mark> で囲んだ ReactNode 配列に変換する。
 * プレースホルダを含まない場合は元の文字列をそのまま返す。
 */
function highlightString(text: string): ReactNode {
  PLACEHOLDER.lastIndex = 0;
  if (!PLACEHOLDER.test(text)) return text;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  PLACEHOLDER.lastIndex = 0;
  while ((match = PLACEHOLDER.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <mark
        key={key++}
        className="rounded bg-lime/15 px-1.5 py-0.5 text-lime font-medium"
        title="公開前に運営者が記入する項目です"
      >
        {match[0]}
      </mark>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

/** children を走査し、文字列ノードに対してプレースホルダ強調を適用する。 */
function withPlaceholders(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === "string") return highlightString(child);
    return child;
  });
}

const components: Components = {
  // 文書冒頭の `# タイトル` は LegalLayout 側の見出しと重複するため非表示にする。
  h1: () => null,
  h2: ({ children }) => (
    <h2 className="font-display text-xl font-bold text-ice mt-10 mb-3 first:mt-0">
      {withPlaceholders(children)}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-display text-base font-semibold text-ice mt-6 mb-2">
      {withPlaceholders(children)}
    </h3>
  ),
  p: ({ children }) => <p className="my-3">{withPlaceholders(children)}</p>,
  ul: ({ children }) => (
    <ul className="list-disc pl-5 my-3 space-y-1.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 my-3 space-y-1.5">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{withPlaceholders(children)}</li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-ice">{withPlaceholders(children)}</strong>
  ),
  em: ({ children }) => <em>{withPlaceholders(children)}</em>,
  hr: () => <hr className="my-8 border-line/60" />,
  blockquote: ({ children }) => (
    <blockquote className="my-4 rounded-r-lg border-l-2 border-cyan/60 bg-panel/40 py-2 pl-4 pr-3 text-mute/80 text-xs leading-relaxed [&_p]:my-1">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => {
    const to = normalizeHref(href ?? "#");
    if (to.startsWith("/")) {
      return (
        <Link href={to} className="text-cyan underline hover:text-pink transition">
          {children}
        </Link>
      );
    }
    return (
      <a
        href={to}
        target="_blank"
        rel="noopener noreferrer"
        className="text-cyan underline hover:text-pink transition break-all"
      >
        {children}
      </a>
    );
  },
};

export function LegalMarkdown({ source }: { source: string }) {
  return <ReactMarkdown components={components}>{source}</ReactMarkdown>;
}
