import { test, expect } from "@playwright/test";

/**
 * Smoke e2e — public surfaces render correctly. No secrets, no DB, no AI →
 * deterministic and CI-safe.
 */
test.describe("public pages", () => {
  test("landing page renders the hero + primary CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Know what your competitors changed/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Start monitoring free/i }).first(),
    ).toBeVisible();
  });

  test("sign-in page renders the form", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByLabel(/work email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sign in/i }),
    ).toBeVisible();
  });

  test("sign-up page renders the form", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(page.getByLabel(/work email/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /create account/i }),
    ).toBeVisible();
  });

  test("public status page is reachable", async ({ page }) => {
    await page.goto("/status");
    await expect(page.getByText(/system status/i)).toBeVisible();
    await expect(page.getByText(/Subsystems/i)).toBeVisible();
  });
});
