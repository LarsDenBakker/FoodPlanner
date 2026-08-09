"use server";

import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { verifySession } from "@/lib/dal";
import { anthropic, AI_PLANNER_MODEL } from "@/lib/anthropic";
import { getRecipes } from "@/server/data/recipes";
import { getPantryItems } from "@/server/data/pantry";
import { getMealPlanForRange } from "@/server/data/meal-plan";
import { filterProposalsAgainstExisting, type MealPlanProposal } from "@/lib/ai-planner";
import { formatISODate } from "@/lib/date";

const newRecipeIngredientSchema = z.object({
  name: z.string(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
});

const proposalResponseSchema = z.object({
  proposals: z.array(
    z.object({
      date: z.string().describe("ISO date (YYYY-MM-DD), within the requested week"),
      mealSlot: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]),
      recipeId: z
        .string()
        .nullable()
        .describe(
          "Set to an id from the recipe library to reuse an existing recipe. Set to null when " +
            "proposing a brand-new recipe via newRecipe instead."
        ),
      newRecipe: z
        .object({
          title: z.string().describe("A short, appetizing recipe title"),
          instructions: z.string().describe("Brief cooking instructions"),
          ingredients: z.array(newRecipeIngredientSchema),
        })
        .nullable()
        .describe(
          "Set to propose a brand-new recipe not in the library. Leave null when reusing recipeId instead."
        ),
      servings: z.number().int().nullable(),
      rationale: z.string().describe("One short sentence: why this recipe, this slot"),
    })
  ),
});

const SYSTEM_PROMPT = `You are a meal-planning assistant for a household app.
Given a recipe library, current pantry stock, and meals already planned for a
week, propose recipes for the remaining EMPTY meal slots only -- never
propose a slot that's already listed as planned.

The recipe library is a source of suggestions, not a hard constraint. Prefer
reusing a recipe from the library (set recipeId, leave newRecipe null) when
one fits well, especially if it uses ingredients already in the pantry. When
nothing in the library fits well, propose a brand-new recipe instead: leave
recipeId null and fill in newRecipe with a title, brief instructions, and an
ingredient list. Every proposal must set exactly one of recipeId or
newRecipe. Use recipe ids exactly as given in the recipe library; never
invent one. Keep each rationale to one short sentence.`;

export type MealPlanProposalState = { proposals?: MealPlanProposal[]; error?: string } | undefined;

export async function suggestMealPlan(
  _prevState: MealPlanProposalState,
  formData: FormData
): Promise<MealPlanProposalState> {
  await verifySession();

  const startISO = String(formData.get("start") ?? "");
  const endISO = String(formData.get("end") ?? "");
  if (!startISO || !endISO) {
    return { error: "Missing week range." };
  }

  const start = new Date(startISO);
  const end = new Date(endISO);

  const [recipes, pantryItems, existingEntries] = await Promise.all([
    getRecipes(),
    getPantryItems(),
    getMealPlanForRange(start, end),
  ]);

  const userContext = buildWeekContext({ recipes, pantryItems, existingEntries, startISO, endISO });

  try {
    const response = await anthropic.messages.parse({
      model: AI_PLANNER_MODEL,
      max_tokens: 4096,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userContext }],
      output_config: { format: zodOutputFormat(proposalResponseSchema) },
    });

    const parsed = response.parsed_output;
    if (!parsed) {
      return { error: "The assistant didn't return a usable suggestion. Try again." };
    }

    const proposals = filterProposalsAgainstExisting(parsed.proposals, existingEntries, recipes);
    if (proposals.length === 0) {
      return { error: "No suggestions for this week -- it may already be fully planned." };
    }

    return { proposals };
  } catch (error) {
    console.error("suggestMealPlan failed:", error);
    return { error: "Couldn't reach the AI assistant. Try again in a moment." };
  }
}

function buildWeekContext({
  recipes,
  pantryItems,
  existingEntries,
  startISO,
  endISO,
}: {
  recipes: { id: string; title: string; ingredients: { name: string }[] }[];
  pantryItems: { name: string; quantity: number | null; unit: string | null }[];
  existingEntries: { date: Date; mealSlot: string; recipe: { title: string } }[];
  startISO: string;
  endISO: string;
}) {
  const recipeLines =
    recipes
      .map((r) => `- id: ${r.id} | ${r.title} | ingredients: ${r.ingredients.map((i) => i.name).join(", ")}`)
      .join("\n") || "(no recipes yet -- propose brand-new ones via newRecipe)";

  const pantryLines =
    pantryItems
      .map((item) => `- ${item.name}${item.quantity ? ` (${item.quantity}${item.unit ?? ""})` : ""}`)
      .join("\n") || "(pantry is empty)";

  const plannedLines =
    existingEntries
      .map((entry) => `- ${formatISODate(entry.date)} ${entry.mealSlot}: ${entry.recipe.title}`)
      .join("\n") || "(nothing planned yet this week)";

  return `Week: ${startISO} to ${endISO}

Recipe library:
${recipeLines}

Pantry stock:
${pantryLines}

Already planned this week (do not propose these slots again):
${plannedLines}

Propose meals for the remaining empty slots this week.`;
}
