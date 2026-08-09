/**
 * Integration tests run against a real Postgres, but never against the dev
 * database — `resetDatabase()` empties every table between tests. Point
 * TEST_DATABASE_URL at your own database to override the default.
 *
 * Plain ESM (not TypeScript) so the Vite config, the global setup and the test
 * setup can all import it with an explicit extension.
 */

/** @type {string} */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://foodhelper:foodhelper@localhost:5432/foodhelper_test?schema=public";

/**
 * Guards against wiping a non-test database by accident.
 * @param {string} url
 */
export function assertIsTestDatabase(url) {
  const database = url.split("/").pop()?.split("?")[0] ?? "";
  if (!/test/i.test(database)) {
    throw new Error(
      `Refusing to run integration tests against "${database}": the database name must ` +
        `contain "test", because every test empties all tables. Set TEST_DATABASE_URL.`
    );
  }
}
