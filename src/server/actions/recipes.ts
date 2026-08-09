"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";

type IngredientInput = {
  name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
};

export type RecipeInput = {
  title: string;
  description: string | null;
  instructions: string;
  servings: number | null;
  ingredients: IngredientInput[];
};

function parseIngredients(formData: FormData): IngredientInput[] {
  const names = formData.getAll("ingredientName") as string[];
  const quantities = formData.getAll("ingredientQuantity") as string[];
  const units = formData.getAll("ingredientUnit") as string[];
  const notes = formData.getAll("ingredientNotes") as string[];

  return names
    .map((name, i) => ({
      name: name.trim(),
      quantity: quantities[i]?.trim() ? Number(quantities[i]) : null,
      unit: units[i]?.trim() || null,
      notes: notes[i]?.trim() || null,
    }))
    .filter((ingredient) => ingredient.name.length > 0);
}

function parseRecipeInput(formData: FormData): RecipeInput {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const instructions = String(formData.get("instructions") ?? "").trim();
  const servingsRaw = String(formData.get("servings") ?? "").trim();
  const servings = servingsRaw ? Number(servingsRaw) : null;

  return { title, description, instructions, servings, ingredients: parseIngredients(formData) };
}

/** Shared by every recipe-creation path so the "title and instructions are required" rule lives in one place. */
async function insertRecipe(input: RecipeInput) {
  if (!input.title || !input.instructions) {
    throw new Error("Title and instructions are required.");
  }

  return prisma.recipe.create({
    data: {
      title: input.title,
      description: input.description,
      instructions: input.instructions,
      servings: input.servings,
      ingredients: {
        create: input.ingredients.map((ingredient, index) => ({ ...ingredient, sortOrder: index })),
      },
    },
  });
}

export async function createRecipe(formData: FormData) {
  await verifySession();
  const recipe = await insertRecipe(parseRecipeInput(formData));
  revalidatePath("/recipes");
  redirect(`/recipes/${recipe.id}`);
}

/**
 * Same as createRecipe, but returns the created recipe instead of redirecting --
 * for callers that create a recipe as one step of a larger flow (e.g. accepting
 * an AI-proposed new recipe into the meal plan) and need to stay on the page.
 */
export async function createRecipeQuietly(input: RecipeInput) {
  await verifySession();
  const recipe = await insertRecipe(input);
  revalidatePath("/recipes");
  return { id: recipe.id };
}

export async function updateRecipe(id: string, formData: FormData) {
  await verifySession();

  const input = parseRecipeInput(formData);
  if (!input.title || !input.instructions) {
    throw new Error("Title and instructions are required.");
  }

  await prisma.$transaction([
    prisma.recipeIngredient.deleteMany({ where: { recipeId: id } }),
    prisma.recipe.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        instructions: input.instructions,
        servings: input.servings,
        ingredients: {
          create: input.ingredients.map((ingredient, index) => ({ ...ingredient, sortOrder: index })),
        },
      },
    }),
  ]);

  revalidatePath("/recipes");
  revalidatePath(`/recipes/${id}`);
  redirect(`/recipes/${id}`);
}

export async function deleteRecipe(id: string) {
  await verifySession();
  await prisma.recipe.delete({ where: { id } });
  revalidatePath("/recipes");
  redirect("/recipes");
}
