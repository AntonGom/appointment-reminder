const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authError = validateWebhookAuthorization(req);

  if (authError) {
    return res.status(authError.status).json({ error: authError.message });
  }

  const adminConfig = getSupabaseAdminConfig();
  if (!adminConfig.ready) {
    return res.status(500).json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." });
  }

  try {
    const incomingEvents = Array.isArray(req.body) ? req.body : [req.body];
    let processed = 0;

    for (const eventPayload of incomingEvents) {
      const handled = await processBrevoEvent(eventPayload);
      if (handled) {
        processed += 1;
      }
    }

    return res.status(200).json({ success: true, processed });
  } catch (error) {
    console.error("Brevo webhook processing failed.", error);
    return res.status(500).json({ error: error.message || "Failed to process webhook." });
  }
}

function validateWebhookAuthorization(req) {
  const expectedToken = String(process.env.BREVO_WEBHOOK_BEARER_TOKEN || "").trim();

  if (!expectedToken) {
    return {
      status: 500,
      message: "Missing BREVO_WEBHOOK_BEARER_TOKEN."
    };
  }

  const authHeader = String(req.headers.authorization || "").trim();
  const providedToken = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!providedToken || providedToken !== expectedToken) {
    return {
      status: 401,
      message: "Unauthorized webhook request."
    };
  }

  return null;
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
    throw new Error(`Supabase error (${response.status}): ${text || response.statusText}`);
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

function normalizeSource(value) {
  return String(value || "").trim().slice(0, 80) || "automated_email";
}

function normalizeBrevoEventType(value) {
  return String(value || "").trim().toLowerCase();
}

function mapBrevoStatus(eventType) {
  if (!eventType) {
    return "";
  }

  if (eventType === "request") {
    return "sent";
  }

  if (eventType === "delivered") {
    return "delivered";
  }

  if (eventType === "proxy_open" || eventType === "unique_proxy_open") {
    return "likely_opened";
  }

  if (eventType === "opened" || eventType === "unique_opened" || eventType === "first_opening") {
    return "opened";
  }

  return "";
}

function getWebhookTimestamp(eventPayload) {
  const timestampCandidates = [
    Number(eventPayload?.ts_event || 0),
    Number(eventPayload?.ts_epoch || 0),
    Number(eventPayload?.ts || 0)
  ];

  for (const value of timestampCandidates) {
    if (!Number.isFinite(value) || value <= 0) {
      continue;
    }

    const normalizedMilliseconds = value > 9999999999 ? value : value * 1000;
    return new Date(normalizedMilliseconds).toISOString();
  }

  const dateValue = String(eventPayload?.date || "").trim();
  if (dateValue) {
    const parsed = new Date(dateValue);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

function parseCustomHeader(headerValue) {
  const metadata = {};
  const source = String(headerValue || "").trim();

  if (!source) {
    return metadata;
  }

  source.split("|").forEach(part => {
    const [rawKey, ...rest] = part.split(":");
    const key = String(rawKey || "").trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key && value) {
      metadata[key] = value;
    }
  });

  return metadata;
}

function getEmailFromPayload(eventPayload) {
  const candidate = String(eventPayload?.email || eventPayload?.recipient || "").trim();
  return EMAIL_PATTERN.test(candidate) ? candidate : "";
}

function getMessageIdFromPayload(eventPayload) {
  return String(
    eventPayload?.["message-id"] ||
    eventPayload?.messageId ||
    eventPayload?.message_id ||
    ""
  ).trim();
}

function buildReminderHistoryEventKey({ messageId, eventType, occurredAt, recipientEmail }) {
  return [
    String(messageId || "").trim() || "no-message-id",
    String(eventType || "").trim() || "unknown",
    String(occurredAt || "").trim() || new Date().toISOString(),
    String(recipientEmail || "").trim().toLowerCase()
  ].join(":");
}

async function findExistingHistoryByMessageId(messageId) {
  if (!messageId) {
    return null;
  }

  const rows = await supabaseAdminFetch(
    `client_reminder_history?select=owner_id,client_id,source,recipient_email&message_id=eq.${encodeURIComponent(messageId)}&order=sent_at.desc&limit=1`
  );

  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function findClientIdByEmail(ownerId, email) {
  if (!ownerId || !email) {
    return "";
  }

  const rows = await supabaseAdminFetch(
    `clients?select=id&owner_id=eq.${encodeURIComponent(ownerId)}&client_email=eq.${encodeURIComponent(email)}&limit=1`
  );

  return Array.isArray(rows) && rows[0]?.id ? rows[0].id : "";
}

async function upsertReminderHistoryEvent(eventRecord) {
  await supabaseAdminFetch("client_reminder_history?on_conflict=event_key", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: eventRecord
  });
}

async function processBrevoEvent(eventPayload) {
  const eventType = normalizeBrevoEventType(eventPayload?.event);
  const status = mapBrevoStatus(eventType);

  if (!status) {
    return false;
  }

  const occurredAt = getWebhookTimestamp(eventPayload);
  const messageId = getMessageIdFromPayload(eventPayload);
  const email = getEmailFromPayload(eventPayload);
  const customMetadata = parseCustomHeader(eventPayload?.["X-Mailin-custom"]);
  const existingHistory = await findExistingHistoryByMessageId(messageId);
  const ownerId = normalizeUuid(customMetadata.owner_id) || normalizeUuid(existingHistory?.owner_id);

  if (!ownerId) {
    return false;
  }

  let clientId = normalizeUuid(customMetadata.client_id) || normalizeUuid(existingHistory?.client_id);

  if (!clientId && email) {
    clientId = normalizeUuid(await findClientIdByEmail(ownerId, email));
  }

  const source = normalizeSource(customMetadata.source || existingHistory?.source);
  const recipientEmail = email || existingHistory?.recipient_email || customMetadata.recipient_email || null;
  const eventKey = buildReminderHistoryEventKey({
    messageId,
    eventType,
    occurredAt,
    recipientEmail
  });

  await upsertReminderHistoryEvent({
    owner_id: ownerId,
    client_id: clientId || null,
    channel: "email",
    source,
    recipient_email: recipientEmail,
    message_id: messageId || null,
    event_type: eventType,
    status,
    occurred_at: occurredAt,
    sent_at: occurredAt,
    event_key: eventKey,
    raw_event: eventPayload
  });

  return true;
}
