import { afterAll, beforeEach, vi } from "vitest";

// Replace the Next APIs that require a request scope. Registering the mocks
// here applies them to every integration test file.
vi.mock("next/cache", async () => {
  const { revalidatePath } = await import("../helpers/next-mocks");
  return { revalidatePath, revalidateTag: () => {} };
});

vi.mock("next/navigation", async () => {
  const { redirect } = await import("../helpers/next-mocks");
  return {
    redirect,
    notFound: () => {
      throw new Error("NEXT_NOT_FOUND");
    },
  };
});

vi.mock("next/headers", async () => {
  const { cookieJar } = await import("../helpers/cookie-jar");
  return { cookies: async () => cookieJar };
});

// Every server action starts with `await verifySession()`. Standing in for it
// keeps the tests focused on behaviour while still proving the gate is called.
vi.mock("@/lib/dal", async () => {
  const { verifySessionMock } = await import("../helpers/next-mocks");
  return { verifySession: verifySessionMock };
});

import { assertIsTestDatabase } from "./database-url.mjs";
import { clearCookies } from "../helpers/cookie-jar";
import { resetNextMocks } from "../helpers/next-mocks";
import { prisma, resetDatabase } from "../helpers/db";

assertIsTestDatabase(process.env.DATABASE_URL ?? "");

beforeEach(async () => {
  await resetDatabase();
  clearCookies();
  resetNextMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});
