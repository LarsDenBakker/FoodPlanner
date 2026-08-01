"use client";

import { useState } from "react";

type IngredientRow = { name: string; quantity: string; unit: string; notes: string };

const EMPTY_ROW: IngredientRow = { name: "", quantity: "", unit: "", notes: "" };

type RecipeFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  defaultValues?: {
    title: string;
    description: string;
    instructions: string;
    servings: string;
    ingredients: IngredientRow[];
  };
};

export function RecipeForm({ action, submitLabel, defaultValues }: RecipeFormProps) {
  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    defaultValues?.ingredients.length ? defaultValues.ingredients : [EMPTY_ROW]
  );

  function updateIngredient(index: number, field: keyof IngredientRow, value: string) {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing)));
  }

  function addIngredient() {
    setIngredients((prev) => [...prev, { ...EMPTY_ROW }]);
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }

  const inputClass =
    "rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm";

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="text-sm font-medium">
          Title
        </label>
        <input id="title" name="title" required defaultValue={defaultValues?.title} className={inputClass} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium">
          Description
        </label>
        <input id="description" name="description" defaultValue={defaultValues?.description} className={inputClass} />
      </div>

      <div className="flex flex-col gap-1 max-w-[160px]">
        <label htmlFor="servings" className="text-sm font-medium">
          Servings
        </label>
        <input
          id="servings"
          name="servings"
          type="number"
          min="1"
          defaultValue={defaultValues?.servings}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Ingredients</span>
          <button type="button" onClick={addIngredient} className="text-sm text-blue-600 hover:underline">
            + Add ingredient
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          Use a simple, consistent name like &quot;flour&quot; or &quot;onion&quot; — the grocery list matches
          ingredients by name and unit, without unit conversion or synonyms.
        </p>
        {ingredients.map((ingredient, index) => (
          <div
            key={index}
            data-testid="ingredient-row"
            className="grid grid-cols-[1fr_80px_80px_1fr_auto] gap-2 items-center"
          >
            <input
              placeholder="Name"
              value={ingredient.name}
              onChange={(e) => updateIngredient(index, "name", e.target.value)}
              name="ingredientName"
              className={inputClass}
            />
            <input
              placeholder="Qty"
              value={ingredient.quantity}
              onChange={(e) => updateIngredient(index, "quantity", e.target.value)}
              name="ingredientQuantity"
              type="number"
              step="any"
              className={inputClass}
            />
            <input
              placeholder="Unit"
              value={ingredient.unit}
              onChange={(e) => updateIngredient(index, "unit", e.target.value)}
              name="ingredientUnit"
              className={inputClass}
            />
            <input
              placeholder="Notes"
              value={ingredient.notes}
              onChange={(e) => updateIngredient(index, "notes", e.target.value)}
              name="ingredientNotes"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => removeIngredient(index)}
              className="text-sm text-red-600 px-2"
              aria-label="Remove ingredient"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="instructions" className="text-sm font-medium">
          Instructions
        </label>
        <textarea
          id="instructions"
          name="instructions"
          required
          rows={8}
          defaultValue={defaultValues?.instructions}
          className={inputClass}
        />
      </div>

      <button type="submit" className="self-start rounded-md bg-foreground text-background px-4 py-2 font-medium">
        {submitLabel}
      </button>
    </form>
  );
}
