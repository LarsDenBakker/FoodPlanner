import { createMealPlanEntry } from "@/server/actions/meal-plan";
import type { MealSlot } from "@/generated/prisma/enums";

type Props = {
  date: string;
  mealSlot: MealSlot;
  recipes: { id: string; title: string }[];
};

export function AddMealEntryForm({ date, mealSlot, recipes }: Props) {
  const action = createMealPlanEntry.bind(null, date, mealSlot);

  return (
    <form action={action} className="flex flex-col gap-1">
      <select
        name="recipeId"
        required
        defaultValue=""
        data-testid={`recipe-select-${date}-${mealSlot}`}
        className="rounded border border-black/15 bg-transparent px-1 py-1 text-xs dark:border-white/20"
      >
        <option value="" disabled>
          + Add recipe
        </option>
        {recipes.map((recipe) => (
          <option key={recipe.id} value={recipe.id}>
            {recipe.title}
          </option>
        ))}
      </select>
      <input
        name="servings"
        type="number"
        min="1"
        placeholder="Servings"
        className="rounded border border-black/15 bg-transparent px-1 py-1 text-xs dark:border-white/20"
      />
      <button type="submit" className="self-start text-xs text-blue-600 hover:underline">
        Add
      </button>
    </form>
  );
}
