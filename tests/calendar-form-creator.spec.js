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
  const session = state.user ? { user: clone(state.user), access_token: "test-token" } : null;
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
            session: state.user ? { user: clone(state.user), access_token: "test-token" } : null
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
        supabasePublishableKey: "publishable-key",
        googleCalendarClientId: "",
        googleCalendarEnabled: false,
        outlookCalendarClientId: "outlook-client-id",
        outlookCalendarEnabled: true,
        inboundAppointmentEmail: "",
        ...(seedState.publicConfig || {})
      })
    });
  });

  await page.route("**/api/account-data?**", async route => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.searchParams.get("resource") !== "profile") {
      await route.fallback();
      return;
    }

    const ownerId = url.searchParams.get("ownerId") || seedState.user?.id || "";
    const state = JSON.parse(await page.evaluate(key => window.localStorage.getItem(key) || "{}", SUPABASE_STATE_KEY));
    state.tables = state.tables || {};
    state.tables.profiles = Array.isArray(state.tables.profiles) ? state.tables.profiles : [];
    let profile = state.tables.profiles.find(row => row.id === ownerId) || null;

    if (!profile) {
      profile = {
        id: ownerId,
        email: state.user?.email || "",
        custom_form_profile: state.user?.user_metadata?.custom_form_profile || {},
        branding_profile: state.user?.user_metadata?.branding_profile || {},
        use_custom_form_enabled: typeof state.user?.user_metadata?.custom_form_profile?.isEnabled === "boolean"
          ? state.user.user_metadata.custom_form_profile.isEnabled
          : null
      };
      state.tables.profiles.push(profile);
    }

    if (request.method() === "POST") {
      const body = request.postDataJSON() || {};
      Object.assign(profile, body, { id: ownerId });
      state.user = state.user || {};
      state.user.user_metadata = state.user.user_metadata || {};
      if (body.custom_form_profile) {
        state.user.user_metadata.custom_form_profile = body.custom_form_profile;
      }
      if (typeof body.use_custom_form_enabled === "boolean") {
        state.user.user_metadata.custom_form_profile = {
          ...(state.user.user_metadata.custom_form_profile || {}),
          isEnabled: body.use_custom_form_enabled
        };
      }
      if (body.branding_profile) {
        state.user.user_metadata.branding_profile = body.branding_profile;
      }
      await page.evaluate(({ key, state: nextState }) => {
        window.localStorage.setItem(key, JSON.stringify(nextState));
      }, { key: SUPABASE_STATE_KEY, state });
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [profile] })
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

  await fromLocator.evaluate((element, drag) => {
    const view = element.ownerDocument.defaultView;
    const dispatchPointer = (target, type, point, buttons = 1) => {
      target.dispatchEvent(new view.PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 77,
        pointerType: "mouse",
        isPrimary: true,
        button: 0,
        buttons,
        clientX: point.x,
        clientY: point.y
      }));
    };

    dispatchPointer(element, "pointerdown", drag.startPoint, 1);
    dispatchPointer(view, "pointermove", {
      x: drag.startPoint.x + 1,
      y: drag.startPoint.y + drag.nudge
    }, 1);

    for (let index = 1; index <= drag.steps; index += 1) {
      const progress = index / drag.steps;
      dispatchPointer(view, "pointermove", {
        x: drag.startPoint.x + ((drag.endPoint.x - drag.startPoint.x) * progress),
        y: drag.startPoint.y + ((drag.endPoint.y - drag.startPoint.y) * progress)
      }, 1);
    }

    dispatchPointer(view, "pointerup", drag.endPoint, 0);
  }, { startPoint, endPoint, nudge, steps });
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

  test("calendar import menu expands in the page flow on full desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await stubModulePages(page, createSupabaseSeed());
    await page.goto("/calendar.html");

    await expect(page.locator("#calendar-layout")).toBeVisible();
    await page.locator(".calendar-import-summary").click();
    await expect(page.locator(".calendar-import-menu")).toHaveAttribute("open", "");

    const boxes = await page.evaluate(() => {
      const panel = document.querySelector(".calendar-import-panel")?.getBoundingClientRect();
      const card = document.querySelector(".appointment-import-card")?.getBoundingClientRect();
      const layout = document.querySelector("#calendar-layout")?.getBoundingClientRect();
      return {
        panel: panel ? { x: panel.x, y: panel.y, width: panel.width, height: panel.height, bottom: panel.bottom } : null,
        card: card ? { x: card.x, y: card.y, width: card.width, height: card.height, bottom: card.bottom } : null,
        layout: layout ? { x: layout.x, y: layout.y, width: layout.width, height: layout.height } : null
      };
    });

    expect(boxes.panel).not.toBeNull();
    expect(boxes.card).not.toBeNull();
    expect(boxes.layout).not.toBeNull();
    expect(boxes.panel.width).toBeLessThanOrEqual(boxes.card.width + 1);
    expect(boxes.layout.y).toBeGreaterThanOrEqual(boxes.panel.bottom - 1);
  });

  test("calendar imports appointments from CSV", async ({ page }) => {
    await stubModulePages(page, createSupabaseSeed());
    await page.goto("/calendar.html");

    await expect(page.locator("#calendar-layout")).toBeVisible();
    await page.locator("#import-appointments-input").setInputFiles({
      name: "appointments.csv",
      mimeType: "text/csv",
      buffer: Buffer.from([
        "client_name,client_email,client_phone,appointment_date,appointment_time,location,notes",
        "Mia Tenant,mia@example.com,3055550190,2027-05-03,3:15 PM,44 Rental Ave,Bring lease docs"
      ].join("\n"))
    });

    await expect(page.locator("#status-banner")).toContainText("Imported 1 appointment");
    await expect(page.locator("#all-appointments-list")).toContainText("Mia Tenant");
    await expect(page.locator("#all-appointments-list")).toContainText("44 Rental Ave");

    const state = await page.evaluate(key => JSON.parse(window.localStorage.getItem(key) || "{}"), SUPABASE_STATE_KEY);
    expect(state.tables.appointments).toHaveLength(1);
    expect(state.tables.appointments[0].client_name).toBe("Mia Tenant");
    expect(state.tables.appointments[0].service_date).toBe("2027-05-03");
    expect(state.tables.appointments[0].service_time).toBe("15:15");
    expect(state.tables.appointments[0].last_source).toBe("import");
  });

  test("calendar imports appointments from Excel files", async ({ page }) => {
    await stubModulePages(page, createSupabaseSeed());
    await page.route("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm", async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: `
          export function read() {
            return { SheetNames: ["Appointments"], Sheets: { Appointments: {} } };
          }
          export const utils = {
            sheet_to_json() {
              return [{
                Customer: "Xavier Excel",
                Email: "xavier@example.com",
                Phone: "404-555-0199",
                Start: "2027-05-07 09:05",
                Location: "19 Spreadsheet Lane",
                Notes: "Imported from an Excel booking export"
              }];
            }
          };
          export default { read, utils };
        `
      });
    });
    await page.goto("/calendar.html");

    await expect(page.locator("#calendar-layout")).toBeVisible();
    await page.locator("#import-appointments-input").setInputFiles({
      name: "appointments.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from("fake workbook bytes")
    });

    await expect(page.locator("#status-banner")).toContainText("Imported 1 appointment");
    await expect(page.locator("#all-appointments-list")).toContainText("Xavier Excel");
    await expect(page.locator("#all-appointments-list")).toContainText("19 Spreadsheet Lane");

    const state = await page.evaluate(key => JSON.parse(window.localStorage.getItem(key) || "{}"), SUPABASE_STATE_KEY);
    expect(state.tables.appointments).toHaveLength(1);
    expect(state.tables.appointments[0].client_name).toBe("Xavier Excel");
    expect(state.tables.appointments[0].service_date).toBe("2027-05-07");
    expect(state.tables.appointments[0].service_time).toBe("09:05");
  });

  test("calendar imports appointment details from pasted email text", async ({ page }) => {
    await stubModulePages(page, createSupabaseSeed());
    await page.goto("/calendar.html");

    await expect(page.locator("#calendar-layout")).toBeVisible();
    await page.locator(".calendar-import-summary").click();
    await page.locator("#raw-email-import-text").fill([
      "Subject: Showing confirmed",
      "Client: Riley Forward",
      "Email: riley.forward@example.com",
      "Phone: (786) 555-0142",
      "Date: May 8, 2027",
      "Time: 4:20 PM",
      "Location: 808 Forwarded Email Rd",
      "Service: Buyer showing",
      "",
      "Please bring the gate code."
    ].join("\n"));
    await page.locator("#import-raw-email-button").click();

    await expect(page.locator("#status-banner")).toContainText("Imported 1 appointment");
    await expect(page.locator("#all-appointments-list")).toContainText("Riley Forward");
    await expect(page.locator("#all-appointments-list")).toContainText("808 Forwarded Email Rd");
    await expect(page.locator("#all-appointments-list")).toContainText("Email import");

    const state = await page.evaluate(key => JSON.parse(window.localStorage.getItem(key) || "{}"), SUPABASE_STATE_KEY);
    expect(state.tables.appointments).toHaveLength(1);
    expect(state.tables.appointments[0].client_name).toBe("Riley Forward");
    expect(state.tables.appointments[0].client_email).toBe("riley.forward@example.com");
    expect(state.tables.appointments[0].service_date).toBe("2027-05-08");
    expect(state.tables.appointments[0].service_time).toBe("16:20");
    expect(state.tables.appointments[0].notes).toContain("Please bring the gate code.");
    expect(state.tables.appointments[0].notes).not.toContain("Client: Riley Forward");
    expect(state.tables.appointments[0].last_source).toBe("raw_email");
  });

  test("calendar imports a Gmail sent-style appointment paste without special formatting", async ({ page }) => {
    await stubModulePages(page, createSupabaseSeed());
    await page.goto("/calendar.html");

    await expect(page.locator("#calendar-layout")).toBeVisible();
    await page.locator(".calendar-import-summary").click();
    await page.locator("#raw-email-import-text").fill([
      "Subject: Showing confirmation",
      "From: Real Estate Team <agent@example.com>",
      "To: Naomi Buyer <naomi.buyer@example.com>",
      "Date: Mon, May 3, 2027 at 8:14 AM",
      "",
      "Hi Naomi,",
      "Confirming our showing on May 12, 2027 at 2:15 PM.",
      "Location: 44 Palm Street",
      "Please bring your ID for the building desk."
    ].join("\n"));
    await page.locator("#import-raw-email-button").click();

    await expect(page.locator("#status-banner")).toContainText("Imported 1 appointment");
    await expect(page.locator("#all-appointments-list")).toContainText("Naomi Buyer");
    await expect(page.locator("#all-appointments-list")).toContainText("44 Palm Street");

    const state = await page.evaluate(key => JSON.parse(window.localStorage.getItem(key) || "{}"), SUPABASE_STATE_KEY);
    expect(state.tables.appointments).toHaveLength(1);
    expect(state.tables.appointments[0].client_name).toBe("Naomi Buyer");
    expect(state.tables.appointments[0].client_email).toBe("naomi.buyer@example.com");
    expect(state.tables.appointments[0].service_date).toBe("2027-05-12");
    expect(state.tables.appointments[0].service_time).toBe("14:15");
  });

  test("calendar imports multiple pasted sent emails at once", async ({ page }) => {
    await stubModulePages(page, createSupabaseSeed());
    await page.goto("/calendar.html");

    await expect(page.locator("#calendar-layout")).toBeVisible();
    await page.locator(".calendar-import-summary").click();
    await page.locator("#raw-email-import-text").fill([
      "Subject: First tour",
      "To: Alex One <alex.one@example.com>",
      "Let's meet May 13, 2027 at 10:00 AM.",
      "Location: 1 One Way",
      "",
      "Subject: Second tour",
      "To: Casey Two <casey.two@example.com>",
      "Let's meet May 14, 2027 at 11:30 AM.",
      "Location: 2 Two Way"
    ].join("\n"));
    await page.locator("#import-raw-email-button").click();

    await expect(page.locator("#status-banner")).toContainText("Imported 2 appointments");
    await expect(page.locator("#all-appointments-list")).toContainText("Alex One");
    await expect(page.locator("#all-appointments-list")).toContainText("Casey Two");

    const state = await page.evaluate(key => JSON.parse(window.localStorage.getItem(key) || "{}"), SUPABASE_STATE_KEY);
    expect(state.tables.appointments).toHaveLength(2);
    expect(state.tables.appointments.map(row => row.client_email).sort()).toEqual(["alex.one@example.com", "casey.two@example.com"]);
  });

  test("calendar imports appointments from ICS", async ({ page }) => {
    await stubModulePages(page, createSupabaseSeed());
    await page.goto("/calendar.html");

    await expect(page.locator("#calendar-layout")).toBeVisible();
    await page.locator("#import-ics-input").setInputFiles({
      name: "calendar.ics",
      mimeType: "text/calendar",
      buffer: Buffer.from([
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "BEGIN:VEVENT",
        "UID:grooming-appointment-1",
        "SUMMARY:Mila Grooming",
        "DTSTART:20270504T143000",
        "LOCATION:22 Pink Paws Ave",
        "DESCRIPTION:Bath and nail trim",
        "END:VEVENT",
        "END:VCALENDAR"
      ].join("\r\n"))
    });

    await expect(page.locator("#status-banner")).toContainText("Imported 1 appointment");
    await expect(page.locator("#all-appointments-list")).toContainText("Mila Grooming");
    await expect(page.locator("#all-appointments-list")).toContainText("22 Pink Paws Ave");

    const state = await page.evaluate(key => JSON.parse(window.localStorage.getItem(key) || "{}"), SUPABASE_STATE_KEY);
    expect(state.tables.appointments).toHaveLength(1);
    expect(state.tables.appointments[0].client_name).toBe("Mila Grooming");
    expect(state.tables.appointments[0].service_date).toBe("2027-05-04");
    expect(state.tables.appointments[0].service_time).toBe("14:30");
    expect(state.tables.appointments[0].last_source).toBe("ics_import");
  });

  test("calendar syncs appointments from an ICS link", async ({ page }) => {
    await stubModulePages(page, createSupabaseSeed());
    await page.route("**/api/calendar-feed", async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          text: [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "BEGIN:VEVENT",
            "UID:calendar-link-appointment-1",
            "SUMMARY:Outlook Client Visit",
            "DTSTART:20270505T101500",
            "LOCATION:77 Sync Street",
            "DESCRIPTION:Imported from a calendar feed",
            "END:VEVENT",
            "END:VCALENDAR"
          ].join("\r\n")
        })
      });
    });
    await page.goto("/calendar.html");

    await expect(page.locator("#calendar-layout")).toBeVisible();
    await page.locator(".calendar-import-summary").click();
    await expect(page.locator(".calendar-import-menu")).toHaveAttribute("open", "");
    await page.locator("#calendar-feed-url").fill("webcal://calendar.example.com/feed.ics");
    await page.locator("#sync-calendar-link-button").click();

    await expect(page.locator("#status-banner")).toContainText("Synced 1 appointment");
    await expect(page.locator("#all-appointments-list")).toContainText("Outlook Client Visit");
    await expect(page.locator("#all-appointments-list")).toContainText("77 Sync Street");

    const state = await page.evaluate(key => JSON.parse(window.localStorage.getItem(key) || "{}"), SUPABASE_STATE_KEY);
    expect(state.tables.appointments).toHaveLength(1);
    expect(state.tables.appointments[0].client_name).toBe("Outlook Client Visit");
    expect(state.tables.appointments[0].service_date).toBe("2027-05-05");
    expect(state.tables.appointments[0].service_time).toBe("10:15");
    expect(state.tables.appointments[0].last_source).toBe("calendar_link");
  });

  test("calendar syncs appointments from Google Calendar", async ({ page }) => {
    const seed = createSupabaseSeed();
    seed.publicConfig = {
      googleCalendarClientId: "google-client-id",
      googleCalendarEnabled: true
    };
    await stubModulePages(page, seed);
    await page.route("https://accounts.google.com/gsi/client", async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: `
          window.google = {
            accounts: {
              oauth2: {
                initTokenClient(options) {
                  return {
                    requestAccessToken() {
                      options.callback({ access_token: "google-access-token" });
                    }
                  };
                }
              }
            }
          };
        `
      });
    });
    await page.route("https://www.googleapis.com/calendar/v3/calendars/primary/events?**", async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              id: "google_event_1",
              iCalUID: "google-uid-1",
              summary: "Google Consult",
              start: {
                dateTime: "2027-05-09T11:30:00-04:00"
              },
              location: "303 Google Calendar Way",
              attendees: [
                {
                  email: "gwen.google@example.com"
                }
              ],
              description: "Imported from Google Calendar"
            }
          ]
        })
      });
    });
    await page.goto("/calendar.html");

    await expect(page.locator("#calendar-layout")).toBeVisible();
    await page.locator(".calendar-import-summary").click();
    await page.locator("#sync-google-calendar-button").click();

    await expect(page.locator("#status-banner")).toContainText("Synced 1 appointment");
    await expect(page.locator("#all-appointments-list")).toContainText("Google Consult");
    await expect(page.locator("#all-appointments-list")).toContainText("303 Google Calendar Way");

    const state = await page.evaluate(key => JSON.parse(window.localStorage.getItem(key) || "{}"), SUPABASE_STATE_KEY);
    expect(state.tables.appointments).toHaveLength(1);
    expect(state.tables.appointments[0].client_name).toBe("Google Consult");
    expect(state.tables.appointments[0].client_email).toBe("gwen.google@example.com");
    expect(state.tables.appointments[0].service_date).toBe("2027-05-09");
    expect(state.tables.appointments[0].last_source).toBe("google_calendar");
  });

  test("calendar syncs appointments from Outlook Calendar", async ({ page }) => {
    await stubModulePages(page, createSupabaseSeed());
    await page.addInitScript(() => {
      window.msal = {
        PublicClientApplication: class {
          async initialize() {}
          getAllAccounts() {
            return [];
          }
          async acquireTokenPopup() {
            return { accessToken: "outlook-access-token" };
          }
        }
      };
    });
    await page.route("https://graph.microsoft.com/v1.0/me/calendarView?**", async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          value: [
            {
              id: "outlook_event_1",
              iCalUId: "outlook-uid-1",
              subject: "Buyer showing",
              start: {
                dateTime: "2027-05-06T13:45:00.0000000",
                timeZone: "Eastern Standard Time"
              },
              location: {
                displayName: "91 Outlook Ave"
              },
              attendees: [
                {
                  emailAddress: {
                    name: "Olivia Outlook",
                    address: "olivia@example.com"
                  }
                }
              ],
              bodyPreview: "Bring buyer packet."
            }
          ]
        })
      });
    });
    await page.goto("/calendar.html");

    await expect(page.locator("#calendar-layout")).toBeVisible();
    await page.locator(".calendar-import-summary").click();
    await expect(page.locator(".calendar-import-menu")).toHaveAttribute("open", "");
    await page.locator("#sync-outlook-calendar-button").click();

    await expect(page.locator("#status-banner")).toContainText("Synced 1 appointment");
    await expect(page.locator("#all-appointments-list")).toContainText("Olivia Outlook");
    await expect(page.locator("#all-appointments-list")).toContainText("91 Outlook Ave");

    const state = await page.evaluate(key => JSON.parse(window.localStorage.getItem(key) || "{}"), SUPABASE_STATE_KEY);
    expect(state.tables.appointments).toHaveLength(1);
    expect(state.tables.appointments[0].client_name).toBe("Olivia Outlook");
    expect(state.tables.appointments[0].client_email).toBe("olivia@example.com");
    expect(state.tables.appointments[0].service_date).toBe("2027-05-06");
    expect(state.tables.appointments[0].service_time).toBe("13:45");
    expect(state.tables.appointments[0].last_source).toBe("outlook_calendar");
  });

  test("calendar appointment rows can start a prefilled reminder", async ({ page }) => {
    await stubModulePages(page, createSupabaseSeed({
      appointments: [
        {
          id: "appointment_use_1",
          owner_id: "bronze_user_1",
          client_name: "Jordan Existing",
          client_email: "jordan.existing@example.com",
          client_phone: "3055550123",
          service_date: "2027-05-10",
          service_time: "12:40",
          service_location: "700 Already Booked Blvd",
          notes: "Imported appointment needs a 24 hour reminder.",
          last_source: "raw_email",
          updated_at: "2027-05-01T12:00:00.000Z"
        }
      ]
    }));
    await page.goto("/calendar.html");

    await expect(page.locator("#all-appointments-list")).toContainText("Jordan Existing");
    await page.locator('#all-appointments-list [data-action="use-appointment"]').first().click();

    await expect(page).toHaveURL(/index\.html/);
    await expect.poll(async () => page.locator("#name").inputValue()).toBe("Jordan Existing");
    await expect(page.locator("#email")).toHaveValue("jordan.existing@example.com");
    await expect(page.locator("#phone")).toHaveValue("(305) 555-0123");
    await expect(page.locator("#address")).toHaveValue("700 Already Booked Blvd");
    await expect(page.locator("#date")).toHaveValue("2027-05-10");
    await expect(page.locator("#time")).toHaveValue("12:40");
    await expect(page.locator("#notes")).toHaveValue("Imported appointment needs a 24 hour reminder.");
  });

  test("form creator saves a selected template and keeps it after reload", async ({ page }) => {
    await stubModulePages(page, createSupabaseSeed());
    await page.goto("/form-creator.html");

    await expect(page.locator("#form-preview-title")).toContainText("Appointment Reminder");
    await expect(page.getByRole("tab", { name: "Background", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Page", exact: true })).toHaveCount(0);
    await page.locator('[data-studio-tab="templates"]').click();
    await page.locator('[data-template-id="barbershop"]').click();
    await expect(page.locator("#status-banner")).toContainText("template loaded");
    await expect(page.locator('#preview-stepper [data-preview-step="custom_service_request"] .preview-stepper-circle')).toContainText("9");
    await expect(page.locator('#preview-stepper [data-preview-step="custom_hair_goal"] .preview-stepper-circle')).toContainText("11");

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

  test("form creator toggle-off makes Send Reminder use the default form", async ({ page }) => {
    const seed = createSupabaseSeed({
      user: createBronzeUser({
        user_metadata: {
          custom_form_profile: {
            isEnabled: true,
            formTitle: "Pet Grooming Reminder",
            fields: [
              {
                id: "custom_pet_name",
                type: "text",
                title: "Pet Name",
                label: "Pet Name",
                navLabel: "Pet",
                placeholder: "Enter pet name"
              }
            ]
          }
        }
      })
    });

    await stubModulePages(page, seed);
    await page.goto("/form-creator.html");

    await expect(page.locator("#form-enabled-toggle")).toBeChecked();
    await expect(page.locator("#form-preview-title")).toContainText("Pet Grooming Reminder");
    await page.locator(".form-enabled-row").click();
    await expect(page.locator("#status-banner")).toContainText("default appointment form");
    await page.waitForFunction(key => {
      const state = JSON.parse(window.localStorage.getItem(key) || "{}");
      return state?.user?.user_metadata?.custom_form_profile?.isEnabled === false;
    }, SUPABASE_STATE_KEY);

    await page.goto("/index.html");
    await expect(page.locator("body")).not.toHaveClass(/custom-form-loading/);
    await expect(page.locator("#custom_pet_name")).toHaveCount(0);
    await expect(page.locator("#step-title")).toHaveText("Client Phone Number");
  });

  test("saving the form prunes deleted remembered client answers", async ({ page }) => {
    const seed = createSupabaseSeed({
      user: createBronzeUser({
        user_metadata: {
          custom_form_profile: {
            isEnabled: true,
            fields: [
              {
                id: "custom_pet_name",
                type: "text",
                label: "Pet Name",
                navLabel: "Pet",
                rememberClientAnswer: true
              }
            ]
          }
        }
      }),
      clients: [
        {
          id: "client_cleanup_1",
          owner_id: "bronze_user_1",
          client_name: "Milo Paws",
          profile_custom_answers: {
            custom_pet_name: {
              field_id: "custom_pet_name",
              value: "Milo",
              raw_value: "Milo",
              display_value: "Milo"
            },
            custom_deleted_field: {
              field_id: "custom_deleted_field",
              value: "Old value",
              raw_value: "Old value",
              display_value: "Old value"
            }
          }
        }
      ]
    });

    await stubModulePages(page, seed);
    await page.goto("/form-creator.html");
    await page.locator("#save-form-button").click();
    await expect(page.locator("#status-banner")).toContainText("Form saved");

    const state = await page.evaluate(key => JSON.parse(window.localStorage.getItem(key) || "{}"), SUPABASE_STATE_KEY);
    expect(state.tables.clients[0].profile_custom_answers.custom_pet_name.value).toBe("Milo");
    expect(state.tables.clients[0].profile_custom_answers.custom_deleted_field).toBeUndefined();
  });

  test("deleted built-in essentials can be added back from the toolbar", async ({ page }) => {
    await stubModulePages(page, createSupabaseSeed());
    await page.goto("/form-creator.html");

    await expect(page.locator('#preview-stepper [data-preview-step="phone"]')).toBeVisible();
    await page.locator('.question-wrap[data-preview-step-id="phone"]').click();
    await expect(page.locator("#form-editor-popover")).toBeVisible();
    await page.locator("#editor-delete-field").click();

    await expect(page.locator('#preview-stepper [data-preview-step="phone"]')).toHaveCount(0);
    await expect(page.locator("#preview-step-title")).not.toContainText("Phone");

    await ensureStudioAccordionOpen(page, "Add The Essentials");
    await page.locator('[data-add-step="phone"]').click();

    await expect(page.locator('#preview-stepper [data-preview-step="phone"]')).toBeVisible();
    await expect(page.locator("#preview-step-title")).toContainText("Client Phone Number");
    await expect(page.locator("#form-editor-title")).toContainText("Question settings");
  });

  test("form creator preview toggle keeps the form size and removes edit hover styling", async ({ page }) => {
    await stubModulePages(page, createSupabaseSeed());
    await page.goto("/form-creator.html");

    const toolbar = page.locator("#form-preview-mode-toolbar");
    await expect(toolbar).toContainText("Business View");
    await expect(toolbar).toContainText("Client View");
    await expect(page.locator("body")).not.toContainText("Business / Employee");
    await expect(page.locator("body")).not.toContainText("Client Link");

    const previewShell = page.locator("#form-preview-shell");
    const widthBefore = await previewShell.evaluate(element => element.getBoundingClientRect().width);

    await toolbar.locator(".preview-mode-toggle").click();
    await expect(toolbar.locator("[data-preview-mode-toggle]")).toBeChecked();
    await expect(page.locator("#signed-in-shell")).toHaveClass(/is-preview-only-mode/);

    const widthAfter = await previewShell.evaluate(element => element.getBoundingClientRect().width);
    expect(Math.abs(widthAfter - widthBefore)).toBeLessThan(1);

    await page.locator("#preview-step-title").hover();
    const titleHoverStyle = await page.locator("#preview-step-title").evaluate(element => {
      const style = window.getComputedStyle(element);
      return {
        outlineStyle: style.outlineStyle,
        boxShadow: style.boxShadow
      };
    });
    expect(titleHoverStyle.outlineStyle).toBe("none");
    expect(titleHoverStyle.boxShadow).toBe("none");

    await page.locator(".preview-field-control").first().hover();
    const fieldHoverStyle = await page.locator(".preview-field-control").first().evaluate(element => {
      const style = window.getComputedStyle(element);
      return {
        outlineStyle: style.outlineStyle,
        boxShadow: style.boxShadow
      };
    });
    expect(fieldHoverStyle.outlineStyle).toBe("none");
    expect(fieldHoverStyle.boxShadow).toBe("none");
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
    await expect(page.locator("#form-editor-title")).toContainText("Business page settings");
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
    await expect(page.locator("#form-editor-title")).toContainText("Business page settings");
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
    await expect(page.locator("#form-editor-title")).toContainText("Business page settings");
    await expect(page.locator("#editor-page-nav-label")).toBeVisible();
    await expect(page.locator("[data-page-item-edit]")).toHaveCount(3);
    await expect(page.locator("#editor-delete-page")).toBeVisible();
  });
});
