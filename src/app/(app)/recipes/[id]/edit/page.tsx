import { notFound } from "next/navigation";
import { RecipeForm } from "@/components/RecipeForm";
import { getRecipeById } from "@/server/data/recipes";
import { updateRecipe } from "@/server/actions/recipes";

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipe = await getRecipeById(id);
  if (!recipe) notFound();

  const updateRecipeWithId = updateRecipe.bind(null, id);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Edit recipe</h1>
      <RecipeForm
        action={updateRecipeWithId}
        submitLabel="Save changes"
        defaultValues={{
          title: recipe.title,
          description: recipe.description ?? "",
          instructions: recipe.instructions,
          servings: recipe.servings?.toString() ?? "",
          ingredients: recipe.ingredients.map((ingredient) => ({
            name: ingredient.name,
            quantity: ingredient.quantity?.toString() ?? "",
            unit: ingredient.unit ?? "",
            notes: ingredient.notes ?? "",
          })),
        }}
      />
    </div>
  );
}
