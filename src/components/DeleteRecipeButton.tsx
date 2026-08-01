"use client";

import { deleteRecipe } from "@/server/actions/recipes";

export function DeleteRecipeButton({ id }: { id: string }) {
  return (
    <form
      action={deleteRecipe.bind(null, id)}
      onSubmit={(e) => {
        if (!confirm("Delete this recipe? This also removes it from any planned days.")) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="rounded-md border border-red-300 text-red-600 px-3 py-1.5 text-sm">
        Delete
      </button>
    </form>
  );
}
