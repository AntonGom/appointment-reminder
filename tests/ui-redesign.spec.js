const { test, expect } = require("@playwright/test");

const PRIMARY_PAGES = [
  "/index.html",
  "/client-details.html",
  "/calendar.html",
  "/form-creator.html",
  "/branding.html"
];

async function expectNoHorizontalOverflow(page) {
  const geometry = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth
  }));

  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
}

test.describe("Primary workspace redesign", () => {
  test("keeps the five primary pages inside the desktop workspace shell", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });

    for (const path of PRIMARY_PAGES) {
      await page.goto(path);
      await expect(page.locator("body")).toHaveClass(/has-app-shell/);
      await expect(page.locator(".site-nav")).toBeVisible();
      await expect(page.locator(".mobile-tab-bar")).toBeHidden();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("keeps the five primary pages usable in the mobile workspace shell", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const path of PRIMARY_PAGES) {
      await page.goto(path);
      await expect(page.locator("body")).toHaveClass(/has-app-shell/);
      await expect(page.locator(".mobile-tab-bar")).toBeVisible();
      await expect(page.locator(".nav-toggle")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });
});
