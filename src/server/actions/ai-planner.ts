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

const proposalResponseSchema = z.object({
  proposals: z.array(
    z.object({
      date: z.string().describe("ISO date (YYYY-MM-DD), within the requested week"),
      mealSlot: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]),
      recipeId: z.string().describe("Must be one of the recipe ids listed in the prompt"),
      servings: z.number().int().nullable(),
      rationale: z.string().describe("One short sentence: why this recipe, this slot"),
    })
  ),
});

const SYSTEM_PROMPT = `You are a meal-planning assistant for a household app.
Given a recipe library, current pantry stock, and meals already planned for a
week, propose recipes for the remaining EMPTY meal slots only -- never
propose a slot that's already listed as planned. Use recipe ids exactly as
given in the recipe library; never invent one. Prefer recipes that use
ingredients already in the pantry. Keep each rationale to one short sentence.`;

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

  if (recipes.length === 0) {
    return { error: "Add some recipes before asking for suggestions." };
  }

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
  const recipeLines = recipes
    .map((r) => `- id: ${r.id} | ${r.title} | ingredients: ${r.ingredients.map((i) => i.name).join(", ")}`)
    .join("\n");

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
