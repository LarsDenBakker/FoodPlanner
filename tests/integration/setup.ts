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

// Never call the real Anthropic API in tests -- every AI-triggered action is
// tested against a canned `parsed_output`, the same way the DB is real but
// the LLM call is not.
vi.mock("@/lib/anthropic", async () => {
  const { anthropicMock } = await import("../helpers/anthropic-mock");
  return { anthropic: anthropicMock, AI_PLANNER_MODEL: "claude-sonnet-5" };
});

import { assertIsTestDatabase } from "./database-url.mjs";
import { clearCookies } from "../helpers/cookie-jar";
import { resetNextMocks } from "../helpers/next-mocks";
import { resetAnthropicMock } from "../helpers/anthropic-mock";
import { prisma, resetDatabase } from "../helpers/db";

assertIsTestDatabase(process.env.DATABASE_URL ?? "");

beforeEach(async () => {
  await resetDatabase();
  clearCookies();
  resetNextMocks();
  resetAnthropicMock();
});

afterAll(async () => {
  await prisma.$disconnect();
});
