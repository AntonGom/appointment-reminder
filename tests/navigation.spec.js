const { test, expect } = require("@playwright/test");

test.describe("Navigation chrome", () => {
  test("shows a dark loading intro and clears it after the form is ready", async ({ page }) => {
    let releaseConfig;
    const configGate = new Promise(resolve => {
      releaseConfig = resolve;
    });

    await page.route("**/api/public-config", async route => {
      await configGate;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accountsEnabled: false,
          supabaseUrl: "",
          supabaseAnonKey: "",
          supabasePublishableKey: ""
        })
      });
    });

    const navigation = page.goto("/index.html");
    const overlay = page.locator(".form-loading-overlay");

    await expect(page.locator("body")).toHaveClass(/custom-form-loading/);
    await expect(overlay).toBeVisible();
    await expect(overlay.locator("> :first-child")).toHaveClass(/form-loading-spinner/);
    await expect(overlay.locator("> :last-child")).toHaveText("Loading your form...");
    await expect(overlay).toHaveCSS("color", "rgb(248, 250, 252)");
    expect(await overlay.evaluate(element => getComputedStyle(element).backgroundImage)).toContain("rgba(2, 6, 23");

    releaseConfig();
    await navigation;

    await expect(page.locator("body")).not.toHaveClass(/custom-form-loading/);
    await expect(overlay).toBeHidden();
  });

  test("shows the dev badge with the deployed app version", async ({ page }) => {
    await page.goto("/index.html");

    const badge = page.locator(".env-badge");
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("DEV");
    await expect(badge).toContainText("v20260501.5");
    await expect(badge).toHaveAttribute("title", /commit testsha/);
    await expect(page.locator("body")).not.toHaveClass(/custom-form-loading/);
    await expect(page.locator(".form-loading-overlay")).toBeHidden();
    await expect(page.locator(".form-loading-overlay > :first-child")).toHaveClass(/form-loading-spinner/);
    await expect(page.locator(".form-loading-overlay > :last-child")).toHaveText("Loading your form...");
  });
});
