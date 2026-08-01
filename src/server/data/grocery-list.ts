import "server-only";
import { prisma } from "@/lib/prisma";

export function getGroceryListForRange(start: Date, end: Date) {
  return prisma.groceryList.findFirst({
    where: { startDate: start, endDate: end },
    orderBy: { generatedAt: "desc" },
    include: { items: { orderBy: { name: "asc" } } },
  });
}
