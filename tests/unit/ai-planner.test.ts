import { describe, expect, it } from "vitest";
import { filterProposalsAgainstExisting, type MealPlanProposal } from "@/lib/ai-planner";

function proposal(overrides: Partial<MealPlanProposal> = {}): MealPlanProposal {
  return {
    date: "2026-07-27",
    mealSlot: "DINNER",
    recipeId: "recipe_1",
    newRecipe: null,
    servings: 4,
    rationale: "Uses up what's in the pantry.",
    ...overrides,
  };
}

function newRecipeProposal(overrides: Partial<MealPlanProposal> = {}): MealPlanProposal {
  return proposal({
    recipeId: null,
    newRecipe: {
      title: "Weeknight Stir Fry",
      instructions: "Stir fry everything together.",
      ingredients: [{ name: "broccoli", quantity: 1, unit: "head" }],
    },
    ...overrides,
  });
}

const knownRecipes = [{ id: "recipe_1" }, { id: "recipe_2" }];

describe("filterProposalsAgainstExisting", () => {
  it("keeps a proposal for an empty slot referencing a known recipe", () => {
    expect(filterProposalsAgainstExisting([proposal()], [], knownRecipes)).toEqual([proposal()]);
  });

  it("drops a proposal referencing a recipe id that was not offered to the model", () => {
    const result = filterProposalsAgainstExisting(
      [proposal({ recipeId: "hallucinated_id" })],
      [],
      knownRecipes
    );
    expect(result).toEqual([]);
  });

  it("drops a proposal that collides with an already-planned slot", () => {
    const existing = [{ date: new Date("2026-07-27T00:00:00Z"), mealSlot: "DINNER" as const }];
    expect(filterProposalsAgainstExisting([proposal()], existing, knownRecipes)).toEqual([]);
  });

  it("keeps a proposal for a different slot on the same day as an existing entry", () => {
    const existing = [{ date: new Date("2026-07-27T00:00:00Z"), mealSlot: "LUNCH" as const }];
    expect(filterProposalsAgainstExisting([proposal()], existing, knownRecipes)).toEqual([proposal()]);
  });

  it("keeps a proposal for the same slot on a different day", () => {
    const existing = [{ date: new Date("2026-07-28T00:00:00Z"), mealSlot: "DINNER" as const }];
    expect(filterProposalsAgainstExisting([proposal()], existing, knownRecipes)).toEqual([proposal()]);
  });

  it("drops the second of two proposals for the same slot in the same batch", () => {
    const first = proposal({ recipeId: "recipe_1" });
    const second = proposal({ recipeId: "recipe_2" });
    expect(filterProposalsAgainstExisting([first, second], [], knownRecipes)).toEqual([first]);
  });

  it("returns an empty list when given no proposals", () => {
    expect(filterProposalsAgainstExisting([], [], knownRecipes)).toEqual([]);
  });

  it("filters recipe id and slot collisions independently across a mixed batch", () => {
    const existing = [{ date: new Date("2026-07-27T00:00:00Z"), mealSlot: "LUNCH" as const }];
    const okay = proposal({ mealSlot: "DINNER", recipeId: "recipe_1" });
    const badRecipe = proposal({ mealSlot: "BREAKFAST", recipeId: "nope" });
    const occupiedSlot = proposal({ mealSlot: "LUNCH", recipeId: "recipe_2" });

    const result = filterProposalsAgainstExisting([okay, badRecipe, occupiedSlot], existing, knownRecipes);
    expect(result).toEqual([okay]);
  });

  it("keeps a well-formed brand-new recipe proposal", () => {
    const result = filterProposalsAgainstExisting([newRecipeProposal()], [], knownRecipes);
    expect(result).toEqual([newRecipeProposal()]);
  });

  it("drops a new-recipe proposal with a blank title", () => {
    const result = filterProposalsAgainstExisting(
      [newRecipeProposal({ newRecipe: { title: "  ", instructions: "Cook it.", ingredients: [] } })],
      [],
      knownRecipes
    );
    expect(result).toEqual([]);
  });

  it("drops a new-recipe proposal with blank instructions", () => {
    const result = filterProposalsAgainstExisting(
      [newRecipeProposal({ newRecipe: { title: "Soup", instructions: "  ", ingredients: [] } })],
      [],
      knownRecipes
    );
    expect(result).toEqual([]);
  });

  it("drops a proposal that sets neither recipeId nor newRecipe", () => {
    const result = filterProposalsAgainstExisting(
      [proposal({ recipeId: null, newRecipe: null })],
      [],
      knownRecipes
    );
    expect(result).toEqual([]);
  });

  it("drops a proposal that sets both recipeId and newRecipe", () => {
    const result = filterProposalsAgainstExisting(
      [newRecipeProposal({ recipeId: "recipe_1" })],
      [],
      knownRecipes
    );
    expect(result).toEqual([]);
  });

  it("drops a new-recipe proposal that collides with an already-planned slot", () => {
    const existing = [{ date: new Date("2026-07-27T00:00:00Z"), mealSlot: "DINNER" as const }];
    expect(filterProposalsAgainstExisting([newRecipeProposal()], existing, knownRecipes)).toEqual([]);
  });
});
