"use client";

import { useTransition } from "react";
import { toggleGroceryListItemChecked } from "@/server/actions/grocery-list";

type Props = {
  id: string;
  name: string;
  unit: string | null;
  requiredQuantity: number | null;
  isChecked: boolean;
  note?: string;
};

export function GroceryListItemRow({ id, name, unit, requiredQuantity, isChecked, note }: Props) {
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        defaultChecked={isChecked}
        disabled={isPending}
        className="mt-0.5"
        onChange={(e) => {
          const checked = e.target.checked;
          startTransition(() => {
            toggleGroceryListItemChecked(id, checked);
          });
        }}
      />
      <span className="flex flex-col">
        <span className={isChecked ? "text-zinc-400 line-through" : ""}>
          {[requiredQuantity, unit, name].filter((value) => value !== null && value !== "").join(" ")}
        </span>
        {note && <span className="text-xs text-zinc-500">{note}</span>}
      </span>
    </label>
  );
}
