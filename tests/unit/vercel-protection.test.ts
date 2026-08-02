import { describe, expect, it } from "vitest";
import { isProtectionResponse } from "../../scripts/lib/vercel-protection.mjs";

const BASE = "https://food-planner-ih955np05-lars12.vercel.app";

describe("isProtectionResponse", () => {
  // The exact response a protected preview returned in CI. An earlier version
  // of this check looked for the literal "/sso/" and missed "/sso-api?", so
  // the run retried five times and reported "never became healthy" instead of
  // naming the real cause.
  it("detects the 302 redirect to vercel.com/sso-api", () => {
    expect(
      isProtectionResponse({
        status: 302,
        location:
          "https://vercel.com/sso-api?url=https%3A%2F%2Ffood-planner-ih955np05-lars12.vercel.app%2Flogin&nonce=9a11fb06a72b2a4",
        baseUrl: BASE,
      })
    ).toBe(true);
  });

  it.each([
    ["a redirect to the SSO path", "https://vercel.com/sso/authenticate"],
    ["a redirect to the login page", "https://vercel.com/login?next=%2Ffoo"],
    ["a team-scoped host", "https://my-team.vercel.com/sso-api?url=x"],
    ["a relative _vercel/sso path", "/_vercel/sso?url=x"],
  ])("detects %s", (_label, location) => {
    expect(isProtectionResponse({ status: 307, location, baseUrl: BASE })).toBe(true);
  });

  it("detects a 401 regardless of body or location", () => {
    expect(isProtectionResponse({ status: 401, baseUrl: BASE })).toBe(true);
  });

  it("detects the 'Authentication Required' body", () => {
    expect(
      isProtectionResponse({
        status: 200,
        body: "<html><body>Authentication Required</body></html>",
        baseUrl: BASE,
      })
    ).toBe(true);
  });

  it("does not flag a healthy page", () => {
    expect(
      isProtectionResponse({ status: 200, body: "<h1>FoodHelper</h1>", baseUrl: BASE })
    ).toBe(false);
  });

  it("does not flag the app's own redirect to its login page", () => {
    // The middleware sends signed-out visitors to /login — same word, but on
    // the deployment's own host, so it must not be mistaken for the SSO gate.
    expect(
      isProtectionResponse({ status: 307, location: `${BASE}/login`, baseUrl: BASE })
    ).toBe(false);
  });

  it("does not flag a relative redirect to /login", () => {
    expect(isProtectionResponse({ status: 307, location: "/login", baseUrl: BASE })).toBe(false);
  });

  it("does not flag a 500 with no redirect", () => {
    expect(
      isProtectionResponse({ status: 500, body: "500: INTERNAL_SERVER_ERROR", baseUrl: BASE })
    ).toBe(false);
  });

  it("survives a malformed Location header", () => {
    expect(isProtectionResponse({ status: 302, location: "::not a url::", baseUrl: BASE })).toBe(
      false
    );
  });
});
