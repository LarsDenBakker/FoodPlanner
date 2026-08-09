import { vi } from "vitest";

/**
 * Stand-in for `src/lib/anthropic.ts`. Integration tests never call the real
 * Anthropic API -- they set `messagesParseMock`'s resolved value to a canned
 * `parsed_output` and assert on how `suggestMealPlan` handles it.
 */
export const messagesParseMock = vi.fn();

export const anthropicMock = {
  messages: { parse: messagesParseMock },
};

export function resetAnthropicMock() {
  messagesParseMock.mockReset();
}
