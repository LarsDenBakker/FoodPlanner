import { execFileSync } from "node:child_process";
import { TEST_DATABASE_URL, assertIsTestDatabase } from "./database-url.mjs";

/** Brings the test database's schema up to date once per run. */
export default function setup() {
  assertIsTestDatabase(TEST_DATABASE_URL);

  try {
    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: "pipe",
    });
  } catch (error) {
    const { stdout, stderr } = error as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(
      "Failed to migrate the test database. Is Postgres running (`docker compose up -d`)?\n" +
        `${stdout?.toString() ?? ""}${stderr?.toString() ?? ""}`
    );
  }
}
