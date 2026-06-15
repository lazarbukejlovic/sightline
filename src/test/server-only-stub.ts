// Test-only stub for the `server-only` package. The real package throws if it
// is imported outside a React Server Component bundle, which would block Vitest
// from importing server modules (e.g. server actions) under test. Aliased in
// vitest.config.ts. It changes nothing at runtime — production still imports the
// real `server-only` guard.
export {};
