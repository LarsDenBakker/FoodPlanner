import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke tests against an already-deployed environment (a Vercel preview on a
 * PR, or production). Unlike playwright.config.ts this starts no server of its
 * own — it points a browser at a URL that is already live.
 */

const rawUrl = process.env.DEPLOYMENT_URL ?? process.env.PREVIEW_URL ?? "";
if (!rawUrl) {
  throw new Error(
    "Set DEPLOYMENT_URL to the deployment you want to smoke-test, " +
      "e.g. DEPLOYMENT_URL=https://foodhelper-abc123.vercel.app"
  );
}
const baseURL = /^https?:\/\//.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

// Preview deployments guarded by Vercel Deployment Protection need a bypass
// token, otherwise every request is answered with Vercel's own login page.
// Vercel project settings → Deployment Protection → Protection Bypass for Automation.
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

// Set in sandboxes that ship a preinstalled browser; CI uses the default.
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./tests/smoke",
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  // A cold serverless function or a database waking up is worth one more try.
  retries: process.env.CI ? 2 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI
    ? [["github"], ["list"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    ...(bypassSecret
      ? {
          extraHTTPHeaders: {
            "x-vercel-protection-bypass": bypassSecret,
            "x-vercel-set-bypass-cookie": "true",
          },
        }
      : {}),
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
      },
    },
  ],
});
