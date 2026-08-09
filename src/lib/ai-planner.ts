import { formatISODate } from "@/lib/date";
import type { MealSlot } from "@/generated/prisma/enums";

export type NewRecipeIngredientProposal = {
  name: string;
  quantity: number | null;
  unit: string | null;
};

export type NewRecipeProposal = {
  title: string;
  instructions: string;
  ingredients: NewRecipeIngredientProposal[];
};

export type MealPlanProposal = {
  date: string;
  mealSlot: MealSlot;
  /** Set to reuse a recipe from the library; null when newRecipe is used instead. */
  recipeId: string | null;
  /** Set to propose a brand-new recipe not in the library; null when recipeId is used instead. */
  newRecipe: NewRecipeProposal | null;
  servings: number | null;
  rationale: string;
};

type ExistingEntry = { date: Date; mealSlot: MealSlot };
type KnownRecipe = { id: string };

/**
 * The model's raw output is never trusted enough to write directly: drops
 * proposals for a recipe id it wasn't given, a malformed or missing new-recipe
 * idea, a slot that's already planned, or a slot it proposed more than once in
 * the same batch.
 */
export function filterProposalsAgainstExisting(
  proposals: MealPlanProposal[],
  existingEntries: ExistingEntry[],
  knownRecipes: KnownRecipe[]
): MealPlanProposal[] {
  const occupiedSlots = new Set(
    existingEntries.map((entry) => `${formatISODate(entry.date)}::${entry.mealSlot}`)
  );
  const knownRecipeIds = new Set(knownRecipes.map((recipe) => recipe.id));
  const seenInBatch = new Set<string>();

  return proposals.filter((proposal) => {
    const usesExistingRecipe = proposal.recipeId !== null;
    const usesNewRecipe = proposal.newRecipe !== null;

    // Exactly one of recipeId / newRecipe must be set -- anything else is unusable.
    if (usesExistingRecipe === usesNewRecipe) return false;
    if (usesExistingRecipe && !knownRecipeIds.has(proposal.recipeId!)) return false;
    if (usesNewRecipe && !(proposal.newRecipe!.title.trim() && proposal.newRecipe!.instructions.trim())) {
      return false;
    }

    const key = `${proposal.date}::${proposal.mealSlot}`;
    if (occupiedSlots.has(key) || seenInBatch.has(key)) return false;

    seenInBatch.add(key);
    return true;
  });
}
