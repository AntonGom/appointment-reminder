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

  test("send reminder uses the quick-entry desk and keeps review validation", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/index.html?demo=1");

    await expect(page.locator(".quick-entry-form")).toBeVisible();
    await expect(page.locator("#phone")).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#date")).toBeVisible();
    await expect(page.locator(".quick-reminder-rail")).toBeVisible();

    await page.locator("#name").fill("Ava Johnson");
    await page.locator("#email").fill("ava.johnson@example.com");
    await page.locator("#date").fill("2026-10-12");
    await page.locator("#time").fill("10:30");
    await page.locator("#custom_service_type").selectOption("Follow-up");
    await page.locator(".quick-review-button").click();

    await expect(page.locator("body")).toHaveClass(/reminder-review-mode/);
    await expect(page.locator(".wizard-step[data-field='consent']")).toBeVisible();
    await page.locator(".quick-review-back").click();
    await expect(page.locator("body")).not.toHaveClass(/reminder-review-mode/);
  });

  test("form creator keeps mobile tools out of the way until requested", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/form-creator.html?demo=1");

    await expect(page.locator(".fc-next-topbar")).toBeVisible();
    await expect(page.locator("#form-preview-shell")).toBeVisible();
    await expect(page.locator(".fc-mobile-tools-button")).toBeVisible();
    await expect(page.locator("body")).not.toHaveClass(/fc-tools-open/);

    await page.locator(".fc-mobile-tools-button").click();
    await expect(page.locator("body")).toHaveClass(/fc-tools-open/);
    await expect(page.locator("#form-studio-panel")).toBeInViewport();
    await expectNoHorizontalOverflow(page);
  });
});
