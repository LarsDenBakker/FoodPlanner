import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createRecipe, deleteRecipe, updateRecipe } from "@/server/actions/recipes";
import { getRecipeById, getRecipes } from "@/server/data/recipes";
import { catchRedirect, revalidatedPaths, verifySessionMock } from "../helpers/next-mocks";

type IngredientRow = { name: string; quantity?: string; unit?: string; notes?: string };

function recipeForm(fields: {
  title?: string;
  description?: string;
  instructions?: string;
  servings?: string;
  ingredients?: IngredientRow[];
}) {
  const formData = new FormData();
  formData.set("title", fields.title ?? "");
  formData.set("description", fields.description ?? "");
  formData.set("instructions", fields.instructions ?? "");
  formData.set("servings", fields.servings ?? "");

  for (const ingredient of fields.ingredients ?? []) {
    formData.append("ingredientName", ingredient.name);
    formData.append("ingredientQuantity", ingredient.quantity ?? "");
    formData.append("ingredientUnit", ingredient.unit ?? "");
    formData.append("ingredientNotes", ingredient.notes ?? "");
  }
  return formData;
}

/** Runs createRecipe and returns the id from the redirect it throws. */
async function createAndGetId(fields: Parameters<typeof recipeForm>[0]) {
  const target = await catchRedirect(createRecipe(recipeForm(fields)));
  expect(target).toMatch(/^\/recipes\/.+/);
  return target.replace("/recipes/", "");
}

const validRecipe = {
  title: "Spaghetti Bolognese",
  instructions: "Brown the beef, simmer, serve.",
};

describe("createRecipe", () => {
  it("persists the recipe and redirects to its page", async () => {
    const id = await createAndGetId({
      ...validRecipe,
      description: "Weeknight pasta.",
      servings: "4",
    });

    const recipe = await prisma.recipe.findUniqueOrThrow({ where: { id } });
    expect(recipe).toMatchObject({
      title: "Spaghetti Bolognese",
      description: "Weeknight pasta.",
      instructions: "Brown the beef, simmer, serve.",
      servings: 4,
    });
  });

  it("checks the session and revalidates the recipe list", async () => {
    await createAndGetId(validRecipe);

    expect(verifySessionMock).toHaveBeenCalled();
    expect(revalidatedPaths).toContain("/recipes");
  });

  it("stores ingredients in form order", async () => {
    const id = await createAndGetId({
      ...validRecipe,
      ingredients: [
        { name: "spaghetti", quantity: "400", unit: "g" },
        { name: "ground beef", quantity: "500", unit: "g", notes: "lean" },
        { name: "tomato sauce", quantity: "1", unit: "jar" },
      ],
    });

    const recipe = await getRecipeById(id);
    expect(recipe?.ingredients.map((i) => [i.name, i.quantity, i.unit, i.sortOrder])).toEqual([
      ["spaghetti", 400, "g", 0],
      ["ground beef", 500, "g", 1],
      ["tomato sauce", 1, "jar", 2],
    ]);
    expect(recipe?.ingredients[1].notes).toBe("lean");
  });

  it("drops ingredient rows with a blank name, keeping the rest contiguous", async () => {
    const id = await createAndGetId({
      ...validRecipe,
      ingredients: [
        { name: "spaghetti", quantity: "400", unit: "g" },
        { name: "   ", quantity: "999", unit: "kg" },
        { name: "basil" },
      ],
    });

    const recipe = await getRecipeById(id);
    expect(recipe?.ingredients.map((i) => [i.name, i.sortOrder])).toEqual([
      ["spaghetti", 0],
      ["basil", 1],
    ]);
  });

  it("stores blank optional fields as null", async () => {
    const id = await createAndGetId({
      ...validRecipe,
      ingredients: [{ name: "salt" }],
    });

    const recipe = await prisma.recipe.findUniqueOrThrow({
      where: { id },
      include: { ingredients: true },
    });
    expect(recipe).toMatchObject({ description: null, servings: null });
    expect(recipe.ingredients[0]).toMatchObject({ quantity: null, unit: null, notes: null });
  });

  it("trims surrounding whitespace from the title and instructions", async () => {
    const id = await createAndGetId({ title: "  Soup  ", instructions: "  Boil it.  " });

    expect(await prisma.recipe.findUniqueOrThrow({ where: { id } })).toMatchObject({
      title: "Soup",
      instructions: "Boil it.",
    });
  });

  it.each([
    ["a missing title", { instructions: "Boil it." }],
    ["a whitespace-only title", { title: "   ", instructions: "Boil it." }],
    ["missing instructions", { title: "Soup" }],
  ])("rejects %s without writing a row", async (_label, fields) => {
    await expect(createRecipe(recipeForm(fields))).rejects.toThrow(
      "Title and instructions are required."
    );

    expect(await prisma.recipe.count()).toBe(0);
  });
});

describe("updateRecipe", () => {
  it("updates the recipe fields and redirects back to it", async () => {
    const id = await createAndGetId({ ...validRecipe, servings: "4" });

    await expect(
      catchRedirect(
        updateRecipe(
          id,
          recipeForm({ title: "Better Bolognese", instructions: "Simmer longer.", servings: "6" })
        )
      )
    ).resolves.toBe(`/recipes/${id}`);

    expect(await prisma.recipe.findUniqueOrThrow({ where: { id } })).toMatchObject({
      title: "Better Bolognese",
      instructions: "Simmer longer.",
      servings: 6,
    });
  });

  it("replaces the ingredient list rather than appending to it", async () => {
    const id = await createAndGetId({
      ...validRecipe,
      ingredients: [{ name: "spaghetti", quantity: "400", unit: "g" }, { name: "beef" }],
    });

    await catchRedirect(
      updateRecipe(id, recipeForm({ ...validRecipe, ingredients: [{ name: "penne", quantity: "300", unit: "g" }] }))
    );

    const recipe = await getRecipeById(id);
    expect(recipe?.ingredients.map((i) => i.name)).toEqual(["penne"]);
    expect(await prisma.recipeIngredient.count()).toBe(1);
  });

  it("can clear every ingredient", async () => {
    const id = await createAndGetId({ ...validRecipe, ingredients: [{ name: "spaghetti" }] });

    await catchRedirect(updateRecipe(id, recipeForm(validRecipe)));

    expect(await prisma.recipeIngredient.count()).toBe(0);
  });

  it("revalidates both the list and the detail page", async () => {
    const id = await createAndGetId(validRecipe);
    revalidatedPaths.length = 0;

    await catchRedirect(updateRecipe(id, recipeForm(validRecipe)));

    expect(revalidatedPaths).toContain("/recipes");
    expect(revalidatedPaths).toContain(`/recipes/${id}`);
  });

  it("rejects an empty title and leaves the recipe untouched", async () => {
    const id = await createAndGetId(validRecipe);

    await expect(updateRecipe(id, recipeForm({ instructions: "x" }))).rejects.toThrow(
      "Title and instructions are required."
    );

    expect(await prisma.recipe.findUniqueOrThrow({ where: { id } })).toMatchObject({
      title: "Spaghetti Bolognese",
    });
  });
});

describe("deleteRecipe", () => {
  it("removes the recipe and redirects to the list", async () => {
    const id = await createAndGetId(validRecipe);

    await expect(catchRedirect(deleteRecipe(id))).resolves.toBe("/recipes");

    expect(await prisma.recipe.findUnique({ where: { id } })).toBeNull();
  });

  it("cascades to its ingredients and planned meals", async () => {
    const id = await createAndGetId({
      ...validRecipe,
      ingredients: [{ name: "spaghetti", quantity: "400", unit: "g" }],
    });
    await prisma.mealPlanEntry.create({
      data: { date: new Date("2026-07-29T00:00:00Z"), mealSlot: "DINNER", recipeId: id },
    });

    await catchRedirect(deleteRecipe(id));

    expect(await prisma.recipeIngredient.count()).toBe(0);
    expect(await prisma.mealPlanEntry.count()).toBe(0);
  });

  it("leaves other recipes alone", async () => {
    const keep = await createAndGetId({ ...validRecipe, title: "Keep me" });
    const drop = await createAndGetId({ ...validRecipe, title: "Drop me" });

    await catchRedirect(deleteRecipe(drop));

    expect(await prisma.recipe.findUnique({ where: { id: keep } })).not.toBeNull();
  });
});

describe("recipe queries", () => {
  it("lists recipes alphabetically with their ingredients", async () => {
    await createAndGetId({ ...validRecipe, title: "Zucchini Bake" });
    await createAndGetId({ ...validRecipe, title: "Apple Pie", ingredients: [{ name: "apple" }] });

    const recipes = await getRecipes();

    expect(recipes.map((r) => r.title)).toEqual(["Apple Pie", "Zucchini Bake"]);
    expect(recipes[0].ingredients.map((i) => i.name)).toEqual(["apple"]);
  });

  it("returns an empty list when there are no recipes", async () => {
    await expect(getRecipes()).resolves.toEqual([]);
  });

  it("returns null for an unknown id", async () => {
    await expect(getRecipeById("does-not-exist")).resolves.toBeNull();
  });

  it("orders a recipe's ingredients by sortOrder, not insertion order", async () => {
    const recipe = await prisma.recipe.create({
      data: {
        ...validRecipe,
        ingredients: {
          create: [
            { name: "third", sortOrder: 2 },
            { name: "first", sortOrder: 0 },
            { name: "second", sortOrder: 1 },
          ],
        },
      },
    });

    const loaded = await getRecipeById(recipe.id);
    expect(loaded?.ingredients.map((i) => i.name)).toEqual(["first", "second", "third"]);
  });
});
