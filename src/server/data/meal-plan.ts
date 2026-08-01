import "server-only";
import { prisma } from "@/lib/prisma";

export function getMealPlanForRange(start: Date, end: Date) {
  return prisma.mealPlanEntry.findMany({
    where: { date: { gte: start, lte: end } },
    include: { recipe: true },
    orderBy: { date: "asc" },
  });
}

export function getMealPlanForRangeWithIngredients(start: Date, end: Date) {
  return prisma.mealPlanEntry.findMany({
    where: { date: { gte: start, lte: end } },
    include: { recipe: { include: { ingredients: true } } },
    orderBy: { date: "asc" },
  });
}
