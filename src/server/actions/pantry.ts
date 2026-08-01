"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";

function parsePantryFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim() || null;
  const category = String(formData.get("category") ?? "").trim() || null;
  return { name, quantity: quantityRaw ? Number(quantityRaw) : null, unit, category };
}

export async function createPantryItem(formData: FormData) {
  await verifySession();
  const fields = parsePantryFields(formData);
  if (!fields.name) return;

  await prisma.pantryItem.create({ data: fields });
  revalidatePath("/pantry");
}

export async function updatePantryItem(id: string, formData: FormData) {
  await verifySession();
  const fields = parsePantryFields(formData);
  if (!fields.name) return;

  await prisma.pantryItem.update({ where: { id }, data: fields });
  revalidatePath("/pantry");
}

export async function deletePantryItem(id: string) {
  await verifySession();
  await prisma.pantryItem.delete({ where: { id } });
  revalidatePath("/pantry");
}
