import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => {
  const { cookieJar } = await import("../helpers/cookie-jar");
  return { cookies: async () => cookieJar };
});

import { clearCookies, readRawCookie } from "../helpers/cookie-jar";
import { createSession, deleteSession, getSession } from "@/lib/session";

const SESSION_COOKIE = "session";

beforeEach(() => {
  clearCookies();
});

describe("createSession / getSession", () => {
  it("round-trips the payload through a signed cookie", async () => {
    await createSession({ userId: "user_123", email: "cook@example.test" });

    await expect(getSession()).resolves.toMatchObject({
      userId: "user_123",
      email: "cook@example.test",
    });
  });

  it("stores the payload as a JWT rather than plain text", async () => {
    await createSession({ userId: "user_123", email: "cook@example.test" });
    const raw = readRawCookie(SESSION_COOKIE)?.value ?? "";

    expect(raw.split(".")).toHaveLength(3);
    expect(raw).not.toContain("cook@example.test");
  });

  it("writes an httpOnly, lax, site-wide cookie that expires in 30 days", async () => {
    const before = Date.now();
    await createSession({ userId: "user_123", email: "cook@example.test" });
    const cookie = readRawCookie(SESSION_COOKIE);

    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });

    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const expires = cookie?.expires?.getTime() ?? 0;
    expect(expires).toBeGreaterThanOrEqual(before + thirtyDays - 5_000);
    expect(expires).toBeLessThanOrEqual(Date.now() + thirtyDays + 5_000);
  });

  it("overwrites an existing session when signing in again", async () => {
    await createSession({ userId: "user_1", email: "first@example.test" });
    await createSession({ userId: "user_2", email: "second@example.test" });

    await expect(getSession()).resolves.toMatchObject({ userId: "user_2" });
  });
});

describe("getSession", () => {
  it("returns null when no cookie is set", async () => {
    await expect(getSession()).resolves.toBeNull();
  });

  it("rejects a tampered token", async () => {
    await createSession({ userId: "user_123", email: "cook@example.test" });
    const [header, , signature] = (readRawCookie(SESSION_COOKIE)?.value ?? "").split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ userId: "attacker", email: "attacker@example.test" })
    ).toString("base64url");

    const { cookieJar } = await import("../helpers/cookie-jar");
    cookieJar.set(SESSION_COOKIE, `${header}.${forgedPayload}.${signature}`);

    await expect(getSession()).resolves.toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const { SignJWT } = await import("jose");
    const foreign = await new SignJWT({ userId: "user_123", email: "cook@example.test" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(new Date(Date.now() + 60_000))
      .sign(new TextEncoder().encode("a-different-secret-entirely"));

    const { cookieJar } = await import("../helpers/cookie-jar");
    cookieJar.set(SESSION_COOKIE, foreign);

    await expect(getSession()).resolves.toBeNull();
  });

  it("rejects a garbage cookie value", async () => {
    const { cookieJar } = await import("../helpers/cookie-jar");
    cookieJar.set(SESSION_COOKIE, "not-a-jwt");

    await expect(getSession()).resolves.toBeNull();
  });

  it("rejects an expired token", async () => {
    const { SignJWT } = await import("jose");
    const expired = await new SignJWT({ userId: "user_123", email: "cook@example.test" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(new Date(Date.now() - 120_000))
      .setExpirationTime(new Date(Date.now() - 60_000))
      .sign(new TextEncoder().encode(process.env.SESSION_SECRET ?? ""));

    const { cookieJar } = await import("../helpers/cookie-jar");
    cookieJar.set(SESSION_COOKIE, expired);

    await expect(getSession()).resolves.toBeNull();
  });
});

describe("deleteSession", () => {
  it("clears the session cookie", async () => {
    await createSession({ userId: "user_123", email: "cook@example.test" });
    await deleteSession();

    expect(readRawCookie(SESSION_COOKIE)).toBeUndefined();
    await expect(getSession()).resolves.toBeNull();
  });

  it("is a no-op when there is no session", async () => {
    await expect(deleteSession()).resolves.not.toThrow();
  });
});

describe("SESSION_SECRET", () => {
  const original = process.env.SESSION_SECRET;

  afterEach(() => {
    process.env.SESSION_SECRET = original;
  });

  it("fails loudly when the secret is missing", async () => {
    delete process.env.SESSION_SECRET;

    await expect(createSession({ userId: "user_123", email: "cook@example.test" })).rejects.toThrow(
      /SESSION_SECRET/
    );
  });
});
