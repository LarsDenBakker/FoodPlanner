import { getPantryItems } from "@/server/data/pantry";
import { createPantryItem, updatePantryItem, deletePantryItem } from "@/server/actions/pantry";

const inputClass =
  "w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1.5 text-sm";

export default async function PantryPage() {
  const items = await getPantryItems();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Pantry</h1>

      <div className="flex flex-col gap-2">
        <h2 className="font-medium">Add item</h2>
        <form action={createPantryItem} className="grid grid-cols-[1fr_90px_90px_1fr_auto] items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500" htmlFor="name">
              Name
            </label>
            <input id="name" name="name" required className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500" htmlFor="quantity">
              Qty
            </label>
            <input id="quantity" name="quantity" type="number" step="any" className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500" htmlFor="unit">
              Unit
            </label>
            <input id="unit" name="unit" className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500" htmlFor="category">
              Category
            </label>
            <input id="category" name="category" className={inputClass} />
          </div>
          <button type="submit" className="rounded-md bg-foreground text-background px-3 py-1.5 text-sm font-medium">
            Add
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-medium">On hand</h2>
        {items.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Nothing in the pantry yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <form
                key={item.id}
                action={updatePantryItem.bind(null, item.id)}
                className="grid grid-cols-[1fr_90px_90px_1fr_auto_auto] items-center gap-2"
              >
                <input name="name" defaultValue={item.name} className={inputClass} />
                <input
                  name="quantity"
                  type="number"
                  step="any"
                  defaultValue={item.quantity ?? ""}
                  className={inputClass}
                />
                <input name="unit" defaultValue={item.unit ?? ""} className={inputClass} />
                <input name="category" defaultValue={item.category ?? ""} className={inputClass} />
                <button type="submit" className="rounded-md border border-black/15 px-3 py-1.5 text-sm dark:border-white/20">
                  Save
                </button>
                <button
                  formAction={deletePantryItem.bind(null, item.id)}
                  className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600"
                >
                  Delete
                </button>
              </form>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
