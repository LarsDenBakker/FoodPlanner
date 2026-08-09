"use client";

import { useState, useTransition } from "react";
import { createMealPlanEntry } from "@/server/actions/meal-plan";
import { createRecipeQuietly } from "@/server/actions/recipes";
import type { MealPlanProposal } from "@/lib/ai-planner";
import { formatDayLabel } from "@/lib/date";

type Recipe = { id: string; title: string };

type Props = {
  proposals: MealPlanProposal[];
  recipes: Recipe[];
};

/** Sentinel select value meaning "keep the AI's proposed new recipe" rather than an existing recipe id. */
const NEW_RECIPE_VALUE = "__new__";

type RowState = { checked: boolean; recipeId: string };

function slotLabel(slot: string) {
  return slot.charAt(0) + slot.slice(1).toLowerCase();
}

export function MealPlanProposalReview({ proposals, recipes }: Props) {
  const [rows, setRows] = useState<RowState[]>(() =>
    proposals.map((proposal) => ({ checked: true, recipeId: proposal.recipeId ?? NEW_RECIPE_VALUE }))
  );
  const [isPending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);

  function toggleChecked(index: number) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, checked: !row.checked } : row)));
  }

  function swapRecipe(index: number, recipeId: string) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, recipeId } : row)));
  }

  function handleAddSelected() {
    startTransition(async () => {
      for (let i = 0; i < proposals.length; i++) {
        if (!rows[i].checked) continue;
        const proposal = proposals[i];

        let recipeId = rows[i].recipeId;
        if (recipeId === NEW_RECIPE_VALUE && proposal.newRecipe) {
          const recipe = await createRecipeQuietly({
            title: proposal.newRecipe.title,
            description: null,
            instructions: proposal.newRecipe.instructions,
            servings: proposal.servings,
            ingredients: proposal.newRecipe.ingredients.map((ingredient) => ({ ...ingredient, notes: null })),
          });
          recipeId = recipe.id;
        }

        const formData = new FormData();
        formData.set("recipeId", recipeId);
        if (proposal.servings) formData.set("servings", String(proposal.servings));
        await createMealPlanEntry(proposal.date, proposal.mealSlot, formData);
      }
      setAdded(true);
    });
  }

  if (added) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">Added to your plan.</p>;
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-black/10 p-4 dark:border-white/10">
      <p className="text-sm font-medium">Suggested for this week</p>
      <ul className="flex flex-col gap-3">
        {proposals.map((proposal, index) => (
          <li key={`${proposal.date}-${proposal.mealSlot}`} className="flex flex-col gap-1 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="checkbox"
                checked={rows[index].checked}
                onChange={() => toggleChecked(index)}
                aria-label={`Include ${formatDayLabel(new Date(`${proposal.date}T00:00:00Z`))} ${slotLabel(proposal.mealSlot)}`}
              />
              <span className="font-medium">
                {formatDayLabel(new Date(`${proposal.date}T00:00:00Z`))} {slotLabel(proposal.mealSlot)}
              </span>
              <span>—</span>
              <select
                value={rows[index].recipeId}
                onChange={(event) => swapRecipe(index, event.target.value)}
                className="rounded border border-black/15 bg-transparent px-1 py-0.5 text-xs dark:border-white/20"
              >
                {proposal.newRecipe && (
                  <option value={NEW_RECIPE_VALUE}>✨ New: {proposal.newRecipe.title}</option>
                )}
                {recipes.map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>
                    {recipe.title}
                  </option>
                ))}
              </select>
            </div>
            <p className="pl-6 text-xs text-zinc-600 dark:text-zinc-400">{proposal.rationale}</p>
            {rows[index].recipeId === NEW_RECIPE_VALUE && proposal.newRecipe && (
              <div className="ml-6 flex flex-col gap-1 rounded border border-dashed border-black/15 p-2 text-xs text-zinc-600 dark:border-white/20 dark:text-zinc-400">
                <p>{proposal.newRecipe.instructions}</p>
                {proposal.newRecipe.ingredients.length > 0 && (
                  <p>
                    Ingredients:{" "}
                    {proposal.newRecipe.ingredients
                      .map((ingredient) =>
                        [ingredient.quantity, ingredient.unit, ingredient.name].filter(Boolean).join(" ")
                      )
                      .join(", ")}
                  </p>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={handleAddSelected}
        disabled={isPending || !rows.some((row) => row.checked)}
        className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
      >
        {isPending ? "Adding…" : "Add selected to plan"}
      </button>
    </div>
  );
}
