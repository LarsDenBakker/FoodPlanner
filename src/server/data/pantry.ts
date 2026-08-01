import "server-only";
import { prisma } from "@/lib/prisma";

export function getPantryItems() {
  return prisma.pantryItem.findMany({ orderBy: { name: "asc" } });
}
