import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { TEST_DATABASE_URL } from "./tests/integration/database-url.mjs";

/** Integration tests: real Postgres, real Prisma queries, mocked Next request scope. */
export default defineConfig({
  resolve: {
    // Resolves the "@/*" paths from tsconfig.json.
    tsconfigPaths: true,
    alias: {
      "server-only": fileURLToPath(new URL("./tests/helpers/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    setupFiles: ["tests/integration/setup.ts"],
    // One database, shared by every test file — keep them off each other's rows.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      SESSION_SECRET: "integration-test-session-secret",
      SEED_USER_EMAIL: "seed@example.test",
      SEED_USER_PASSWORD: "seed-password-123",
    },
  },
});
