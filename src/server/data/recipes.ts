import "server-only";
import { prisma } from "@/lib/prisma";

export function getRecipes() {
  return prisma.recipe.findMany({
    orderBy: { title: "asc" },
    include: { ingredients: true },
  });
}

export function getRecipeById(id: string) {
  return prisma.recipe.findUnique({
    where: { id },
    include: { ingredients: { orderBy: { sortOrder: "asc" } } },
  });
}
