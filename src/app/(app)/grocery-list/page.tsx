import Link from "next/link";
import { getGroceryListForRange } from "@/server/data/grocery-list";
import { generateGroceryList } from "@/server/actions/grocery-list";
import { GroceryListItemRow } from "@/components/GroceryListItemRow";
import { getWeekRange, addWeeks, formatISODate, formatRangeLabel } from "@/lib/date";

export default async function GroceryListPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const referenceDate = week ? new Date(week) : new Date();
  const { start, end } = getWeekRange(referenceDate);

  const list = await getGroceryListForRange(start, end);
  const generateWithRange = generateGroceryList.bind(null, formatISODate(start), formatISODate(end));

  const needToBuy = list?.items.filter((item) => item.remainingQuantity === null || item.remainingQuantity > 0) ?? [];
  const alreadyHave =
    list?.items.filter((item) => item.remainingQuantity === 0 && !item.unitMismatch) ?? [];

  const prevWeek = formatISODate(addWeeks(start, -1));
  const nextWeek = formatISODate(addWeeks(start, 1));

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Grocery List</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link href={`/grocery-list?week=${prevWeek}`} className="hover:underline">
            ← Prev
          </Link>
          <span className="font-medium">{formatRangeLabel(start, end)}</span>
          <Link href={`/grocery-list?week=${nextWeek}`} className="hover:underline">
            Next →
          </Link>
        </div>
      </div>

      <form action={generateWithRange}>
        <button type="submit" className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium">
          {list ? "Regenerate for this week" : "Generate for this week"}
        </button>
      </form>

      {!list ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No grocery list generated for this week yet.</p>
      ) : (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="mb-2 font-medium">Need to buy</h2>
            {needToBuy.length === 0 ? (
              <p className="text-sm text-zinc-500">Nothing needed — you have it all.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {needToBuy.map((item) => (
                  <GroceryListItemRow
                    key={item.id}
                    id={item.id}
                    name={item.name}
                    unit={item.unit}
                    requiredQuantity={item.remainingQuantity ?? item.requiredQuantity}
                    isChecked={item.isChecked}
                    note={
                      item.unitMismatch
                        ? `pantry has some in a different unit (${item.pantryQuantity ?? "?"} ${item.unit ?? ""}) — check manually`
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-2 font-medium">Already have enough</h2>
            {alreadyHave.length === 0 ? (
              <p className="text-sm text-zinc-500">Nothing fully stocked yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {alreadyHave.map((item) => (
                  <GroceryListItemRow
                    key={item.id}
                    id={item.id}
                    name={item.name}
                    unit={item.unit}
                    requiredQuantity={item.requiredQuantity}
                    isChecked={item.isChecked}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
