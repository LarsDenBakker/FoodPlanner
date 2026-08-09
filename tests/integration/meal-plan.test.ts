import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createMealPlanEntry, deleteMealPlanEntry } from "@/server/actions/meal-plan";
import {
  getMealPlanForRange,
  getMealPlanForRangeWithIngredients,
} from "@/server/data/meal-plan";
import { revalidatedPaths, verifySessionMock } from "../helpers/next-mocks";

const MONDAY = "2026-07-27";
const WEDNESDAY = "2026-07-29";
const SUNDAY = "2026-08-02";
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

function entryForm(recipeId: string, servings?: string) {
  const formData = new FormData();
  formData.set("recipeId", recipeId);
  formData.set("servings", servings ?? "");
  return formData;
}

async function createRecipe(title = "Spaghetti Bolognese", ingredients: string[] = []) {
  return prisma.recipe.create({
    data: {
      title,
      instructions: "Cook it.",
      servings: 4,
      ingredients: {
        create: ingredients.map((name, index) => ({ name, quantity: 1, unit: "g", sortOrder: index })),
      },
    },
  });
}

describe("createMealPlanEntry", () => {
  it("plans a recipe for a date and slot", async () => {
    const recipe = await createRecipe();

    await createMealPlanEntry(`${WEDNESDAY}T00:00:00Z`, "DINNER", entryForm(recipe.id, "6"));

    const entries = await prisma.mealPlanEntry.findMany();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      recipeId: recipe.id,
      mealSlot: "DINNER",
      servings: 6,
    });
    expect(entries[0].date.toISOString()).toBe("2026-07-29T00:00:00.000Z");
  });

  it("checks the session and revalidates the planner and grocery list", async () => {
    const recipe = await createRecipe();

    await createMealPlanEntry(`${WEDNESDAY}T00:00:00Z`, "LUNCH", entryForm(recipe.id));

    expect(verifySessionMock).toHaveBeenCalled();
    expect(revalidatedPaths).toContain("/planner");
    expect(revalidatedPaths).toContain("/grocery-list");
  });

  it("leaves servings null when none is given, so the recipe's own count is used", async () => {
    const recipe = await createRecipe();

    await createMealPlanEntry(`${WEDNESDAY}T00:00:00Z`, "DINNER", entryForm(recipe.id));

    expect((await prisma.mealPlanEntry.findFirstOrThrow()).servings).toBeNull();
  });

  it("ignores a submission with no recipe selected", async () => {
    await createMealPlanEntry(`${WEDNESDAY}T00:00:00Z`, "DINNER", entryForm(""));

    expect(await prisma.mealPlanEntry.count()).toBe(0);
    expect(revalidatedPaths).toEqual([]);
  });

  it("allows several slots on the same day", async () => {
    const recipe = await createRecipe();

    await createMealPlanEntry(`${WEDNESDAY}T00:00:00Z`, "LUNCH", entryForm(recipe.id));
    await createMealPlanEntry(`${WEDNESDAY}T00:00:00Z`, "DINNER", entryForm(recipe.id));

    expect(await prisma.mealPlanEntry.count()).toBe(2);
  });

  it("rejects a recipe id that does not exist", async () => {
    await expect(
      createMealPlanEntry(`${WEDNESDAY}T00:00:00Z`, "DINNER", entryForm("no-such-recipe"))
    ).rejects.toThrow();

    expect(await prisma.mealPlanEntry.count()).toBe(0);
  });
});

describe("deleteMealPlanEntry", () => {
  it("removes the entry but keeps the recipe", async () => {
    const recipe = await createRecipe();
    const entry = await prisma.mealPlanEntry.create({
      data: { date: day(WEDNESDAY), mealSlot: "DINNER", recipeId: recipe.id },
    });

    await deleteMealPlanEntry(entry.id);

    expect(await prisma.mealPlanEntry.count()).toBe(0);
    expect(await prisma.recipe.findUnique({ where: { id: recipe.id } })).not.toBeNull();
    expect(revalidatedPaths).toContain("/planner");
  });
});

describe("getMealPlanForRange", () => {
  it("includes both ends of the range and excludes days outside it", async () => {
    const recipe = await createRecipe();
    for (const date of ["2026-07-26", MONDAY, WEDNESDAY, SUNDAY, "2026-08-03"]) {
      await prisma.mealPlanEntry.create({
        data: { date: day(date), mealSlot: "DINNER", recipeId: recipe.id },
      });
    }

    const entries = await getMealPlanForRange(day(MONDAY), day(SUNDAY));

    expect(entries.map((entry) => entry.date.toISOString().slice(0, 10))).toEqual([
      MONDAY,
      WEDNESDAY,
      SUNDAY,
    ]);
  });

  it("returns entries in date order with the recipe attached", async () => {
    const recipe = await createRecipe("Soup");
    await prisma.mealPlanEntry.create({
      data: { date: day(SUNDAY), mealSlot: "DINNER", recipeId: recipe.id },
    });
    await prisma.mealPlanEntry.create({
      data: { date: day(MONDAY), mealSlot: "LUNCH", recipeId: recipe.id },
    });

    const entries = await getMealPlanForRange(day(MONDAY), day(SUNDAY));

    expect(entries.map((entry) => entry.mealSlot)).toEqual(["LUNCH", "DINNER"]);
    expect(entries[0].recipe.title).toBe("Soup");
  });

  it("returns an empty list for a week with nothing planned", async () => {
    await expect(getMealPlanForRange(day(MONDAY), day(SUNDAY))).resolves.toEqual([]);
  });
});

describe("getMealPlanForRangeWithIngredients", () => {
  it("loads each planned recipe's ingredients", async () => {
    const recipe = await createRecipe("Bolognese", ["spaghetti", "beef"]);
    await prisma.mealPlanEntry.create({
      data: { date: day(WEDNESDAY), mealSlot: "DINNER", recipeId: recipe.id },
    });

    const entries = await getMealPlanForRangeWithIngredients(day(MONDAY), day(SUNDAY));

    expect(entries[0].recipe.ingredients.map((i) => i.name).sort()).toEqual(["beef", "spaghetti"]);
  });
});
