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

export async function createRecipe(formData: FormData) {
  await verifySession();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const instructions = String(formData.get("instructions") ?? "").trim();
  const servingsRaw = String(formData.get("servings") ?? "").trim();
  const servings = servingsRaw ? Number(servingsRaw) : null;
  const ingredients = parseIngredients(formData);

  if (!title || !instructions) {
    throw new Error("Title and instructions are required.");
  }

  const recipe = await prisma.recipe.create({
    data: {
      title,
      description,
      instructions,
      servings,
      ingredients: {
        create: ingredients.map((ingredient, index) => ({ ...ingredient, sortOrder: index })),
      },
    },
  });

  revalidatePath("/recipes");
  redirect(`/recipes/${recipe.id}`);
}

export async function updateRecipe(id: string, formData: FormData) {
  await verifySession();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const instructions = String(formData.get("instructions") ?? "").trim();
  const servingsRaw = String(formData.get("servings") ?? "").trim();
  const servings = servingsRaw ? Number(servingsRaw) : null;
  const ingredients = parseIngredients(formData);

  if (!title || !instructions) {
    throw new Error("Title and instructions are required.");
  }

  await prisma.$transaction([
    prisma.recipeIngredient.deleteMany({ where: { recipeId: id } }),
    prisma.recipe.update({
      where: { id },
      data: {
        title,
        description,
        instructions,
        servings,
        ingredients: {
          create: ingredients.map((ingredient, index) => ({ ...ingredient, sortOrder: index })),
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
