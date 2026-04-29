const { test, expect } = require("@playwright/test");

const REMINDER_PREFILL_KEY = "appointment-reminder-selected-client";

async function setSignedInUser(page, user) {
  await page.evaluate(async nextUser => {
    window.__testSignedInUser = nextUser;
    window.eval("currentSignedInUser = window.__testSignedInUser;");
    renderBronzeFeatures();
    updateDraftPreviewChrome();
    await syncCustomFormFromUser(window.__testSignedInUser);
    refreshFormState();
  }, user);
}

function createBronzeUser(overrides = {}) {
  const baseUser = {
    id: "user_bronze_123",
    email: "owner@example.com",
    user_metadata: {
      tier: "bronze",
      branding_profile: {
        brandingEnabled: true,
        businessName: "North Shore Wellness",
        templateStyle: "signature",
        headerLabel: "Appointment Reminder",
        accentColor: "#2563eb",
        headerColor: "#1d4ed8",
        secondaryColor: "#e8f1ff",
        heroGradientColor: "#60a5fa",
        heroGradientStyle: "solid",
        heroTextColor: "#ffffff",
        panelColor: "#f3f7ff",
        bodyColor: "#ffffff",
        footerColor: "#0f172a",
        footerTextColor: "#ffffff",
        contactEmail: "owner@example.com"
      },
      custom_form_profile: null
    },
    app_metadata: {}
  };

  return {
    ...baseUser,
    ...overrides,
    user_metadata: {
      ...baseUser.user_metadata,
      ...(overrides.user_metadata || {})
    },
    app_metadata: {
      ...baseUser.app_metadata,
      ...(overrides.app_metadata || {})
    }
  };
}

async function goToReviewStep(page) {
  await page.evaluate(() => {
    const reviewIndex = Array.from(document.querySelectorAll(".wizard-step"))
      .findIndex(step => step.dataset.field === "consent" || step.dataset.nav === "Review");

    if (reviewIndex >= 0) {
      setStep(reviewIndex, "forward");
    }
  });
}

test.describe("Send Reminder", () => {
  test("shows the standard review preview for free and logged-out visitors", async ({ page }) => {
    await page.goto("/index.html");
    await goToReviewStep(page);

    await expect(page.locator("#preview")).toBeVisible();
    await expect(page.locator("#bronze-preview-shell")).toBeHidden();
    await expect(page.locator("#preview")).toHaveJSProperty("readOnly", true);
  });

  test("shows the bronze branded preview when a bronze branding profile is available", async ({ page }) => {
    await page.goto("/index.html");

    await setSignedInUser(page, createBronzeUser());
    await goToReviewStep(page);

    await expect(page.locator("#bronze-preview-shell")).toBeVisible();
    await expect(page.locator("#preview")).toBeHidden();
  });

  test("uses the visible welcome screen start button without a duplicate bottom start control", async ({ page }) => {
    await page.goto("/index.html");

    await setSignedInUser(page, createBronzeUser({
      user_metadata: {
        custom_form_profile: {
          isEnabled: true,
          welcomeScreenEnabled: true,
          welcomeTitle: "Welcome to Pink Paws",
          welcomeCopy: "A quick setup before we send the reminder.",
          welcomeButtonText: "Start"
        }
      }
    }));
    await page.evaluate(() => setStep(0));

    await expect(page.locator("#step-title")).toHaveText("Welcome to Pink Paws");
    await expect(page.locator(".wizard-step.active [data-wizard-start-button]")).toBeVisible();
    await expect(page.locator("#next-button")).toBeHidden();

    await page.locator(".wizard-step.active [data-wizard-start-button]").click();

    await expect(page.locator("#step-title")).toHaveText("Client Phone Number");
    await expect(page.locator("#next-button")).toBeVisible();
  });

  test("renders the bronze branded preview with the latest appointment data", async ({ page }) => {
    const consoleErrors = [];
    page.on("console", message => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await page.goto("/index.html");
    await setSignedInUser(page, createBronzeUser({
      user_metadata: {
        branding_profile: {
          brandingEnabled: true,
          businessName: "Pink Paws Grooming",
          templateStyle: "signature",
          headerLabel: "Pet grooming reminder",
          headerColor: "#ec4899",
          secondaryColor: "#fbcfe8",
          heroGradientColor: "#f9a8d4",
          heroGradientStyle: "solid",
          heroTextColor: "#ffffff",
          contactEmail: "hello@pinkpaws.example"
        }
      }
    }));

    await page.evaluate(() => {
      document.getElementById("name").value = "Ava Johnson";
      document.getElementById("email").value = "ava@example.com";
      document.getElementById("date").value = "2026-05-08";
      document.getElementById("time").value = "10:30";
      document.getElementById("address").value = "245 Rosebud Lane, Miami, FL 33131";
      document.getElementById("notes").value = "Please bring Bella's vaccination records.";
      refreshFormState();
    });
    await goToReviewStep(page);

    const previewBody = page.frameLocator("#bronze-preview-frame").locator("body");

    await expect(page.locator("#bronze-preview-shell")).toBeVisible();
    await expect(previewBody).toContainText("Pink Paws Grooming");
    await expect(previewBody).toContainText("Hello Ava Johnson,");
    await expect(previewBody).toContainText("05/08/2026");
    await expect(previewBody).toContainText("10:30 AM");
    await expect(previewBody).toContainText("245 Rosebud Lane, Miami, FL 33131");
    expect(consoleErrors.join("\n")).not.toContain("index is not defined");
  });

  test("falls back to the plain review message if the branded preview cannot render", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", error => {
      pageErrors.push(error.message);
    });

    await page.goto("/index.html");
    await setSignedInUser(page, createBronzeUser({
      user_metadata: {
        branding_profile: {
          brandingEnabled: true,
          businessName: "Pink Paws Grooming",
          templateStyle: "signature",
          contactEmail: "hello@pinkpaws.example"
        }
      }
    }));

    await page.evaluate(() => {
      window.eval(`
        brandingTemplateModulePromise = Promise.resolve({
          buildReminderEmailHtml() {
            throw new Error("Preview exploded");
          }
        });
      `);
      document.getElementById("name").value = "Ava Johnson";
      document.getElementById("email").value = "ava@example.com";
      document.getElementById("date").value = "2026-05-08";
      document.getElementById("time").value = "10:30";
      document.getElementById("address").value = "245 Rosebud Lane, Miami, FL 33131";
      refreshFormState();
    });
    await goToReviewStep(page);

    await expect(page.locator("#preview")).toBeVisible();
    await expect(page.locator("#preview")).toHaveValue(/Hello Ava Johnson,/);
    await expect(page.locator("#preview")).toHaveValue(/245 Rosebud Lane, Miami, FL 33131/);
    await expect(page.locator("#bronze-preview-shell")).toBeHidden();
    await expect(page.locator("#preview-hint")).toContainText("plain message");
    expect(pageErrors).toEqual([]);
  });

  test("falls back to the standard preview when bronze branding is turned off", async ({ page }) => {
    await page.goto("/index.html");

    await setSignedInUser(page, createBronzeUser({
      user_metadata: {
        branding_profile: {
          brandingEnabled: false,
          businessName: "North Shore Wellness",
          templateStyle: "signature"
        }
      }
    }));
    await goToReviewStep(page);

    await expect(page.locator("#preview")).toBeVisible();
    await expect(page.locator("#bronze-preview-shell")).toBeHidden();
  });

  test("prefills client info from the saved client handoff payload", async ({ page }) => {
    await page.addInitScript(({ key, payload }) => {
      const serialized = JSON.stringify(payload);
      window.sessionStorage.setItem(key, serialized);
      window.localStorage.setItem(key, serialized);
    }, {
      key: REMINDER_PREFILL_KEY,
      payload: {
        id: "client_123",
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "(305) 555-0188",
        address: "123 Test Street"
      }
    });

    await page.goto("/index.html");

    await expect(page.locator("#name")).toHaveValue("Jane Doe");
    await expect(page.locator("#email")).toHaveValue("jane@example.com");
    await expect(page.locator("#phone")).toHaveValue("(305) 555-0188");
    await expect(page.locator("#address")).toHaveValue("123 Test Street");
  });

  test("prefills remembered custom-form answers from the saved client handoff payload", async ({ page }) => {
    await page.goto("/index.html");

    await setSignedInUser(page, createBronzeUser({
      user_metadata: {
        custom_form_profile: {
          isEnabled: true,
          fields: [
            {
              id: "custom_pet_name",
              type: "text",
              title: "Pet name",
              label: "Pet name",
              navLabel: "Pet",
              placeholder: "Enter pet name",
              rememberClientAnswer: true
            }
          ]
        }
      }
    }));

    await page.evaluate(() => {
      applyReminderClientPrefillPayload({
        id: "client_999",
        name: "Jamie",
        email: "jamie@example.com",
        phone: "(305) 555-0111",
        address: "88 Ocean Drive",
        profileCustomAnswers: {
          custom_pet_name: {
            field_id: "custom_pet_name",
            value: "Milo",
            raw_value: "Milo",
            type: "text"
          }
        }
      });
    });

    await expect(page.locator("#custom_pet_name")).toHaveValue("Milo");
    await expect(page.locator("#name")).toHaveValue("Jamie");
  });

  test("maps the appointment fields into the generated review message", async ({ page }) => {
    await page.goto("/index.html");

    await page.evaluate(() => {
      document.getElementById("name").value = "Ava Johnson";
      document.getElementById("email").value = "ava@example.com";
      document.getElementById("date").value = "2026-04-05";
      document.getElementById("time").value = "16:00";
      document.getElementById("address").value = "1540 Bay Road";
      document.getElementById("businessContact").value = "(305) 555-0188";
      document.getElementById("notes").value = "Please call when you are on the way.";
      refreshFormState();
    });

    const message = await page.evaluate(() => getCurrentReviewMessage());
    const subject = await page.locator("#preview-subject").textContent();

    expect(message).toContain("Hello Ava Johnson,");
    expect(message).toContain("Date: 04/05/2026");
    expect(message).toContain("Time: 4:00 PM");
    expect(message).toContain("Location: 1540 Bay Road");
    expect(message).toContain("Additional Details:");
    expect(message).toContain("Please call when you are on the way.");
    expect(message).toContain("If you need to reach us before your appointment, please contact us at (305) 555-0188.");
    expect(subject).toContain("Appointment Reminder for 04/05/2026 at 4:00 PM - Ava Johnson");
  });
});
