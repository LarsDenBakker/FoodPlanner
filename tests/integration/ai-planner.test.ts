import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { suggestMealPlan } from "@/server/actions/ai-planner";
import { messagesParseMock } from "../helpers/anthropic-mock";
import { verifySessionMock } from "../helpers/next-mocks";

const MONDAY = "2026-07-27";
const SUNDAY = "2026-08-02";
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

function rangeForm(startISO = MONDAY, endISO = SUNDAY) {
  const formData = new FormData();
  formData.set("start", startISO);
  formData.set("end", endISO);
  return formData;
}

async function createRecipe(title = "Spaghetti Bolognese") {
  return prisma.recipe.create({
    data: { title, instructions: "Cook it.", servings: 4 },
  });
}

function mockProposalResponse(proposals: unknown[]) {
  messagesParseMock.mockResolvedValue({ parsed_output: { proposals } });
}

describe("suggestMealPlan", () => {
  it("checks the session before calling the AI", async () => {
    const recipe = await createRecipe();
    mockProposalResponse([
      {
        date: MONDAY,
        mealSlot: "DINNER",
        recipeId: recipe.id,
        newRecipe: null,
        servings: 4,
        rationale: "Uses beef.",
      },
    ]);

    await suggestMealPlan(undefined, rangeForm());

    expect(verifySessionMock).toHaveBeenCalled();
  });

  it("returns the model's proposals for empty slots", async () => {
    const recipe = await createRecipe();
    mockProposalResponse([
      {
        date: MONDAY,
        mealSlot: "DINNER",
        recipeId: recipe.id,
        newRecipe: null,
        servings: 4,
        rationale: "Uses beef.",
      },
    ]);

    const result = await suggestMealPlan(undefined, rangeForm());

    expect(result?.proposals).toEqual([
      {
        date: MONDAY,
        mealSlot: "DINNER",
        recipeId: recipe.id,
        newRecipe: null,
        servings: 4,
        rationale: "Uses beef.",
      },
    ]);
  });

  it("returns a brand-new recipe proposal when the model doesn't reuse the library", async () => {
    await createRecipe();
    const newRecipe = {
      title: "Weeknight Stir Fry",
      instructions: "Stir fry everything together.",
      ingredients: [{ name: "broccoli", quantity: 1, unit: "head" }],
    };
    mockProposalResponse([
      {
        date: MONDAY,
        mealSlot: "DINNER",
        recipeId: null,
        newRecipe,
        servings: 4,
        rationale: "Nothing in the library uses broccoli.",
      },
    ]);

    const result = await suggestMealPlan(undefined, rangeForm());

    expect(result?.proposals).toEqual([
      {
        date: MONDAY,
        mealSlot: "DINNER",
        recipeId: null,
        newRecipe,
        servings: 4,
        rationale: "Nothing in the library uses broccoli.",
      },
    ]);
  });

  it("calls the AI and can still get new-recipe proposals when the library is empty", async () => {
    const newRecipe = { title: "Simple Soup", instructions: "Simmer.", ingredients: [] };
    mockProposalResponse([
      { date: MONDAY, mealSlot: "DINNER", recipeId: null, newRecipe, servings: 4, rationale: "Quick." },
    ]);

    const result = await suggestMealPlan(undefined, rangeForm());

    expect(messagesParseMock).toHaveBeenCalled();
    expect(result?.proposals).toEqual([
      { date: MONDAY, mealSlot: "DINNER", recipeId: null, newRecipe, servings: 4, rationale: "Quick." },
    ]);
  });

  it("drops a proposal for a slot that's already planned", async () => {
    const recipe = await createRecipe();
    await prisma.mealPlanEntry.create({
      data: { date: day(MONDAY), mealSlot: "DINNER", recipeId: recipe.id },
    });
    mockProposalResponse([
      {
        date: MONDAY,
        mealSlot: "DINNER",
        recipeId: recipe.id,
        newRecipe: null,
        servings: 4,
        rationale: "Uses beef.",
      },
    ]);

    const result = await suggestMealPlan(undefined, rangeForm());

    expect(result?.error).toBeDefined();
    expect(result?.proposals).toBeUndefined();
  });

  it("drops a proposal referencing a recipe id the model hallucinated", async () => {
    await createRecipe();
    mockProposalResponse([
      {
        date: MONDAY,
        mealSlot: "DINNER",
        recipeId: "hallucinated-id",
        newRecipe: null,
        servings: 4,
        rationale: "Uses beef.",
      },
    ]);

    const result = await suggestMealPlan(undefined, rangeForm());

    expect(result?.error).toBeDefined();
    expect(result?.proposals).toBeUndefined();
  });

  it("drops a proposal that sets both recipeId and newRecipe", async () => {
    const recipe = await createRecipe();
    mockProposalResponse([
      {
        date: MONDAY,
        mealSlot: "DINNER",
        recipeId: recipe.id,
        newRecipe: { title: "Soup", instructions: "Simmer.", ingredients: [] },
        servings: 4,
        rationale: "Ambiguous.",
      },
    ]);

    const result = await suggestMealPlan(undefined, rangeForm());

    expect(result?.error).toBeDefined();
    expect(result?.proposals).toBeUndefined();
  });

  it("returns an error when the model call throws", async () => {
    await createRecipe();
    messagesParseMock.mockRejectedValue(new Error("network error"));

    const result = await suggestMealPlan(undefined, rangeForm());

    expect(result?.error).toBeDefined();
    expect(result?.proposals).toBeUndefined();
  });

  it("returns an error when the week range is missing", async () => {
    const result = await suggestMealPlan(undefined, new FormData());

    expect(result?.error).toBeDefined();
    expect(messagesParseMock).not.toHaveBeenCalled();
  });
});
