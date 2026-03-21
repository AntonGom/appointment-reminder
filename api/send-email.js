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
      serviceTime
    } = req.body;
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    const senderName = process.env.BREVO_SENDER_NAME || "Appointment Reminder";
    const copyEmail = process.env.BREVO_COPY_EMAIL || "";

    if (!apiKey) {
      return res.status(500).json({ error: "Missing BREVO_API_KEY in Vercel environment variables." });
    }

    if (!senderEmail) {
      return res.status(500).json({ error: "Missing BREVO_SENDER_EMAIL in Vercel environment variables." });
    }

    if (!clientEmail || !message) {
      return res.status(400).json({ error: "clientEmail and message are required." });
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
    const htmlMessage = buildEmailHtml(message, calendarLinks);

    await sendBrevoEmail({
      apiKey,
      senderEmail,
      senderName,
      toEmail: clientEmail,
      subject: "Appointment Reminder",
      htmlContent: htmlMessage
    });

    if (copyEmail && copyEmail !== clientEmail) {
      await sendBrevoEmail({
        apiKey,
        senderEmail,
        senderName,
        toEmail: copyEmail,
        subject: "Copy of Reminder",
        htmlContent: htmlMessage
      });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to send email." });
  }
}

async function sendBrevoEmail({ apiKey, senderEmail, senderName, toEmail, subject, htmlContent }) {
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
      htmlContent
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Brevo error (${response.status}): ${errorText}`);
  }

  return response.json();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmailHtml(message, calendarLinks) {
  const safeMessage = escapeHtml(message);
  const formattedMessage = safeMessage
    .split("\n\n")
    .map(section => `<p style="margin:0 0 16px; line-height:1.65; color:#334155; font-size:15px;">${section.replace(/\n/g, "<br>")}</p>`)
    .join("");
  const calendarSection = calendarLinks ? `
        <div style="padding:0 24px 28px;">
          <div style="margin:0 0 12px; color:#0f172a; font-size:16px; font-weight:700;">Add to Calendar</div>
          <div style="font-size:14px; color:#475569; margin-bottom:14px;">Save this appointment to your preferred calendar.</div>
          <div>
            <a href="${calendarLinks.apple}" style="display:inline-block; margin:0 10px 10px 0; padding:12px 16px; background:#1f2937; color:#ffffff; text-decoration:none; border-radius:10px; font-weight:700;">Apple Calendar</a>
            <a href="${calendarLinks.outlook}" style="display:inline-block; margin:0 10px 10px 0; padding:12px 16px; background:#2563eb; color:#ffffff; text-decoration:none; border-radius:10px; font-weight:700;">Outlook Calendar</a>
            <a href="${calendarLinks.google}" style="display:inline-block; margin:0 10px 10px 0; padding:12px 16px; background:#0f766e; color:#ffffff; text-decoration:none; border-radius:10px; font-weight:700;">Google Calendar</a>
          </div>
        </div>
  ` : "";

  return `
    <div style="margin:0; padding:32px 16px; background:#f3f7ff; font-family:Arial, sans-serif;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #dbe7ff; border-radius:20px; overflow:hidden; box-shadow:0 10px 30px rgba(37,99,235,0.08);">
        <div style="background:linear-gradient(135deg, #2563eb, #1d4ed8); padding:20px 24px;">
          <div style="color:#ffffff; font-size:22px; font-weight:700;">Appointment Reminder</div>
        </div>
        <div style="padding:28px 24px;">
          ${formattedMessage}
        </div>
        ${calendarSection}
      </div>
    </div>
  `;
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
    { label: "Service Address", value: serviceAddress || "", maxLength: 40 },
    { label: "Your Contact Info", value: businessContact || "", maxLength: 30, allowEmail: true },
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
    if (hasLink && !hasEmail) {
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
