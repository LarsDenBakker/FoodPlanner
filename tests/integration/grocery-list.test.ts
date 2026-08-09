import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  generateGroceryList,
  toggleGroceryListItemChecked,
} from "@/server/actions/grocery-list";
import { getGroceryListForRange } from "@/server/data/grocery-list";
import { revalidatedPaths, verifySessionMock } from "../helpers/next-mocks";

const MONDAY = "2026-07-27T00:00:00.000Z";
const WEDNESDAY = "2026-07-29T00:00:00.000Z";
const SUNDAY = "2026-08-02T00:00:00.000Z";

type Ingredient = { name: string; quantity: number | null; unit: string | null };

async function createRecipe(title: string, servings: number | null, ingredients: Ingredient[]) {
  return prisma.recipe.create({
    data: {
      title,
      instructions: "Cook it.",
      servings,
      ingredients: {
        create: ingredients.map((ingredient, index) => ({ ...ingredient, sortOrder: index })),
      },
    },
  });
}

function planMeal(recipeId: string, date: string, servings: number | null = null) {
  return prisma.mealPlanEntry.create({
    data: { date: new Date(date), mealSlot: "DINNER", recipeId, servings },
  });
}

const itemsByName = async () => {
  const list = await getGroceryListForRange(new Date(MONDAY), new Date(SUNDAY));
  return Object.fromEntries((list?.items ?? []).map((item) => [item.name, item]));
};

describe("generateGroceryList", () => {
  it("creates a list for the range and revalidates the page", async () => {
    const recipe = await createRecipe("Bolognese", 4, [
      { name: "spaghetti", quantity: 400, unit: "g" },
    ]);
    await planMeal(recipe.id, WEDNESDAY);

    await generateGroceryList(MONDAY, SUNDAY);

    const list = await getGroceryListForRange(new Date(MONDAY), new Date(SUNDAY));
    expect(list).not.toBeNull();
    expect(list?.startDate.toISOString()).toBe(MONDAY);
    expect(list?.endDate.toISOString()).toBe(SUNDAY);
    expect(verifySessionMock).toHaveBeenCalled();
    expect(revalidatedPaths).toContain("/grocery-list");
  });

  it("subtracts pantry stock from what the week requires", async () => {
    const recipe = await createRecipe("Bolognese", 4, [
      { name: "spaghetti", quantity: 400, unit: "g" },
      { name: "ground beef", quantity: 500, unit: "g" },
    ]);
    await planMeal(recipe.id, WEDNESDAY);
    await prisma.pantryItem.create({ data: { name: "spaghetti", quantity: 150, unit: "g" } });

    await generateGroceryList(MONDAY, SUNDAY);

    const items = await itemsByName();
    expect(items["spaghetti"]).toMatchObject({
      requiredQuantity: 400,
      pantryQuantity: 150,
      remainingQuantity: 250,
      unitMismatch: false,
      isChecked: false,
    });
    expect(items["ground beef"]).toMatchObject({
      requiredQuantity: 500,
      pantryQuantity: null,
      remainingQuantity: 500,
    });
  });

  it("scales ingredients by the servings planned for the meal", async () => {
    const recipe = await createRecipe("Bolognese", 4, [
      { name: "spaghetti", quantity: 400, unit: "g" },
    ]);
    await planMeal(recipe.id, WEDNESDAY, 6);

    await generateGroceryList(MONDAY, SUNDAY);

    expect((await itemsByName())["spaghetti"]).toMatchObject({ requiredQuantity: 600 });
  });

  it("merges the same ingredient across several planned meals", async () => {
    const pasta = await createRecipe("Bolognese", 4, [
      { name: "spaghetti", quantity: 400, unit: "g" },
    ]);
    const bake = await createRecipe("Pasta Bake", 4, [
      { name: "spaghetti", quantity: 200, unit: "g" },
    ]);
    await planMeal(pasta.id, WEDNESDAY);
    await planMeal(bake.id, SUNDAY);

    await generateGroceryList(MONDAY, SUNDAY);

    const list = await getGroceryListForRange(new Date(MONDAY), new Date(SUNDAY));
    expect(list?.items).toHaveLength(1);
    expect(list?.items[0]).toMatchObject({ name: "spaghetti", requiredQuantity: 600 });
  });

  it("flags pantry stock stored in a different unit instead of subtracting it", async () => {
    const recipe = await createRecipe("Bolognese", 4, [
      { name: "tomato sauce", quantity: 500, unit: "ml" },
    ]);
    await planMeal(recipe.id, WEDNESDAY);
    await prisma.pantryItem.create({ data: { name: "tomato sauce", quantity: 2, unit: "jar" } });

    await generateGroceryList(MONDAY, SUNDAY);

    expect((await itemsByName())["tomato sauce"]).toMatchObject({
      requiredQuantity: 500,
      pantryQuantity: 2,
      remainingQuantity: 500,
      unitMismatch: true,
    });
  });

  it("ignores meals planned outside the requested range", async () => {
    const recipe = await createRecipe("Bolognese", 4, [
      { name: "spaghetti", quantity: 400, unit: "g" },
    ]);
    await planMeal(recipe.id, "2026-08-05T00:00:00.000Z");

    await generateGroceryList(MONDAY, SUNDAY);

    const list = await getGroceryListForRange(new Date(MONDAY), new Date(SUNDAY));
    expect(list?.items).toEqual([]);
  });

  it("creates an empty list when nothing is planned", async () => {
    await generateGroceryList(MONDAY, SUNDAY);

    const list = await getGroceryListForRange(new Date(MONDAY), new Date(SUNDAY));
    expect(list).not.toBeNull();
    expect(list?.items).toEqual([]);
  });

  it("replaces the previous list for the same range rather than stacking up", async () => {
    const recipe = await createRecipe("Bolognese", 4, [
      { name: "spaghetti", quantity: 400, unit: "g" },
    ]);
    await planMeal(recipe.id, WEDNESDAY);

    await generateGroceryList(MONDAY, SUNDAY);
    await generateGroceryList(MONDAY, SUNDAY);

    expect(await prisma.groceryList.count()).toBe(1);
    expect(await prisma.groceryListItem.count()).toBe(1);
  });

  it("picks up pantry and planner changes on regeneration", async () => {
    const recipe = await createRecipe("Bolognese", 4, [
      { name: "spaghetti", quantity: 400, unit: "g" },
    ]);
    await planMeal(recipe.id, WEDNESDAY);
    await generateGroceryList(MONDAY, SUNDAY);
    expect((await itemsByName())["spaghetti"].remainingQuantity).toBe(400);

    await prisma.pantryItem.create({ data: { name: "spaghetti", quantity: 400, unit: "g" } });
    await generateGroceryList(MONDAY, SUNDAY);

    expect((await itemsByName())["spaghetti"].remainingQuantity).toBe(0);
  });

  it("keeps lists for other weeks", async () => {
    const recipe = await createRecipe("Bolognese", 4, [
      { name: "spaghetti", quantity: 400, unit: "g" },
    ]);
    await planMeal(recipe.id, WEDNESDAY);

    await generateGroceryList(MONDAY, SUNDAY);
    await generateGroceryList("2026-08-03T00:00:00.000Z", "2026-08-09T00:00:00.000Z");

    expect(await prisma.groceryList.count()).toBe(2);
    expect(await getGroceryListForRange(new Date(MONDAY), new Date(SUNDAY))).not.toBeNull();
  });
});

describe("toggleGroceryListItemChecked", () => {
  beforeEach(async () => {
    const recipe = await createRecipe("Bolognese", 4, [
      { name: "spaghetti", quantity: 400, unit: "g" },
      { name: "ground beef", quantity: 500, unit: "g" },
    ]);
    await planMeal(recipe.id, WEDNESDAY);
    await generateGroceryList(MONDAY, SUNDAY);
  });

  it("checks an item off", async () => {
    const item = (await itemsByName())["spaghetti"];

    await toggleGroceryListItemChecked(item.id, true);

    expect(
      await prisma.groceryListItem.findUniqueOrThrow({ where: { id: item.id } })
    ).toMatchObject({ isChecked: true });
    expect(verifySessionMock).toHaveBeenCalled();
    expect(revalidatedPaths).toContain("/grocery-list");
  });

  it("unchecks it again", async () => {
    const item = (await itemsByName())["spaghetti"];

    await toggleGroceryListItemChecked(item.id, true);
    await toggleGroceryListItemChecked(item.id, false);

    expect(
      await prisma.groceryListItem.findUniqueOrThrow({ where: { id: item.id } })
    ).toMatchObject({ isChecked: false });
  });

  it("does not touch the other items", async () => {
    const items = await itemsByName();

    await toggleGroceryListItemChecked(items["spaghetti"].id, true);

    expect(
      await prisma.groceryListItem.findUniqueOrThrow({ where: { id: items["ground beef"].id } })
    ).toMatchObject({ isChecked: false });
  });

  it("throws for an unknown item id", async () => {
    await expect(toggleGroceryListItemChecked("no-such-item", true)).rejects.toThrow();
  });

  it("loses the checked state when the list is regenerated", async () => {
    const item = (await itemsByName())["spaghetti"];
    await toggleGroceryListItemChecked(item.id, true);

    await generateGroceryList(MONDAY, SUNDAY);

    expect((await itemsByName())["spaghetti"].isChecked).toBe(false);
  });
});

describe("getGroceryListForRange", () => {
  it("returns null when no list has been generated", async () => {
    await expect(
      getGroceryListForRange(new Date(MONDAY), new Date(SUNDAY))
    ).resolves.toBeNull();
  });

  it("returns items sorted by name", async () => {
    const recipe = await createRecipe("Everything", 1, [
      { name: "zucchini", quantity: 1, unit: null },
      { name: "apple", quantity: 2, unit: null },
      { name: "mango", quantity: 3, unit: null },
    ]);
    await planMeal(recipe.id, WEDNESDAY);
    await generateGroceryList(MONDAY, SUNDAY);

    const list = await getGroceryListForRange(new Date(MONDAY), new Date(SUNDAY));
    expect(list?.items.map((item) => item.name)).toEqual(["apple", "mango", "zucchini"]);
  });

  it("does not return a list generated for a different range", async () => {
    await generateGroceryList("2026-08-03T00:00:00.000Z", "2026-08-09T00:00:00.000Z");

    await expect(
      getGroceryListForRange(new Date(MONDAY), new Date(SUNDAY))
    ).resolves.toBeNull();
  });
});
