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

  test("demo mode renders realistic signed-in data across protected pages", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/client-details.html?demo=1");
    await expect(page.locator("#signed-in-panel")).toBeVisible();
    await expect(page.locator("#clients-list")).toContainText("Ava Johnson");
    await expect(page.locator(".ar-demo-banner")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/calendar.html?demo=1");
    await expect(page.locator("#bronze-shell")).toBeVisible();
    await expect(page.locator("#upcoming-list")).toContainText("Ava Johnson");
    await expectNoHorizontalOverflow(page);

    await page.goto("/form-creator.html?demo=1");
    await expect(page.locator("#signed-in-shell")).toBeVisible();
    await expect(page.locator("#form-preview-title")).toHaveText("Juniper & Co. Appointments");
    await expectNoHorizontalOverflow(page);

    await page.goto("/branding.html?demo=1");
    await expect(page.locator("#signed-in-shell")).toBeVisible();
    await expect(page.locator("#branding-business-name")).toHaveValue("Juniper & Co.");
    await expectNoHorizontalOverflow(page);
  });
});
