const { test, expect } = require("@playwright/test");

const MESSAGES_STATE_KEY = "__playwright_messages_state__";

const SUPABASE_AUTH_STUB = `
const STORAGE_KEY = "${MESSAGES_STATE_KEY}";

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
      onAuthStateChange() {
        return {
          data: {
            subscription: {
              unsubscribe() {}
            }
          }
        };
      }
    }
  };
}
`;

function createMessagesSeed() {
  return {
    user: {
      id: "bronze_user_1",
      email: "owner@example.com",
      user_metadata: {
        tier: "bronze"
      },
      app_metadata: {}
    },
    tables: {
      clients: [
        {
          id: "client_avery",
          owner_id: "bronze_user_1",
          client_name: "Avery House",
          client_email: "avery@home.test",
          client_phone: "3055550199",
          service_address: "441 Palm Avenue"
        },
        {
          id: "client_dana",
          owner_id: "bronze_user_1",
          client_name: "Dana Buyer",
          client_email: "dana@home.test",
          client_phone: "3055550144",
          service_address: "22 Lake Street"
        }
      ],
      appointments: [
        {
          id: "appt_imported_email",
          owner_id: "bronze_user_1",
          client_id: "client_avery",
          client_name: "Avery House",
          client_email: "avery@home.test",
          client_phone: "3055550199",
          service_date: "2026-06-21",
          service_time: "15:00",
          service_location: "441 Palm Avenue",
          notes: "Imported from a pasted showing confirmation.",
          last_channel: "email",
          last_source: "raw_email",
          created_at: "2026-05-18T12:00:00.000Z",
          updated_at: "2026-05-18T12:10:00.000Z"
        },
        {
          id: "appt_manual",
          owner_id: "bronze_user_1",
          client_id: "client_dana",
          client_name: "Dana Buyer",
          client_email: "dana@home.test",
          service_date: "2026-06-22",
          service_time: "09:00",
          service_location: "22 Lake Street",
          notes: "Manually created appointment that should stay out of the import timeline.",
          last_channel: "manual",
          last_source: "manual",
          created_at: "2026-05-18T13:00:00.000Z",
          updated_at: "2026-05-18T13:00:00.000Z"
        }
      ],
      client_reminder_history: [
        {
          id: "history_sent",
          owner_id: "bronze_user_1",
          client_id: "client_avery",
          channel: "email",
          source: "automated_email",
          message_id: "message_1",
          recipient_email: "avery@home.test",
          event_type: "sent",
          status: "sent",
          occurred_at: "2026-05-19T10:00:00.000Z",
          sent_at: "2026-05-19T10:00:00.000Z",
          created_at: "2026-05-19T10:00:00.000Z",
          message_preview: "Reminder: showing at 3 PM tomorrow.",
          event_key: "evt_sent",
          raw_event: {}
        },
        {
          id: "history_delivered",
          owner_id: "bronze_user_1",
          client_id: "client_avery",
          channel: "email",
          source: "automated_email",
          message_id: "message_1",
          recipient_email: "avery@home.test",
          event_type: "delivered",
          status: "delivered",
          occurred_at: "2026-05-19T10:02:00.000Z",
          sent_at: "2026-05-19T10:02:00.000Z",
          created_at: "2026-05-19T10:02:00.000Z",
          message_preview: "Reminder: showing at 3 PM tomorrow.",
          event_key: "evt_delivered",
          raw_event: {}
        }
      ]
    }
  };
}

async function readState(page) {
  return page.evaluate(key => JSON.parse(window.localStorage.getItem(key) || "{}"), MESSAGES_STATE_KEY);
}

async function writeState(page, state) {
  await page.evaluate(({ key, state: nextState }) => {
    window.localStorage.setItem(key, JSON.stringify(nextState));
  }, { key: MESSAGES_STATE_KEY, state });
}

async function stubMessagesPage(page, seedState) {
  await page.addInitScript(({ key, seed }) => {
    window.localStorage.setItem(key, JSON.stringify(seed));
  }, {
    key: MESSAGES_STATE_KEY,
    seed: seedState
  });

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
      body: SUPABASE_AUTH_STUB
    });
  });

  await page.route("https://esm.sh/@supabase/supabase-js@2", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: SUPABASE_AUTH_STUB
    });
  });

  await page.route("**/api/account-data?**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const resource = url.searchParams.get("resource") || "";
    const ownerId = url.searchParams.get("ownerId") || seedState.user.id;
    const state = await readState(page);
    state.tables = state.tables || {};

    if (request.method() === "POST" && resource === "history") {
      const body = request.postDataJSON() || {};
      const row = body.row || body;
      state.tables.client_reminder_history = state.tables.client_reminder_history || [];
      state.tables.client_reminder_history.push({
        id: `history_${state.tables.client_reminder_history.length + 1}`,
        owner_id: ownerId,
        source: "external_import",
        occurred_at: new Date().toISOString(),
        sent_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        event_key: `manual:${ownerId}:test`,
        ...row,
        raw_event: {
          ...(row.raw_event || {}),
          recipient_phone: String(row.recipient_phone || row.raw_event?.recipient_phone || "").replace(/\D/g, "")
        }
      });
      await writeState(page, state);
    }

    const tableByResource = {
      clients: "clients",
      "calendar-appointments": "appointments",
      history: "client_reminder_history"
    };
    const tableName = tableByResource[resource];

    if (!tableName) {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unknown account data resource." })
      });
      return;
    }

    const rows = (state.tables[tableName] || []).filter(row => !row.owner_id || row.owner_id === ownerId);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: rows })
    });
  });
}

test.describe("Messages timeline", () => {
  test("combines imported appointments, sent reminders, and logged past texts", async ({ page }) => {
    await stubMessagesPage(page, createMessagesSeed());
    await page.goto("/messages.html");

    await expect(page.locator("#bronze-shell")).toBeVisible();
    await expect(page.locator("[data-message-event]")).toHaveCount(2);
    await expect(page.locator("#messages-total-count")).toHaveText("2");
    await expect(page.locator("#messages-reminder-count")).toHaveText("1");
    await expect(page.locator("#messages-import-count")).toHaveText("1");
    await expect(page.locator("#messages-timeline")).toContainText("Avery House");
    await expect(page.locator("#messages-timeline")).toContainText("Reminder: showing at 3 PM tomorrow.");
    await expect(page.locator("#messages-timeline")).toContainText("Pasted email import");
    await expect(page.locator("#messages-timeline")).toContainText("441 Palm Avenue");
    await expect(page.locator("#messages-timeline")).not.toContainText("Manually created appointment");

    await page.locator("#messages-filter").selectOption("imports");
    await expect(page.locator("[data-message-event]")).toHaveCount(1);
    await expect(page.locator("#messages-timeline")).toContainText("Pasted email import");

    await page.locator("#messages-search").fill("no match");
    await expect(page.locator("#messages-timeline")).toContainText("No timeline items match that filter.");
    await page.locator("#messages-search").fill("");
    await page.locator("#messages-filter").selectOption("all");

    await page.locator("#past-message-client").selectOption("client_dana");
    await expect(page.locator("#past-message-recipient")).toHaveValue("dana@home.test");
    await page.locator("#past-message-channel").selectOption("sms");
    await expect(page.locator("#past-message-recipient")).toHaveValue("(305) 555-0144");
    await page.locator("#past-message-status").selectOption("replied");
    await page.locator("#past-message-preview").fill("Client confirmed via text.");
    await page.locator("#save-past-message-button").click();

    await expect(page.locator("[data-message-event]")).toHaveCount(3);
    await expect(page.locator("#messages-total-count")).toHaveText("3");
    await expect(page.locator("#messages-reminder-count")).toHaveText("2");
    await expect(page.locator("#messages-timeline")).toContainText("Client confirmed via text.");
    await expect(page.locator("#messages-timeline")).toContainText("Text");
    await expect(page.locator("#messages-timeline")).toContainText("Logged past message");
  });
});
