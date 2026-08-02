import { vi } from "vitest";

/**
 * Stand-ins for the `next/navigation` and `next/cache` APIs, which need a Next
 * request scope to work.
 *
 * `redirect` deliberately *throws*, exactly like the real one: server actions
 * rely on it aborting the rest of the function body. A no-op mock would let
 * execution fall through and quietly change what the code under test does.
 */

export class RedirectError extends Error {
  readonly url: string;

  constructor(url: string) {
    super(`NEXT_REDIRECT: ${url}`);
    this.name = "RedirectError";
    this.url = url;
  }
}

export function redirect(url: string): never {
  throw new RedirectError(url);
}

export const revalidatedPaths: string[] = [];

export function revalidatePath(path: string) {
  revalidatedPaths.push(path);
}

/** Session gate shared by every server action, so tests can assert it ran. */
export const testSession = { userId: "test-user-id", email: "tester@example.test" };
export const verifySessionMock = vi.fn(async () => testSession);

export function resetNextMocks() {
  revalidatedPaths.length = 0;
  verifySessionMock.mockClear();
}

/** Awaits a call expected to redirect and returns the target path. */
export async function catchRedirect(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RedirectError) return error.url;
    throw error;
  }
  throw new Error("Expected a redirect to be thrown, but the call returned normally.");
}
