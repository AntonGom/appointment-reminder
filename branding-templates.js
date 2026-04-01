export const BRANDING_TEMPLATE_OPTIONS = [
  {
    id: "signature",
    label: "Signature",
    description: "Polished header with strong brand presence and clean action buttons."
  },
  {
    id: "spotlight",
    label: "Spotlight",
    description: "Soft card layout with a brighter content focus and modern spacing."
  },
  {
    id: "executive",
    label: "Executive",
    description: "Sharper dark header with a more formal business look."
  }
];

const DEFAULT_TEMPLATE = "signature";
const DEFAULT_ACCENT = "#2563eb";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function hasSavedBrandingProfile(profile = {}) {
  return Boolean(cleanText(profile.businessName, 80));
}

export function buildReminderEmailSubject(brandingProfile) {
  if (!hasSavedBrandingProfile(brandingProfile)) {
    return "Appointment Reminder";
  }

  const businessName = normalizeBrandingProfile(brandingProfile).businessName;
  return businessName ? `Appointment Reminder from ${businessName}` : "Appointment Reminder";
}

export function normalizeBrandingProfile(profile = {}, options = {}) {
  const forPreview = Boolean(options.forPreview);
  const fallbackEmail = normalizeEmail(options.fallbackEmail || "");
  const templateStyle = BRANDING_TEMPLATE_OPTIONS.some(option => option.id === profile?.templateStyle)
    ? profile.templateStyle
    : DEFAULT_TEMPLATE;

  const businessName = cleanText(profile?.businessName, 80);
  const tagline = cleanText(profile?.tagline, 120);
  const accentColor = normalizeHexColor(profile?.accentColor) || DEFAULT_ACCENT;
  const logoUrl = normalizeUrl(profile?.logoUrl);
  const contactEmail = normalizeEmail(profile?.contactEmail) || (forPreview ? fallbackEmail || "hello@yourbusiness.com" : fallbackEmail);
  const contactPhone = cleanText(profile?.contactPhone, 40);
  const websiteUrl = normalizeUrl(profile?.websiteUrl);
  const rescheduleUrl = normalizeUrl(profile?.rescheduleUrl);

  return {
    templateStyle,
    businessName: businessName || (forPreview ? "North Shore Wellness" : ""),
    tagline: tagline || (forPreview ? "Friendly appointment reminders that feel polished and trustworthy." : ""),
    accentColor,
    logoUrl,
    contactEmail,
    contactPhone: contactPhone || (forPreview ? "(305) 555-0188" : ""),
    websiteUrl,
    rescheduleUrl
  };
}

export function buildReminderEmailHtml({ message, calendarLinks = null, brandingProfile = null, previewMode = false } = {}) {
  const branding = normalizeBrandingProfile(brandingProfile, { forPreview: previewMode });

  if (!previewMode && !hasSavedBrandingProfile(brandingProfile)) {
    return buildDefaultReminderEmail(message, calendarLinks);
  }

  const content = buildEmailContent({ message, branding, calendarLinks });

  if (branding.templateStyle === "spotlight") {
    return buildSpotlightTemplate(content);
  }

  if (branding.templateStyle === "executive") {
    return buildExecutiveTemplate(content);
  }

  return buildSignatureTemplate(content);
}

function buildEmailContent({ message, branding, calendarLinks }) {
  const parsed = parseReminderMessage(message);
  const greeting = parsed.greeting ? `<div style="font-size:18px;font-weight:800;color:#0f172a;margin:0 0 14px;">${escapeHtml(parsed.greeting)}</div>` : "";
  const intro = parsed.intro ? `<div style="font-size:15px;line-height:1.7;color:#334155;margin:0 0 18px;">${escapeHtml(parsed.intro)}</div>` : "";
  const summaryHtml = parsed.summary.length
    ? `<div style="display:grid;grid-template-columns:repeat(${Math.min(parsed.summary.length, 3)}, minmax(0, 1fr));gap:10px;margin:0 0 18px;">
        ${parsed.summary.map(item => `
          <div style="padding:14px 16px;border-radius:16px;background:${hexToRgba(branding.accentColor, 0.08)};border:1px solid ${hexToRgba(branding.accentColor, 0.18)};">
            <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${branding.accentColor};margin:0 0 6px;">${escapeHtml(item.label)}</div>
            <div style="font-size:15px;font-weight:700;color:#0f172a;line-height:1.45;">${escapeHtml(item.value)}</div>
          </div>`).join("")}
      </div>`
    : "";
  const detailsHtml = parsed.details
    ? `<div style="margin:0 0 18px;padding:16px 18px;border-radius:18px;background:#f8fafc;border:1px solid #dbe4f2;">
        <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin:0 0 8px;">Additional details</div>
        <div style="font-size:15px;line-height:1.7;color:#0f172a;">${escapeHtml(parsed.details).replace(/\n/g, "<br>")}</div>
      </div>`
    : "";
  const bodyHtml = parsed.body.length
    ? parsed.body.map(paragraph => `<p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:#334155;">${escapeHtml(paragraph)}</p>`).join("")
    : "";
  const contactPrompt = parsed.contactPrompt
    ? `<p style="margin:0 0 18px;font-size:15px;line-height:1.75;color:#334155;">${escapeHtml(parsed.contactPrompt)}</p>`
    : "";
  const closing = parsed.closing
    ? `<div style="font-size:15px;font-weight:700;color:#0f172a;margin-top:8px;">${escapeHtml(parsed.closing)}</div>`
    : "";
  const ctaButtons = buildActionButtons(branding);
  const calendarSection = buildCalendarSection(calendarLinks, branding.accentColor);
  const footerContact = buildFooterContactLine(branding);
  const businessName = escapeHtml(branding.businessName || "Appointment Reminder");
  const tagline = branding.tagline ? `<div style="font-size:14px;line-height:1.65;color:#dbe7ff;margin-top:8px;">${escapeHtml(branding.tagline)}</div>` : "";
  const logoMarkup = branding.logoUrl
    ? `<img src="${escapeAttribute(branding.logoUrl)}" alt="${businessName} logo" style="width:52px;height:52px;border-radius:18px;display:block;object-fit:cover;background:#ffffff;border:1px solid rgba(255,255,255,0.35);">`
    : `<div style="width:52px;height:52px;border-radius:18px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.24);color:#ffffff;font-size:18px;font-weight:800;">${escapeHtml(getInitials(branding.businessName || "AR"))}</div>`;

  return {
    brand: branding,
    logoMarkup,
    brandTitle: businessName,
    tagline,
    greeting,
    intro,
    summaryHtml,
    detailsHtml,
    bodyHtml,
    contactPrompt,
    closing,
    ctaButtons,
    calendarSection,
    footerContact
  };
}

function buildSignatureTemplate(content) {
  return `
    <div style="margin:0;padding:32px 16px;background:#eef4ff;font-family:Arial, sans-serif;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dbe7ff;border-radius:28px;overflow:hidden;box-shadow:0 24px 54px rgba(15,23,42,0.14);">
        <div style="padding:26px 28px;background:linear-gradient(135deg, ${content.brand.accentColor}, #0f172a);">
          <div style="display:flex;align-items:center;gap:16px;">
            ${content.logoMarkup}
            <div>
              <div style="font-size:13px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#bfdbfe;">Appointment reminder</div>
              <div style="font-size:28px;line-height:1.08;font-weight:800;color:#ffffff;margin-top:4px;">${content.brandTitle}</div>
              ${content.tagline}
            </div>
          </div>
        </div>
        <div style="padding:28px;">
          ${content.greeting}
          ${content.intro}
          ${content.summaryHtml}
          ${content.detailsHtml}
          ${content.bodyHtml}
          ${content.contactPrompt}
          ${content.ctaButtons}
          ${content.calendarSection}
          ${content.closing}
        </div>
        <div style="padding:18px 28px;border-top:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-size:13px;line-height:1.7;">
          <div style="font-weight:800;color:#0f172a;margin-bottom:4px;">${content.brandTitle}</div>
          ${content.footerContact}
        </div>
      </div>
    </div>
  `;
}

function buildSpotlightTemplate(content) {
  return `
    <div style="margin:0;padding:30px 14px;background:linear-gradient(180deg, #f8fbff, #edf4ff);font-family:Arial, sans-serif;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid ${hexToRgba(content.brand.accentColor, 0.16)};border-radius:30px;overflow:hidden;box-shadow:0 24px 54px rgba(15,23,42,0.1);">
        <div style="padding:18px 22px;background:${hexToRgba(content.brand.accentColor, 0.08)};border-bottom:1px solid ${hexToRgba(content.brand.accentColor, 0.16)};">
          <div style="display:flex;align-items:center;gap:14px;">
            ${content.logoMarkup}
            <div>
              <div style="font-size:12px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${content.brand.accentColor};">Branded reminder</div>
              <div style="font-size:26px;line-height:1.08;font-weight:800;color:#0f172a;margin-top:4px;">${content.brandTitle}</div>
            </div>
          </div>
        </div>
        <div style="padding:28px;">
          ${content.greeting}
          ${content.intro}
          ${content.summaryHtml}
          <div style="padding:20px 22px;border-radius:24px;background:#ffffff;border:1px solid #e2e8f0;box-shadow:0 12px 24px rgba(15,23,42,0.05);">
            ${content.detailsHtml}
            ${content.bodyHtml}
            ${content.contactPrompt}
          </div>
          ${content.ctaButtons}
          ${content.calendarSection}
          <div style="margin-top:18px;">${content.closing}</div>
        </div>
        <div style="padding:18px 28px;background:#eff6ff;border-top:1px solid #dbeafe;color:#475569;font-size:13px;line-height:1.7;">
          <div style="font-weight:800;color:#0f172a;margin-bottom:4px;">${content.brandTitle}</div>
          ${content.footerContact}
        </div>
      </div>
    </div>
  `;
}

function buildExecutiveTemplate(content) {
  return `
    <div style="margin:0;padding:30px 14px;background:#f1f5f9;font-family:Arial, sans-serif;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #d5dde8;border-radius:24px;overflow:hidden;box-shadow:0 20px 42px rgba(15,23,42,0.12);">
        <div style="padding:22px 26px;background:#0f172a;border-bottom:4px solid ${content.brand.accentColor};">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:18px;">
            <div style="display:flex;align-items:center;gap:14px;">
              ${content.logoMarkup}
              <div>
                <div style="font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#94a3b8;">Appointment notice</div>
                <div style="font-size:26px;line-height:1.08;font-weight:800;color:#ffffff;margin-top:4px;">${content.brandTitle}</div>
              </div>
            </div>
            <div style="font-size:13px;color:#cbd5e1;text-align:right;">${escapeHtml(content.brand.tagline || "Professional reminders")}</div>
          </div>
        </div>
        <div style="padding:28px;">
          ${content.greeting}
          ${content.intro}
          ${content.summaryHtml}
          ${content.detailsHtml}
          ${content.bodyHtml}
          ${content.contactPrompt}
          ${content.ctaButtons}
          ${content.calendarSection}
          ${content.closing}
        </div>
        <div style="padding:18px 26px;background:#0f172a;color:#cbd5e1;font-size:13px;line-height:1.7;">
          <div style="font-weight:800;color:#ffffff;margin-bottom:4px;">${content.brandTitle}</div>
          ${content.footerContact}
        </div>
      </div>
    </div>
  `;
}

function buildDefaultReminderEmail(message, calendarLinks) {
  const safeMessage = escapeHtml(message || "");
  const formattedMessage = safeMessage
    .split("\n\n")
    .filter(Boolean)
    .map(section => `<p style="margin:0 0 16px; line-height:1.65; color:#334155; font-size:15px;">${section.replace(/\n/g, "<br>")}</p>`)
    .join("");

  return `
    <div style="margin:0; padding:32px 16px; background:#f3f7ff; font-family:Arial, sans-serif;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #dbe7ff; border-radius:20px; overflow:hidden; box-shadow:0 10px 30px rgba(37,99,235,0.08);">
        <div style="background:linear-gradient(135deg, #2563eb, #1d4ed8); padding:20px 24px;">
          <div style="color:#ffffff; font-size:22px; font-weight:700;">Appointment Reminder</div>
        </div>
        <div style="padding:28px 24px;">
          ${formattedMessage}
        </div>
        ${buildCalendarSection(calendarLinks, DEFAULT_ACCENT)}
      </div>
    </div>
  `;
}

function buildActionButtons(branding) {
  const buttons = [];

  if (branding.contactPhone) {
    const digits = branding.contactPhone.replace(/\D/g, "");
    if (digits) {
      buttons.push({
        href: `tel:${digits}`,
        label: "Call us",
        background: branding.accentColor,
        color: "#ffffff"
      });
    }
  }

  if (branding.websiteUrl) {
    buttons.push({
      href: branding.websiteUrl,
      label: "Visit website",
      background: "#ffffff",
      color: "#0f172a",
      border: "#cbd5e1"
    });
  }

  if (branding.rescheduleUrl) {
    buttons.push({
      href: branding.rescheduleUrl,
      label: "Reschedule",
      background: "#0f172a",
      color: "#ffffff"
    });
  }

  if (!buttons.length) {
    return "";
  }

  return `
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin:0 0 18px;">
      ${buttons.map(button => `
        <a href="${escapeAttribute(button.href)}" style="display:inline-block;padding:12px 16px;border-radius:12px;text-decoration:none;font-size:14px;font-weight:800;background:${button.background};color:${button.color};border:${button.border ? `1px solid ${button.border}` : "none"};">${escapeHtml(button.label)}</a>
      `).join("")}
    </div>
  `;
}

function buildCalendarSection(calendarLinks, accentColor) {
  if (!calendarLinks) {
    return "";
  }

  return `
    <div style="margin:4px 0 18px;padding:18px;border-radius:18px;background:${hexToRgba(accentColor, 0.06)};border:1px solid ${hexToRgba(accentColor, 0.16)};">
      <div style="margin:0 0 10px;color:#0f172a;font-size:15px;font-weight:800;">Add to Calendar</div>
      <div style="font-size:13px;line-height:1.65;color:#475569;margin:0 0 12px;">Save this appointment to the calendar you already use.</div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;">
        <a href="${escapeAttribute(calendarLinks.apple)}" style="display:inline-block;padding:11px 14px;background:#1f2937;color:#ffffff;text-decoration:none;border-radius:12px;font-size:13px;font-weight:800;">Apple Calendar</a>
        <a href="${escapeAttribute(calendarLinks.outlook)}" style="display:inline-block;padding:11px 14px;background:${accentColor};color:#ffffff;text-decoration:none;border-radius:12px;font-size:13px;font-weight:800;">Outlook Calendar</a>
        <a href="${escapeAttribute(calendarLinks.google)}" style="display:inline-block;padding:11px 14px;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:12px;font-size:13px;font-weight:800;">Google Calendar</a>
      </div>
    </div>
  `;
}

function buildFooterContactLine(branding) {
  const parts = [branding.contactEmail, branding.contactPhone, formatUrlLabel(branding.websiteUrl)].filter(Boolean);
  return parts.length ? escapeHtml(parts.join(" | ")) : "Professional appointment reminders sent from this business.";
}

function parseReminderMessage(message) {
  const lines = String(message || "").split("\n").map(line => line.trim());
  const greeting = lines.find(line => line) || "Hello,";
  const intro = lines.find(line => /^This is a friendly reminder/i.test(line)) || "";
  const summary = [];
  const body = [];
  let detailsLines = [];
  let captureDetails = false;
  let contactPrompt = "";
  let closing = "";

  lines.forEach((line, index) => {
    if (!line) {
      if (captureDetails && detailsLines.length) {
        captureDetails = false;
      }
      return;
    }

    if (index === 0 || line === intro) {
      return;
    }

    if (/^Date:/i.test(line)) {
      summary.push({ label: "Date", value: line.replace(/^Date:\s*/i, "") });
      return;
    }

    if (/^Time:/i.test(line)) {
      summary.push({ label: "Time", value: line.replace(/^Time:\s*/i, "") });
      return;
    }

    if (/^Location:/i.test(line)) {
      summary.push({ label: "Location", value: line.replace(/^Location:\s*/i, "") });
      return;
    }

    if (/^Additional Details:/i.test(line)) {
      captureDetails = true;
      detailsLines = [];
      return;
    }

    if (/^If you need to reach us/i.test(line)) {
      captureDetails = false;
      contactPrompt = line;
      return;
    }

    if (/^Thank you/i.test(line)) {
      closing = line;
      return;
    }

    if (captureDetails) {
      detailsLines.push(line);
      return;
    }

    body.push(line);
  });

  return {
    greeting,
    intro,
    summary,
    details: detailsLines.join("\n"),
    body,
    contactPrompt,
    closing: closing || "Thank you."
  };
}

function cleanText(value, maxLength) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizeEmail(value) {
  const normalized = cleanText(value, 120);
  return EMAIL_PATTERN.test(normalized) ? normalized : "";
}

function normalizeUrl(value) {
  const normalized = cleanText(value, 240);

  if (!normalized) {
    return "";
  }

  try {
    const url = new URL(normalized.startsWith("http") ? normalized : `https://${normalized}`);
    return /^https?:$/i.test(url.protocol) ? url.toString() : "";
  } catch (_error) {
    return "";
  }
}

function normalizeHexColor(value) {
  const normalized = String(value || "").trim();

  if (/^#[0-9a-f]{6}$/i.test(normalized)) {
    return normalized.toLowerCase();
  }

  if (/^#[0-9a-f]{3}$/i.test(normalized)) {
    const [, r, g, b] = normalized;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return "";
}

function getInitials(value) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) {
    return "AR";
  }

  return parts.map(part => part[0].toUpperCase()).join("");
}

function formatUrlLabel(value) {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./i, "");
  } catch (_error) {
    return value;
  }
}

function hexToRgba(hex, alpha) {
  const normalized = normalizeHexColor(hex) || DEFAULT_ACCENT;
  const red = parseInt(normalized.slice(1, 3), 16);
  const green = parseInt(normalized.slice(3, 5), 16);
  const blue = parseInt(normalized.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "");
}
