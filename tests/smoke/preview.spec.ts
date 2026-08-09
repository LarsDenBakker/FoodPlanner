import { expect, test, type Page } from "@playwright/test";

/**
 * Smoke tests for a live deployment (a PR's Vercel preview, or production).
 *
 * These are deliberately READ-ONLY. A Vercel preview normally inherits the
 * same DATABASE_URL as production, so anything written here would land in real
 * household data. Rendering the signed-in pages is still a genuine end-to-end
 * check: each one is server-rendered from Postgres, so it fails if the
 * deployment cannot reach the database.
 */

const EMAIL = process.env.SMOKE_USER_EMAIL ?? process.env.SEED_USER_EMAIL ?? "";
const PASSWORD = process.env.SMOKE_USER_PASSWORD ?? process.env.SEED_USER_PASSWORD ?? "";
const hasCredentials = Boolean(EMAIL && PASSWORD);

const PROTECTED_ROUTES = ["/", "/recipes", "/planner", "/grocery-list", "/pantry"];

const SIGNED_IN_PAGES = [
  { route: "/recipes", heading: "Recipes" },
  { route: "/planner", heading: "Planner" },
  { route: "/grocery-list", heading: "Grocery List" },
  { route: "/pantry", heading: "Pantry" },
];

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

test.describe("public surface", () => {
  test("serves the login page", async ({ page }) => {
    const response = await page.goto("/login");

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "FoodHelper", level: 1 })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  for (const route of PROTECTED_ROUTES) {
    test(`sends a signed-out visitor from ${route} to the login page`, async ({ page }) => {
      await page.goto(route);

      await expect(page).toHaveURL("/login");
    });
  }

  // Exercises the login server action against the deployment's database
  // without writing anything.
  test("rejects invalid credentials without starting a session", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("not-a-real-user@example.invalid");
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Invalid email or password.")).toBeVisible();
    await expect(page).toHaveURL("/login");

    const cookies = await page.context().cookies();
    expect(cookies.find((cookie) => cookie.name === "session")).toBeUndefined();
  });
});

test.describe("signed in", () => {
  test.skip(
    !hasCredentials,
    "Set SMOKE_USER_EMAIL and SMOKE_USER_PASSWORD to run the signed-in checks."
  );

  test("signs in and lands on the home page", async ({ page }) => {
    await signIn(page);

    await expect(page.getByRole("heading", { name: "Welcome back", level: 1 })).toBeVisible();
  });

  test("issues an httpOnly, secure session cookie", async ({ page }) => {
    await signIn(page);

    const session = (await page.context().cookies()).find((cookie) => cookie.name === "session");
    expect(session).toBeDefined();
    expect(session?.httpOnly).toBe(true);
    expect(session?.secure).toBe(true);
    expect(session?.path).toBe("/");
  });

  for (const { route, heading } of SIGNED_IN_PAGES) {
    test(`renders ${route} from the database`, async ({ page }) => {
      await signIn(page);

      const response = await page.goto(route);

      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
    });
  }

  test("signs out and puts the app back behind the login page", async ({ page }) => {
    await signIn(page);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/login");

    await page.goto("/recipes");
    await expect(page).toHaveURL("/login");
  });
});
