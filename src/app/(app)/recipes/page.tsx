import Link from "next/link";
import { getRecipes } from "@/server/data/recipes";

export default async function RecipesPage() {
  const recipes = await getRecipes();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Recipes</h1>
        <Link href="/recipes/new" className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium">
          + New recipe
        </Link>
      </div>
      {recipes.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No recipes yet. Add your first one.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {recipes.map((recipe) => (
            <Link
              key={recipe.id}
              href={`/recipes/${recipe.id}`}
              className="rounded-lg border border-black/10 p-4 hover:bg-black/[.03] dark:border-white/10 dark:hover:bg-white/[.05]"
            >
              <h2 className="font-medium">{recipe.title}</h2>
              {recipe.description && (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{recipe.description}</p>
              )}
              <p className="mt-2 text-xs text-zinc-500">
                {recipe.ingredients.length} ingredient{recipe.ingredients.length === 1 ? "" : "s"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
