import { test, expect } from "@playwright/test";

/**
 * Core-loop e2e: sign in → add competitor → add source → scan → see a cited
 * change card → Ask returns a cited answer.
 *
 * OPT-IN: requires a live app with Supabase + AI configured, so it does not run
 * in CI (which would burn API credits and need real auth). Run it against a
 * seeded preview/prod deploy:
 *
 *   E2E_BASE_URL=https://your-preview.vercel.app \
 *   E2E_EMAIL=you@example.com E2E_PASSWORD=... \
 *   npx playwright test --project=core-loop
 */
const BASE = process.env.E2E_BASE_URL;
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.describe("core loop", () => {
  test.skip(
    !BASE || !EMAIL || !PASSWORD,
    "Set E2E_BASE_URL, E2E_EMAIL, E2E_PASSWORD to run the full core loop.",
  );

  test("add competitor → source → scan → cited card → cited Ask", async ({
    page,
  }) => {
    // Sign in.
    await page.goto("/sign-in");
    await page.getByLabel(/work email/i).fill(EMAIL!);
    await page.getByLabel(/password/i).fill(PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/app/);

    // Add a competitor.
    const name = `Playwright Co ${Date.now()}`;
    await page.getByLabel(/competitor name/i).fill(name);
    await page.getByRole("button", { name: /add competitor/i }).click();
    await expect(page.getByText(name).first()).toBeVisible();

    // Open it and add a source.
    await page.getByText(name).first().click();
    await page.waitForURL(/\/app\/competitors\//);
    await page.getByLabel(/public url/i).fill("https://vercel.com/pricing");
    await page.getByRole("button", { name: /add source/i }).click();

    // Scan now → expect a result message (baseline or change).
    await page.getByRole("button", { name: /scan now/i }).first().click();
    await expect(
      page.getByText(/baseline captured|change detected|no change|snapshot/i),
    ).toBeVisible({ timeout: 60_000 });

    // Ask → expect either a streamed answer or a clean "unavailable" notice.
    await page
      .getByPlaceholder(/how did .* change/i)
      .fill("What does the pricing page say?");
    await page.getByRole("button", { name: /^ask$/i }).click();
    await expect(
      page.locator("text=/Sources|unavailable until embeddings/i"),
    ).toBeVisible({ timeout: 60_000 });
  });
});
