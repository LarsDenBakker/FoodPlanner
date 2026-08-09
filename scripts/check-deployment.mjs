#!/usr/bin/env node
/**
 * Preflight for the deployment smoke tests.
 *
 * Confirms the deployment is actually reachable and actually serving the app
 * before a browser is launched at it, so the two most common CI failures —
 * Deployment Protection, and a deployment that is not ready yet — surface as
 * one clear message instead of a screen of selector timeouts.
 */

import { isProtectionResponse } from "./lib/vercel-protection.mjs";

const rawUrl = process.env.DEPLOYMENT_URL ?? process.env.PREVIEW_URL ?? "";
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "";

const ATTEMPTS = Number(process.env.PREFLIGHT_ATTEMPTS ?? 5);
const DELAY_MS = Number(process.env.PREFLIGHT_DELAY_MS ?? 4000);

if (!rawUrl) {
  console.error("DEPLOYMENT_URL is not set.");
  process.exit(1);
}

const baseUrl = (/^https?:\/\//.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/$/, "");
const target = `${baseUrl}/login`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message, detail) {
  console.error(`\n✗ ${message}`);
  if (detail) console.error(`\n${detail}`);
  process.exit(1);
}

async function attempt() {
  const response = await fetch(target, {
    redirect: "manual",
    headers: bypassSecret ? { "x-vercel-protection-bypass": bypassSecret } : {},
  });
  const body = await response.text().catch(() => "");
  const location = response.headers.get("location") ?? "";
  const vercelId = response.headers.get("x-vercel-id") ?? "—";
  const vercelError = response.headers.get("x-vercel-error");

  const looksProtected = isProtectionResponse({
    status: response.status,
    location,
    body,
    baseUrl,
  });

  return { response, body, location, vercelId, vercelError, looksProtected };
}

console.log(`Preflight: ${target}`);

let last;
for (let i = 1; i <= ATTEMPTS; i++) {
  try {
    last = await attempt();
  } catch (error) {
    console.log(`  attempt ${i}/${ATTEMPTS}: unreachable (${error.message})`);
    last = { networkError: error.message };
    if (i < ATTEMPTS) await sleep(DELAY_MS);
    continue;
  }

  const { response, looksProtected, vercelId } = last;
  console.log(`  attempt ${i}/${ATTEMPTS}: ${response.status} (x-vercel-id: ${vercelId})`);

  if (looksProtected) {
    fail(
      "The deployment is behind Vercel Deployment Protection.",
      "Every request is being answered with Vercel's authentication page, so the smoke\n" +
        "tests cannot reach the app. Create a bypass token in Vercel:\n" +
        "  Project Settings → Deployment Protection → Protection Bypass for Automation\n" +
        "and add it to this repository as the secret VERCEL_AUTOMATION_BYPASS_SECRET."
    );
  }

  if (response.ok) {
    if (!/FoodHelper/i.test(last.body)) {
      fail(
        `${target} returned 200 but does not look like the login page.`,
        `First 500 characters of the response:\n\n${last.body.slice(0, 500)}`
      );
    }
    console.log("\n✓ Deployment is reachable and serving the login page.");
    process.exit(0);
  }

  // 5xx on a just-promoted deployment is usually a cold start; retry.
  if (i < ATTEMPTS) await sleep(DELAY_MS);
}

if (last?.networkError) {
  fail(`Could not reach ${target}.`, `Last error: ${last.networkError}`);
}

fail(
  `${target} never became healthy (last status ${last.response.status}).`,
  last.vercelError
    ? `Vercel reported x-vercel-error: ${last.vercelError}`
    : `x-vercel-id: ${last.vercelId}\n\nFirst 500 characters of the response:\n\n${last.body.slice(0, 500)}`
);
