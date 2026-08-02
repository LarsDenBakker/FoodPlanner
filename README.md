# FoodHelper

A household meal planner and grocery list app. Plan meals for the week, keep a
recipe box, track what's in the pantry, and generate a shopping list that
subtracts what you already have.

Built with Next.js (App Router), Prisma + PostgreSQL, and a small hand-rolled
login gate (one shared household login — not per-user data).

## Local development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start a local Postgres with Docker Compose:
   ```bash
   docker compose up -d
   ```
   This runs Postgres 16 on `localhost:5432` with a `foodhelper`/`foodhelper_dev`
   user/db (data persists in a Docker volume across restarts). No Docker?
   Any local Postgres works — just point `DATABASE_URL` at it (same
   connection-string shape as below).
3. Copy the env template and fill in the blanks:
   ```bash
   cp .env.example .env
   ```
   `DATABASE_URL` already matches the Compose service. Generate a
   `SESSION_SECRET` with `openssl rand -base64 32`, and set `SEED_USER_EMAIL` /
   `SEED_USER_PASSWORD` for the initial login.
4. Apply the schema:
   ```bash
   npx prisma migrate dev
   ```
   `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` are checked directly against the
   login form, so you can sign in as soon as they're set in the environment —
   no database row required. Running `npx prisma db seed` is optional and
   only useful for pre-populating sample recipes/pantry/meal-plan data.
5. Start the dev server:
   ```bash
   npm run dev
   ```
   Sign in at [http://localhost:3000/login](http://localhost:3000/login) with
   the `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` you set.

## Tests

Three layers, each runnable on its own:

```bash
npm run test              # unit + integration
npm run test:unit         # fast, no database
npm run test:integration  # against a real Postgres
npm run test:e2e          # Playwright browser test, local dev server
npm run test:preview      # smoke tests against a deployed URL
```

### Unit tests (`tests/unit`)

Pure logic, no database and no Next request scope: grocery-list aggregation
(serving scaling, ingredient merging, pantry subtraction, unit mismatches),
week/date maths, and session cookie signing and verification.

### Integration tests (`tests/integration`)

The server actions and data-access functions run against a real Postgres, so
the Prisma queries, cascades, and transactions are genuinely exercised. Only
the Next.js request-scoped APIs are stubbed — `cookies()`, `revalidatePath()`,
and `redirect()` (which still throws, as the real one does, so control flow
matches production).

They use a **separate database** from your dev one, because every test empties
all tables. The default is `foodhelper_test` on the Compose Postgres; override
it with `TEST_DATABASE_URL`. A guard refuses to run if the target database name
doesn't contain `test`, and migrations are applied automatically before the
suite.

```bash
docker compose up -d
createdb -h localhost -U foodhelper foodhelper_test   # once
npm run test:integration
```

### Deployment smoke tests (`tests/smoke`)

Read-only checks against an environment that is already live — a PR's Vercel
preview, or production. `.github/workflows/preview-smoke-tests.yml` runs them
automatically whenever Vercel reports a successful preview deployment, so each
PR gets its own deployment verified.

```bash
DEPLOYMENT_URL=https://foodhelper-abc123.vercel.app \
SMOKE_USER_EMAIL=... SMOKE_USER_PASSWORD=... \
npm run test:preview
```

They cover: the login page renders, every protected route redirects a signed-out
visitor to it, bad credentials are rejected, signing in issues an httpOnly and
secure session cookie, each signed-in page server-renders (which only works if
the deployment can reach Postgres), and signing out re-protects the app.

They deliberately **write nothing**, because a Vercel preview normally inherits
production's `DATABASE_URL` — a preview that creates recipes would be creating
them in real household data. Give previews their own database if you want
write coverage here.

#### When a run fails

The workflow debugs the deployment for you rather than leaving you with a red
check. On failure it runs `scripts/vercel-diagnostics.mjs`, which collects:

- an HTTP probe of the deployment (status, `x-vercel-id`, `x-vercel-error`)
- the deployment's state via `vercel inspect`
- the **build log** via `vercel inspect --logs`
- **runtime errors** via `vercel logs --level error`

The full output is uploaded as the `vercel-diagnostics` artifact, and a redacted
summary is posted as a single, updated-in-place PR comment. Connection strings,
JWTs, bearer tokens and known secret values are stripped before anything is
posted — raw logs stay in the artifact, which only collaborators can read.

A preflight step runs *before* the browser, so the two most common failures —
Deployment Protection, and a deployment that is not serving yet — fail with one
clear message instead of a screen of selector timeouts.

#### Repository secrets

| Secret | Needed for |
| --- | --- |
| `SEED_USER_EMAIL`, `SEED_USER_PASSWORD` | the signed-in checks. Must match the **Preview** environment values in Vercel. Without them those tests skip and only the public ones run |
| `VERCEL_TOKEN` | reading build and runtime logs when a run fails. Without it, diagnostics fall back to the HTTP probe alone |
| `VERCEL_TEAM_ID` | only for team-owned projects (`--scope` for the Vercel CLI) |
| `VERCEL_PROJECT_ID` | narrows the runtime log query; optional |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | only if the preview is behind Vercel Deployment Protection (Project Settings → Deployment Protection → Protection Bypass for Automation) |

### End-to-end test (`tests/e2e`)

A Playwright smoke test covering the full flow: login → create a recipe → stock
the pantry → assign it in the planner → generate the grocery list → verify
need-to-buy vs. already-have → delete the recipe → sign out. It boots the dev
server itself and needs `DATABASE_URL`, `SEED_USER_EMAIL`, and
`SEED_USER_PASSWORD` to be set (it logs in as the seed user).

## Deploying

The app is designed to deploy to Vercel with a hosted Postgres database
(Vercel Postgres / Neon, or any standard Postgres provider):

1. Create a Postgres database and copy its connection string.
2. In the Vercel project settings, set `DATABASE_URL`, `SESSION_SECRET`, and
   optionally re-run the seed script (`npx prisma db seed`) against that
   database to create the household login.
3. Deploy. `next build` runs the standard production build; no database
   access happens at build time.

## How the grocery list works

Ingredients from every recipe planned in a date range are aggregated (summed
per ingredient name + unit, scaled by servings), then matched against pantry
items by normalized name and unit. This is intentionally simple for v1: no
unit conversion (e.g. cups vs. grams) and no fuzzy/synonym matching — use
consistent, simple ingredient names (e.g. "flour", not "all-purpose flour")
for the best results.
