const { test, expect } = require("@playwright/test");

const SUPABASE_STATE_KEY = "__playwright_supabase_state__";

const SUPABASE_STUB_MODULE = `
const STORAGE_KEY = "${SUPABASE_STATE_KEY}";
const listeners = [];

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function readState() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
  } catch (error) {
    return {};
  }
}

function writeState(state) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeTableState(state) {
  if (!state.tables || typeof state.tables !== "object") {
    state.tables = {};
  }

  ["profiles", "clients", "appointments", "client_reminder_history"].forEach(name => {
    if (!Array.isArray(state.tables[name])) {
      state.tables[name] = [];
    }
  });

  return state;
}

function getTableRows(table) {
  const state = normalizeTableState(readState());
  return state.tables[table] || [];
}

function setTableRows(table, rows) {
  const state = normalizeTableState(readState());
  state.tables[table] = rows;
  writeState(state);
}

function emitAuthEvent(event) {
  const state = readState();
  const session = state.user ? { user: clone(state.user) } : null;
  listeners.forEach(listener => {
    try {
      listener(event, session);
    } catch (error) {
      console.warn(error);
    }
  });
}

function applyFilters(rows, filters) {
  return rows.filter(row => filters.every(filter => {
    if (filter.type === "eq") {
      return String(row?.[filter.column] ?? "") === String(filter.value ?? "");
    }
    if (filter.type === "in") {
      return filter.values.includes(String(row?.[filter.column] ?? ""));
    }
    return true;
  }));
}

function selectColumns(rows, columns) {
  if (!columns || columns === "*" || columns.includes("*")) {
    return clone(rows);
  }

  const normalized = String(columns)
    .split(",")
    .map(column => column.trim())
    .filter(Boolean);

  return clone(rows.map(row => {
    const next = {};
    normalized.forEach(column => {
      next[column] = row?.[column];
    });
    return next;
  }));
}

function createQueryBuilder(table) {
  const state = {
    table,
    action: "select",
    selectColumns: "*",
    filters: [],
    limitCount: null,
    orderBy: null,
    updatePayload: null,
    insertRows: null,
    upsertRows: null,
    single: false
  };

  const builder = {
    select(columns = "*") {
      state.action = "select";
      state.selectColumns = columns;
      return builder;
    },
    eq(column, value) {
      state.filters.push({ type: "eq", column, value });
      return builder;
    },
    in(column, values) {
      state.filters.push({ type: "in", column, values: (values || []).map(value => String(value)) });
      return builder;
    },
    limit(count) {
      state.limitCount = count;
      return builder;
    },
    order(column, options = {}) {
      state.orderBy = { column, ascending: options.ascending !== false };
      return builder;
    },
    update(payload) {
      state.action = "update";
      state.updatePayload = clone(payload || {});
      return builder;
    },
    delete() {
      state.action = "delete";
      return builder;
    },
    insert(payload) {
      state.action = "insert";
      state.insertRows = Array.isArray(payload) ? clone(payload) : [clone(payload)];
      return builder;
    },
    upsert(payload) {
      state.action = "upsert";
      state.upsertRows = Array.isArray(payload) ? clone(payload) : [clone(payload)];
      return builder;
    },
    single() {
      state.single = true;
      return builder;
    },
    maybeSingle() {
      state.single = true;
      return builder;
    },
    then(resolve, reject) {
      return execute().then(resolve, reject);
    }
  };

  async function execute() {
    const rows = getTableRows(state.table);
    const matchingRows = applyFilters(rows, state.filters);

    if (state.action === "select") {
      let resultRows = [...matchingRows];

      if (state.orderBy) {
        const { column, ascending } = state.orderBy;
        resultRows.sort((left, right) => {
          const leftValue = String(left?.[column] ?? "");
          const rightValue = String(right?.[column] ?? "");
          return ascending ? leftValue.localeCompare(rightValue) : rightValue.localeCompare(leftValue);
        });
      }

      if (typeof state.limitCount === "number") {
        resultRows = resultRows.slice(0, state.limitCount);
      }

      const selectedRows = selectColumns(resultRows, state.selectColumns);

      if (state.single) {
        return {
          data: selectedRows[0] || null,
          error: null
        };
      }

      return {
        data: selectedRows,
        error: null
      };
    }

    if (state.action === "delete") {
      const matchingIds = new Set(matchingRows.map(row => String(row?.id ?? "")));
      const nextRows = rows.filter(row => !matchingIds.has(String(row?.id ?? "")));
      setTableRows(state.table, nextRows);
      return { data: null, error: null };
    }

    if (state.action === "update") {
      const nextRows = rows.map(row => {
        const matches = applyFilters([row], state.filters).length > 0;
        return matches ? { ...row, ...clone(state.updatePayload) } : row;
      });
      setTableRows(state.table, nextRows);
      return { data: clone(nextRows.filter(row => applyFilters([row], state.filters).length > 0)), error: null };
    }

    if (state.action === "insert") {
      const nextRows = [...rows];
      state.insertRows.forEach((row, index) => {
        nextRows.push({
          id: row?.id || \`\${state.table}_\${Date.now()}_\${index}\`,
          ...row
        });
      });
      setTableRows(state.table, nextRows);
      return { data: clone(state.insertRows), error: null };
    }

    if (state.action === "upsert") {
      const nextRows = [...rows];
      state.upsertRows.forEach((row, index) => {
        const id = String(row?.id || "");
        const existingIndex = nextRows.findIndex(entry => String(entry?.id || "") === id);

        if (existingIndex >= 0) {
          nextRows[existingIndex] = { ...nextRows[existingIndex], ...row };
          return;
        }

        nextRows.push({
          id: id || \`\${state.table}_\${Date.now()}_\${index}\`,
          ...row
        });
      });
      setTableRows(state.table, nextRows);
      return { data: clone(state.upsertRows), error: null };
    }

    return { data: null, error: null };
  }

  return builder;
}

export function createClient() {
  return {
    auth: {
      async getSession() {
        const state = readState();
        return {
          data: {
            session: state.user ? { user: clone(state.user) } : null
          },
          error: null
        };
      },
      async getUser() {
        const state = readState();
        return {
          data: {
            user: state.user ? clone(state.user) : null
          },
          error: null
        };
      },
      async updateUser({ data }) {
        const state = normalizeTableState(readState());
        const currentUser = state.user || {
          id: "pw_user",
          email: "owner@example.com",
          user_metadata: {},
          app_metadata: {}
        };
        state.user = {
          ...currentUser,
          user_metadata: {
            ...(currentUser.user_metadata || {}),
            ...(data || {})
          }
        };
        writeState(state);
        emitAuthEvent("USER_UPDATED");
        return {
          data: {
            user: clone(state.user)
          },
          error: null
        };
      },
      onAuthStateChange(callback) {
        listeners.push(callback);
        return {
          data: {
            subscription: {
              unsubscribe() {}
            }
          }
        };
      }
    },
    from(table) {
      return createQueryBuilder(table);
    }
  };
}
`;

function createBronzeUser(overrides = {}) {
  const baseUser = {
    id: "bronze_user_1",
    email: "owner@example.com",
    user_metadata: {
      tier: "bronze",
      branding_profile: {},
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

function createSupabaseSeed({ user, clients = [], appointments = [], history = [], profiles = [] } = {}) {
  return {
    user: user || createBronzeUser(),
    tables: {
      profiles,
      clients,
      appointments,
      client_reminder_history: history
    }
  };
}

async function stubModulePages(page, seedState) {
  await page.route("**/api/public-config", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accountsEnabled: true,
        supabaseUrl: "https://example.supabase.co",
        supabaseAnonKey: "anon-key",
        supabasePublishableKey: "publishable-key"
      })
    });
  });

  await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: SUPABASE_STUB_MODULE
    });
  });

  await page.addInitScript(({ key, seed }) => {
    if (!window.localStorage.getItem(key)) {
      window.localStorage.setItem(key, JSON.stringify(seed));
    }
  }, {
    key: SUPABASE_STATE_KEY,
    seed: seedState
  });
}

async function goToReviewStep(page) {
  await page.waitForFunction(() => typeof setStep === "function");
  await page.evaluate(() => {
    const reviewIndex = Array.from(document.querySelectorAll(".wizard-step"))
      .findIndex(step => step.dataset.field === "consent" || step.dataset.nav === "Review");

    if (reviewIndex >= 0) {
      setStep(reviewIndex, "forward");
    }
  });
}

test.describe("Branding and Client Details", () => {
  test("branding toggle and saved colors persist after reload", async ({ page }) => {
    const seed = createSupabaseSeed({
      user: createBronzeUser({
        user_metadata: {
          branding_profile: {
            brandingEnabled: true,
            businessName: "Clip House",
            templateStyle: "signature",
            headerColor: "#123456",
            accentColor: "#123456",
            buttonColor: "#ff6600",
            contactEmail: "owner@example.com"
          }
        }
      })
    });

    await stubModulePages(page, seed);
    await page.goto("/branding.html");

    await expect(page.locator("#branding-business-name")).toHaveValue("Clip House");
    await expect(page.locator("#branding-enabled")).toBeChecked();

    await page.evaluate(() => {
      const businessName = document.getElementById("branding-business-name");
      const headerColor = document.getElementById("branding-header-color");
      const headerHex = document.getElementById("branding-header-hex");

      businessName.value = "Clip House Studio";
      headerColor.value = "#224466";
      headerHex.value = "#224466";

      businessName.dispatchEvent(new Event("input", { bubbles: true }));
      headerColor.dispatchEvent(new Event("input", { bubbles: true }));
      headerColor.dispatchEvent(new Event("change", { bubbles: true }));
      headerHex.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.locator("#save-branding-button").click();

    await expect(page.locator("#branding-business-name")).toHaveValue("Clip House Studio");
    await expect(page.locator("#branding-enabled-note")).toContainText("Branding is on");

    await page.locator("#branding-enabled").uncheck();
    await expect(page.locator("#branding-enabled-note")).toContainText("standard reminder format");

    await page.reload();

    await expect(page.locator("#branding-business-name")).toHaveValue("Clip House Studio");
    await expect(page.locator("#branding-header-color")).toHaveValue("#224466");
    await expect(page.locator("#branding-enabled")).not.toBeChecked();
  });

  test("sends a branding test email using the current draft design", async ({ page }) => {
    const seed = createSupabaseSeed({
      user: createBronzeUser({
        email: "owner@example.com",
        user_metadata: {
          branding_profile: {
            brandingEnabled: true,
            businessName: "Pink Paws Grooming",
            templateStyle: "signature",
            headerColor: "#ec4899",
            buttonColor: "#db2777",
            contactEmail: "hello@pinkpaws.example"
          }
        }
      })
    });
    let requestPayload = null;

    await stubModulePages(page, seed);
    await page.route("**/api/send-email", async route => {
      requestPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          messageId: "test-message-1",
          qaEmailDebug: {
            subject: "Appointment Reminder for 04/05/2026 at 4:00 PM from Pink Paws Grooming",
            html: "<html><body>Pink Paws Grooming</body></html>",
            recipient: "owner@example.com",
            messageId: "test-message-1",
            sentAt: "2026-04-29T12:00:00.000Z"
          }
        })
      });
    });

    await page.goto("/branding.html");
    await expect(page.locator("#branding-business-name")).toHaveValue("Pink Paws Grooming");

    await page.evaluate(() => {
      const businessName = document.getElementById("branding-business-name");
      businessName.value = "Pink Paws Grooming Studio";
      businessName.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.locator("#send-branding-test-button").click();

    await expect(page.locator("#status-banner")).toContainText("Test email sent to owner@example.com");
    expect(requestPayload.clientEmail).toBe("owner@example.com");
    expect(requestPayload.trackingSource).toBe("branding_test_email");
    expect(requestPayload.brandingProfile.businessName).toBe("Pink Paws Grooming Studio");
    expect(requestPayload.message).toContain("Hello Ava Johnson,");
  });

  test("saved branding email toggle controls the Send Reminder branded preview", async ({ page }) => {
    const seed = createSupabaseSeed({
      user: createBronzeUser({
        user_metadata: {
          branding_profile: {
            brandingEnabled: false,
            businessName: "Northline Realty",
            templateStyle: "signature",
            headerColor: "#123456",
            accentColor: "#123456",
            contactEmail: "hello@northline.example"
          }
        }
      })
    });

    await stubModulePages(page, seed);
    await page.goto("/branding.html");

    await expect(page.locator("#branding-enabled")).not.toBeChecked();
    await page.locator("#branding-enabled").check();
    await page.evaluate(() => {
      const businessName = document.getElementById("branding-business-name");
      const headerColor = document.getElementById("branding-header-color");
      const headerHex = document.getElementById("branding-header-hex");

      businessName.value = "Northline Realty Group";
      headerColor.value = "#224466";
      headerHex.value = "#224466";

      businessName.dispatchEvent(new Event("input", { bubbles: true }));
      headerColor.dispatchEvent(new Event("input", { bubbles: true }));
      headerColor.dispatchEvent(new Event("change", { bubbles: true }));
      headerHex.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.locator("#save-branding-button").click();

    await page.waitForFunction(key => {
      const state = JSON.parse(window.localStorage.getItem(key) || "{}");
      const profile = state?.user?.user_metadata?.branding_profile || {};
      return profile.brandingEnabled === true
        && profile.businessName === "Northline Realty Group"
        && profile.headerColor === "#224466";
    }, SUPABASE_STATE_KEY);

    await page.goto("/index.html");
    await expect(page.locator("body")).not.toHaveClass(/custom-form-loading/);
    await goToReviewStep(page);

    await expect(page.locator("#bronze-preview-shell")).toBeVisible();
    await expect(page.locator("#preview")).toBeHidden();
    await expect(page.frameLocator("#bronze-preview-frame").locator("body")).toContainText("Northline Realty Group");
  });

  test("adding and editing a client persists saved contact details", async ({ page }) => {
    await stubModulePages(page, createSupabaseSeed());
    await page.goto("/client-details.html");

    await expect(page.locator("#clients-list")).toContainText("No contacts saved yet.");
    await page.locator("#open-add-client-button").click();
    await expect(page.locator("#client-modal")).toBeVisible();

    await page.locator("#client-email").fill("casey@example.com");
    await page.locator("#client-phone").fill("(305) 555-0199");
    await page.locator("#client-address").fill("44 Listing Lane");
    await page.locator("#client-notes").fill("Prefers afternoon showings.");
    await page.locator("#client-name").fill("Casey Seller");
    await page.locator("#save-client-button").click();

    await expect(page.locator("#status-banner")).toContainText("Contact saved");
    await expect(page.locator("#clients-list")).toContainText("Casey Seller");

    await page.locator("#clients-list").locator('[data-action="edit"]').first().click();
    await expect(page.locator("#client-modal")).toBeVisible();
    await page.locator("#client-address").fill("88 Updated Ave");
    await page.locator("#client-notes").fill("Use side gate for inspections.");
    await page.locator("#client-name").fill("Casey Seller");
    await page.locator("#save-client-button").click();

    await expect(page.locator("#status-banner")).toContainText("Contact updated");
    await expect(page.locator("#clients-list")).toContainText("88 Updated Ave");

    const state = await page.evaluate(key => JSON.parse(window.localStorage.getItem(key) || "{}"), SUPABASE_STATE_KEY);
    expect(state.tables.clients).toHaveLength(1);
    expect(state.tables.clients[0].client_name).toBe("Casey Seller");
    expect(state.tables.clients[0].client_email).toBe("casey@example.com");
    expect(state.tables.clients[0].client_phone).toBe("3055550199");
    expect(state.tables.clients[0].service_address).toBe("88 Updated Ave");
    expect(state.tables.clients[0].notes).toBe("Use side gate for inspections.");
  });

  test("exporting and reimporting clients updates matching ids without creating duplicates", async ({ page }) => {
    const seed = createSupabaseSeed({
      clients: [
        {
          id: "client_barber_1",
          owner_id: "bronze_user_1",
          client_name: "Alex Fade",
          client_email: "alex@example.com",
          client_phone: "3055550101",
          service_address: "12 Barber Lane",
          profile_custom_answers: {
            preferred_barber: {
              field_id: "preferred_barber",
              label: "Preferred Barber",
              value: "Antonio",
              raw_value: "Antonio",
              display_value: "Antonio"
            }
          }
        }
      ]
    });

    await stubModulePages(page, seed);
    await page.goto("/client-details.html");

    await expect(page.locator("#clients-list")).toContainText("Alex Fade");

    const updatedJson = JSON.stringify({
      format: "appointment-reminder-clients-v1",
      exported_at: "2026-04-16T12:00:00.000Z",
      clients: [
        {
          id: "client_barber_1",
          client_name: "Alex Fade Jr",
          client_email: "alex@example.com",
          client_phone: "3055550101",
          service_address: "99 Updated Ave",
          profile_custom_answers: {
            preferred_barber: {
              field_id: "preferred_barber",
              label: "Preferred Barber",
              value: "Henry",
              raw_value: "Henry",
              display_value: "Henry"
            }
          }
        }
      ]
    });

    await page.setInputFiles("#import-clients-input", {
      name: "clients.json",
      mimeType: "application/json",
      buffer: Buffer.from(updatedJson)
    });

    await expect(page.locator("#status-banner")).toContainText("Imported 1 client");
    await expect(page.locator("#clients-list")).toContainText("Alex Fade Jr");

    const state = await page.evaluate(key => JSON.parse(window.localStorage.getItem(key) || "{}"), SUPABASE_STATE_KEY);
    expect(state.tables.clients).toHaveLength(1);
    expect(state.tables.clients[0].client_name).toBe("Alex Fade Jr");
    expect(state.tables.clients[0].service_address).toBe("99 Updated Ave");
    expect(state.tables.clients[0].profile_custom_answers.preferred_barber.value).toBe("Henry");
  });

  test("export json includes the saved client records and remembered answers", async ({ page }) => {
    const seed = createSupabaseSeed({
      clients: [
        {
          id: "client_export_1",
          owner_id: "bronze_user_1",
          client_name: "Milo Paws",
          client_email: "milo@example.com",
          client_phone: "3055552222",
          service_address: "200 Groomer Way",
          profile_custom_answers: {
            pet_name: {
              field_id: "pet_name",
              label: "Pet Name",
              value: "Milo",
              raw_value: "Milo",
              display_value: "Milo"
            }
          }
        }
      ]
    });

    await stubModulePages(page, seed);
    await page.goto("/client-details.html");

    await page.locator("#clients-more-actions-menu").evaluate(element => {
      element.open = true;
    });

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("#export-clients-json-button").click()
    ]);

    const stream = await download.createReadStream();
    const chunks = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    const exported = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    expect(exported.format).toBe("appointment-reminder-clients-v1");
    expect(Array.isArray(exported.clients)).toBe(true);
    expect(exported.clients).toHaveLength(1);
    expect(exported.clients[0].client_name).toBe("Milo Paws");
    expect(JSON.stringify(exported.clients[0].profile_custom_answers || {})).toContain("Milo");
  });

  test("deleting a client removes only the targeted record even when another client shares the email", async ({ page }) => {
    const seed = createSupabaseSeed({
      clients: [
        {
          id: "client_one",
          owner_id: "bronze_user_1",
          client_name: "Jamie Seller",
          client_email: "shared@example.com",
          client_phone: "",
          service_address: "12 Market St",
          profile_custom_answers: {}
        },
        {
          id: "client_two",
          owner_id: "bronze_user_1",
          client_name: "Taylor Buyer",
          client_email: "shared@example.com",
          client_phone: "",
          service_address: "44 Pine St",
          profile_custom_answers: {}
        }
      ],
      appointments: [
        {
          id: "appt_one",
          owner_id: "bronze_user_1",
          client_id: "client_one",
          client_email: "shared@example.com",
          client_name: "Jamie Seller",
          service_date: "2026-05-01"
        },
        {
          id: "appt_two",
          owner_id: "bronze_user_1",
          client_id: "client_two",
          client_email: "shared@example.com",
          client_name: "Taylor Buyer",
          service_date: "2026-05-02"
        }
      ],
      history: [
        {
          id: "history_one",
          owner_id: "bronze_user_1",
          client_id: "client_one",
          recipient_email: "shared@example.com"
        },
        {
          id: "history_two",
          owner_id: "bronze_user_1",
          client_id: "client_two",
          recipient_email: "shared@example.com"
        }
      ]
    });

    await stubModulePages(page, seed);
    page.on("dialog", dialog => dialog.accept());
    await page.goto("/client-details.html");

    await expect(page.locator("#clients-list")).toContainText("Jamie Seller");
    await expect(page.locator("#clients-list")).toContainText("Taylor Buyer");

    await page.locator('[data-action="delete"][data-client-id="client_one"]').first().click();

    await expect(page.locator("#status-banner")).toContainText("deleted");
    await expect(page.locator("#clients-list")).not.toContainText("Jamie Seller");
    await expect(page.locator("#clients-list")).toContainText("Taylor Buyer");

    const state = await page.evaluate(key => JSON.parse(window.localStorage.getItem(key) || "{}"), SUPABASE_STATE_KEY);
    expect(state.tables.clients.map(client => client.id)).toEqual(["client_two"]);
    expect(state.tables.appointments.map(appointment => appointment.id)).toEqual(["appt_two"]);
    expect(state.tables.client_reminder_history.map(entry => entry.id)).toEqual(["history_two"]);
  });
});

test.describe("Branding mobile UX", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });

  test("tapping the preview opens a readable branding editor on mobile", async ({ page }) => {
    const seed = createSupabaseSeed({
      user: createBronzeUser({
        user_metadata: {
          branding_profile: {
            brandingEnabled: true,
            businessName: "Clip House",
            templateStyle: "signature",
            headerColor: "#123456",
            accentColor: "#123456",
            contactEmail: "owner@example.com"
          }
        }
      })
    });

    await stubModulePages(page, seed);
    await page.goto("/branding.html");

    const heroArea = page.frameLocator("#branding-preview-frame").locator('[data-preview-area="hero"]').first();
    await expect(heroArea).toBeVisible();
    await heroArea.click();

    const editorCard = page.locator(".branding-editor-card");
    await expect(editorCard).toBeVisible();
    await expect(page.locator("#branding-header-color")).toBeVisible();
    await expect(page.locator("#branding-hero-text-color")).toBeVisible();

    const editorBox = await editorCard.boundingBox();
    expect(editorBox).not.toBeNull();
    expect(editorBox.width).toBeGreaterThan(250);
    expect(editorBox.height).toBeGreaterThan(300);
  });
});
