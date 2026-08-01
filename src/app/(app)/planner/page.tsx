import { Fragment } from "react";
import Link from "next/link";
import { getMealPlanForRange } from "@/server/data/meal-plan";
import { getRecipes } from "@/server/data/recipes";
import { deleteMealPlanEntry } from "@/server/actions/meal-plan";
import { AddMealEntryForm } from "@/components/AddMealEntryForm";
import { MealSlot } from "@/generated/prisma/enums";
import { getWeekRange, addWeeks, formatISODate, formatDayLabel, formatRangeLabel } from "@/lib/date";

const MEAL_SLOTS: MealSlot[] = [MealSlot.BREAKFAST, MealSlot.LUNCH, MealSlot.DINNER, MealSlot.SNACK];

function slotLabel(slot: MealSlot) {
  return slot.charAt(0) + slot.slice(1).toLowerCase();
}

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const referenceDate = week ? new Date(week) : new Date();
  const { start, end, days } = getWeekRange(referenceDate);

  const [entries, recipes] = await Promise.all([getMealPlanForRange(start, end), getRecipes()]);

  const entriesByCell = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = `${formatISODate(entry.date)}::${entry.mealSlot}`;
    const list = entriesByCell.get(key) ?? [];
    list.push(entry);
    entriesByCell.set(key, list);
  }

  const prevWeek = formatISODate(addWeeks(start, -1));
  const nextWeek = formatISODate(addWeeks(start, 1));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Planner</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link href={`/planner?week=${prevWeek}`} className="hover:underline">
            ← Prev
          </Link>
          <span className="font-medium">{formatRangeLabel(start, end)}</span>
          <Link href={`/planner?week=${nextWeek}`} className="hover:underline">
            Next →
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[900px] grid-cols-[100px_repeat(7,1fr)] gap-2">
          <div />
          {days.map((day) => (
            <div key={day.toISOString()} className="text-center text-sm font-medium">
              {formatDayLabel(day)}
            </div>
          ))}

          {MEAL_SLOTS.map((slot) => (
            <Fragment key={slot}>
              <div className="py-2 text-sm font-medium">{slotLabel(slot)}</div>
              {days.map((day) => {
                const key = `${formatISODate(day)}::${slot}`;
                const cellEntries = entriesByCell.get(key) ?? [];
                return (
                  <div
                    key={key}
                    className="flex min-h-[80px] flex-col gap-1 rounded-md border border-black/10 p-2 dark:border-white/10"
                  >
                    {cellEntries.map((entry) => (
                      <div
                        key={entry.id}
                        data-testid="meal-plan-entry"
                        className="flex items-center justify-between gap-1 rounded bg-black/5 px-2 py-1 text-xs dark:bg-white/10"
                      >
                        <span className="truncate">{entry.recipe.title}</span>
                        <form action={deleteMealPlanEntry.bind(null, entry.id)}>
                          <button type="submit" aria-label="Remove" className="text-red-600">
                            ×
                          </button>
                        </form>
                      </div>
                    ))}
                    <AddMealEntryForm date={formatISODate(day)} mealSlot={slot} recipes={recipes} />
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
