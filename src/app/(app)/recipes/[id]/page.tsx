import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecipeById } from "@/server/data/recipes";
import { DeleteRecipeButton } from "@/components/DeleteRecipeButton";

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipe = await getRecipeById(id);
  if (!recipe) notFound();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{recipe.title}</h1>
          {recipe.description && <p className="mt-1 text-zinc-600 dark:text-zinc-400">{recipe.description}</p>}
          {recipe.servings && <p className="mt-1 text-sm text-zinc-500">Serves {recipe.servings}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href={`/recipes/${recipe.id}/edit`}
            className="rounded-md border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
          >
            Edit
          </Link>
          <DeleteRecipeButton id={recipe.id} />
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-medium">Ingredients</h2>
        {recipe.ingredients.length === 0 ? (
          <p className="text-sm text-zinc-500">No ingredients listed.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {recipe.ingredients.map((ingredient) => (
              <li key={ingredient.id}>
                {[ingredient.quantity, ingredient.unit, ingredient.name].filter(Boolean).join(" ")}
                {ingredient.notes ? ` (${ingredient.notes})` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-2 font-medium">Instructions</h2>
        <p className="whitespace-pre-line text-sm">{recipe.instructions}</p>
      </div>
    </div>
  );
}
