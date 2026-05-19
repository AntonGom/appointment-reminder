const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const APPOINTMENT_SOURCE_COLUMNS = ["source_type", "source_external_id", "source_signature", "source_synced_at"];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  const adminConfig = getSupabaseAdminConfig();

  if (!adminConfig.ready) {
    return sendJson(res, 500, { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." });
  }

  try {
    const payload = typeof req.body === "string" ? safeJsonParse(req.body) || { text: req.body } : req.body || {};
    const ownerId = normalizeUuid(req.query.ownerId || req.query.owner_id || payload.ownerId || payload.owner_id);

    if (!ownerId) {
      return sendJson(res, 400, { error: "A valid ownerId is required." });
    }

    const integrationProfile = await loadIntegrationProfile(ownerId);
    const authError = validateSchedulerWebhookAuth(req, integrationProfile);

    if (authError) {
      return sendJson(res, authError.status, { error: authError.message });
    }

    const rawRecords = getWebhookRecords(payload);

    if (!rawRecords.length) {
      return sendJson(res, 400, { error: "No appointment records were provided." });
    }

    const sourceType = normalizeSourceType(req.query.source || payload.source || payload.source_type || integrationProfile.webhook?.sourceName || "scheduler_webhook");
    const results = [];

    for (const rawRecord of rawRecords) {
      const appointment = normalizeWebhookAppointment(rawRecord, ownerId, sourceType);

      if (!appointment) {
        results.push({ status: "skipped", reason: "missing_required_fields" });
        continue;
      }

      const existing = await findExistingAppointment(appointment);
      const saved = existing
        ? await updateAppointment(existing.id, appointment)
        : await insertAppointment(appointment);

      results.push({
        status: existing ? "updated" : "inserted",
        id: saved?.id || existing?.id || null,
        client_name: appointment.client_name || "",
        service_date: appointment.service_date || ""
      });
    }

    const inserted = results.filter(result => result.status === "inserted").length;
    const updated = results.filter(result => result.status === "updated").length;
    const skipped = results.filter(result => result.status === "skipped").length;

    return sendJson(res, 200, {
      success: true,
      processed: results.length,
      inserted,
      updated,
      skipped,
      results
    });
  } catch (error) {
    console.error("Scheduler webhook failed.", error);
    return sendJson(res, error.status || 500, {
      error: error.message || "Unable to import scheduler appointments."
    });
  }
}

function sendJson(res, statusCode, payload) {
  res.setHeader("Cache-Control", "no-store");
  res.status(statusCode).json(payload);
}

function getSupabaseAdminConfig() {
  const url = String(process.env.SUPABASE_URL || "").trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  return {
    url,
    serviceRoleKey,
    ready: Boolean(url && serviceRoleKey)
  };
}

async function supabaseAdminFetch(path, options = {}) {
  const config = getSupabaseAdminConfig();
  const method = options.method || "GET";
  const headers = {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    ...options.headers
  };

  if (method !== "GET" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  const payload = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    const error = new Error(`Supabase error (${response.status}): ${text || response.statusText}`);
    error.status = response.status;
    error.payload = payload || text;
    throw error;
  }

  return payload;
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeUuid(value) {
  const normalized = String(value || "").trim();
  return UUID_PATTERN.test(normalized) ? normalized : "";
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 20);
}

function normalizeSourceType(value) {
  return String(value || "scheduler_webhook")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_:-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "scheduler_webhook";
}

function getBearerToken(req) {
  const header = String(req.headers.authorization || "").trim();
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

async function loadIntegrationProfile(ownerId) {
  let rows = [];

  try {
    rows = await supabaseAdminFetch(`profiles?select=integration_profile&id=eq.${encodeURIComponent(ownerId)}&limit=1`);
  } catch (error) {
    if (isMissingColumnError(error, "integration_profile")) {
      const setupError = new Error("Scheduler webhooks need the latest Supabase profile SQL before they can be used.");
      setupError.status = 409;
      throw setupError;
    }

    throw error;
  }

  const profile = Array.isArray(rows) ? rows[0] || null : null;
  const integrationProfile = profile?.integration_profile && typeof profile.integration_profile === "object"
    ? profile.integration_profile
    : {};

  return {
    addonModeEnabled: integrationProfile.addonModeEnabled === true,
    webhook: integrationProfile.webhook && typeof integrationProfile.webhook === "object" ? integrationProfile.webhook : {}
  };
}

function validateSchedulerWebhookAuth(req, integrationProfile) {
  const expectedSecret = String(integrationProfile.webhook?.secret || "").trim();
  const providedSecret = String(
    getBearerToken(req)
      || req.headers["x-appointment-reminder-secret"]
      || req.headers["x-scheduler-secret"]
      || ""
  ).trim();

  if (!integrationProfile.addonModeEnabled || integrationProfile.webhook?.enabled !== true) {
    return {
      status: 403,
      message: "Scheduler webhook imports are not enabled for this account."
    };
  }

  if (!expectedSecret) {
    return {
      status: 409,
      message: "Generate and save a webhook secret before using this endpoint."
    };
  }

  if (providedSecret !== expectedSecret) {
    return {
      status: 401,
      message: "Unauthorized scheduler webhook."
    };
  }

  return null;
}

function getWebhookRecords(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  const candidates = [
    payload.appointments,
    payload.events,
    payload.bookings,
    payload.data,
    payload.records
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  const nested = payload.appointment || payload.event || payload.booking || payload.object || payload.payload;
  return [nested && typeof nested === "object" ? nested : payload].filter(Boolean);
}

function firstValue(record, paths) {
  for (const path of paths) {
    const value = path.split(".").reduce((current, key) => current?.[key], record);

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
}

function parseDateFromText(value) {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
  }

  const slashMatch = text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);

  if (slashMatch) {
    const year = slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3];
    return `${year}-${slashMatch[1].padStart(2, "0")}-${slashMatch[2].padStart(2, "0")}`;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime())
    ? ""
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseTimeFromText(value) {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }

  const isoTime = text.match(/T(\d{1,2}):(\d{2})/);

  if (isoTime) {
    return `${isoTime[1].padStart(2, "0")}:${isoTime[2]}`;
  }

  const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?/i);

  if (!timeMatch) {
    return "";
  }

  let hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2] || "0");
  const meridiem = String(timeMatch[3] || "").toLowerCase();

  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 24 || minutes > 59) {
    return "";
  }

  if (meridiem.startsWith("p") && hours < 12) {
    hours += 12;
  } else if (meridiem.startsWith("a") && hours === 12) {
    hours = 0;
  }

  if (hours === 24) {
    hours = 0;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function buildSourceSignature(appointment) {
  const externalId = String(appointment.source_external_id || "").trim();

  if (externalId) {
    return `${appointment.owner_id}|${appointment.source_type}|id:${externalId}`;
  }

  return [
    appointment.owner_id,
    appointment.source_type,
    appointment.service_date,
    appointment.service_time || "",
    String(appointment.client_email || "").toLowerCase(),
    normalizePhone(appointment.client_phone || ""),
    String(appointment.client_name || "").trim().toLowerCase()
  ].join("|");
}

function normalizeWebhookAppointment(record, ownerId, sourceType) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const startValue = firstValue(record, [
    "start.dateTime",
    "start.datetime",
    "start.date",
    "start_time",
    "startTime",
    "starts_at",
    "startsAt",
    "appointment_start",
    "appointmentStart",
    "scheduled_start",
    "scheduledStart",
    "date"
  ]);
  const dateValue = firstValue(record, ["service_date", "appointment_date", "booking_date", "event_date", "date", "day"]) || startValue;
  const timeValue = firstValue(record, ["service_time", "appointment_time", "booking_time", "event_time", "time"]) || startValue;
  const clientName = String(firstValue(record, [
    "client.name",
    "client_name",
    "customer.name",
    "customer_name",
    "invitee.name",
    "invitee_name",
    "guest.name",
    "guest_name",
    "name",
    "title",
    "summary",
    "subject"
  ]) || "").trim().slice(0, 80);
  const clientEmail = String(firstValue(record, [
    "client.email",
    "client_email",
    "customer.email",
    "customer_email",
    "invitee.email",
    "invitee_email",
    "guest.email",
    "guest_email",
    "email",
    "email_address"
  ]) || "").trim().slice(0, 320);
  const clientPhone = normalizePhone(firstValue(record, [
    "client.phone",
    "client_phone",
    "customer.phone",
    "customer_phone",
    "invitee.phone",
    "invitee_phone",
    "guest.phone",
    "guest_phone",
    "phone",
    "phone_number",
    "mobile"
  ]));
  const serviceDate = parseDateFromText(dateValue);
  const serviceTime = parseTimeFromText(timeValue) || null;
  const serviceLocation = String(firstValue(record, [
    "location.displayName",
    "location.name",
    "location",
    "address",
    "service_location",
    "meeting_location",
    "where"
  ]) || "").trim().slice(0, 240);
  const appointmentType = String(firstValue(record, ["appointment_type", "booking_type", "service", "service_name", "event_type", "type"]) || "").trim();
  const description = String(firstValue(record, ["notes", "description", "details", "bodyPreview", "body.preview"]) || "").trim();
  const externalId = String(firstValue(record, ["id", "event_id", "eventId", "booking_id", "bookingId", "appointment_id", "appointmentId", "external_id", "externalId", "iCalUID", "ical_uid"]) || "").trim().slice(0, 240);

  if (!serviceDate || (!clientName && !clientEmail && !clientPhone)) {
    return null;
  }

  if (clientEmail && !EMAIL_PATTERN.test(clientEmail)) {
    return null;
  }

  const appointment = {
    owner_id: ownerId,
    client_name: clientName,
    client_email: clientEmail,
    client_phone: clientPhone,
    service_date: serviceDate,
    service_time: serviceTime,
    service_location: serviceLocation,
    notes: [description, appointmentType ? `Type: ${appointmentType}` : ""].filter(Boolean).join("\n").slice(0, 1200),
    last_source: "scheduler_webhook",
    source_type: sourceType,
    source_external_id: externalId || null,
    source_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  appointment.source_signature = buildSourceSignature(appointment).slice(0, 500);
  return appointment;
}

function encodeFilter(value) {
  return encodeURIComponent(String(value || ""));
}

function isMissingColumnError(error, columnName) {
  const text = [
    error?.payload?.code,
    error?.payload?.message,
    error?.payload?.details,
    error?.payload?.hint,
    error?.message
  ].filter(Boolean).join(" ").toLowerCase();

  return text.includes("42703") || text.includes(String(columnName || "").toLowerCase());
}

async function findExistingAppointment(appointment) {
  if (appointment.source_external_id) {
    try {
      const rows = await supabaseAdminFetch(
        `appointments?select=id&owner_id=eq.${encodeFilter(appointment.owner_id)}&source_type=eq.${encodeFilter(appointment.source_type)}&source_external_id=eq.${encodeFilter(appointment.source_external_id)}&limit=1`
      );

      if (Array.isArray(rows) && rows[0]) {
        return rows[0];
      }
    } catch (error) {
      if (!APPOINTMENT_SOURCE_COLUMNS.some(column => isMissingColumnError(error, column))) {
        throw error;
      }
    }
  }

  if (appointment.source_signature) {
    try {
      const rows = await supabaseAdminFetch(
        `appointments?select=id&owner_id=eq.${encodeFilter(appointment.owner_id)}&source_signature=eq.${encodeFilter(appointment.source_signature)}&limit=1`
      );

      if (Array.isArray(rows) && rows[0]) {
        return rows[0];
      }
    } catch (error) {
      if (!isMissingColumnError(error, "source_signature")) {
        throw error;
      }
    }
  }

  const filters = [
    `owner_id=eq.${encodeFilter(appointment.owner_id)}`,
    `service_date=eq.${encodeFilter(appointment.service_date)}`,
    appointment.service_time ? `service_time=eq.${encodeFilter(appointment.service_time)}` : "service_time=is.null"
  ];

  if (appointment.client_email) {
    filters.push(`client_email=eq.${encodeFilter(appointment.client_email)}`);
  } else if (appointment.client_phone) {
    filters.push(`client_phone=eq.${encodeFilter(appointment.client_phone)}`);
  } else {
    filters.push(`client_name=eq.${encodeFilter(appointment.client_name)}`);
  }

  const rows = await supabaseAdminFetch(`appointments?select=id&${filters.join("&")}&limit=1`);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

function stripSourceColumns(row) {
  const nextRow = { ...row };
  APPOINTMENT_SOURCE_COLUMNS.forEach(column => {
    delete nextRow[column];
  });
  return nextRow;
}

async function insertAppointment(appointment) {
  try {
    const rows = await supabaseAdminFetch("appointments", {
      method: "POST",
      headers: {
        Prefer: "return=representation"
      },
      body: appointment
    });
    return Array.isArray(rows) ? rows[0] || appointment : rows;
  } catch (error) {
    if (!APPOINTMENT_SOURCE_COLUMNS.some(column => isMissingColumnError(error, column))) {
      throw error;
    }

    const rows = await supabaseAdminFetch("appointments", {
      method: "POST",
      headers: {
        Prefer: "return=representation"
      },
      body: stripSourceColumns(appointment)
    });
    return Array.isArray(rows) ? rows[0] || appointment : rows;
  }
}

async function updateAppointment(id, appointment) {
  try {
    const rows = await supabaseAdminFetch(`appointments?id=eq.${encodeFilter(id)}`, {
      method: "PATCH",
      headers: {
        Prefer: "return=representation"
      },
      body: appointment
    });
    return Array.isArray(rows) ? rows[0] || appointment : rows;
  } catch (error) {
    if (!APPOINTMENT_SOURCE_COLUMNS.some(column => isMissingColumnError(error, column))) {
      throw error;
    }

    const rows = await supabaseAdminFetch(`appointments?id=eq.${encodeFilter(id)}`, {
      method: "PATCH",
      headers: {
        Prefer: "return=representation"
      },
      body: stripSourceColumns(appointment)
    });
    return Array.isArray(rows) ? rows[0] || appointment : rows;
  }
}
