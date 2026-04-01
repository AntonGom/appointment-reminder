import { buildReminderEmailHtml, buildReminderEmailSubject, hasSavedBrandingProfile } from "../branding-templates.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      clientEmail,
      message,
      clientName,
      clientPhone,
      serviceAddress,
      businessContact,
      serviceDate,
      serviceTime,
      sendCopy,
      copyEmail,
      brandingProfile,
      trackingOwnerId,
      trackingClientId,
      trackingSource
    } = req.body;
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    const savedBranding = hasSavedBrandingProfile(brandingProfile) && brandingProfile?.brandingEnabled !== false
      ? brandingProfile
      : null;
    const senderName = savedBranding?.businessName || process.env.BREVO_SENDER_NAME || "Appointment Reminder";
    const wantsCopy = sendCopy === true || sendCopy === "true";
    const normalizedCopyEmail = String(copyEmail || "").trim();
    const trackingMetadata = buildTrackingMetadata({
      ownerId: trackingOwnerId,
      clientId: trackingClientId,
      source: trackingSource,
      recipientEmail: clientEmail
    });

    if (!apiKey) {
      return res.status(500).json({ error: "Missing BREVO_API_KEY in Vercel environment variables." });
    }

    if (!senderEmail) {
      return res.status(500).json({ error: "Missing BREVO_SENDER_EMAIL in Vercel environment variables." });
    }

    if (!clientEmail || !message) {
      return res.status(400).json({ error: "clientEmail and message are required." });
    }

    if (!EMAIL_PATTERN.test(clientEmail)) {
      return res.status(400).json({ error: "Enter a valid client email address." });
    }

    if (wantsCopy) {
      if (!normalizedCopyEmail) {
        return res.status(400).json({ error: "Enter the email address where you want the appointment copy sent." });
      }

      if (!EMAIL_PATTERN.test(normalizedCopyEmail)) {
        return res.status(400).json({ error: "Enter a valid email address." });
      }
    }

    const validationError = validateReminderPayload({
      clientName,
      clientPhone,
      serviceAddress,
      businessContact,
      message
    });

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const baseUrl = getBaseUrl(req);
    const calendarLinks = buildCalendarLinks({
      baseUrl,
      clientName,
      message,
      serviceAddress,
      businessContact,
      serviceDate,
      serviceTime
    });
    const htmlMessage = buildReminderEmailHtml({
      message,
      calendarLinks,
      brandingProfile: savedBranding
    });
    const subject = buildReminderEmailSubject(savedBranding, { message });
    const occurredAt = new Date().toISOString();
    const qaDebugEnabled = isQaRuntime();

    const primaryResult = await sendBrevoEmail({
      apiKey,
      senderEmail,
      senderName,
      toEmail: clientEmail,
      subject,
      htmlContent: htmlMessage,
      trackingMetadata
    });
    const primaryMessageId = getBrevoMessageId(primaryResult);

    await insertReminderHistoryEvent({
      ownerId: trackingMetadata.ownerId,
      clientId: trackingMetadata.clientId,
      channel: "email",
      source: trackingMetadata.source,
      recipientEmail: clientEmail,
      messageId: primaryMessageId,
      eventType: "request",
      status: "sent",
      occurredAt,
      messagePreview: message,
      rawEvent: {
        provider: "brevo",
        transport: "transactional_email",
        stage: "send_api"
      }
    });

    if (wantsCopy && normalizedCopyEmail && normalizedCopyEmail !== clientEmail) {
      await sendBrevoEmail({
        apiKey,
        senderEmail,
        senderName,
        toEmail: normalizedCopyEmail,
        subject: `Copy of ${subject}`,
        htmlContent: htmlMessage
      });
    }

    return res.status(200).json({
      success: true,
      messageId: primaryMessageId || null,
      qaEmailDebug: qaDebugEnabled ? {
        subject,
        html: htmlMessage,
        recipient: clientEmail,
        messageId: primaryMessageId || null,
        sentAt: occurredAt
      } : null
    });

  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to send email." });
  }
}

function isQaRuntime() {
  const env = process.env.VERCEL_ENV || "development";
  const branch = process.env.VERCEL_GIT_COMMIT_REF || "";
  return env === "preview" || /qa/i.test(branch);
}

async function sendBrevoEmail({ apiKey, senderEmail, senderName, toEmail, subject, htmlContent, trackingMetadata }) {
  const headers = trackingMetadata?.customHeader
    ? { "X-Mailin-custom": trackingMetadata.customHeader }
    : undefined;
  const tags = trackingMetadata?.tags?.length ? trackingMetadata.tags : undefined;
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey
    },
    body: JSON.stringify({
      sender: {
        name: senderName,
        email: senderEmail
      },
      to: [{ email: toEmail }],
      subject,
      htmlContent,
      headers,
      tags
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Brevo error (${response.status}): ${errorText}`);
  }

  return response.json();
}

function buildCalendarLinks({ baseUrl, clientName, message, serviceAddress, businessContact, serviceDate, serviceTime }) {
  if (!serviceDate) {
    return null;
  }

  const title = clientName ? `Appointment with ${clientName}` : "Appointment Reminder";
  const details = businessContact
    ? `${message}\n\nContact: ${businessContact}`
    : message;
  const dateRange = buildCalendarDateRange(serviceDate, serviceTime);
  const appleUrl = `${baseUrl}/api/calendar-ics?${new URLSearchParams({
    title,
    description: details,
    location: serviceAddress || "",
    date: serviceDate,
    time: serviceTime || ""
  }).toString()}`;

  const googleParams = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    details,
    location: serviceAddress || "",
    dates: `${dateRange.googleStart}/${dateRange.googleEnd}`
  });

  const outlookParams = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: title,
    body: details,
    location: serviceAddress || "",
    startdt: dateRange.outlookStart,
    enddt: dateRange.outlookEnd
  });

  return {
    apple: appleUrl,
    google: `https://calendar.google.com/calendar/render?${googleParams.toString()}`,
    outlook: `https://outlook.office.com/calendar/0/deeplink/compose?${outlookParams.toString()}`
  };
}

function buildCalendarDateRange(serviceDate, serviceTime) {
  if (!serviceTime) {
    const nextDate = addDays(serviceDate, 1);
    return {
      googleStart: formatDateForCalendar(serviceDate),
      googleEnd: formatDateForCalendar(nextDate),
      outlookStart: serviceDate,
      outlookEnd: nextDate
    };
  }

  const endTime = addOneHour(serviceTime);

  return {
    googleStart: formatDateTimeForCalendar(serviceDate, serviceTime),
    googleEnd: formatDateTimeForCalendar(serviceDate, endTime),
    outlookStart: `${serviceDate}T${serviceTime}:00`,
    outlookEnd: `${serviceDate}T${endTime}:00`
  };
}

function addOneHour(time) {
  const [hours, minutes] = time.split(":").map(Number);
  const totalMinutes = ((hours * 60) + minutes + 60) % (24 * 60);
  const nextHours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const nextMinutes = String(totalMinutes % 60).padStart(2, "0");
  return `${nextHours}:${nextMinutes}`;
}

function addDays(dateString, daysToAdd) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + daysToAdd);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateForCalendar(dateString) {
  return dateString.replace(/-/g, "");
}

function formatDateTimeForCalendar(dateString, timeString) {
  return `${dateString.replace(/-/g, "")}T${timeString.replace(":", "")}00`;
}

function getBaseUrl(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${host}`;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeUuid(value) {
  const normalized = String(value || "").trim();
  return UUID_PATTERN.test(normalized) ? normalized : "";
}

function normalizeSource(value) {
  return String(value || "").trim().slice(0, 80) || "automated_email";
}

function buildTrackingMetadata({ ownerId, clientId, source, recipientEmail }) {
  const normalizedOwnerId = normalizeUuid(ownerId);
  const normalizedClientId = normalizeUuid(clientId);
  const normalizedSource = normalizeSource(source);
  const normalizedRecipientEmail = EMAIL_PATTERN.test(String(recipientEmail || "").trim())
    ? String(recipientEmail || "").trim()
    : "";
  const customHeaderParts = [
    normalizedOwnerId ? `owner_id:${normalizedOwnerId}` : "",
    normalizedClientId ? `client_id:${normalizedClientId}` : "",
    normalizedSource ? `source:${normalizedSource}` : "",
    normalizedRecipientEmail ? `recipient_email:${normalizedRecipientEmail}` : ""
  ].filter(Boolean);
  const tags = [
    "appointment-reminder",
    normalizedSource ? `source:${normalizedSource}` : ""
  ].filter(Boolean);

  return {
    ownerId: normalizedOwnerId,
    clientId: normalizedClientId,
    source: normalizedSource,
    recipientEmail: normalizedRecipientEmail,
    customHeader: customHeaderParts.join("|"),
    tags
  };
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

  if (!config.ready) {
    return { data: null, error: null };
  }

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
    return {
      data: null,
      error: new Error(`Supabase error (${response.status}): ${text || response.statusText}`)
    };
  }

  return { data: payload, error: null };
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getBrevoMessageId(payload) {
  const directMessageId = String(payload?.messageId || "").trim();

  if (directMessageId) {
    return directMessageId;
  }

  if (Array.isArray(payload?.messageIds) && payload.messageIds.length) {
    return String(payload.messageIds[0] || "").trim();
  }

  return "";
}

function normalizeReminderEventKeyType(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized || normalized === "request" || normalized === "sent") {
    return "sent";
  }

  if (normalized.includes("delivered")) {
    return "delivered";
  }

  if (normalized.includes("proxy")) {
    return "likely_opened";
  }

  if (normalized.includes("open")) {
    return "opened";
  }

  return normalized;
}

function buildReminderHistoryEventKey({ messageId, eventType, occurredAt, recipientEmail }) {
  const normalizedMessageId = String(messageId || "").trim();

  if (normalizedMessageId) {
    return [
      normalizedMessageId,
      normalizeReminderEventKeyType(eventType),
      String(recipientEmail || "").trim().toLowerCase()
    ].join(":");
  }

  return [
    "no-message-id",
    normalizeReminderEventKeyType(eventType),
    String(occurredAt || "").trim() || new Date().toISOString(),
    String(recipientEmail || "").trim().toLowerCase()
  ].join(":");
}

async function insertReminderHistoryEvent({
  ownerId,
  clientId,
  channel,
  source,
  recipientEmail,
  messageId,
  eventType,
  status,
  occurredAt,
  messagePreview,
  rawEvent
}) {
  const normalizedOwnerId = normalizeUuid(ownerId);
  const normalizedClientId = normalizeUuid(clientId);

  if (!normalizedOwnerId || !channel) {
    return;
  }

  const normalizedOccurredAt = String(occurredAt || "").trim() || new Date().toISOString();
  const normalizedRecipientEmail = EMAIL_PATTERN.test(String(recipientEmail || "").trim())
    ? String(recipientEmail || "").trim()
    : null;
  const eventKey = buildReminderHistoryEventKey({
    messageId,
    eventType,
    occurredAt: normalizedOccurredAt,
    recipientEmail: normalizedRecipientEmail
  });

  const { error } = await supabaseAdminFetch("client_reminder_history?on_conflict=event_key", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: {
      owner_id: normalizedOwnerId,
      client_id: normalizedClientId || null,
      channel,
      source: normalizeSource(source),
      recipient_email: normalizedRecipientEmail,
      message_id: String(messageId || "").trim() || null,
      event_type: String(eventType || "").trim() || "request",
      status: String(status || "").trim() || "sent",
      occurred_at: normalizedOccurredAt,
      sent_at: normalizedOccurredAt,
      event_key: eventKey,
      message_preview: String(messagePreview || "").trim() || null,
      raw_event: rawEvent || null
    }
  });

  if (error) {
    console.warn("Unable to store reminder history event.", error);
  }
}

function validateReminderPayload({ clientName, clientPhone, serviceAddress, businessContact, message }) {
  const messageLengthLimit = 1200;
  const strictLinkPattern = /(https?:\/\/|www\.)/i;
  const domainPattern = /(^|\s)[a-z0-9-]+\.(com|net|org|io|co|info|biz|me|us|ly|app|gg|tv|xyz)(\/|\s|$)/i;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
  const blockedPhrases = [
    "kill yourself",
    "go kill yourself",
    "i will kill you",
    "we will kill you",
    "pay now or else",
    "click here to claim",
    "wire money",
    "send gift cards",
    "or else",
    "you have been selected",
    "act now",
    "final warning",
    "urgent action required"
  ];

  const restrictedFields = [
    { label: "Client Name", value: clientName || "", maxLength: 30 },
    { label: "Client Phone Number", value: clientPhone || "", maxLength: 30 },
    { label: "Service Location", value: serviceAddress || "", maxLength: 160, allowLink: true },
    { label: "Bussiness Contact Infoformation", value: businessContact || "", maxLength: 60, allowEmail: true },
    { label: "Message Preview", value: message || "" }
  ];

  if (String(message || "").length > messageLengthLimit) {
    return `Message Preview cannot be longer than ${messageLengthLimit} characters.`;
  }

  for (const field of restrictedFields) {
    if (field.maxLength && String(field.value).length > field.maxLength) {
      return `${field.label} cannot be longer than ${field.maxLength} characters.`;
    }

    const hasLink = strictLinkPattern.test(field.value) || domainPattern.test(field.value);
    const hasEmail = field.allowEmail && emailPattern.test(field.value);
    if (hasLink && !hasEmail && !field.allowLink) {
      return `Links are not allowed in ${field.label}.`;
    }
  }

  const combined = restrictedFields.map(field => field.value).join("\n").toLowerCase();
  for (const phrase of blockedPhrases) {
    if (combined.includes(phrase)) {
      return "This message contains content that is not allowed.";
    }
  }

  return null;
}
