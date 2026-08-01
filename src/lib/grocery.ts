export type IngredientLine = {
  name: string;
  quantity: number | null;
  unit: string | null;
};

export type MealPlanEntryWithRecipe = {
  servings: number | null;
  recipe: {
    servings: number | null;
    ingredients: IngredientLine[];
  };
};

export type PantryItemInput = {
  name: string;
  quantity: number | null;
  unit: string | null;
};

export type AggregatedGroceryItem = {
  name: string;
  unit: string | null;
  requiredQuantity: number | null;
  pantryQuantity: number | null;
  remainingQuantity: number | null;
  unitMismatch: boolean;
};

/** Lowercase + trim + naive trailing-"s" strip. No fuzzy matching or unit conversion by design (v1). */
function normalizeName(name: string): string {
  const trimmed = name.trim().toLowerCase();
  return trimmed.length > 1 && trimmed.endsWith("s") ? trimmed.slice(0, -1) : trimmed;
}

function normalizeUnit(unit: string | null | undefined): string {
  return (unit ?? "").trim().toLowerCase();
}

type Bucket = {
  name: string;
  unit: string | null;
  quantitySum: number | null;
  hasQuantity: boolean;
};

/**
 * Aggregates ingredients across planned meals, scaling by servings, then
 * cross-references pantry stock. Ingredients are matched to pantry items by
 * normalized name; quantities are only subtracted when units also match
 * (see AggregatedGroceryItem.unitMismatch for the "can't safely subtract" case).
 */
export function aggregateGroceryList(
  entries: MealPlanEntryWithRecipe[],
  pantryItems: PantryItemInput[]
): AggregatedGroceryItem[] {
  const buckets = new Map<string, Bucket>();

  for (const entry of entries) {
    const multiplier =
      entry.servings && entry.recipe.servings ? entry.servings / entry.recipe.servings : 1;

    for (const ingredient of entry.recipe.ingredients) {
      const key = `${normalizeName(ingredient.name)}::${normalizeUnit(ingredient.unit)}`;
      const scaledQuantity = ingredient.quantity != null ? ingredient.quantity * multiplier : null;
      const existing = buckets.get(key);

      if (!existing) {
        buckets.set(key, {
          name: ingredient.name.trim(),
          unit: ingredient.unit ?? null,
          quantitySum: scaledQuantity,
          hasQuantity: scaledQuantity != null,
        });
        continue;
      }

      if (scaledQuantity != null) {
        existing.quantitySum = (existing.hasQuantity ? existing.quantitySum ?? 0 : 0) + scaledQuantity;
        existing.hasQuantity = true;
      }
    }
  }

  const pantryByName = new Map<string, PantryItemInput[]>();
  for (const item of pantryItems) {
    const nameKey = normalizeName(item.name);
    const list = pantryByName.get(nameKey) ?? [];
    list.push(item);
    pantryByName.set(nameKey, list);
  }

  const results: AggregatedGroceryItem[] = [];

  for (const [key, bucket] of buckets) {
    const nameKey = key.split("::")[0];
    const requiredQuantity = bucket.hasQuantity ? bucket.quantitySum : null;
    const requiredUnit = normalizeUnit(bucket.unit);
    const pantryMatches = pantryByName.get(nameKey) ?? [];
    const sameUnitMatches = pantryMatches.filter(
      (item) => item.quantity != null && normalizeUnit(item.unit) === requiredUnit
    );
    const anyMatch = pantryMatches[0];

    let pantryQuantity: number | null = null;
    let remainingQuantity: number | null = requiredQuantity;
    let unitMismatch = false;

    if (sameUnitMatches.length > 0) {
      // Sum every matching row rather than just the first — nothing stops a
      // user from adding the same pantry item twice (no upsert-by-name).
      pantryQuantity = sameUnitMatches.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
      remainingQuantity =
        requiredQuantity != null ? Math.max(0, requiredQuantity - pantryQuantity) : null;
    } else if (anyMatch) {
      unitMismatch = true;
      pantryQuantity = anyMatch.quantity;
      remainingQuantity = requiredQuantity;
    }

    results.push({
      name: bucket.name,
      unit: bucket.unit,
      requiredQuantity,
      pantryQuantity,
      remainingQuantity,
      unitMismatch,
    });
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}
