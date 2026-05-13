const EMAIL_PATTERN = /[^\s<>"']+@[^\s<>"']+\.[^\s<>"']+/gi;
const SINGLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  const authError = validateInboundAuthorization(req);

  if (authError) {
    return sendJson(res, authError.status, { error: authError.message });
  }

  const adminConfig = getSupabaseAdminConfig();

  if (!adminConfig.ready) {
    return sendJson(res, 500, { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." });
  }

  try {
    const payload = typeof req.body === "string" ? { text: req.body } : req.body || {};
    const ownerId = getOwnerIdFromPayload(payload, req.query);

    if (!ownerId) {
      return sendJson(res, 400, { error: "Forwarding address must include the account owner id." });
    }

    const appointment = parseInboundAppointment(payload, ownerId);

    if (!appointment.service_date || (!appointment.client_name && !appointment.client_email && !appointment.client_phone)) {
      return sendJson(res, 422, {
        error: "The forwarded email did not include enough appointment information."
      });
    }

    const existingAppointment = await findDuplicateAppointment(appointment);

    if (existingAppointment) {
      return sendJson(res, 200, {
        success: true,
        duplicate: true,
        data: existingAppointment
      });
    }

    const insertedRows = await supabaseAdminFetch("appointments", {
      method: "POST",
      headers: {
        Prefer: "return=representation"
      },
      body: appointment
    });

    return sendJson(res, 200, {
      success: true,
      duplicate: false,
      data: Array.isArray(insertedRows) ? insertedRows[0] : insertedRows
    });
  } catch (error) {
    console.error("Inbound appointment email failed.", error);
    return sendJson(res, 500, { error: error.message || "Unable to save forwarded appointment email." });
  }
}

function sendJson(res, statusCode, payload) {
  res.setHeader("Cache-Control", "no-store");
  res.status(statusCode).json(payload);
}

function validateInboundAuthorization(req) {
  const expectedToken = String(process.env.INBOUND_APPOINTMENT_BEARER_TOKEN || "").trim();

  if (!expectedToken) {
    return {
      status: 500,
      message: "Missing INBOUND_APPOINTMENT_BEARER_TOKEN."
    };
  }

  const authHeader = String(req.headers.authorization || "").trim();
  const providedToken = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!providedToken || providedToken !== expectedToken) {
    return {
      status: 401,
      message: "Unauthorized inbound email request."
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

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 20);
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'");
}

function stripHtml(value) {
  return decodeHtmlEntities(String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " "));
}

function flattenStrings(value) {
  if (Array.isArray(value)) {
    return value.flatMap(flattenStrings);
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap(flattenStrings);
  }

  if (value === undefined || value === null) {
    return [];
  }

  return [String(value)];
}

function getOwnerIdFromPayload(payload = {}, query = {}) {
  const explicitOwnerId = normalizeUuid(payload.ownerId || payload.owner_id || query.ownerId || query.owner_id);

  if (explicitOwnerId) {
    return explicitOwnerId;
  }

  const recipients = flattenStrings([
    payload.to,
    payload.recipient,
    payload.recipients,
    payload.envelope?.to,
    payload.headers?.to
  ]);
  const uuidPlusAddressPattern = new RegExp(`\\+(${UUID_PATTERN.source.slice(1, -1)})@`, "i");

  for (const recipient of recipients) {
    const match = String(recipient || "").match(uuidPlusAddressPattern);

    if (match && normalizeUuid(match[1])) {
      return match[1];
    }
  }

  return "";
}

function getInboundBodyText(payload = {}) {
  const textCandidates = [
    payload.text,
    payload.plain,
    payload.body,
    payload["body-plain"],
    payload.email_body
  ];
  const htmlCandidates = [
    payload.html,
    payload["body-html"],
    payload.html_body
  ];
  const text = textCandidates.find(value => String(value || "").trim());

  if (text) {
    return String(text).trim();
  }

  const html = htmlCandidates.find(value => String(value || "").trim());
  return stripHtml(html || "").trim();
}

function extractLabelValue(text, labels) {
  const labelPattern = labels.map(label => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const pattern = new RegExp(`(?:^|\\n)\\s*(?:${labelPattern})\\s*[:\\-]\\s*([^\\n]+)`, "i");
  const match = String(text || "").match(pattern);
  return match ? match[1].trim() : "";
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

  const monthMatch = text.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/i);

  if (monthMatch) {
    const year = monthMatch[3] || new Date().getFullYear();
    const date = new Date(`${monthMatch[1]} ${monthMatch[2]}, ${year}`);
    return Number.isNaN(date.getTime()) ? "" : formatDateKey(date);
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : formatDateKey(date);
}

function parseTimeFromText(value) {
  const text = String(value || "").trim();

  if (!text) {
    return "";
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

function formatDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getEmailCandidates(payload, bodyText) {
  const forwardingAddress = String(process.env.INBOUND_APPOINTMENT_EMAIL || "").replace(/\{ownerId\}|\{userId\}/g, "").toLowerCase();
  const values = [
    bodyText,
    payload.subject,
    payload.from,
    payload.sender,
    payload.replyTo,
    payload["reply-to"]
  ].join("\n");
  const emails = values.match(EMAIL_PATTERN) || [];

  return emails
    .map(email => email.trim().replace(/[),.;]+$/g, ""))
    .filter((email, index, list) => SINGLE_EMAIL_PATTERN.test(email) && list.indexOf(email) === index)
    .filter(email => !forwardingAddress || !email.toLowerCase().includes(forwardingAddress));
}

function parseDisplayName(value) {
  const text = String(value || "").trim();
  const nameMatch = text.match(/^"?([^"<]+)"?\s*</);

  if (nameMatch) {
    return nameMatch[1].trim();
  }

  return "";
}

function extractDateCandidate(text) {
  const labelDate = extractLabelValue(text, ["date", "appointment date", "when", "start date"]);

  if (labelDate) {
    return labelDate;
  }

  const match = String(text || "").match(/(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)/i);
  return match ? match[1] : "";
}

function extractTimeCandidate(text) {
  const labelTime = extractLabelValue(text, ["time", "appointment time", "start time"]);

  if (labelTime) {
    return labelTime;
  }

  const match = String(text || "").match(/\b(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))\b/i);
  return match ? match[1] : "";
}

function buildInboundNotes(payload, bodyText) {
  const subject = String(payload.subject || "").trim();
  const from = String(payload.from || payload.sender || "").trim();
  const parts = [
    "Forwarded appointment email",
    subject ? `Subject: ${subject}` : "",
    from ? `From: ${from}` : "",
    bodyText
  ].filter(Boolean);

  return parts.join("\n\n").slice(0, 1200);
}

function parseInboundAppointment(payload = {}, ownerId) {
  const bodyText = getInboundBodyText(payload);
  const combinedText = [
    payload.subject,
    payload.from,
    bodyText
  ].filter(Boolean).join("\n");
  const emailCandidates = getEmailCandidates(payload, bodyText);
  const clientName = String(
    extractLabelValue(combinedText, ["client", "client name", "customer", "customer name", "name", "invitee", "patient"])
      || parseDisplayName(payload.from)
      || String(payload.subject || "").replace(/^(fwd?|fw):\s*/i, "")
  ).trim().slice(0, 80);
  const phoneMatch = combinedText.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/);
  const dateCandidate = extractDateCandidate(combinedText);
  const timeCandidate = extractTimeCandidate(combinedText);

  return {
    owner_id: ownerId,
    client_name: clientName,
    client_email: emailCandidates[0] || "",
    client_phone: normalizePhone(phoneMatch ? phoneMatch[0] : ""),
    service_date: parseDateFromText(dateCandidate),
    service_time: parseTimeFromText(timeCandidate) || null,
    service_location: extractLabelValue(combinedText, ["location", "address", "where"]).slice(0, 240),
    notes: buildInboundNotes(payload, bodyText),
    last_source: "forwarded_email",
    updated_at: new Date().toISOString()
  };
}

async function findDuplicateAppointment(appointment) {
  if (!appointment.client_email && !appointment.client_name) {
    return null;
  }

  const filters = [
    `owner_id=eq.${encodeURIComponent(appointment.owner_id)}`,
    `service_date=eq.${encodeURIComponent(appointment.service_date)}`,
    appointment.service_time
      ? `service_time=eq.${encodeURIComponent(appointment.service_time)}`
      : "service_time=is.null"
  ];

  if (appointment.client_email) {
    filters.push(`client_email=eq.${encodeURIComponent(appointment.client_email)}`);
  } else {
    filters.push(`client_name=eq.${encodeURIComponent(appointment.client_name)}`);
  }

  const rows = await supabaseAdminFetch(`appointments?select=id,client_name,client_email,service_date,service_time&${filters.join("&")}&limit=1`);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}
