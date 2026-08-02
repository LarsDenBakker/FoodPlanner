import { prisma } from "@/lib/prisma";

/**
 * Wipes every table so each test starts from a known-empty database.
 * Children are deleted before parents; the schema's cascades would cover most
 * of this, but being explicit keeps the order obvious as the schema grows.
 */
export async function resetDatabase() {
  await prisma.groceryListItem.deleteMany();
  await prisma.groceryList.deleteMany();
  await prisma.mealPlanEntry.deleteMany();
  await prisma.recipeIngredient.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.pantryItem.deleteMany();
  await prisma.user.deleteMany();
}

export { prisma };
