import { describe, it, expect } from "vitest";
import {
  buildSessionSetCookie,
  parseSessionFromCookie,
  resolveClientIp,
  resolveSession,
  SESSION_COOKIE_NAME,
} from "./session";

describe("parseSessionFromCookie", () => {
  it("cookie ヘッダから session_id を取り出す", () => {
    const id = "abcdefghijklmnopqrstu"; // 21 char
    expect(parseSessionFromCookie(`${SESSION_COOKIE_NAME}=${id}`)).toBe(id);
  });
  it("複数 cookie の中から該当キーだけを拾う", () => {
    const id = "abcdefghijklmnopqrstu";
    expect(
      parseSessionFromCookie(`other=xxx; ${SESSION_COOKIE_NAME}=${id}; foo=bar`),
    ).toBe(id);
  });
  it("無ければ null", () => {
    expect(parseSessionFromCookie(null)).toBeNull();
    expect(parseSessionFromCookie("")).toBeNull();
    expect(parseSessionFromCookie("foo=bar")).toBeNull();
  });
  it("不正な形式(短すぎ・記号混入)は受け入れない", () => {
    expect(parseSessionFromCookie(`${SESSION_COOKIE_NAME}=short`)).toBeNull();
    expect(
      parseSessionFromCookie(`${SESSION_COOKIE_NAME}=has space inside`),
    ).toBeNull();
  });
});

describe("resolveSession", () => {
  it("既存 cookie があれば isNew=false", () => {
    const id = "abcdefghijklmnopqrstu";
    const r = resolveSession(`${SESSION_COOKIE_NAME}=${id}`);
    expect(r.sessionId).toBe(id);
    expect(r.isNew).toBe(false);
  });
  it("cookie 無しなら新規発行(isNew=true・長さ 21)", () => {
    const r = resolveSession(null);
    expect(r.isNew).toBe(true);
    expect(r.sessionId).toMatch(/^[A-Za-z0-9_-]{21}$/);
  });
});

describe("buildSessionSetCookie", () => {
  it("本番(secure: true)で Secure 属性が付く", () => {
    const v = buildSessionSetCookie("abcdefghijklmnopqrstu", { secure: true });
    expect(v).toContain("HttpOnly");
    expect(v).toContain("SameSite=Lax");
    expect(v).toContain("Secure");
    expect(v).toContain("Path=/");
    expect(v).toMatch(/Max-Age=\d+/);
  });
  it("dev(secure: false)で Secure 属性が付かない", () => {
    const v = buildSessionSetCookie("abcdefghijklmnopqrstu", { secure: false });
    expect(v).toContain("HttpOnly");
    expect(v).not.toContain("Secure");
  });
});

describe("resolveClientIp", () => {
  function h(rec: Record<string, string>): Headers {
    const out = new Headers();
    for (const [k, v] of Object.entries(rec)) out.set(k, v);
    return out;
  }

  it("x-forwarded-for の左端を採用", () => {
    expect(
      resolveClientIp(h({ "x-forwarded-for": "1.2.3.4, 10.0.0.1, 10.0.0.2" })),
    ).toBe("1.2.3.4");
  });
  it("x-real-ip を次点で採用", () => {
    expect(resolveClientIp(h({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
  });
  it("cf-connecting-ip を次点で採用", () => {
    expect(resolveClientIp(h({ "cf-connecting-ip": "9.9.9.9" }))).toBe("9.9.9.9");
  });
  it("何もなければ 'unknown'", () => {
    expect(resolveClientIp(h({}))).toBe("unknown");
  });
  it("IPv6 mapped IPv4(::ffff:1.2.3.4)は IPv4 化", () => {
    expect(
      resolveClientIp(h({ "x-forwarded-for": "::ffff:1.2.3.4" })),
    ).toBe("1.2.3.4");
  });
});
