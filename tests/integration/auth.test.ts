import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { login, logout } from "@/server/actions/auth";
import { readRawCookie } from "../helpers/cookie-jar";
import { catchRedirect } from "../helpers/next-mocks";

// Mirrors the SEED_USER_* values in vitest.integration.config.mts.
const SEED_EMAIL = "seed@example.test";
const SEED_PASSWORD = "seed-password-123";

function credentials(email: string, password: string) {
  const formData = new FormData();
  formData.set("email", email);
  formData.set("password", password);
  return formData;
}

const signIn = (email: string, password: string) => login(undefined, credentials(email, password));

async function createDbUser(email: string, password: string) {
  return prisma.user.create({
    data: { email, hashedPassword: await bcrypt.hash(password, 10), name: "Household" },
  });
}

describe("login with SEED_USER_* environment credentials", () => {
  it("signs in with no matching row in the database", async () => {
    expect(await prisma.user.count()).toBe(0);

    await expect(catchRedirect(signIn(SEED_EMAIL, SEED_PASSWORD))).resolves.toBe("/");

    await expect(getSession()).resolves.toMatchObject({ email: SEED_EMAIL });
  });

  it("does not create a user row as a side effect", async () => {
    await catchRedirect(signIn(SEED_EMAIL, SEED_PASSWORD));

    expect(await prisma.user.count()).toBe(0);
  });

  it("sets an httpOnly session cookie", async () => {
    await catchRedirect(signIn(SEED_EMAIL, SEED_PASSWORD));

    expect(readRawCookie("session")).toMatchObject({ httpOnly: true, path: "/" });
  });

  it("ignores casing and surrounding whitespace in the submitted email", async () => {
    await expect(catchRedirect(signIn("  SeeD@Example.TEST  ", SEED_PASSWORD))).resolves.toBe("/");

    await expect(getSession()).resolves.toMatchObject({ email: SEED_EMAIL });
  });

  it("rejects the seed email with the wrong password", async () => {
    await expect(signIn(SEED_EMAIL, "not-the-password")).resolves.toEqual({
      error: "Invalid email or password.",
    });

    await expect(getSession()).resolves.toBeNull();
  });

  it("is case-sensitive about the password", async () => {
    await expect(signIn(SEED_EMAIL, SEED_PASSWORD.toUpperCase())).resolves.toEqual({
      error: "Invalid email or password.",
    });
  });

  it("still works when unrelated users exist in the database", async () => {
    await createDbUser("someone@example.test", "another-password");

    await expect(catchRedirect(signIn(SEED_EMAIL, SEED_PASSWORD))).resolves.toBe("/");
  });

  it("prefers the stored password when the seed email also has a database row", async () => {
    const user = await createDbUser(SEED_EMAIL, "password-from-the-database");

    // The env credentials still work...
    await expect(catchRedirect(signIn(SEED_EMAIL, SEED_PASSWORD))).resolves.toBe("/");
    // ...and so does the row, which wins the session's userId.
    await expect(catchRedirect(signIn(SEED_EMAIL, "password-from-the-database"))).resolves.toBe("/");
    await expect(getSession()).resolves.toMatchObject({ userId: user.id, email: SEED_EMAIL });
  });
});

describe("login against a database user", () => {
  it("signs in with the stored bcrypt password", async () => {
    const user = await createDbUser("cook@example.test", "correct horse battery");

    await expect(catchRedirect(signIn("cook@example.test", "correct horse battery"))).resolves.toBe(
      "/"
    );

    await expect(getSession()).resolves.toMatchObject({
      userId: user.id,
      email: "cook@example.test",
    });
  });

  it("normalises the submitted email before looking the user up", async () => {
    await createDbUser("cook@example.test", "correct horse battery");

    await expect(
      catchRedirect(signIn("  COOK@Example.test ", "correct horse battery"))
    ).resolves.toBe("/");
  });

  it("rejects a wrong password without setting a session", async () => {
    await createDbUser("cook@example.test", "correct horse battery");

    await expect(signIn("cook@example.test", "wrong")).resolves.toEqual({
      error: "Invalid email or password.",
    });
    await expect(getSession()).resolves.toBeNull();
  });

  it("rejects an unknown email", async () => {
    await expect(signIn("nobody@example.test", "whatever")).resolves.toEqual({
      error: "Invalid email or password.",
    });
  });
});

describe("login input validation", () => {
  it.each([
    ["a missing email", "", SEED_PASSWORD],
    ["a missing password", SEED_EMAIL, ""],
    ["both fields missing", "", ""],
    ["a whitespace-only email", "   ", SEED_PASSWORD],
  ])("asks for both fields given %s", async (_label, email, password) => {
    await expect(signIn(email, password)).resolves.toEqual({
      error: "Enter your email and password.",
    });
  });

  it("does not touch the database when validation fails", async () => {
    await createDbUser("cook@example.test", "correct horse battery");

    await expect(signIn("", "")).resolves.toEqual({ error: "Enter your email and password." });
    await expect(getSession()).resolves.toBeNull();
  });
});

describe("logout", () => {
  it("clears the session and redirects to the login page", async () => {
    await catchRedirect(signIn(SEED_EMAIL, SEED_PASSWORD));
    await expect(getSession()).resolves.not.toBeNull();

    await expect(catchRedirect(logout())).resolves.toBe("/login");

    await expect(getSession()).resolves.toBeNull();
    expect(readRawCookie("session")).toBeUndefined();
  });
});
