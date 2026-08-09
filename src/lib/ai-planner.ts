import { formatISODate } from "@/lib/date";
import type { MealSlot } from "@/generated/prisma/enums";

export type MealPlanProposal = {
  date: string;
  mealSlot: MealSlot;
  recipeId: string;
  servings: number | null;
  rationale: string;
};

type ExistingEntry = { date: Date; mealSlot: MealSlot };
type KnownRecipe = { id: string };

/**
 * The model's raw output is never trusted enough to write directly: drops
 * proposals for a recipe id it wasn't given, a slot that's already planned,
 * or a slot it proposed more than once in the same batch.
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
    if (!knownRecipeIds.has(proposal.recipeId)) return false;

    const key = `${proposal.date}::${proposal.mealSlot}`;
    if (occupiedSlots.has(key) || seenInBatch.has(key)) return false;

    seenInBatch.add(key);
    return true;
  });
}
