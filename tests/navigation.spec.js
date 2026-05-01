const { test, expect } = require("@playwright/test");

test.describe("Navigation chrome", () => {
  test("shows the dev badge with the deployed app version", async ({ page }) => {
    await page.goto("/index.html");

    const badge = page.locator(".env-badge");
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("DEV");
    await expect(badge).toContainText("v20260501.3");
    await expect(badge).toHaveAttribute("title", /commit testsha/);
    await expect(page.locator("body")).not.toHaveClass(/custom-form-loading/);
    await expect(page.locator(".form-loading-overlay")).toBeHidden();
    await expect(page.locator(".form-loading-overlay > :first-child")).toHaveClass(/form-loading-spinner/);
    await expect(page.locator(".form-loading-overlay > :last-child")).toHaveText("Loading your form...");
  });
});
