const { test, expect } = require("@playwright/test");

test.describe("Navigation chrome", () => {
  test("shows the dev badge with the deployed app version", async ({ page }) => {
    await page.goto("/index.html");

    const badge = page.locator(".env-badge");
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("DEV");
    await expect(badge).toContainText("v20260501.1");
    await expect(badge).toHaveAttribute("title", /commit testsha/);
  });
});
