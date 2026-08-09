"use client";

import { useActionState } from "react";
import { suggestMealPlan } from "@/server/actions/ai-planner";
import { MealPlanProposalReview } from "./MealPlanProposalReview";

type Recipe = { id: string; title: string };

type Props = {
  start: string;
  end: string;
  recipes: Recipe[];
};

export function SuggestMealsButton({ start, end, recipes }: Props) {
  const [state, formAction, pending] = useActionState(suggestMealPlan, undefined);

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="start" value={start} />
        <input type="hidden" name="end" value={end} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium disabled:opacity-60 dark:border-white/20"
        >
          {pending ? "Thinking…" : "Suggest meals"}
        </button>
      </form>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.proposals && <MealPlanProposalReview proposals={state.proposals} recipes={recipes} />}
    </div>
  );
}
