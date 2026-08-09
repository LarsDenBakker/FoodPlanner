import Anthropic from "@anthropic-ai/sdk";

/**
 * Sonnet 5 balances quality and cost for this app's bounded, structured
 * requests (a recipe/pantry list in, a JSON proposal out) — not the
 * heavier reasoning Opus is priced for.
 */
export const AI_PLANNER_MODEL = "claude-sonnet-5";

export const anthropic = new Anthropic();
