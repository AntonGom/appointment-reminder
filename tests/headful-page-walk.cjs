const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium, devices } = require("@playwright/test");

const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT_DIR, "visual-review", "headful-page-walk");
const SUPABASE_STATE_KEY = "__playwright_supabase_state__";
const PAGE_KEY = String(process.argv[2] || "").trim().toLowerCase();

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp"
};

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
  const normalized = String(columns).split(",").map(column => column.trim()).filter(Boolean);
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
      state.orderBy.push({ column, ascending: options.ascending !== false });
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
      state.orderBy.forEach(orderRule => {
        resultRows.sort((left, right) => {
          const leftValue = String(left?.[orderRule.column] ?? "");
          const rightValue = String(right?.[orderRule.column] ?? "");
          return orderRule.ascending ? leftValue.localeCompare(rightValue) : rightValue.localeCompare(leftValue);
        });
      });
      if (typeof state.limitCount === "number") {
        resultRows = resultRows.slice(0, state.limitCount);
      }
      const selectedRows = selectColumns(resultRows, state.selectColumns);
      return state.single ? { data: selectedRows[0] || null, error: null } : { data: selectedRows, error: null };
    }
    if (state.action === "delete") {
      const matchingIds = new Set(matchingRows.map(row => String(row?.id ?? "")));
      setTableRows(state.table, rows.filter(row => !matchingIds.has(String(row?.id ?? ""))));
      return { data: null, error: null };
    }
    if (state.action === "update") {
      const nextRows = rows.map(row => applyFilters([row], state.filters).length > 0 ? { ...row, ...clone(state.updatePayload) } : row);
      setTableRows(state.table, nextRows);
      return { data: clone(nextRows), error: null };
    }
    if (state.action === "insert") {
      const nextRows = [...rows];
      state.insertRows.forEach((row, index) => {
        nextRows.push({ id: row?.id || \`\${state.table}_\${Date.now()}_\${index}\`, ...row });
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
        nextRows.push({ id: id || \`\${state.table}_\${Date.now()}_\${index}\`, ...row });
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
        return { data: { session: state.user ? { user: clone(state.user) } : null }, error: null };
      },
      async getUser() {
        const state = readState();
        return { data: { user: state.user ? clone(state.user) : null }, error: null };
      },
      async updateUser({ data }) {
        const state = normalizeTableState(readState());
        const currentUser = state.user || { id: "pw_user", email: "owner@example.com", user_metadata: {}, app_metadata: {} };
        state.user = {
          ...currentUser,
          user_metadata: {
            ...(currentUser.user_metadata || {}),
            ...(data || {})
          }
        };
        writeState(state);
        emitAuthEvent("USER_UPDATED");
        return { data: { user: clone(state.user) }, error: null };
      },
      onAuthStateChange(callback) {
        listeners.push(callback);
        return { data: { subscription: { unsubscribe() {} } } };
      }
    },
    from(table) {
      return createQueryBuilder(table);
    }
  };
}
`;

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function createBronzeSeed() {
  return {
    user: {
      id: "bronze_user_1",
      email: "owner@example.com",
      user_metadata: {
        tier: "bronze",
        branding_profile: {
          brandingEnabled: true,
          templateStyle: "signature",
          businessName: "North Shore Wellness",
          tagline: "Friendly reminders that feel polished and trustworthy.",
          headerLabel: "Appointment Reminder",
          headerColor: "#0f766e",
          heroGradientColor: "#38bdf8",
          heroGradientStyle: "signature",
          heroTextColor: "#ffffff",
          secondaryColor: "#dff7f3",
          panelColor: "#ebfffb",
          summaryTextColor: "#0f172a",
          bodyColor: "#ffffff",
          bodyGradientStyle: "solid",
          bodyTextColor: "#0f172a",
          detailsColor: "#eefcf9",
          detailsGradientStyle: "soft",
          detailsTextColor: "#0f172a",
          calendarColor: "#eefcf9",
          calendarGradientStyle: "soft",
          calendarTextColor: "#0f172a",
          calendarButtonColor: "#0f766e",
          calendarButtonSecondaryColor: "#38bdf8",
          calendarButtonGradientStyle: "solid",
          calendarButtonTextColor: "#ffffff",
          buttonColor: "#0f766e",
          tertiaryColor: "#38bdf8",
          buttonGradientStyle: "solid",
          buttonTextColor: "#ffffff",
          buttonStyle: "pill",
          panelShape: "rounded",
          shineStyle: "on",
          motionStyle: "showcase",
          contactEmail: "owner@example.com",
          contactPhone: "(305) 555-0188",
          websiteUrl: "https://northshorewellness.example",
          footerColor: "#eaf3ff",
          footerTextColor: "#334155",
          socialLinks: [
            "https://instagram.com/northshorewellness",
            "https://facebook.com/northshorewellness"
          ]
        },
        custom_form_profile: null
      },
      app_metadata: {}
    },
    tables: {
      profiles: [],
      clients: [
        {
          id: "client_1",
          owner_id: "bronze_user_1",
          client_name: "Ava Johnson",
          client_email: "ava@example.com",
          client_phone: "3055550101",
          service_address: "1540 Bay Road",
          notes: "Prefers text reminders.",
          profile_custom_answers: {},
          created_at: "2026-04-10T12:00:00.000Z",
          updated_at: "2026-04-15T12:00:00.000Z"
        },
        {
          id: "client_2",
          owner_id: "bronze_user_1",
          client_name: "Jordan Miles",
          client_email: "jordan@example.com",
          client_phone: "3055550102",
          service_address: "12 Barber Lane",
          notes: "Likes morning appointments.",
          profile_custom_answers: {},
          created_at: "2026-04-11T12:00:00.000Z",
          updated_at: "2026-04-14T12:00:00.000Z"
        }
      ],
      appointments: [
        {
          id: "appt_1",
          owner_id: "bronze_user_1",
          client_id: "client_1",
          client_name: "Ava Johnson",
          client_email: "ava@example.com",
          client_phone: "3055550101",
          service_date: "2026-04-18",
          service_time: "16:00",
          service_location: "1540 Bay Road",
          notes: "Please call when you are on the way.",
          created_at: "2026-04-15T15:00:00.000Z",
          updated_at: "2026-04-15T15:00:00.000Z"
        },
        {
          id: "appt_2",
          owner_id: "bronze_user_1",
          client_id: "client_2",
          client_name: "Jordan Miles",
          client_email: "jordan@example.com",
          client_phone: "3055550102",
          service_date: "2026-04-09",
          service_time: "10:30",
          service_location: "12 Barber Lane",
          notes: "Fade with beard trim",
          created_at: "2026-04-08T15:00:00.000Z",
          updated_at: "2026-04-08T15:00:00.000Z"
        }
      ],
      client_reminder_history: [
        {
          id: "history_1",
          owner_id: "bronze_user_1",
          client_id: "client_1",
          channel: "email",
          source: "automation",
          status: "sent",
          sent_at: "2026-04-15T15:10:00.000Z",
          message_preview: "Appointment reminder preview"
        }
      ]
    }
  };
}

function createServer() {
  return http.createServer((request, response) => {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
    const pathname = decodeURIComponent(requestUrl.pathname);
    const relativePath = pathname === "/" ? "/index.html" : pathname;
    const absolutePath = path.resolve(ROOT_DIR, `.${relativePath}`);
    if (!absolutePath.startsWith(ROOT_DIR)) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }
    fs.stat(absolutePath, (error, stats) => {
      if (error || !stats.isFile()) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }
      const extension = path.extname(absolutePath).toLowerCase();
      response.writeHead(200, {
        "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
        "Cache-Control": "no-store"
      });
      fs.createReadStream(absolutePath).pipe(response);
    });
  });
}

async function prepareContext(browser) {
  const context = await browser.newContext({
    ...devices["iPhone 13"],
    locale: "en-US",
    colorScheme: "light"
  });
  await context.route("**/api/public-config", async route => {
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
  await context.route("**/api/runtime-env", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        env: "preview",
        label: "DEV",
        branch: "codex/qa"
      })
    });
  });
  await context.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: SUPABASE_STUB_MODULE
    });
  });
  const seed = createBronzeSeed();
  await context.addInitScript(({ key, seedState }) => {
    window.localStorage.setItem(key, JSON.stringify(seedState));
  }, {
    key: SUPABASE_STATE_KEY,
    seedState: seed
  });
  return context;
}

async function waitForSettled(page, delay = 320) {
  try {
    await page.waitForLoadState("networkidle", { timeout: 2500 });
  } catch (_error) {
  }
  await page.waitForTimeout(delay);
}

async function capture(page, label) {
  ensureDir(OUTPUT_DIR);
  const filePath = path.join(OUTPUT_DIR, `${PAGE_KEY}-${label}.png`);
  await page.screenshot({ path: filePath });
  console.log(`Captured ${path.basename(filePath)}`);
}

async function nudgeNav(page) {
  const nav = page.locator(".account-page-nav").first();
  if (!(await nav.count())) {
    return;
  }
  await nav.evaluate(element => {
    element.scrollTo({ left: Math.min(220, element.scrollWidth), behavior: "instant" });
  });
  await page.waitForTimeout(220);
}

async function runClientDetails(page, baseUrl) {
  await page.goto(`${baseUrl}/client-details.html`, { waitUntil: "domcontentloaded" });
  await waitForSettled(page, 700);
  await capture(page, "start");
  await nudgeNav(page);
  await capture(page, "nav");
  const search = page.locator("#clients-search");
  if (await search.count()) {
    await search.fill("Ava");
    await page.waitForTimeout(200);
  }
  await capture(page, "search");
  const moreActions = page.locator(".actions-menu-summary").first();
  if (await moreActions.count()) {
    await moreActions.click();
    await page.waitForTimeout(240);
    await capture(page, "menu-open");
    await moreActions.click();
    await page.waitForTimeout(140);
  }
}

async function runCalendar(page, baseUrl) {
  await page.goto(`${baseUrl}/calendar.html`, { waitUntil: "domcontentloaded" });
  await waitForSettled(page, 900);
  await capture(page, "start");
  await nudgeNav(page);
  const monthButton = page.locator("#calendar-month-view");
  if (await monthButton.count()) {
    await monthButton.click();
    await page.waitForTimeout(180);
  }
  const nextButton = page.locator("#calendar-next");
  if (await nextButton.count()) {
    await nextButton.click();
    await page.waitForTimeout(180);
  }
  await capture(page, "interacted");
}

async function runBranding(page, baseUrl) {
  await page.goto(`${baseUrl}/branding.html`, { waitUntil: "domcontentloaded" });
  await waitForSettled(page, 1000);
  await capture(page, "start");
  const templateStrip = page.locator("#template-grid");
  if (await templateStrip.count()) {
    await templateStrip.evaluate(element => {
      element.scrollTo({ left: Math.min(320, element.scrollWidth), behavior: "instant" });
    });
    await page.waitForTimeout(200);
  }
  await capture(page, "templates");
  const templateButton = page.locator("#template-grid [data-template]").nth(1);
  if (await templateButton.count()) {
    await templateButton.click();
    await page.waitForTimeout(260);
  }
  await capture(page, "selected");
}

async function runFormCreator(page, baseUrl) {
  await page.goto(`${baseUrl}/form-creator.html`, { waitUntil: "domcontentloaded" });
  await waitForSettled(page, 1000);
  await capture(page, "start");
  const questionCard = page.locator('.question-wrap[data-preview-step-id]').first();
  if (await questionCard.count()) {
    await questionCard.click();
    await page.waitForTimeout(260);
    await capture(page, "editor");
  }
  const templatesTab = page.getByRole("button", { name: "Templates" });
  if (await templatesTab.count()) {
    await templatesTab.click();
    await page.waitForTimeout(220);
  }
  await capture(page, "templates");
  const panel = page.locator(".floating-panel-studio").first();
  if (await panel.count()) {
    await panel.evaluate(element => {
      element.scrollTo({ top: Math.min(240, element.scrollHeight), behavior: "instant" });
    });
    await page.waitForTimeout(220);
  }
  const formSettingsTab = page.getByRole("button", { name: "Form Settings" });
  if (await formSettingsTab.count()) {
    await formSettingsTab.click();
    await page.waitForTimeout(220);
  }
  await capture(page, "scrolled");
}

async function main() {
  if (!["client-details", "calendar", "branding", "form-creator"].includes(PAGE_KEY)) {
    throw new Error("Pass one page key: client-details, calendar, branding, or form-creator");
  }

  const server = createServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 4187;
  const baseUrl = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch({
    headless: false,
    slowMo: 35
  });

  try {
    const context = await prepareContext(browser);
    const page = await context.newPage();
    page.setDefaultTimeout(4500);

    if (PAGE_KEY === "client-details") {
      await runClientDetails(page, baseUrl);
    } else if (PAGE_KEY === "calendar") {
      await runCalendar(page, baseUrl);
    } else if (PAGE_KEY === "branding") {
      await runBranding(page, baseUrl);
    } else if (PAGE_KEY === "form-creator") {
      await runFormCreator(page, baseUrl);
    }

    await context.close();
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
