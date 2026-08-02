#!/usr/bin/env node
/**
 * Collects Vercel-side diagnostics for a deployment whose smoke tests failed.
 *
 * Answers "why did it fail *inside* Vercel?" by pulling the deployment's state,
 * its build log, and its runtime errors, alongside a direct HTTP probe.
 *
 * Everything is written to ./vercel-diagnostics (raw, for the CI artifact) plus
 * a redacted report.md safe to surface in a PR comment.
 *
 * Degrades gracefully: without VERCEL_TOKEN it still reports the HTTP probe and
 * says which credentials were missing. It never exits non-zero — the smoke-test
 * failure is the real result; this must not mask it.
 */

import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { isProtectionResponse } from "./lib/vercel-protection.mjs";

const execFileAsync = promisify(execFile);

const OUT_DIR = process.env.DIAGNOSTICS_DIR ?? "vercel-diagnostics";
const CLI_VERSION = process.env.VERCEL_CLI_VERSION ?? "58.4.4";
const COMMAND_TIMEOUT_MS = 120_000;

const deploymentUrl = process.env.DEPLOYMENT_URL ?? "";
const token = process.env.VERCEL_TOKEN ?? "";
const scope = process.env.VERCEL_TEAM_ID ?? process.env.VERCEL_ORG_ID ?? "";
const project = process.env.VERCEL_PROJECT_ID ?? "";
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "";

/** Values that must never reach a log, artifact or PR comment. */
const SECRETS = [token, bypassSecret, process.env.SMOKE_USER_PASSWORD, process.env.SEED_USER_PASSWORD]
  .filter((value) => typeof value === "string" && value.length >= 6)
  .sort((a, b) => b.length - a.length);

function redact(text) {
  if (!text) return "";
  let output = String(text);
  for (const secret of SECRETS) {
    output = output.split(secret).join("«redacted»");
  }
  return output
    .replace(/\b(postgres(?:ql)?:\/\/)[^\s"']+/gi, "$1«redacted»")
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/-]{12,}/gi, "$1«redacted»")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "«redacted-jwt»");
}

/** Runs the Vercel CLI via npx, returning its output rather than throwing. */
async function vercel(args, { label }) {
  if (!token) {
    return { ok: false, skipped: true, output: "", error: "VERCEL_TOKEN is not set." };
  }

  const fullArgs = [
    "--yes",
    `vercel@${CLI_VERSION}`,
    ...args,
    "--token",
    token,
    ...(scope ? ["--scope", scope] : []),
  ];

  try {
    const { stdout, stderr } = await execFileAsync("npx", fullArgs, {
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: 20 * 1024 * 1024,
      env: { ...process.env, VERCEL_TELEMETRY_DISABLED: "1" },
    });
    // `vercel inspect --logs` writes the log stream to stderr.
    return { ok: true, output: `${stdout}${stderr}`.trim(), error: "" };
  } catch (error) {
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim();
    console.warn(`  ! ${label} failed: ${error.shortMessage ?? error.message}`);
    return { ok: false, output, error: error.shortMessage ?? String(error.message) };
  }
}

/** Direct HTTP request — works with no Vercel credentials at all. */
async function probe(url) {
  const target = `${url.replace(/\/$/, "")}/login`;
  try {
    const response = await fetch(target, {
      redirect: "manual",
      headers: bypassSecret ? { "x-vercel-protection-bypass": bypassSecret } : {},
    });
    const body = await response.text().catch(() => "");
    const headers = Object.fromEntries(response.headers.entries());

    return {
      url: target,
      status: response.status,
      location: headers.location ?? null,
      vercelId: headers["x-vercel-id"] ?? null,
      vercelError: headers["x-vercel-error"] ?? null,
      vercelCache: headers["x-vercel-cache"] ?? null,
      // Deployment Protection answers every request with Vercel's own SSO page,
      // which otherwise shows up as a pile of confusing selector failures.
      looksProtected: isProtectionResponse({
        status: response.status,
        location: headers.location,
        body,
        baseUrl: target,
      }),
      bodyPreview: body.slice(0, 600),
    };
  } catch (error) {
    return { url: target, error: error.message, unreachable: true };
  }
}

function section(title, body) {
  return `## ${title}\n\n${body}\n`;
}

function codeBlock(text, { lang = "", tail } = {}) {
  const lines = String(text || "").split("\n");
  const kept = tail && lines.length > tail ? lines.slice(-tail) : lines;
  const prefix = tail && lines.length > tail ? `… trimmed to the last ${tail} lines …\n` : "";
  return `\`\`\`${lang}\n${prefix}${kept.join("\n").trim() || "(no output)"}\n\`\`\``;
}

async function main() {
  if (!deploymentUrl) {
    console.error("DEPLOYMENT_URL is not set — nothing to diagnose.");
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Collecting Vercel diagnostics for ${deploymentUrl}`);

  const httpProbe = await probe(deploymentUrl);
  await writeFile(path.join(OUT_DIR, "probe.json"), redact(JSON.stringify(httpProbe, null, 2)));

  const [inspect, buildLogs, runtimeErrors, runtimeRecent] = [
    await vercel(["inspect", deploymentUrl, "--json"], { label: "vercel inspect" }),
    await vercel(["inspect", deploymentUrl, "--logs"], { label: "vercel inspect --logs" }),
    await vercel(
      [
        "logs",
        deploymentUrl,
        "--json",
        "--level",
        "error",
        "--since",
        "1h",
        "--limit",
        "100",
        ...(project ? ["--project", project] : []),
      ],
      { label: "vercel logs --level error" }
    ),
    await vercel(
      [
        "logs",
        deploymentUrl,
        "--json",
        "--since",
        "1h",
        "--limit",
        "100",
        ...(project ? ["--project", project] : []),
      ],
      { label: "vercel logs" }
    ),
  ];

  await Promise.all([
    writeFile(path.join(OUT_DIR, "inspect.json"), redact(inspect.output)),
    writeFile(path.join(OUT_DIR, "build-logs.txt"), redact(buildLogs.output)),
    writeFile(path.join(OUT_DIR, "runtime-errors.jsonl"), redact(runtimeErrors.output)),
    writeFile(path.join(OUT_DIR, "runtime-logs.jsonl"), redact(runtimeRecent.output)),
  ]);

  // ---- Build the human-readable report ----
  const parts = [`# Vercel deployment diagnostics\n\n**Deployment:** ${deploymentUrl}`];

  const probeLines = httpProbe.unreachable
    ? `The deployment could not be reached: \`${httpProbe.error}\``
    : [
        `| Check | Value |`,
        `| --- | --- |`,
        `| \`GET /login\` | ${httpProbe.status}${httpProbe.location ? ` → ${httpProbe.location}` : ""} |`,
        `| \`x-vercel-id\` | ${httpProbe.vercelId ?? "—"} |`,
        `| \`x-vercel-error\` | ${httpProbe.vercelError ?? "—"} |`,
        `| Looks protected | ${httpProbe.looksProtected ? "**yes**" : "no"} |`,
      ].join("\n");
  parts.push(section("HTTP probe", probeLines));

  if (httpProbe.looksProtected) {
    parts.push(
      section(
        "Likely cause: Deployment Protection",
        "The deployment answered with Vercel's own authentication page, so the smoke tests " +
          "never reached the app. Add a `VERCEL_AUTOMATION_BYPASS_SECRET` repository secret " +
          "(Vercel → Project Settings → Deployment Protection → Protection Bypass for Automation)."
      )
    );
  }

  if (!token) {
    parts.push(
      section(
        "Vercel API checks skipped",
        "No `VERCEL_TOKEN` secret is configured, so the build log, runtime logs and deployment " +
          "state could not be read. Add `VERCEL_TOKEN` (and `VERCEL_TEAM_ID` for team projects) " +
          "to enable them."
      )
    );
  } else {
    if (inspect.ok) {
      try {
        const data = JSON.parse(inspect.output);
        const summary = [
          `| Field | Value |`,
          `| --- | --- |`,
          `| State | ${data.readyState ?? data.status ?? "unknown"} |`,
          `| Deployment id | ${data.id ?? "—"} |`,
          `| Created | ${data.createdAt ? new Date(data.createdAt).toISOString() : "—"} |`,
          `| Commit | ${data.meta?.githubCommitSha?.slice(0, 8) ?? "—"} |`,
        ].join("\n");
        parts.push(section("Deployment", summary));
      } catch {
        parts.push(section("Deployment", codeBlock(redact(inspect.output), { tail: 40 })));
      }
    }

    const errorLines = runtimeErrors.output.split("\n").filter(Boolean);
    parts.push(
      section(
        `Runtime errors (${errorLines.length})`,
        errorLines.length
          ? codeBlock(redact(errorLines.slice(0, 20).join("\n")), { lang: "json" })
          : "No error-level runtime logs in the last hour. If the app returned 500s, check " +
              "`runtime-logs.jsonl` in the artifact for the full request log."
      )
    );

    parts.push(
      section("Build log (tail)", codeBlock(redact(buildLogs.output), { tail: 40 }))
    );
  }

  parts.push(
    section(
      "Full output",
      "The complete build log, runtime logs and deployment JSON are in the " +
        "`vercel-diagnostics` artifact on this workflow run."
    )
  );

  const report = parts.join("\n");
  await writeFile(path.join(OUT_DIR, "report.md"), report);
  console.log(`\n${report}`);
}

main().catch((error) => {
  // Never mask the smoke-test failure with a diagnostics failure.
  console.error(`Diagnostics collection failed: ${error.message}`);
});
