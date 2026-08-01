"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { getMealPlanForRangeWithIngredients } from "@/server/data/meal-plan";
import { getPantryItems } from "@/server/data/pantry";
import { aggregateGroceryList } from "@/lib/grocery";

export async function generateGroceryList(startISO: string, endISO: string) {
  await verifySession();
  const start = new Date(startISO);
  const end = new Date(endISO);

  const [entries, pantryItems] = await Promise.all([
    getMealPlanForRangeWithIngredients(start, end),
    getPantryItems(),
  ]);

  const aggregated = aggregateGroceryList(entries, pantryItems);

  await prisma.$transaction(async (tx) => {
    await tx.groceryList.deleteMany({ where: { startDate: start, endDate: end } });
    await tx.groceryList.create({
      data: {
        startDate: start,
        endDate: end,
        items: { create: aggregated },
      },
    });
  });

  revalidatePath("/grocery-list");
}

export async function toggleGroceryListItemChecked(id: string, isChecked: boolean) {
  await verifySession();
  await prisma.groceryListItem.update({ where: { id }, data: { isChecked } });
  revalidatePath("/grocery-list");
}
