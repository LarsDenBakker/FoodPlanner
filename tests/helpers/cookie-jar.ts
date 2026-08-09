/**
 * In-memory stand-in for the `next/headers` cookie store, which is only
 * available inside a Next request scope. Tests mock `next/headers` to hand out
 * `cookieJar`, so session cookies can be written, read back, and inspected.
 */

export type StoredCookie = {
  name: string;
  value: string;
  httpOnly?: boolean;
  secure?: boolean;
  expires?: Date;
  sameSite?: string;
  path?: string;
};

const store = new Map<string, StoredCookie>();

export const cookieJar = {
  get(name: string) {
    const cookie = store.get(name);
    return cookie ? { name: cookie.name, value: cookie.value } : undefined;
  },
  set(name: string, value: string, options: Omit<StoredCookie, "name" | "value"> = {}) {
    store.set(name, { name, value, ...options });
  },
  delete(name: string) {
    store.delete(name);
  },
};

/** Returns the cookie with the attributes it was written with (httpOnly, expires, ...). */
export function readRawCookie(name: string): StoredCookie | undefined {
  return store.get(name);
}

export function clearCookies() {
  store.clear();
}
