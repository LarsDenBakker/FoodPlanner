// Next.js resolves the bare `server-only` specifier internally, so it is not a
// real package in node_modules. The vitest configs alias it here so modules
// guarded by `import "server-only"` can be imported directly from tests.
export {};
