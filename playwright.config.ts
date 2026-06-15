import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright e2e config.
 *
 * Two project groups:
 *  - "smoke" — public pages render (landing, sign-in, sign-up). Deterministic,
 *    needs no secrets/DB; runs in CI against a locally-started production build.
 *  - "core-loop" — the full signed-in flow (add competitor → source → scan →
 *    cited card → Ask). It needs a live app + Supabase + AI, so it is OPT-IN:
 *    set E2E_BASE_URL (and E2E_EMAIL / E2E_PASSWORD) to run it against a seeded
 *    preview/prod deploy. Skipped otherwise (so CI never burns API credits).
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const useLocalServer = !process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "smoke",
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "core-loop",
      testMatch: /core-loop\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Start a local production server only when not targeting a remote base URL.
  webServer: useLocalServer
    ? {
        command: "npm run start -- -p 3100",
        url: "http://localhost:3100",
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
        env: {
          NEXT_PUBLIC_SUPABASE_URL:
            process.env.NEXT_PUBLIC_SUPABASE_URL ??
            "https://placeholder.supabase.co",
          NEXT_PUBLIC_SUPABASE_ANON_KEY:
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key",
          NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
          // Server env so getServerEnv() parses on public routes (e.g. /status).
          SUPABASE_SERVICE_ROLE_KEY:
            process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder",
          DATABASE_URL:
            process.env.DATABASE_URL ??
            "postgresql://u:p@localhost:6543/postgres",
          DIRECT_URL:
            process.env.DIRECT_URL ??
            "postgresql://u:p@localhost:5432/postgres",
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "sk-ant-placeholder",
          FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY ?? "fc-placeholder",
        },
      }
    : undefined,
});
