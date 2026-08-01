import { RecipeForm } from "@/components/RecipeForm";
import { createRecipe } from "@/server/actions/recipes";

export default function NewRecipePage() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">New recipe</h1>
      <RecipeForm action={createRecipe} submitLabel="Create recipe" />
    </div>
  );
}
