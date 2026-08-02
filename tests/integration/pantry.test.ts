import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createPantryItem, deletePantryItem, updatePantryItem } from "@/server/actions/pantry";
import { getPantryItems } from "@/server/data/pantry";
import { revalidatedPaths, verifySessionMock } from "../helpers/next-mocks";

function pantryForm(fields: {
  name?: string;
  quantity?: string;
  unit?: string;
  category?: string;
}) {
  const formData = new FormData();
  formData.set("name", fields.name ?? "");
  formData.set("quantity", fields.quantity ?? "");
  formData.set("unit", fields.unit ?? "");
  formData.set("category", fields.category ?? "");
  return formData;
}

describe("createPantryItem", () => {
  it("stores the item and revalidates the pantry page", async () => {
    await createPantryItem(
      pantryForm({ name: "spaghetti", quantity: "500", unit: "g", category: "Pantry" })
    );

    const items = await getPantryItems();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: "spaghetti",
      quantity: 500,
      unit: "g",
      category: "Pantry",
    });
    expect(verifySessionMock).toHaveBeenCalled();
    expect(revalidatedPaths).toContain("/pantry");
  });

  it("trims whitespace around the name", async () => {
    await createPantryItem(pantryForm({ name: "  olive oil  " }));

    expect((await getPantryItems())[0].name).toBe("olive oil");
  });

  it("stores blank optional fields as null", async () => {
    await createPantryItem(pantryForm({ name: "salt" }));

    expect((await getPantryItems())[0]).toMatchObject({
      quantity: null,
      unit: null,
      category: null,
    });
  });

  it("parses decimal quantities", async () => {
    await createPantryItem(pantryForm({ name: "milk", quantity: "1.5", unit: "l" }));

    expect((await getPantryItems())[0].quantity).toBe(1.5);
  });

  it.each([
    ["an empty name", ""],
    ["a whitespace-only name", "   "],
  ])("ignores the submission with %s", async (_label, name) => {
    await createPantryItem(pantryForm({ name, quantity: "5" }));

    expect(await prisma.pantryItem.count()).toBe(0);
  });

  it("allows the same item to be added twice", async () => {
    await createPantryItem(pantryForm({ name: "spaghetti", quantity: "200", unit: "g" }));
    await createPantryItem(pantryForm({ name: "spaghetti", quantity: "300", unit: "g" }));

    expect(await prisma.pantryItem.count()).toBe(2);
  });
});

describe("updatePantryItem", () => {
  it("overwrites every field", async () => {
    const item = await prisma.pantryItem.create({
      data: { name: "spaghetti", quantity: 500, unit: "g", category: "Pantry" },
    });

    await updatePantryItem(
      item.id,
      pantryForm({ name: "penne", quantity: "250", unit: "gram", category: "Dry goods" })
    );

    expect(await prisma.pantryItem.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({
      name: "penne",
      quantity: 250,
      unit: "gram",
      category: "Dry goods",
    });
  });

  it("clears optional fields that are submitted blank", async () => {
    const item = await prisma.pantryItem.create({
      data: { name: "spaghetti", quantity: 500, unit: "g", category: "Pantry" },
    });

    await updatePantryItem(item.id, pantryForm({ name: "spaghetti" }));

    expect(await prisma.pantryItem.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({
      quantity: null,
      unit: null,
      category: null,
    });
  });

  it("ignores a blank name and leaves the row untouched", async () => {
    const item = await prisma.pantryItem.create({ data: { name: "spaghetti", quantity: 500 } });

    await updatePantryItem(item.id, pantryForm({ name: "", quantity: "1" }));

    expect(await prisma.pantryItem.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({
      name: "spaghetti",
      quantity: 500,
    });
  });
});

describe("deletePantryItem", () => {
  it("removes only the given item", async () => {
    const keep = await prisma.pantryItem.create({ data: { name: "keep" } });
    const drop = await prisma.pantryItem.create({ data: { name: "drop" } });

    await deletePantryItem(drop.id);

    expect(await prisma.pantryItem.findUnique({ where: { id: drop.id } })).toBeNull();
    expect(await prisma.pantryItem.findUnique({ where: { id: keep.id } })).not.toBeNull();
    expect(revalidatedPaths).toContain("/pantry");
  });
});

describe("getPantryItems", () => {
  it("returns items sorted by name", async () => {
    await prisma.pantryItem.createMany({
      data: [{ name: "zucchini" }, { name: "apple" }, { name: "mango" }],
    });

    expect((await getPantryItems()).map((item) => item.name)).toEqual([
      "apple",
      "mango",
      "zucchini",
    ]);
  });

  it("returns an empty list when the pantry is empty", async () => {
    await expect(getPantryItems()).resolves.toEqual([]);
  });
});
