import { test, expect } from "@playwright/test";

const EMAIL = process.env.SEED_USER_EMAIL ?? "you@example.com";
const PASSWORD = process.env.SEED_USER_PASSWORD ?? "change-me-please";

/** Mirrors getWeekRange() in src/lib/date.ts so the test targets the same "this week" cell the app renders. */
function getThisWeekWednesdayISO(): string {
  const now = new Date();
  const utcToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekday = utcToday.getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const monday = new Date(utcToday.getTime() + mondayOffset * 24 * 60 * 60 * 1000);
  const wednesday = new Date(monday.getTime() + 2 * 24 * 60 * 60 * 1000);
  return wednesday.toISOString().slice(0, 10);
}

test("full meal planning + grocery list flow", async ({ page }) => {
  // Unique per run so re-runs never aggregate against a previous run's leftover data.
  const runId = Date.now();
  const recipeTitle = `Test Spaghetti ${runId}`;
  const spaghettiName = `test spaghetti ${runId}`;
  const groundBeefName = `test ground beef ${runId}`;
  const tomatoSauceName = `test tomato sauce ${runId}`;

  await test.step("log in", async () => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");
  });

  await test.step("create a recipe", async () => {
    await page.goto("/recipes/new");
    await page.getByLabel("Title").fill(recipeTitle);
    await page.getByLabel("Servings").fill("4");

    const ingredients = [
      { name: spaghettiName, quantity: "400", unit: "g" },
      { name: groundBeefName, quantity: "500", unit: "g" },
      { name: tomatoSauceName, quantity: "1", unit: "jar" },
    ];

    for (let i = 0; i < ingredients.length; i++) {
      if (i > 0) {
        await page.getByRole("button", { name: "+ Add ingredient" }).click();
      }
      const row = page.getByTestId("ingredient-row").nth(i);
      await row.locator('input[name="ingredientName"]').fill(ingredients[i].name);
      await row.locator('input[name="ingredientQuantity"]').fill(ingredients[i].quantity);
      await row.locator('input[name="ingredientUnit"]').fill(ingredients[i].unit);
    }

    await page.getByLabel("Instructions").fill("1. Cook.\n2. Eat.");
    await page.getByRole("button", { name: "Create recipe" }).click();
    await expect(page.getByRole("heading", { name: recipeTitle })).toBeVisible();
  });

  await test.step("stock the pantry", async () => {
    await page.goto("/pantry");
    await page.locator('form[action] input[name="name"]').first().fill(spaghettiName);
    await page.locator('form[action] input[name="quantity"]').first().fill("200");
    await page.locator('form[action] input[name="unit"]').first().fill("g");
    await page.getByRole("button", { name: "Add" }).click();
    // Wait for the row to land before submitting again — otherwise the second
    // submission can race the first request's revalidation. Pantry rows render
    // the name in an <input>, so match on its value, not its (nonexistent) text node.
    await expect(page.locator(`input[value="${spaghettiName}"]`)).toBeVisible();

    await page.locator('form[action] input[name="name"]').first().fill(tomatoSauceName);
    await page.locator('form[action] input[name="quantity"]').first().fill("1");
    await page.locator('form[action] input[name="unit"]').first().fill("jar");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.locator(`input[value="${tomatoSauceName}"]`)).toBeVisible();
  });

  await test.step("assign the recipe to this week's Wednesday dinner", async () => {
    await page.goto("/planner");
    const wednesdayISO = getThisWeekWednesdayISO();
    const dinnerSelect = page.getByTestId(`recipe-select-${wednesdayISO}-DINNER`);
    await dinnerSelect.selectOption({ label: recipeTitle });
    await dinnerSelect.locator("xpath=ancestor::form").getByRole("button", { name: "Add" }).click();
    await expect(page.getByTestId("meal-plan-entry").filter({ hasText: recipeTitle })).toBeVisible();
  });

  await test.step("generate the grocery list and check aggregation", async () => {
    await page.goto("/grocery-list");
    await page.getByRole("button", { name: /generate for this week/i }).click();

    await expect(page.getByText(`500 g ${groundBeefName}`)).toBeVisible();
    await expect(page.getByText(`200 g ${spaghettiName}`)).toBeVisible();

    const alreadyHaveSection = page.getByRole("heading", { name: "Already have enough" }).locator("..");
    await expect(alreadyHaveSection.getByText(tomatoSauceName)).toBeVisible();
  });

  await test.step("delete the recipe and confirm cascade", async () => {
    await page.goto("/recipes");
    await page.getByRole("link", { name: recipeTitle }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL("/recipes");
    await expect(page.getByText(recipeTitle)).toHaveCount(0);

    await page.goto("/planner");
    await expect(page.getByTestId("meal-plan-entry").filter({ hasText: recipeTitle })).toHaveCount(0);
  });

  await test.step("sign out", async () => {
    await page.goto("/");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/login");

    await page.goto("/recipes");
    await expect(page).toHaveURL("/login");
  });
});
