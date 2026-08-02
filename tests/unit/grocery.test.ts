import { describe, expect, it } from "vitest";
import {
  aggregateGroceryList,
  type MealPlanEntryWithRecipe,
  type PantryItemInput,
} from "@/lib/grocery";

function entry(
  ingredients: { name: string; quantity: number | null; unit: string | null }[],
  options: { servings?: number | null; recipeServings?: number | null } = {}
): MealPlanEntryWithRecipe {
  return {
    servings: options.servings ?? null,
    recipe: { servings: options.recipeServings ?? null, ingredients },
  };
}

const pantry = (
  name: string,
  quantity: number | null,
  unit: string | null
): PantryItemInput => ({ name, quantity, unit });

describe("aggregateGroceryList", () => {
  it("returns nothing when no meals are planned", () => {
    expect(aggregateGroceryList([], [pantry("spaghetti", 500, "g")])).toEqual([]);
  });

  it("sums the same ingredient across separate planned meals", () => {
    const result = aggregateGroceryList(
      [
        entry([{ name: "spaghetti", quantity: 200, unit: "g" }]),
        entry([{ name: "spaghetti", quantity: 300, unit: "g" }]),
      ],
      []
    );

    expect(result).toEqual([
      {
        name: "spaghetti",
        unit: "g",
        requiredQuantity: 500,
        pantryQuantity: null,
        remainingQuantity: 500,
        unitMismatch: false,
      },
    ]);
  });

  it("keeps the same ingredient in separate buckets when units differ", () => {
    const result = aggregateGroceryList(
      [
        entry([{ name: "milk", quantity: 200, unit: "ml" }]),
        entry([{ name: "milk", quantity: 1, unit: "cup" }]),
      ],
      []
    );

    expect(result).toHaveLength(2);
    expect(result.map((item) => [item.unit, item.requiredQuantity])).toEqual(
      expect.arrayContaining([
        ["ml", 200],
        ["cup", 1],
      ])
    );
  });

  it("matches ingredient and pantry names case-insensitively, ignoring a trailing plural 's'", () => {
    const result = aggregateGroceryList(
      [entry([{ name: "  Eggs ", quantity: 6, unit: null }])],
      [pantry("egg", 2, null)]
    );

    expect(result).toEqual([
      {
        name: "Eggs",
        unit: null,
        requiredQuantity: 6,
        pantryQuantity: 2,
        remainingQuantity: 4,
        unitMismatch: false,
      },
    ]);
  });

  it("sorts results by ingredient name", () => {
    const result = aggregateGroceryList(
      [
        entry([
          { name: "zucchini", quantity: 1, unit: null },
          { name: "apple", quantity: 2, unit: null },
          { name: "mango", quantity: 3, unit: null },
        ]),
      ],
      []
    );

    expect(result.map((item) => item.name)).toEqual(["apple", "mango", "zucchini"]);
  });

  describe("serving scaling", () => {
    it("scales quantities by the planned-to-recipe servings ratio", () => {
      const result = aggregateGroceryList(
        [
          entry([{ name: "beef", quantity: 500, unit: "g" }], {
            servings: 6,
            recipeServings: 4,
          }),
        ],
        []
      );

      expect(result[0].requiredQuantity).toBe(750);
    });

    it("scales down when fewer servings are planned than the recipe yields", () => {
      const result = aggregateGroceryList(
        [entry([{ name: "beef", quantity: 500, unit: "g" }], { servings: 2, recipeServings: 4 })],
        []
      );

      expect(result[0].requiredQuantity).toBe(250);
    });

    it("does not scale when the entry has no servings override", () => {
      const result = aggregateGroceryList(
        [entry([{ name: "beef", quantity: 500, unit: "g" }], { recipeServings: 4 })],
        []
      );

      expect(result[0].requiredQuantity).toBe(500);
    });

    it("does not scale when the recipe itself has no serving count", () => {
      const result = aggregateGroceryList(
        [entry([{ name: "beef", quantity: 500, unit: "g" }], { servings: 8 })],
        []
      );

      expect(result[0].requiredQuantity).toBe(500);
    });

    it("sums differently-scaled entries of the same ingredient", () => {
      const result = aggregateGroceryList(
        [
          entry([{ name: "rice", quantity: 100, unit: "g" }], { servings: 4, recipeServings: 2 }),
          entry([{ name: "rice", quantity: 100, unit: "g" }], { servings: 1, recipeServings: 2 }),
        ],
        []
      );

      expect(result[0].requiredQuantity).toBe(250);
    });
  });

  describe("quantity-less ingredients", () => {
    it("reports a null required quantity for ingredients with no amount", () => {
      const result = aggregateGroceryList([entry([{ name: "salt", quantity: null, unit: null }])], []);

      expect(result[0]).toMatchObject({ requiredQuantity: null, remainingQuantity: null });
    });

    it("keeps a null required quantity even when the pantry has stock", () => {
      const result = aggregateGroceryList(
        [entry([{ name: "salt", quantity: null, unit: null }])],
        [pantry("salt", 200, null)]
      );

      expect(result[0]).toMatchObject({
        requiredQuantity: null,
        pantryQuantity: 200,
        remainingQuantity: null,
      });
    });

    it("ignores the quantity-less occurrence when another entry specifies an amount", () => {
      const result = aggregateGroceryList(
        [
          entry([{ name: "olive oil", quantity: null, unit: "ml" }]),
          entry([{ name: "olive oil", quantity: 30, unit: "ml" }]),
        ],
        []
      );

      expect(result[0].requiredQuantity).toBe(30);
    });
  });

  describe("pantry subtraction", () => {
    it("subtracts matching pantry stock from the required amount", () => {
      const result = aggregateGroceryList(
        [entry([{ name: "spaghetti", quantity: 400, unit: "g" }])],
        [pantry("spaghetti", 150, "g")]
      );

      expect(result[0]).toMatchObject({
        requiredQuantity: 400,
        pantryQuantity: 150,
        remainingQuantity: 250,
        unitMismatch: false,
      });
    });

    it("clamps the remaining amount at zero when the pantry covers the recipe", () => {
      const result = aggregateGroceryList(
        [entry([{ name: "spaghetti", quantity: 400, unit: "g" }])],
        [pantry("spaghetti", 900, "g")]
      );

      expect(result[0]).toMatchObject({ pantryQuantity: 900, remainingQuantity: 0 });
    });

    it("sums several pantry rows of the same item and unit", () => {
      const result = aggregateGroceryList(
        [entry([{ name: "spaghetti", quantity: 500, unit: "g" }])],
        [pantry("spaghetti", 100, "g"), pantry("spaghetti", 250, "g")]
      );

      expect(result[0]).toMatchObject({ pantryQuantity: 350, remainingQuantity: 150 });
    });

    it("matches pantry units case-insensitively", () => {
      const result = aggregateGroceryList(
        [entry([{ name: "flour", quantity: 500, unit: "G" }])],
        [pantry("flour", 200, " g ")]
      );

      expect(result[0]).toMatchObject({ pantryQuantity: 200, remainingQuantity: 300, unitMismatch: false });
    });

    it("treats a missing unit on both sides as a match", () => {
      const result = aggregateGroceryList(
        [entry([{ name: "lemon", quantity: 3, unit: null }])],
        [pantry("lemon", 1, null)]
      );

      expect(result[0]).toMatchObject({ pantryQuantity: 1, remainingQuantity: 2, unitMismatch: false });
    });

    it("leaves the requirement untouched when the pantry has no matching item", () => {
      const result = aggregateGroceryList(
        [entry([{ name: "basil", quantity: 1, unit: "bunch" }])],
        [pantry("parsley", 1, "bunch")]
      );

      expect(result[0]).toMatchObject({
        pantryQuantity: null,
        remainingQuantity: 1,
        unitMismatch: false,
      });
    });

    it("flags a unit mismatch and refuses to subtract across incompatible units", () => {
      const result = aggregateGroceryList(
        [entry([{ name: "tomato sauce", quantity: 500, unit: "ml" }])],
        [pantry("tomato sauce", 2, "jar")]
      );

      expect(result[0]).toMatchObject({
        requiredQuantity: 500,
        pantryQuantity: 2,
        remainingQuantity: 500,
        unitMismatch: true,
      });
    });

    it("prefers the unit-matched pantry rows over a mismatched one", () => {
      const result = aggregateGroceryList(
        [entry([{ name: "milk", quantity: 500, unit: "ml" }])],
        [pantry("milk", 2, "cup"), pantry("milk", 300, "ml")]
      );

      expect(result[0]).toMatchObject({
        pantryQuantity: 300,
        remainingQuantity: 200,
        unitMismatch: false,
      });
    });

    // Known quirk: a pantry row is only usable for subtraction if it has a
    // quantity, so a matching-unit row with an unknown amount falls through to
    // the mismatch branch rather than being ignored.
    it("flags a mismatch when the only matching pantry row has no quantity", () => {
      const result = aggregateGroceryList(
        [entry([{ name: "sugar", quantity: 100, unit: "g" }])],
        [pantry("sugar", null, "g")]
      );

      expect(result[0]).toMatchObject({
        pantryQuantity: null,
        remainingQuantity: 100,
        unitMismatch: true,
      });
    });
  });

  it("handles a full week: scaling, merging, and pantry subtraction together", () => {
    const result = aggregateGroceryList(
      [
        entry(
          [
            { name: "spaghetti", quantity: 400, unit: "g" },
            { name: "ground beef", quantity: 500, unit: "g" },
            { name: "tomato sauce", quantity: 1, unit: "jar" },
          ],
          { servings: 2, recipeServings: 4 }
        ),
        entry([
          { name: "lettuce", quantity: 1, unit: "head" },
          { name: "olive oil", quantity: 2, unit: "tbsp" },
        ]),
        entry([{ name: "spaghetti", quantity: 100, unit: "g" }]),
      ],
      [pantry("spaghetti", 250, "g"), pantry("olive oil", 500, "ml")]
    );

    expect(result).toEqual([
      {
        name: "ground beef",
        unit: "g",
        requiredQuantity: 250,
        pantryQuantity: null,
        remainingQuantity: 250,
        unitMismatch: false,
      },
      {
        name: "lettuce",
        unit: "head",
        requiredQuantity: 1,
        pantryQuantity: null,
        remainingQuantity: 1,
        unitMismatch: false,
      },
      {
        name: "olive oil",
        unit: "tbsp",
        requiredQuantity: 2,
        pantryQuantity: 500,
        remainingQuantity: 2,
        unitMismatch: true,
      },
      {
        name: "spaghetti",
        unit: "g",
        requiredQuantity: 300,
        pantryQuantity: 250,
        remainingQuantity: 50,
        unitMismatch: false,
      },
      {
        name: "tomato sauce",
        unit: "jar",
        requiredQuantity: 0.5,
        pantryQuantity: null,
        remainingQuantity: 0.5,
        unitMismatch: false,
      },
    ]);
  });
});
