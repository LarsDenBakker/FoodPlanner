/**
 * Detects whether a response came from Vercel Deployment Protection rather
 * than from the app.
 *
 * Shared by the preflight check and the diagnostics collector so the two can
 * never disagree about what "protected" means.
 *
 * Vercel signals this in more than one shape, so match on the destination
 * rather than a literal path. Observed in the wild:
 *   302 → https://vercel.com/sso-api?url=…&nonce=…   (the common case)
 *   401 + an "Authentication Required" body
 *   307 → https://vercel.com/login?next=…
 */

/**
 * @param {{ status: number, location?: string | null, body?: string, baseUrl?: string }} response
 * @returns {boolean}
 */
export function isProtectionResponse({ status, location, body = "", baseUrl }) {
  if (status === 401) return true;

  if (location) {
    try {
      const target = new URL(location, baseUrl ?? "https://example.invalid");
      // Any redirect off to vercel.com's auth surface is the protection gate.
      if (/(^|\.)vercel\.com$/i.test(target.hostname) && /sso|login|auth/i.test(target.pathname)) {
        return true;
      }
    } catch {
      // A malformed Location header is not something to crash the check over.
    }
    if (/_vercel\/sso|\/sso-api/i.test(location)) return true;
  }

  return /_vercel\/sso|Authentication Required/i.test(body.slice(0, 4000));
}
