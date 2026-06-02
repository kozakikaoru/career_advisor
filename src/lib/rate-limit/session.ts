import { nanoid } from "nanoid";

/**
 * セッション cookie 名。Set-Cookie のキーとして API ハンドラから使う。
 *
 * httpOnly / SameSite=Lax / 本番は Secure を付与する。
 * ローカル http://localhost では Secure を付けない(Chrome が拒否するため)。
 */
export const SESSION_COOKIE_NAME = "session_id";

/**
 * cookie ヘッダから session_id を取り出す。
 * Next.js の `req.headers.get('cookie')` の生文字列を渡す前提。
 *
 * 自前で実装する理由: Next.js の `cookies()` は RSC でしか使えず、
 * Route Handler の `req`(NextRequest)に頼るとテストでモックが面倒。
 * シンプルに「; 区切りの key=value」をパースする。
 */
export function parseSessionFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  // 例: "session_id=abc; foo=bar"
  const parts = cookieHeader.split(/;\s*/);
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (name !== SESSION_COOKIE_NAME) continue;
    const value = part.slice(eq + 1).trim();
    // 推測困難な ID(nanoid 21 char URL-safe)以外は信頼しない。
    // 緩めの検証: [A-Za-z0-9_-]{16,32} 程度であれば受け入れる。
    if (!/^[A-Za-z0-9_-]{16,40}$/.test(value)) return null;
    return value;
  }
  return null;
}

/**
 * cookie ヘッダから session_id を取り出し、無ければ新規発行する。
 *
 * 戻り値:
 *  - sessionId: 今回のリクエストで使うセッション ID
 *  - isNew: 新規発行したか(true なら Set-Cookie で付与する必要あり)
 */
export function resolveSession(
  cookieHeader: string | null,
): { sessionId: string; isNew: boolean } {
  const existing = parseSessionFromCookie(cookieHeader);
  if (existing) return { sessionId: existing, isNew: false };
  return { sessionId: nanoid(21), isNew: true };
}

/**
 * Set-Cookie ヘッダ値を組み立てる(httpOnly / SameSite=Lax / Path=/ / Max-Age=180 日)。
 * 本番(NODE_ENV=production)では Secure 属性を付与する。
 */
export function buildSessionSetCookie(
  sessionId: string,
  opts: { secure: boolean },
): string {
  const maxAgeSec = 60 * 60 * 24 * 180; // 180 日
  const parts = [
    `${SESSION_COOKIE_NAME}=${sessionId}`,
    "Path=/",
    `Max-Age=${maxAgeSec}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

/**
 * リクエストヘッダからクライアント IP を抽出する。
 *
 * Vercel / 一般的なリバースプロキシで使われるヘッダを優先順に見て、
 * x-forwarded-for は左端(オリジナル client)を採用する。
 *
 * 取得できない場合は "unknown" を返す(レート制限の key 上は同一バケットに
 * 集約される。攻撃者目線ではむしろ厳しめになるので運用上問題なし)。
 */
export function resolveClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    // "client, proxy1, proxy2" の左端
    const first = xff.split(",")[0]?.trim();
    if (first) return normalizeIp(first);
  }
  const real = headers.get("x-real-ip");
  if (real) return normalizeIp(real.trim());
  const cf = headers.get("cf-connecting-ip");
  if (cf) return normalizeIp(cf.trim());
  return "unknown";
}

function normalizeIp(ip: string): string {
  // IPv6 mapped IPv4(::ffff:1.2.3.4)を 1.2.3.4 に正規化
  const m = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(ip);
  if (m) return m[1];
  return ip;
}
