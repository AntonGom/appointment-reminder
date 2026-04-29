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
  } catch (_error) {
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
  if (!columns || columns === "*" || String(columns).includes("*")) {
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
    orderBy: [],
    updatePayload: null,
    insertRows: null,
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
      state.orderBy.push({ column, ascending: options.ascending !== false });
      return builder;
    },
    update(payload) {
      state.action = "update";
      state.updatePayload = clone(payload || {});
      return builder;
    },
    insert(payload) {
      state.action = "insert";
      state.insertRows = Array.isArray(payload) ? clone(payload) : [clone(payload)];
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

      state.orderBy.forEach(orderRule => {
        resultRows.sort((left, right) => {
          const leftValue = String(left?.[orderRule.column] ?? "");
          const rightValue = String(right?.[orderRule.column] ?? "");
          return orderRule.ascending
            ? leftValue.localeCompare(rightValue)
            : rightValue.localeCompare(leftValue);
        });
      });

      if (typeof state.limitCount === "number") {
        resultRows = resultRows.slice(0, state.limitCount);
      }

      const selectedRows = selectColumns(resultRows, state.selectColumns);

      if (state.single) {
        return { data: selectedRows[0] || null, error: null };
      }

      return { data: selectedRows, error: null };
    }

    if (state.action === "update") {
      const nextRows = rows.map(row => {
        const matches = applyFilters([row], state.filters).length > 0;
        return matches ? { ...row, ...clone(state.updatePayload) } : row;
      });
      setTableRows(state.table, nextRows);
      return { data: clone(nextRows), error: null };
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

async function pointerDrag(page, fromLocator, toLocator, options = {}) {
  const {
    startAt = "center",
    endAt = "center",
    nudge = 10,
    steps = 14
  } = options;

  await fromLocator.scrollIntoViewIfNeeded();
  await toLocator.scrollIntoViewIfNeeded();

  const fromBox = await fromLocator.boundingBox();
  const toBox = await toLocator.boundingBox();

  expect(fromBox).not.toBeNull();
  expect(toBox).not.toBeNull();

  const pointFor = (box, placement) => {
    if (placement === "top") {
      return { x: box.x + (box.width / 2), y: box.y + Math.min(16, box.height * 0.25) };
    }
    if (placement === "bottom") {
      return { x: box.x + (box.width / 2), y: box.y + box.height - Math.min(16, box.height * 0.25) };
    }
    if (placement === "left") {
      return { x: box.x + Math.min(16, box.width * 0.25), y: box.y + (box.height / 2) };
    }
    if (placement === "right") {
      return { x: box.x + box.width - Math.min(16, box.width * 0.25), y: box.y + (box.height / 2) };
    }

    return { x: box.x + (box.width / 2), y: box.y + (box.height / 2) };
  };

  const startPoint = pointFor(fromBox, startAt);
  const endPoint = pointFor(toBox, endAt);

  await page.mouse.move(startPoint.x, startPoint.y);
  await page.mouse.down();
  await page.mouse.move(startPoint.x + 1, startPoint.y + nudge, { steps: 3 });
  await page.mouse.move(endPoint.x, endPoint.y, { steps });
  await page.mouse.up();
}

async function closeFormEditorIfOpen(page) {
  const editor = page.locator("#form-editor-popover");
  if (await editor.isVisible()) {
    await page.locator("#form-editor-close").click();
    await expect(editor).toBeHidden();
  }
}

async function ensureStudioAccordionOpen(page, title) {
  const accordion = page.locator("details.settings-accordion", {
    has: page.locator(".settings-accordion-title", { hasText: title })
  }).first();
  await expect(accordion).toBeVisible();

  if ((await accordion.getAttribute("open")) === null) {
    await accordion.locator("summary").click();
  }
}

test.describe("Calendar and Form Creator", () => {
  test("calendar renders saved appointments and switches between week and month views", async ({ page }) => {
    const seed = createSupabaseSeed({
      appointments: [
        {
          id: "appt_future_1",
          owner_id: "bronze_user_1",
          client_id: "client_1",
          client_name: "Jordan Fade",
          client_email: "jordan@example.com",
          client_phone: "3055550101",
          service_date: "2027-04-18",
          service_time: "14:30",
          service_location: "12 Barber Lane",
          notes: "Fade with beard trim"
        },
        {
          id: "appt_past_1",
          owner_id: "bronze_user_1",
          client_id: "client_2",
          client_name: "Ava Buyer",
          client_email: "ava@example.com",
          client_phone: "3055550102",
          service_date: "2026-04-10",
          service_time: "09:00",
          service_location: "88 Ocean Drive",
          notes: "Listing walk-through"
        }
      ],
      history: [
        {
          id: "history_1",
          owner_id: "bronze_user_1",
          client_id: "client_1",
          status: "sent",
          channel: "email",
          source: "automation",
          sent_at: "2026-04-16T10:00:00.000Z"
        }
      ]
    });

    await stubModulePages(page, seed);
    await page.goto("/calendar.html");

    await expect(page.locator("#calendar-layout")).toBeVisible();
    await expect(page.locator("#upcoming-list")).toContainText("Jordan Fade");
    await expect(page.locator("#previous-list")).toContainText("Ava Buyer");
    await expect(page.locator("#all-appointments-list")).toContainText("Jordan Fade");

    await page.locator("#all-appointments-list").getByText("Jordan Fade").click();
    await expect(page.locator("#appointment-detail-modal")).toBeVisible();
    await expect(page.locator("#appointment-detail-body")).toContainText("12 Barber Lane");
    await expect(page.locator("#appointment-detail-body")).toContainText("Fade with beard trim");
    await expect(page.locator("#appointment-detail-body")).toContainText("Email");
    await page.locator("#close-appointment-detail-button").click();
    await expect(page.locator("#appointment-detail-modal")).toBeHidden();

    await page.locator("#calendar-month-view").click();
    await expect(page.locator("#calendar-month-shell")).toBeVisible();
    await expect(page.locator("#calendar-week-shell")).toBeHidden();

    await page.locator("#calendar-week-view").click();
    await expect(page.locator("#calendar-week-shell")).toBeVisible();
  });

  test("calendar shows empty states when no appointments are saved", async ({ page }) => {
    await stubModulePages(page, createSupabaseSeed());
    await page.goto("/calendar.html");

    await expect(page.locator("#calendar-layout")).toBeVisible();
    await expect(page.locator("#upcoming-list")).toContainText("No upcoming appointments yet.");
    await expect(page.locator("#previous-list")).toContainText("No previous appointments yet.");
    await expect(page.locator("#all-appointments-list")).toContainText("No appointments have been saved yet.");
  });

  test("form creator saves a selected template and keeps it after reload", async ({ page }) => {
    await stubModulePages(page, createSupabaseSeed());
    await page.goto("/form-creator.html");

    await expect(page.locator("#form-preview-title")).toContainText("Appointment Reminder");
    await page.locator('[data-studio-tab="templates"]').click();
    await page.locator('[data-template-id="barbershop"]').click();
    await expect(page.locator("#status-banner")).toContainText("template loaded");

    await page.locator("#save-form-button").click();
    await expect(page.locator("#status-banner")).toContainText("Form saved");

    await page.reload();
    await expect(page.locator("#form-preview-title")).toContainText("Barbershop Reminder");
  });

  test("form creator toggle-off state persists after reload", async ({ page }) => {
    const seed = createSupabaseSeed({
      user: createBronzeUser({
        user_metadata: {
          custom_form_profile: {
            isEnabled: true
          }
        }
      })
    });

    await stubModulePages(page, seed);
    await page.goto("/form-creator.html");

    await expect(page.locator("#form-enabled-toggle")).toBeChecked();
    await page.locator(".form-enabled-row").click();
    await page.waitForFunction(key => {
      const state = JSON.parse(window.localStorage.getItem(key) || "{}");
      return state?.user?.user_metadata?.custom_form_profile?.isEnabled === false;
    }, SUPABASE_STATE_KEY);

    await page.reload();
    await expect(page.locator("#form-enabled-toggle")).not.toBeChecked();
  });
});

test.describe("Form Creator mobile UX", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });

  test("opening a question on mobile keeps the editor readable and reachable", async ({ page }) => {
    await stubModulePages(page, createSupabaseSeed());
    await page.goto("/form-creator.html");

    const studioPanel = page.locator("#form-studio-panel");
    await expect(studioPanel).toBeVisible();
    await expect(page.locator("#form-studio-mobile-resize")).toBeVisible();

    await page.locator('.question-wrap[data-preview-step-id]').first().tap();

    const editor = page.locator("#form-editor-popover");
    await expect(editor).toBeVisible();
    await expect(editor.getByText("Question settings")).toBeVisible();
    await expect(editor.getByText("Question title")).toBeVisible();
    await expect(editor.getByText("Field type")).toBeVisible();
    await expect(editor.getByText("Placeholder")).toBeVisible();

    const editorBox = await editor.boundingBox();
    expect(editorBox).not.toBeNull();
    expect(editorBox.width).toBeGreaterThan(250);
    expect(editorBox.height).toBeGreaterThan(260);
  });

  test("mobile exploratory workflow handles page add/delete, seven-question pages, and drag reordering", async ({ page }) => {
    await stubModulePages(page, createSupabaseSeed());
    await page.goto("/form-creator.html");

    await expect(page.locator("#form-studio-panel")).toBeVisible();

    const stepButtons = page.locator("#preview-stepper [data-preview-step]");
    const initialStepCount = await stepButtons.count();

    const blankPageButton = page.locator('[data-add-page="blank"]');
    await blankPageButton.click();
    await expect(page.locator("#form-editor-popover")).toBeVisible();
    await closeFormEditorIfOpen(page);

    await blankPageButton.click();
    await expect(page.locator("#form-editor-popover")).toBeVisible();
    await closeFormEditorIfOpen(page);

    await expect(stepButtons).toHaveCount(initialStepCount + 2);

    const fieldTypesToAdd = ["text", "textarea", "select", "content-text", "content-divider", "text", "textarea"];
    for (const fieldType of fieldTypesToAdd) {
      if (fieldType.startsWith("content-")) {
        await ensureStudioAccordionOpen(page, "Add Personality");
      } else {
        await ensureStudioAccordionOpen(page, "Add Custom Inputs");
      }
      await page.locator(`[data-add-type="${fieldType}"]`).click();
      await expect(page.locator("#form-editor-popover")).toBeVisible();
      await closeFormEditorIfOpen(page);
    }

    const fieldCards = page.locator("#field-rail-list .field-rail-card");
    await expect(fieldCards).toHaveCount(7);

    await page.locator("#studio-context-action").click();
    await expect(page.locator("#form-editor-popover")).toBeVisible();
    await expect(page.locator("#form-editor-title")).toContainText("Page settings");
    await expect(page.locator("#editor-page-nav-label")).toBeVisible();
    await expect(page.locator("[data-page-item-edit]")).toHaveCount(7);
    await expect(page.locator("#editor-delete-page")).toBeVisible();
    await closeFormEditorIfOpen(page);

    const dividerCard = fieldCards.filter({ has: page.locator(".field-rail-title", { hasText: "Divider" }) }).first();
    await expect(dividerCard).toBeVisible();

    await dividerCard.click();
    await expect(page.locator("#form-editor-popover")).toBeVisible();
    await expect(page.locator("#form-editor-title")).toContainText("Divider block");
    await page.locator("#editor-delete-field").click();
    await expect(fieldCards).toHaveCount(6);

    const timeChip = page.locator('#preview-stepper [data-preview-step="time"]').first();
    const phoneChip = page.locator('#preview-stepper [data-preview-step="phone"]').first();
    await pointerDrag(page, timeChip, phoneChip, { startAt: "center", endAt: "left" });
    await expect(page.locator("#preview-stepper .preview-stepper-label").first()).toContainText("Time");

    await page.waitForTimeout(250);
    await page.locator("#studio-context-action").click();
    await expect(page.locator("#form-editor-popover")).toBeVisible();
    await expect(page.locator("#form-editor-title")).toContainText("Page settings");
    await page.locator("#editor-delete-page").click();

    await expect(stepButtons).toHaveCount(initialStepCount + 1);
    await expect(page.locator("#status-banner")).toContainText("removed from your form");
  });

  test("built-in page editor shows all fields on the page and delete page action", async ({ page }) => {
    await stubModulePages(page, createSupabaseSeed());
    await page.goto("/form-creator.html");

    await expect(page.locator("#form-studio-panel")).toBeVisible();
    await page.locator('#preview-stepper [data-preview-step="name"]').click();
    const stepButtons = page.locator('#preview-stepper [data-preview-step]');
    const initialStepCount = await stepButtons.count();

    await ensureStudioAccordionOpen(page, "Add The Essentials");
    await page.locator('[data-add-step="email"]').click();
    await expect(page.locator("#form-editor-popover")).toBeVisible();
    await closeFormEditorIfOpen(page);
    await expect(stepButtons).toHaveCount(initialStepCount - 1);

    await ensureStudioAccordionOpen(page, "Add Custom Inputs");
    await page.locator('[data-add-type="text"]').click();
    await expect(page.locator("#form-editor-popover")).toBeVisible();
    await page.locator("#editor-field-label").fill("Last Name");
    await closeFormEditorIfOpen(page);

    await page.locator("#studio-context-action").click();
    await expect(page.locator("#form-editor-popover")).toBeVisible();
    await expect(page.locator("#form-editor-title")).toContainText("Page settings");
    await expect(page.locator("#editor-page-nav-label")).toBeVisible();
    await expect(page.locator("[data-page-item-edit]")).toHaveCount(3);
    await expect(page.locator("#editor-delete-page")).toBeVisible();
  });
});
