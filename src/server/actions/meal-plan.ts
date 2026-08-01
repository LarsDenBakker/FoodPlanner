"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { MealSlot } from "@/generated/prisma/enums";

export async function createMealPlanEntry(date: string, mealSlot: MealSlot, formData: FormData) {
  await verifySession();
  const recipeId = String(formData.get("recipeId") ?? "");
  const servingsRaw = String(formData.get("servings") ?? "").trim();
  if (!recipeId) return;

  await prisma.mealPlanEntry.create({
    data: {
      date: new Date(date),
      mealSlot,
      recipeId,
      servings: servingsRaw ? Number(servingsRaw) : null,
    },
  });

  revalidatePath("/planner");
  revalidatePath("/grocery-list");
}

export async function deleteMealPlanEntry(id: string) {
  await verifySession();
  await prisma.mealPlanEntry.delete({ where: { id } });
  revalidatePath("/planner");
  revalidatePath("/grocery-list");
}
