const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

function createResponseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
}

test.describe("scheduler webhook api", () => {
  test("validates the saved secret and inserts a scheduler appointment", async () => {
    const previousEnv = {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
    };
    const previousFetch = global.fetch;
    const ownerId = "27335a5c-1a8e-4c91-a4e7-1492747fc9c0";
    const insertedBodies = [];

    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

    global.fetch = async (url, options = {}) => {
      const requestUrl = String(url);

      if (requestUrl.includes("/rest/v1/profiles")) {
        return new Response(JSON.stringify([
          {
            integration_profile: {
              addonModeEnabled: true,
              webhook: {
                enabled: true,
                secret: "arwh_testsecret",
                sourceName: "calendly"
              }
            }
          }
        ]), { status: 200 });
      }

      if (requestUrl.includes("/rest/v1/appointments") && (options.method || "GET") === "GET") {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      if (requestUrl.includes("/rest/v1/appointments") && options.method === "POST") {
        const body = JSON.parse(options.body || "{}");
        insertedBodies.push(body);
        return new Response(JSON.stringify([{ id: "appt_webhook_1", ...body }]), { status: 200 });
      }

      return new Response(JSON.stringify({ message: "not found" }), { status: 404 });
    };

    try {
      const source = fs.readFileSync(path.join(__dirname, "..", "api", "scheduler-webhook.js"), "utf8");
      const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
      const { default: handler } = await import(moduleUrl);
      const req = {
        method: "POST",
        query: {
          ownerId,
          source: "calendly"
        },
        headers: {
          authorization: "Bearer arwh_testsecret"
        },
        body: {
          event: {
            id: "evt_123",
            customer: {
              name: "Jamie Seller",
              email: "jamie@example.com",
              phone: "305-555-0188"
            },
            startTime: "2026-06-04T15:30:00-04:00",
            location: "12 Listing Road",
            service: "Listing consultation"
          }
        }
      };
      const res = createResponseRecorder();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.payload.success).toBe(true);
      expect(res.payload.inserted).toBe(1);
      expect(insertedBodies).toHaveLength(1);
      expect(insertedBodies[0]).toMatchObject({
        owner_id: ownerId,
        client_name: "Jamie Seller",
        client_email: "jamie@example.com",
        client_phone: "3055550188",
        service_date: "2026-06-04",
        service_time: "15:30",
        service_location: "12 Listing Road",
        last_source: "scheduler_webhook",
        source_type: "calendly",
        source_external_id: "evt_123"
      });
      expect(insertedBodies[0].source_signature).toContain("evt_123");
    } finally {
      global.fetch = previousFetch;
      process.env.SUPABASE_URL = previousEnv.SUPABASE_URL;
      process.env.SUPABASE_SERVICE_ROLE_KEY = previousEnv.SUPABASE_SERVICE_ROLE_KEY;
    }
  });
});
