import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Unit tests: pure logic, no database, no Next request scope. */
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
    include: ["tests/unit/**/*.test.ts"],
    env: {
      SESSION_SECRET: "unit-test-session-secret",
    },
  },
});
