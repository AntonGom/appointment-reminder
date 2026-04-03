(() => {
  const currentPath = window.location.pathname || "/";
  const isAccountPage = /\/(account|signin|client-details)\.html$/i.test(currentPath);

  if (isAccountPage) {
    return;
  }

  const hash = window.location.hash || "";
  const search = window.location.search || "";
  const looksLikeAuthCallback =
    /access_token=|refresh_token=|type=(signup|magiclink|recovery|invite)/i.test(hash) ||
    /(^|[?&])(code|token_hash|type)=/i.test(search);

  if (!looksLikeAuthCallback) {
    return;
  }

  window.location.replace(`${window.location.origin}/client-details.html${search}${hash}`);
})();

const FIELD_LIMITS = {
  name: { label: "Client Name", maxLength: 30 },
  phone: { label: "Client Phone Number", maxLength: 30 },
  address: { label: "Service Location", maxLength: 160 },
  businessContact: { label: "Bussiness Contact Infoformation", maxLength: 60 }
};

const PHONE_DIGIT_LIMIT = 10;
const FORM_FIELD_IDS = ["phone", "email", "name", "address", "businessContact", "date", "time", "notes"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const STRICT_LINK_PATTERN = /(https?:\/\/|www\.)/i;
const DOMAIN_PATTERN = /(^|\s)[a-z0-9-]+\.(com|net|org|io|co|info|biz|me|us|ly|app|gg|tv|xyz)(\/|\s|$)/i;
const ADDRESS_PREVIEW_MIN_LENGTH = 6;
const REMINDER_PREFILL_KEY = "appointment-reminder-selected-client";
const QA_LAST_EMAIL_STORAGE_KEY = "appointment-reminder:last-sent-email-html";
const BRANDING_TEMPLATE_MODULE_PATH = "./branding-templates.js?v=20260403a";
const BRONZE_REVIEW_PREVIEW_WIDTH = 664;
const BRONZE_REVIEW_PREVIEW_MAX_HEIGHT = 720;
const BRONZE_REVIEW_PREVIEW_MAX_HEIGHT_MOBILE = 360;
const BRONZE_REVIEW_PREVIEW_MIN_HEIGHT = 320;
const BRONZE_REVIEW_PREVIEW_MIN_HEIGHT_MOBILE = 220;
const BRONZE_REVIEW_MAX_SCALE_DESKTOP = 0.72;
const BRONZE_REVIEW_MAX_SCALE_MOBILE = 0.5;

let currentStepIndex = 0;
let wizardSteps = [];
let visitedSteps = [];
let lastAddressLookup = "";
let copyEmailDirty = false;
let sendEmailResetTimer = null;
let sendEmailLockedAfterSuccess = false;
let safeToLeaveAfterSend = false;
let suppressBeforeUnload = false;
let appSupabase = null;
let appPublicConfig = null;
let currentSignedInUser = null;
let currentUserTier = "free";
let currentAuthUserId = "";
let linkedPrefillClientId = "";
let brandingTemplateModulePromise = null;
let bronzePreviewScaleTimer = null;
let bronzePreviewRenderToken = 0;
let bronzePreviewManualMessage = "";
let bronzePreviewUsesManualMessage = false;

function getSavedBrandingProfile() {
  const profile = currentSignedInUser?.user_metadata?.branding_profile;

  if (!profile || typeof profile !== "object") {
    return null;
  }

  const businessName = String(profile.businessName || "").trim();

  if (!businessName || profile.brandingEnabled === false) {
    return null;
  }

  return {
    ...profile,
    templateStyle: String(profile.templateStyle || "").trim(),
    brandingEnabled: profile.brandingEnabled !== false,
    businessName,
    tagline: String(profile.tagline || "").trim(),
    headerLabel: String(profile.headerLabel || "").trim(),
    accentColor: String(profile.accentColor || "").trim(),
    headerColor: String(profile.headerColor || "").trim(),
    heroGradientColor: String(profile.heroGradientColor || "").trim(),
    secondaryColor: String(profile.secondaryColor || "").trim(),
    heroTextColor: String(profile.heroTextColor || "").trim(),
    artShapeColor: String(profile.artShapeColor || "").trim(),
    panelColor: String(profile.panelColor || "").trim(),
    bodyTextColor: String(profile.bodyTextColor || "").trim(),
    bodyColor: String(profile.bodyColor || "").trim(),
    bodyGradientStyle: String(profile.bodyGradientStyle || "").trim(),
    detailsColor: String(profile.detailsColor || "").trim(),
    detailsTextColor: String(profile.detailsTextColor || "").trim(),
    calendarColor: String(profile.calendarColor || "").trim(),
    calendarTextColor: String(profile.calendarTextColor || "").trim(),
    buttonColor: String(profile.buttonColor || "").trim(),
    tertiaryColor: String(profile.tertiaryColor || "").trim(),
    buttonGradientStyle: String(profile.buttonGradientStyle || "").trim(),
    buttonTextColor: String(profile.buttonTextColor || "").trim(),
    logoUrl: String(profile.logoUrl || "").trim(),
    buttonStyle: String(profile.buttonStyle || "").trim(),
    panelShape: String(profile.panelShape || "").trim(),
    heroGradientStyle: String(profile.heroGradientStyle || "").trim(),
    summaryGradientStyle: String(profile.summaryGradientStyle || "").trim(),
    detailsGradientStyle: String(profile.detailsGradientStyle || "").trim(),
    calendarGradientStyle: String(profile.calendarGradientStyle || "").trim(),
    artShape: String(profile.artShape || "").trim(),
    shapeIntensity: String(profile.shapeIntensity || "").trim(),
    shineStyle: String(profile.shineStyle || "").trim(),
    motionStyle: String(profile.motionStyle || "").trim(),
    showHeroArt: profile.showHeroArt !== false,
    contactEmail: String(profile.contactEmail || "").trim(),
    contactPhone: String(profile.contactPhone || "").trim(),
    websiteUrl: String(profile.websiteUrl || "").trim(),
    rescheduleUrl: String(profile.rescheduleUrl || "").trim(),
    footerColor: String(profile.footerColor || "").trim(),
    footerTextColor: String(profile.footerTextColor || "").trim()
  };
}

function getTierKey(user) {
  const candidates = [
    user?.user_metadata?.tier,
    user?.user_metadata?.plan,
    user?.app_metadata?.tier,
    user?.app_metadata?.plan,
    user?.app_metadata?.subscription_tier
  ];

  return String(candidates.find(value => typeof value === "string" && value.trim()) || "free")
    .trim()
    .toLowerCase();
}

function isBronzeUser(user = currentSignedInUser) {
  return getTierKey(user) === "bronze";
}

function getBronzeReminderPanel() {
  return document.getElementById("bronze-reminder-panel");
}

function getBronzeReminderPreferences(user = currentSignedInUser) {
  const stored = user?.user_metadata?.reminder_preferences;
  return {
    email: Array.isArray(stored?.email) ? stored.email : [],
    sms: Array.isArray(stored?.sms) ? stored.sms : []
  };
}

function syncBronzeReminderPreferencesFromUser(user = currentSignedInUser) {
  const preferences = getBronzeReminderPreferences(user);
  document.querySelectorAll("#bronze-reminder-panel input[type='checkbox'][data-channel]").forEach(input => {
    const channel = input.dataset.channel || "";
    const value = input.value || "";
    const selectedValues = channel === "sms" ? preferences.sms : preferences.email;
    input.checked = selectedValues.includes(value);
  });
}

function renderBronzeFeatures() {
  currentUserTier = getTierKey(currentSignedInUser);
  const bronzePanel = getBronzeReminderPanel();
  const isBronze = isBronzeUser();

  if (bronzePanel) {
    bronzePanel.hidden = !isBronze;
    bronzePanel.classList.toggle("visible", isBronze);
  }

  if (isBronze) {
    syncBronzeReminderPreferencesFromUser();
  }

  updateReviewPreview();
}

async function initAccountTierState() {
  try {
    const response = await fetch("/api/public-config", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Unable to load account configuration.");
    }

    appPublicConfig = await response.json();

    if (!appPublicConfig.accountsEnabled || !appPublicConfig.supabaseUrl || !appPublicConfig.supabasePublishableKey) {
      renderBronzeFeatures();
      return;
    }

    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    appSupabase = createClient(appPublicConfig.supabaseUrl, appPublicConfig.supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });

    const {
      data: { session }
    } = await appSupabase.auth.getSession();

    currentSignedInUser = session?.user || null;
    currentAuthUserId = session?.user?.id || "";
    renderBronzeFeatures();
    updateDraftPreviewChrome();

    appSupabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "TOKEN_REFRESHED") {
        return;
      }

      const nextUserId = nextSession?.user?.id || "";

      if (nextUserId === currentAuthUserId && event !== "USER_UPDATED") {
        return;
      }

      currentAuthUserId = nextUserId;
      currentSignedInUser = nextSession?.user || null;
      renderBronzeFeatures();
      updateDraftPreviewChrome();
    });
  } catch (error) {
    currentSignedInUser = null;
    currentUserTier = "free";
    renderBronzeFeatures();
  }
}

async function getBrandingTemplateModule() {
  if (!brandingTemplateModulePromise) {
    brandingTemplateModulePromise = import(BRANDING_TEMPLATE_MODULE_PATH);
  }

  return brandingTemplateModulePromise;
}

function getBronzePreviewFrame() {
  return document.getElementById("bronze-preview-frame");
}

function getBronzePreviewShell() {
  return document.getElementById("bronze-preview-shell");
}

function getBronzePreviewStage() {
  return document.getElementById("bronze-preview-stage");
}

function getBronzePreviewHint() {
  return document.getElementById("bronze-preview-hint");
}

function getPreviewBodyShell() {
  return document.getElementById("preview-body-shell");
}

function getPreviewToRow() {
  return document.getElementById("preview-to-row");
}

function getBronzePreviewEditorWrap() {
  return document.getElementById("bronze-preview-editor-wrap");
}

function getReviewDraftCard() {
  return document.getElementById("review-draft-card");
}

function formatTime(time) {
  if (!time) return "";
  let [hour, minute] = time.split(":");
  hour = parseInt(hour, 10);
  let ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return hour + ":" + minute + " " + ampm;
}

function formatDate(dateString) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-");
  return month && day && year ? month + "/" + day + "/" + year : dateString;
}

function generatePreviewSubject() {
  const date = getFieldValue("date");
  const time = getFieldValue("time");
  const name = getFieldValue("name");
  let subject = "Appointment Reminder";

  if (date) {
    subject += ` for ${formatDate(date)}`;
  }

  if (time) {
    subject += ` at ${formatTime(time)}`;
  }

  if (name) {
    subject += ` • ${name}`;
  }

  return subject;
}

function generatePreviewSubject() {
  const date = getFieldValue("date");
  const time = getFieldValue("time");
  const name = getFieldValue("name");
  let subject = "Appointment Reminder";

  if (date) {
    subject += ` for ${formatDate(date)}`;
  }

  if (time) {
    subject += ` at ${formatTime(time)}`;
  }

  if (name) {
    subject += ` - ${name}`;
  }

  return subject;
}

function getPreviewFromValue() {
  const businessContact = getFieldValue("businessContact");
  const brandingProfile = getSavedBrandingProfile();

  if (EMAIL_PATTERN.test(businessContact)) {
    return businessContact;
  }

  if (brandingProfile?.contactEmail) {
    return brandingProfile.contactEmail;
  }

  if (currentSignedInUser?.email) {
    return currentSignedInUser.email;
  }

  return "yourbusiness@example.com";
}

function getPreviewToValue() {
  const email = getEmail();
  const name = getFieldValue("name");

  if (email) {
    return email;
  }

  if (name) {
    return `${name} <client@example.com>`;
  }

  return "client@example.com";
}

function updateDraftPreviewChrome() {
  const previewTo = document.getElementById("preview-to");
  const previewSubject = document.getElementById("preview-subject");
  const previewToRow = getPreviewToRow();
  const usingBronzePreview = isBronzeUser();

  if (previewTo) {
    const toValue = getPreviewToValue();
    previewTo.textContent = toValue;
    previewTo.classList.toggle("muted", toValue === "client@example.com");
    previewTo.classList.toggle("is-clickable", usingBronzePreview);
  }

  if (previewToRow) {
    previewToRow.classList.toggle("is-clickable", usingBronzePreview);
  }

  if (previewSubject) {
    previewSubject.textContent = generatePreviewSubject();
  }
}

function getGeneratedReviewMessage() {
  return generateMessage();
}

function getCurrentReviewMessage() {
  if (isBronzeUser() && bronzePreviewUsesManualMessage) {
    return bronzePreviewManualMessage;
  }

  return getGeneratedReviewMessage();
}

function getEditableFrameText(element) {
  return String(element?.innerText || element?.textContent || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(line => line.trim())
    .join("\n")
    .trim();
}

function buildManualReviewMessageFromFrame(frameDocument) {
  const lines = [];
  const greeting = getEditableFrameText(frameDocument.querySelector('[data-review-edit="greeting"]')) || "Hello,";
  const intro = getEditableFrameText(frameDocument.querySelector('[data-review-edit="intro"]'));
  const detailText = getEditableFrameText(frameDocument.querySelector('[data-review-edit="details"]'));
  const bodyParagraphs = Array.from(frameDocument.querySelectorAll('[data-review-edit="body-paragraph"]'))
    .map(getEditableFrameText)
    .filter(Boolean);
  const contactPrompt = getEditableFrameText(frameDocument.querySelector('[data-review-edit="contact"]'));
  const closing = getEditableFrameText(frameDocument.querySelector('[data-review-edit="closing"]')) || "Thank you.";
  const summaryItems = Array.from(frameDocument.querySelectorAll('[data-preview-area="summary"] td[height]')).map(cell => {
    const parts = Array.from(cell.querySelectorAll("div")).map(getEditableFrameText).filter(Boolean);
    return {
      label: parts[0] || "",
      value: parts[1] || ""
    };
  });

  lines.push(greeting);

  if (intro) {
    lines.push("");
    lines.push(intro);
  }

  summaryItems.forEach(item => {
    if (item.label && item.value) {
      lines.push(`${item.label}: ${item.value}`);
    }
  });

  if (detailText) {
    lines.push("");
    lines.push("Additional Details:");
    lines.push(detailText);
  }

  bodyParagraphs.forEach(paragraph => {
    lines.push("");
    lines.push(paragraph);
  });

  if (contactPrompt) {
    lines.push("");
    lines.push(contactPrompt);
  }

  lines.push("");
  lines.push(closing);

  return lines.join("\n");
}

function buildReviewPreviewCalendarLinks(message) {
  const serviceDate = getFieldValue("date");

  if (!serviceDate) {
    return null;
  }

  const serviceTime = getFieldValue("time");
  const serviceAddress = getFieldValue("address");
  const businessContact = getFieldValue("businessContact");
  const clientName = getFieldValue("name");
  const title = clientName ? `Appointment with ${clientName}` : "Appointment Reminder";
  const details = businessContact
    ? `${message}\n\nContact: ${businessContact}`
    : message;
  const dateRange = buildReviewPreviewCalendarDateRange(serviceDate, serviceTime);
  const appleUrl = `${window.location.origin}/api/calendar-ics?${new URLSearchParams({
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

function buildReviewPreviewCalendarDateRange(serviceDate, serviceTime) {
  if (!serviceTime) {
    const nextDate = addReviewPreviewDays(serviceDate, 1);
    return {
      googleStart: formatReviewPreviewCalendarDate(serviceDate),
      googleEnd: formatReviewPreviewCalendarDate(nextDate),
      outlookStart: serviceDate,
      outlookEnd: nextDate
    };
  }

  const endTime = addReviewPreviewHour(serviceTime);

  return {
    googleStart: formatReviewPreviewCalendarDateTime(serviceDate, serviceTime),
    googleEnd: formatReviewPreviewCalendarDateTime(serviceDate, endTime),
    outlookStart: `${serviceDate}T${serviceTime}:00`,
    outlookEnd: `${serviceDate}T${endTime}:00`
  };
}

function addReviewPreviewHour(time) {
  const [hours, minutes] = String(time || "").split(":").map(Number);
  const totalMinutes = (((hours || 0) * 60) + (minutes || 0) + 60) % (24 * 60);
  const nextHours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const nextMinutes = String(totalMinutes % 60).padStart(2, "0");
  return `${nextHours}:${nextMinutes}`;
}

function addReviewPreviewDays(dateString, daysToAdd) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + daysToAdd);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatReviewPreviewCalendarDate(dateString) {
  return String(dateString || "").replace(/-/g, "");
}

function formatReviewPreviewCalendarDateTime(dateString, timeString) {
  return `${formatReviewPreviewCalendarDate(dateString)}T${String(timeString || "").replace(":", "")}00`;
}

function scheduleBronzePreviewScale() {
  if (bronzePreviewScaleTimer) {
    window.clearTimeout(bronzePreviewScaleTimer);
  }

  bronzePreviewScaleTimer = window.setTimeout(() => {
    syncBronzePreviewScale();
  }, 50);
}

function scheduleBronzePreviewScaleBurst() {
  [0, 90, 220, 500, 900].forEach(delay => {
    window.setTimeout(() => {
      syncBronzePreviewScale();
    }, delay);
  });
}

function syncBronzePreviewScale() {
  const shell = getBronzePreviewShell();
  const stage = getBronzePreviewStage();
  const frame = getBronzePreviewFrame();

  if (!shell || shell.hidden || !stage || !frame) {
    return;
  }

  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;

  if (!frameDocument || !frameWindow) {
    return;
  }

  const body = frameDocument.body;
  const html = frameDocument.documentElement;

  if (!body || !html) {
    return;
  }

  const contentHeight = Math.max(body.scrollHeight, body.offsetHeight, html.scrollHeight, html.offsetHeight, 480);
  const previewContainer = shell.parentElement;
  const availableWidth = Math.max(previewContainer?.clientWidth || shell.clientWidth, 260);
  const isMobileViewport = window.innerWidth <= 640;
  const maxPreviewHeight = isMobileViewport
    ? BRONZE_REVIEW_PREVIEW_MAX_HEIGHT_MOBILE
    : BRONZE_REVIEW_PREVIEW_MAX_HEIGHT;
  const minPreviewHeight = isMobileViewport
    ? BRONZE_REVIEW_PREVIEW_MIN_HEIGHT_MOBILE
    : BRONZE_REVIEW_PREVIEW_MIN_HEIGHT;
  const widthScale = Math.min(availableWidth / BRONZE_REVIEW_PREVIEW_WIDTH, 1);
  const heightScale = Math.min(maxPreviewHeight / contentHeight, 1);
  const scale = isMobileViewport
    ? Math.min(widthScale, heightScale, BRONZE_REVIEW_MAX_SCALE_MOBILE, 1)
    : Math.min(widthScale, heightScale, BRONZE_REVIEW_MAX_SCALE_DESKTOP, 1);
  const scaledHeight = Math.max(Math.ceil(contentHeight * scale), minPreviewHeight);

  frame.style.width = `${BRONZE_REVIEW_PREVIEW_WIDTH}px`;
  frame.style.height = `${contentHeight}px`;
  frame.style.transform = `scale(${scale})`;
  stage.style.height = `${scaledHeight}px`;
  shell.style.height = `${scaledHeight}px`;
  shell.style.setProperty("--bronze-preview-scale", String(scale));
  shell.style.setProperty("--bronze-preview-height", `${scaledHeight}px`);
}

async function renderBronzeReviewPreview(message) {
  const frame = getBronzePreviewFrame();

  if (!frame) {
    return;
  }

  const currentToken = ++bronzePreviewRenderToken;
  const module = await getBrandingTemplateModule();

  if (currentToken !== bronzePreviewRenderToken) {
    return;
  }

  const html = module.buildReminderEmailHtml({
    message,
    calendarLinks: buildReviewPreviewCalendarLinks(message),
    brandingProfile: getSavedBrandingProfile(),
    previewMode: true
  });

  frame.onload = () => {
    if (currentToken !== bronzePreviewRenderToken) {
      return;
    }

    const frameDocument = frame.contentDocument;

    if (frameDocument) {
      const styleTag = frameDocument.createElement("style");
      styleTag.textContent = `
        html, body {
          background: transparent !important;
        }
        body > div:last-of-type {
          padding: 0 !important;
          min-width: 640px !important;
          background: transparent !important;
        }
        [data-review-edit] {
          cursor: text;
          transition: box-shadow 0.18s ease, background-color 0.18s ease;
        }
        [data-review-edit]:hover,
        [data-review-edit]:focus {
          background-color: rgba(59, 130, 246, 0.08);
          box-shadow: inset 0 0 0 2px rgba(59, 130, 246, 0.24);
          outline: none;
        }
      `;
      frameDocument.head.appendChild(styleTag);

      const contentRoot = frameDocument.body?.lastElementChild;
      if (contentRoot instanceof frameDocument.defaultView.HTMLElement) {
        contentRoot.style.padding = "0";
        contentRoot.style.minWidth = "640px";
        contentRoot.style.background = "transparent";
      }

      frameDocument.querySelectorAll("[data-review-edit]").forEach(element => {
        element.setAttribute("contenteditable", "true");
        element.setAttribute("spellcheck", "true");
        element.addEventListener("input", () => {
          const nextMessage = buildManualReviewMessageFromFrame(frameDocument);
          bronzePreviewUsesManualMessage = true;
          bronzePreviewManualMessage = nextMessage;

          const preview = document.getElementById("preview");
          if (preview) {
            preview.value = nextMessage;
          }
        });
      });
    }

    scheduleBronzePreviewScaleBurst();
  };
  frame.srcdoc = html;
  scheduleBronzePreviewScaleBurst();
}

function updateReviewPreview() {
  const preview = document.getElementById("preview");
  const previewHint = document.getElementById("preview-hint");
  const bronzePreviewShell = getBronzePreviewShell();
  const bronzePreviewHint = getBronzePreviewHint();
  const previewBodyShell = getPreviewBodyShell();
  const reviewDraftCard = getReviewDraftCard();
  const bronzePreviewEditorWrap = getBronzePreviewEditorWrap();
  const generatedMessage = getGeneratedReviewMessage();
  const message = getCurrentReviewMessage();
  const shouldShowBronzePreview = isBronzeUser();

  if (preview) {
    if (!bronzePreviewUsesManualMessage || !shouldShowBronzePreview) {
      preview.value = generatedMessage;
      bronzePreviewManualMessage = generatedMessage;
    } else {
      preview.value = bronzePreviewManualMessage;
    }
  }

  if (!shouldShowBronzePreview) {
    if (preview) {
      preview.hidden = false;
      preview.readOnly = true;
      preview.classList.remove("is-bronze-editor");
    }

    if (bronzePreviewShell) {
      bronzePreviewShell.hidden = true;
    }

    if (previewBodyShell) {
      previewBodyShell.classList.remove("is-bronze");
    }

    if (reviewDraftCard) {
      reviewDraftCard.classList.remove("is-bronze-compact");
    }

    if (bronzePreviewEditorWrap) {
      bronzePreviewEditorWrap.classList.remove("visible");
    }

    if (bronzePreviewHint) {
      bronzePreviewHint.classList.remove("visible");
      bronzePreviewHint.hidden = true;
    }

    updatePreviewLayout();
    return;
  }

  if (preview) {
    preview.hidden = true;
    preview.readOnly = true;
    preview.classList.remove("is-bronze-editor");
  }

  if (bronzePreviewShell) {
    bronzePreviewShell.hidden = false;
  }

  if (previewBodyShell) {
    previewBodyShell.classList.add("is-bronze");
  }

  if (reviewDraftCard) {
    reviewDraftCard.classList.add("is-bronze-compact");
  }

  if (bronzePreviewEditorWrap) {
    bronzePreviewEditorWrap.classList.remove("visible");
  }

  if (previewHint) {
    previewHint.classList.remove("visible");
  }

  if (bronzePreviewHint) {
    bronzePreviewHint.hidden = false;
    bronzePreviewHint.classList.add("visible");
  }

  renderBronzeReviewPreview(message);
}

function getFieldValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : "";
}

function normalizePhoneDigits(value) {
  return String(value || "").replace(/\D/g, "").slice(0, PHONE_DIGIT_LIMIT);
}

function formatPhoneNumber(value) {
  const digits = normalizePhoneDigits(value);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function syncPhoneFieldFormatting() {
  const phoneInput = document.getElementById("phone");
  if (!phoneInput) {
    return;
  }

  phoneInput.value = formatPhoneNumber(phoneInput.value);
}

function applySavedClientPrefill() {
  try {
    const rawValue = window.sessionStorage.getItem(REMINDER_PREFILL_KEY);

    if (!rawValue) {
      return;
    }

    const client = JSON.parse(rawValue);
    linkedPrefillClientId = String(client?.id || "").trim();

    const mappedFields = {
      name: client.name || "",
      email: client.email || "",
      phone: client.phone || "",
      address: client.address || "",
      notes: client.notes || ""
    };

    Object.entries(mappedFields).forEach(([fieldId, value]) => {
      const element = document.getElementById(fieldId);

      if (element && typeof value === "string") {
        element.value = value;
      }
    });

    window.sessionStorage.removeItem(REMINDER_PREFILL_KEY);
  } catch (error) {
    window.sessionStorage.removeItem(REMINDER_PREFILL_KEY);
    console.warn("Saved client prefill failed", error);
  }
}

function generateMessage() {
  const name = getFieldValue("name");
  const address = getFieldValue("address");
  const businessContact = getFieldValue("businessContact");
  const date = getFieldValue("date");
  const time = getFieldValue("time");
  const notes = getFieldValue("notes");

  const lines = [];
  const greeting = name ? "Hello " + name + "," : "Hello,";

  lines.push(greeting);
  lines.push("");
  lines.push("This is a friendly reminder about your upcoming appointment.");

  if (date) lines.push("Date: " + formatDate(date));
  if (time) lines.push("Time: " + formatTime(time));
  if (address) lines.push("Location: " + address);

  if (notes) {
    lines.push("");
    lines.push("Additional Details:");
    lines.push(notes);
  }

  lines.push("");
  if (businessContact) {
    lines.push("If you need to reach us before your appointment, please contact us at " + businessContact + ".");
    lines.push("");
  }
  lines.push("Thank you.");

  return lines.join("\n");
}

function refreshFormState() {
  if (sendEmailLockedAfterSuccess) {
    setSendEmailButtonState("idle");
  }

  if (safeToLeaveAfterSend) {
    safeToLeaveAfterSend = false;
  }

  syncCopyEmailOption();

  const preview = document.getElementById("preview");

  if (preview) {
    updateDraftPreviewChrome();
  }

  updateReviewPreview();

  syncFieldValidationErrors();
  renderStepNavigation();
}

function expandBoundingBox(result) {
  const lat = parseFloat(result.lat);
  const lon = parseFloat(result.lon);
  const defaultDelta = 0.008;

  if (!Array.isArray(result.boundingbox) || result.boundingbox.length !== 4) {
    return {
      left: lon - defaultDelta,
      right: lon + defaultDelta,
      top: lat + defaultDelta,
      bottom: lat - defaultDelta
    };
  }

  const south = parseFloat(result.boundingbox[0]);
  const north = parseFloat(result.boundingbox[1]);
  const west = parseFloat(result.boundingbox[2]);
  const east = parseFloat(result.boundingbox[3]);
  const latPadding = Math.max((north - south) * 0.35, 0.0035);
  const lonPadding = Math.max((east - west) * 0.35, 0.0035);

  return {
    left: west - lonPadding,
    right: east + lonPadding,
    top: north + latPadding,
    bottom: south - latPadding
  };
}

function getOpenStreetMapEmbedUrl(result) {
  const box = expandBoundingBox(result);
  const bbox = [box.left, box.bottom, box.right, box.top]
    .map(value => value.toFixed(6))
    .join("%2C");
  const marker = `${parseFloat(result.lat).toFixed(6)}%2C${parseFloat(result.lon).toFixed(6)}`;

  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`;
}

function setAddressMapPreview({ visible, src = "", note = "" }) {
  const container = document.getElementById("map-preview");
  const frame = document.getElementById("map-preview-frame");
  const previewNote = document.getElementById("map-preview-note");

  if (!container || !frame || !previewNote) {
    return;
  }

  container.classList.toggle("visible", visible);
  previewNote.textContent = note;

  if (src) {
    frame.src = src;
    frame.hidden = false;
  } else {
    frame.src = "";
    frame.hidden = true;
  }
}

async function loadAddressMapPreview() {
  const address = getFieldValue("address");

  if (!address || address.length < ADDRESS_PREVIEW_MIN_LENGTH || getFieldValidationMessage("address")) {
    lastAddressLookup = "";
    setAddressMapPreview({
      visible: false,
      src: "",
      note: ""
    });
    return;
  }

  if (address === lastAddressLookup) {
    return;
  }

  if (hasWebLink(address)) {
    lastAddressLookup = address;
    setAddressMapPreview({
      visible: true,
      src: "",
      note: "Location details will be included in the reminder."
    });
    return;
  }

  lastAddressLookup = address;
  setAddressMapPreview({
    visible: true,
    src: "",
    note: "Loading map..."
  });

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`,
      {
        headers: {
          Accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error("Lookup failed");
    }

    const results = await response.json();

    if (getFieldValue("address") !== address) {
      return;
    }

    if (!Array.isArray(results) || !results.length) {
      setAddressMapPreview({
        visible: true,
        src: "",
        note: "No map found for that address."
      });
      return;
    }

    setAddressMapPreview({
      visible: true,
      src: getOpenStreetMapEmbedUrl(results[0]),
      note: "Map data by OpenStreetMap contributors."
    });
  } catch (error) {
    setAddressMapPreview({
      visible: true,
      src: "",
      note: "Map preview is unavailable right now."
    });
  }
}

function hasDisallowedLink(value, allowEmail) {
  const hasLink = STRICT_LINK_PATTERN.test(value) || DOMAIN_PATTERN.test(value);
  const hasEmail = allowEmail && EMAIL_PATTERN.test(value);
  return hasLink && !hasEmail;
}

function hasWebLink(value) {
  return STRICT_LINK_PATTERN.test(value) || DOMAIN_PATTERN.test(value);
}

function getFieldValidationMessage(fieldId) {
  const value = getFieldValue(fieldId);

  if (fieldId === "copyEmail") {
    return getCopyEmailValidationMessage();
  }

  if (!value) {
    return "";
  }

  if (fieldId === "email" && !EMAIL_PATTERN.test(value)) {
    return "Enter a valid email address.";
  }

  if (FIELD_LIMITS[fieldId] && value.length > FIELD_LIMITS[fieldId].maxLength) {
    return `${FIELD_LIMITS[fieldId].label} cannot be longer than ${FIELD_LIMITS[fieldId].maxLength} characters.`;
  }

  if (fieldId === "notes" && hasDisallowedLink(value, false)) {
    return "Links are not allowed here.";
  }

  if ((fieldId === "name" || fieldId === "phone") && hasDisallowedLink(value, false)) {
    return "Links are not allowed here.";
  }

  if (fieldId === "businessContact" && hasDisallowedLink(value, true)) {
    return "Enter a phone number or email address only.";
  }

  return "";
}

function syncFieldValidationErrors() {
  const fieldIds = ["phone", "email", "name", "address", "businessContact", "notes", "copyEmail"];

  fieldIds.forEach(fieldId => {
    const errorElement = document.getElementById(`${fieldId}-error`);

    if (!errorElement) {
      return;
    }

    const message = getFieldValidationMessage(fieldId);

    if (message) {
      errorElement.textContent = message;
      errorElement.classList.add("visible");
    } else {
      errorElement.textContent = "";
      errorElement.classList.remove("visible");
    }
  });
}

function updatePreviewLayout() {
  const preview = document.getElementById("preview");
  const previewHint = document.getElementById("preview-hint");

  if (!preview) {
    return;
  }

  preview.style.height = "auto";
  const nextHeight = Math.min(preview.scrollHeight, 360);
  preview.style.height = `${nextHeight}px`;

  if (previewHint) {
    if (preview.scrollHeight > 360) {
      previewHint.classList.add("visible");
    } else {
      previewHint.classList.remove("visible");
    }
  }
}

function getMessage() {
  return document.getElementById("preview").value.trim();
}

function getEmail() {
  return getFieldValue("email");
}

function getPhone() {
  return getFieldValue("phone");
}

function getPhoneDigits() {
  return normalizePhoneDigits(getFieldValue("phone"));
}

function shouldSendCopy() {
  const checkbox = document.getElementById("sendCopy");
  return Boolean(checkbox && checkbox.checked);
}

function getCopyEmail() {
  return getFieldValue("copyEmail");
}

function getSuggestedCopyEmail() {
  const businessContact = getFieldValue("businessContact");
  return EMAIL_PATTERN.test(businessContact) ? businessContact : "";
}

function syncCopyEmailOption() {
  const checkbox = document.getElementById("sendCopy");
  const copyEmailWrap = document.getElementById("copy-email-wrap");
  const copyEmailInput = document.getElementById("copyEmail");

  if (!checkbox || !copyEmailWrap || !copyEmailInput) {
    return;
  }

  const enabled = checkbox.checked;
  copyEmailWrap.classList.toggle("visible", enabled);
  copyEmailInput.disabled = !enabled;

  if (!enabled) {
    return;
  }

  if (!copyEmailDirty) {
    copyEmailInput.value = getSuggestedCopyEmail();
  }
}

function getCopyEmailValidationMessage() {
  if (!shouldSendCopy()) {
    return "";
  }

  const copyEmail = getCopyEmail();

  if (!copyEmail) {
    return "Enter the email address where you want the appointment copy sent.";
  }

  if (!EMAIL_PATTERN.test(copyEmail)) {
    return "Enter a valid email address.";
  }

  return "";
}

function getReminderPayload() {
  return {
    clientEmail: getEmail(),
    message: getMessage(),
    clientName: getFieldValue("name"),
    clientPhone: getPhoneDigits(),
    serviceAddress: getFieldValue("address"),
    businessContact: getFieldValue("businessContact"),
    serviceDate: getFieldValue("date"),
    serviceTime: getFieldValue("time"),
    sendCopy: shouldSendCopy(),
    copyEmail: getCopyEmail(),
    brandingProfile: getSavedBrandingProfile()
  };
}

function getSelectedReminderOffsets(channel) {
  return Array.from(document.querySelectorAll(`#bronze-reminder-panel input[type='checkbox'][data-channel='${channel}']`))
    .filter(input => input.checked)
    .map(input => input.value);
}

async function persistBronzeReminderPreferences() {
  if (!appSupabase || !currentSignedInUser || !isBronzeUser()) {
    return;
  }

  const nextMetadata = {
    ...(currentSignedInUser.user_metadata || {}),
    reminder_preferences: {
      email: getSelectedReminderOffsets("email"),
      sms: getSelectedReminderOffsets("sms")
    }
  };

  try {
    const { data, error } = await appSupabase.auth.updateUser({
      data: nextMetadata
    });

    if (error) {
      throw error;
    }

    currentSignedInUser = data.user || currentSignedInUser;
    renderBronzeFeatures();
  } catch (error) {
    console.warn("Unable to save Bronze reminder preferences.", error);
  }
}

function buildBronzeContactPayload() {
  const payload = {
    owner_id: currentSignedInUser?.id || "",
    client_name: getFieldValue("name").slice(0, 30),
    client_email: getFieldValue("email"),
    client_phone: getPhoneDigits(),
    service_address: getFieldValue("address").slice(0, FIELD_LIMITS.address.maxLength),
    notes: getFieldValue("notes").slice(0, 1200),
    updated_at: new Date().toISOString()
  };

  if (!payload.client_name && !payload.client_email && !payload.client_phone) {
    return null;
  }

  return payload;
}

async function findExistingBronzeContactId(payload) {
  if (!appSupabase || !payload?.owner_id) {
    return null;
  }

  const lookupRules = [];

  if (payload.client_email) {
    lookupRules.push({ column: "client_email", value: payload.client_email });
  }

  if (payload.client_phone) {
    lookupRules.push({ column: "client_phone", value: payload.client_phone });
  }

  for (const rule of lookupRules) {
    const { data, error } = await appSupabase
      .from("clients")
      .select("id")
      .eq("owner_id", payload.owner_id)
      .eq(rule.column, rule.value)
      .limit(1)
      .maybeSingle();

    if (!error && data?.id) {
      return data.id;
    }
  }

  return null;
}

async function autoSaveBronzeContact() {
  if (!appSupabase || !currentSignedInUser || !isBronzeUser()) {
    return null;
  }

  const payload = buildBronzeContactPayload();

  if (!payload) {
    return null;
  }

  try {
    if (linkedPrefillClientId) {
      const { error } = await appSupabase
        .from("clients")
        .update(payload)
        .eq("id", linkedPrefillClientId)
        .eq("owner_id", payload.owner_id);

      if (!error) {
        return linkedPrefillClientId;
      }
    }

    const existingId = await findExistingBronzeContactId(payload);

    if (existingId) {
      const { error } = await appSupabase
        .from("clients")
        .update(payload)
        .eq("id", existingId)
        .eq("owner_id", payload.owner_id);

      if (error) {
        throw error;
      }

      linkedPrefillClientId = existingId;
      return existingId;
    }

    const { data, error } = await appSupabase
      .from("clients")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    linkedPrefillClientId = data?.id || "";
    return data?.id || null;
  } catch (error) {
    console.warn("Unable to auto-save Bronze contact.", error);
    return null;
  }
}

async function logBronzeReminderHistory({ clientId, channel, source, messageId, status, eventType, occurredAt, recipientEmail, messagePreview, rawEvent }) {
  if (!appSupabase || !currentSignedInUser || !isBronzeUser() || !clientId || !channel) {
    return;
  }

  const normalizedOccurredAt = occurredAt || new Date().toISOString();
  const normalizedStatus = String(status || "").trim() || "sent";
  const normalizedEventType = String(eventType || "").trim() || normalizedStatus;
  const normalizedMessageId = String(messageId || "").trim();
  const eventKey = normalizedMessageId
    ? `${normalizedMessageId}:${normalizedEventType}:${normalizedOccurredAt}`
    : `${currentSignedInUser.id}:${clientId}:${channel}:${normalizedEventType}:${normalizedOccurredAt}`;

  try {
    const { error } = await appSupabase.from("client_reminder_history").insert({
      owner_id: currentSignedInUser.id,
      client_id: clientId,
      channel,
      source: source || "",
      status: normalizedStatus,
      event_type: normalizedEventType,
      message_id: normalizedMessageId || null,
      recipient_email: recipientEmail || null,
      occurred_at: normalizedOccurredAt,
      sent_at: normalizedOccurredAt,
      event_key: eventKey,
      message_preview: String(messagePreview || "").trim() || null,
      raw_event: rawEvent || null
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.warn("Unable to log Bronze reminder history.", error);
  }
}

function buildBronzeAppointmentPayload({ clientId, channel, source }) {
  if (!currentSignedInUser?.id) {
    return null;
  }

  const serviceDate = getFieldValue("date");

  if (!serviceDate) {
    return null;
  }

  const serviceTime = getFieldValue("time");

  return {
    owner_id: currentSignedInUser.id,
    client_id: clientId || null,
    client_name: getFieldValue("name").slice(0, 30),
    client_email: getFieldValue("email"),
    client_phone: getPhoneDigits(),
    service_date: serviceDate,
    service_time: serviceTime || null,
    service_location: getFieldValue("address").slice(0, FIELD_LIMITS.address.maxLength),
    notes: getFieldValue("notes").slice(0, 1200),
    last_channel: channel || null,
    last_source: source || "",
    updated_at: new Date().toISOString()
  };
}

async function findExistingBronzeAppointmentId(payload) {
  if (!appSupabase || !payload?.owner_id || !payload?.service_date) {
    return null;
  }

  const lookupRules = [];

  if (payload.client_id) {
    lookupRules.push({ column: "client_id", value: payload.client_id });
  }

  if (payload.client_email) {
    lookupRules.push({ column: "client_email", value: payload.client_email });
  }

  if (payload.client_phone) {
    lookupRules.push({ column: "client_phone", value: payload.client_phone });
  }

  for (const rule of lookupRules) {
    let query = appSupabase
      .from("appointments")
      .select("id")
      .eq("owner_id", payload.owner_id)
      .eq(rule.column, rule.value)
      .eq("service_date", payload.service_date)
      .limit(1);

    query = payload.service_time
      ? query.eq("service_time", payload.service_time)
      : query.is("service_time", null);

    const { data, error } = await query.maybeSingle();

    if (!error && data?.id) {
      return data.id;
    }
  }

  return null;
}

async function upsertBronzeAppointment({ clientId, channel, source }) {
  if (!appSupabase || !currentSignedInUser || !isBronzeUser()) {
    return null;
  }

  const payload = buildBronzeAppointmentPayload({ clientId, channel, source });

  if (!payload) {
    return null;
  }

  try {
    const existingId = await findExistingBronzeAppointmentId(payload);

    if (existingId) {
      const { error } = await appSupabase
        .from("appointments")
        .update(payload)
        .eq("id", existingId)
        .eq("owner_id", payload.owner_id);

      if (error) {
        throw error;
      }

      return existingId;
    }

    const { data, error } = await appSupabase
      .from("appointments")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    return data?.id || null;
  } catch (error) {
    console.warn("Unable to save Bronze appointment.", error);
    return null;
  }
}

function hasUnsavedFormData() {
  if (safeToLeaveAfterSend) {
    return false;
  }

  if (FORM_FIELD_IDS.some(fieldId => getFieldValue(fieldId).length > 0)) {
    return true;
  }

  if (hasConsent() || shouldSendCopy() || getCopyEmail().length > 0) {
    return true;
  }

  return false;
}

function temporarilySuppressBeforeUnload() {
  suppressBeforeUnload = true;

  window.setTimeout(() => {
    suppressBeforeUnload = false;
  }, 2000);
}

function hasConsent() {
  return document.getElementById("consent").checked;
}

function requireConsent() {
  if (!hasConsent()) {
    alert("Please confirm the consent checkbox before sending.");
    return false;
  }

  return true;
}

function validateMessageSafety(options = {}) {
  const { includeCopyEmailValidation = true } = options;
  const name = getFieldValue("name");
  const notes = getFieldValue("notes");
  const phone = getFieldValue("phone");
  const address = getFieldValue("address");
  const businessContact = getFieldValue("businessContact");
  const message = getMessage();
  const combined = `${notes}\n${message}`.toLowerCase();
  const messageLengthLimit = 1200;
  const copyEmailMessage = getCopyEmailValidationMessage();

  if (includeCopyEmailValidation && copyEmailMessage) {
    alert(copyEmailMessage);
    return false;
  }

  const restrictedFields = [
    { label: "Client Name", value: name, maxLength: FIELD_LIMITS.name.maxLength },
    { label: "Client Phone Number", value: phone, maxLength: FIELD_LIMITS.phone.maxLength },
    { label: FIELD_LIMITS.address.label, value: address, maxLength: FIELD_LIMITS.address.maxLength, allowLink: true },
    { label: FIELD_LIMITS.businessContact.label, value: businessContact, maxLength: FIELD_LIMITS.businessContact.maxLength, allowEmail: true },
    { label: "Additional Details", value: notes },
    { label: "Message Preview", value: message }
  ];

  for (const field of restrictedFields) {
    if (field.maxLength && field.value.length > field.maxLength) {
      alert(`${field.label} cannot be longer than ${field.maxLength} characters.`);
      return false;
    }

    const hasLink = STRICT_LINK_PATTERN.test(field.value) || DOMAIN_PATTERN.test(field.value);
    const hasEmail = field.allowEmail && EMAIL_PATTERN.test(field.value);
    if (hasLink && !hasEmail && !field.allowLink) {
      alert(`Links are not allowed in ${field.label}.`);
      return false;
    }
  }

  if (message.length > messageLengthLimit) {
    alert(`Message Preview cannot be longer than ${messageLengthLimit} characters.`);
    return false;
  }

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

  for (const phrase of blockedPhrases) {
    if (combined.includes(phrase)) {
      alert("This message contains content that is not allowed.");
      return false;
    }
  }

  return true;
}

function getProgressStatus(index, totalSteps) {
  if (index === totalSteps - 1) {
    return "Final step";
  }

  if (index >= totalSteps - 2) {
    return "Almost done";
  }

  if (index >= Math.floor(totalSteps / 2)) {
    return "You are getting close";
  }

  return "Just a few quick questions";
}

function hasValueForField(fieldId) {
  if (!fieldId) {
    return false;
  }

  if (fieldId === "phone") {
    return getPhoneDigits().length > 0;
  }

  if (fieldId === "consent") {
    return hasConsent();
  }

  return getFieldValue(fieldId).length > 0;
}

function isStepComplete(step, index) {
  if (!step) {
    return false;
  }

  const fieldId = step.dataset.field || "";
  const isOptional = step.dataset.optional === "true";

  if (isOptional) {
    return Boolean(visitedSteps[index]) || hasValueForField(fieldId);
  }

  return hasValueForField(fieldId);
}

function isStepInvalid(step) {
  if (!step) {
    return false;
  }

  const fieldId = step.dataset.field || "";
  return Boolean(getFieldValidationMessage(fieldId));
}

function renderStepNavigation() {
  const stepper = document.getElementById("stepper");

  if (!stepper || !wizardSteps.length) {
    return;
  }

  stepper.innerHTML = "";

  wizardSteps.forEach((step, index) => {
    const button = document.createElement("button");
    const label = step.dataset.nav || step.dataset.title || `Step ${index + 1}`;
    const invalid = isStepInvalid(step);
    const complete = isStepComplete(step, index);
    const stepIcon = invalid ? "X" : complete ? "&#10003;" : String(index + 1);

    button.type = "button";
    button.className = "stepper-button";
    button.setAttribute("aria-label", `Go to ${label}`);
    button.innerHTML = `
      <span class="stepper-circle">${stepIcon}</span>
      <span class="stepper-label">${label}</span>
    `;

    if (index === currentStepIndex) {
      button.classList.add("active");
    }

    if (invalid) {
      button.classList.add("invalid");
    } else if (complete) {
      button.classList.add("complete");
    }

    button.addEventListener("click", () => setStep(index));
    stepper.appendChild(button);
  });
}

function focusStepField(step) {
  const field = step.querySelector("input, textarea");

  if (!field || field.id === "preview" || field.type === "checkbox") {
    return;
  }

  window.setTimeout(() => {
    field.focus({ preventScroll: true });
  }, 60);
}

function updateWizardUI() {
  if (!wizardSteps.length) {
    return;
  }

  const currentStep = wizardSteps[currentStepIndex];
  const totalSteps = wizardSteps.length;
  const wizardShell = document.querySelector(".wizard-shell");
  const stepCount = document.getElementById("step-count");
  const stepTitle = document.getElementById("step-title");
  const stepCopy = document.getElementById("step-copy");
  const stepPill = document.getElementById("step-pill");
  const progressStatus = document.getElementById("progress-status");
  const progressFill = document.getElementById("progress-fill");
  const backButton = document.getElementById("back-button");
  const skipButton = document.getElementById("skip-button");
  const nextButton = document.getElementById("next-button");
  const wizardControls = document.querySelector(".wizard-controls");
  const isFinalStep = currentStepIndex === totalSteps - 1;
  const isOptional = currentStep.dataset.optional === "true";

  wizardSteps.forEach((step, index) => {
    step.classList.toggle("active", index === currentStepIndex);
  });

  stepCount.textContent = `Step ${currentStepIndex + 1} of ${totalSteps}`;
  stepTitle.textContent = currentStep.dataset.title || "";
  stepCopy.textContent = currentStep.dataset.copy || "";
  progressStatus.textContent = getProgressStatus(currentStepIndex, totalSteps);
  progressFill.style.width = `${((currentStepIndex + 1) / totalSteps) * 100}%`;

  if (isFinalStep) {
    stepPill.textContent = "Final Step";
    stepPill.className = "step-pill final";
  } else {
    stepPill.textContent = isOptional ? "Optional" : "Required";
    stepPill.className = "step-pill";
  }

  backButton.hidden = currentStepIndex === 0;
  skipButton.hidden = isFinalStep || !isOptional;
  nextButton.hidden = isFinalStep;
  nextButton.textContent = currentStepIndex === totalSteps - 2 ? "Review" : "Next";

  if (wizardControls) {
    const visibleButtons = [backButton, skipButton, nextButton].filter(button => !button.hidden).length;
    wizardControls.classList.remove("one-button", "two-buttons");

    if (visibleButtons === 1) {
      wizardControls.classList.add("one-button");
    } else if (visibleButtons === 2) {
      wizardControls.classList.add("two-buttons");
    }
  }

  focusStepField(currentStep);
  renderStepNavigation();

  if (wizardShell) {
    const activeStepperButton = document.querySelector(".stepper-button.active");
    if (activeStepperButton) {
      activeStepperButton.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center"
      });
    }
  }
}

function setStep(index, direction) {
  if (index < 0 || index >= wizardSteps.length) {
    return;
  }

  const wizardShell = document.querySelector(".wizard-shell");
  let nextDirection = direction;

  if (!nextDirection) {
    if (index > currentStepIndex) {
      nextDirection = "forward";
    } else if (index < currentStepIndex) {
      nextDirection = "backward";
    } else {
      nextDirection = "forward";
    }
  }

  if (wizardShell) {
    wizardShell.dataset.direction = nextDirection;
  }

  currentStepIndex = index;
  visitedSteps[currentStepIndex] = true;
  updateWizardUI();
}

function moveToNextStep() {
  setStep(currentStepIndex + 1, "forward");
}

function initWizard() {
  wizardSteps = Array.from(document.querySelectorAll(".wizard-step"));
  visitedSteps = wizardSteps.map((_, index) => index === 0);

  if (!wizardSteps.length) {
    return;
  }

  const backButton = document.getElementById("back-button");
  const skipButton = document.getElementById("skip-button");
  const nextButton = document.getElementById("next-button");

  backButton.addEventListener("click", () => setStep(currentStepIndex - 1, "backward"));
  skipButton.addEventListener("click", moveToNextStep);
  nextButton.addEventListener("click", moveToNextStep);

  wizardSteps.forEach((step, index) => {
    step.querySelectorAll("input").forEach(input => {
      if (input.type === "date" || input.type === "time" || input.type === "checkbox") {
        return;
      }

      input.addEventListener("keydown", event => {
        if (event.key === "Enter" && index === currentStepIndex) {
          event.preventDefault();

          if (currentStepIndex < wizardSteps.length - 1) {
            moveToNextStep();
          }
        }
      });
    });
  });

  renderStepNavigation();
  updateWizardUI();
}

FORM_FIELD_IDS.forEach(fieldId => {
  const element = document.getElementById(fieldId);

  if (!element) {
    return;
  }

  element.addEventListener("input", () => {
    if (fieldId === "phone") {
      syncPhoneFieldFormatting();
    }

    if (fieldId === "address") {
      lastAddressLookup = "";
      setAddressMapPreview({
        visible: false,
        src: "",
        note: ""
      });
    }

    refreshFormState();
  });
});

const previewTextarea = document.getElementById("preview");
if (previewTextarea) {
  previewTextarea.addEventListener("input", () => {
    if (!isBronzeUser()) {
      return;
    }

    bronzePreviewUsesManualMessage = true;
    bronzePreviewManualMessage = previewTextarea.value;
    updateDraftPreviewChrome();
    updateReviewPreview();
  });
}

const addressInput = document.getElementById("address");
if (addressInput) {
  addressInput.addEventListener("blur", loadAddressMapPreview);
}

const consentInput = document.getElementById("consent");
if (consentInput) {
  consentInput.addEventListener("change", renderStepNavigation);
}

const sendCopyInput = document.getElementById("sendCopy");
if (sendCopyInput) {
  sendCopyInput.addEventListener("change", () => {
    if (sendCopyInput.checked && !getCopyEmail()) {
      copyEmailDirty = false;
    }

    refreshFormState();
  });
}

const copyEmailInput = document.getElementById("copyEmail");
if (copyEmailInput) {
  copyEmailInput.addEventListener("input", () => {
    copyEmailDirty = true;
    refreshFormState();
  });
}

document.querySelectorAll("#bronze-reminder-panel input[type='checkbox'][data-channel]").forEach(input => {
  input.addEventListener("change", () => {
    persistBronzeReminderPreferences();
  });
});

const emailModal = document.getElementById("email-modal");
if (emailModal) {
  emailModal.addEventListener("click", event => {
    if (event.target === emailModal) {
      closeEmailModal();
    }
  });
}

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && emailModal && !emailModal.hidden) {
    closeEmailModal();
  }
});

window.addEventListener("resize", scheduleBronzePreviewScale);

window.addEventListener("beforeunload", event => {
  if (suppressBeforeUnload || !hasUnsavedFormData()) {
    return;
  }

  event.preventDefault();
  event.returnValue = "";
});
syncPhoneFieldFormatting();
applySavedClientPrefill();
syncPhoneFieldFormatting();
refreshFormState();
initWizard();
renderBronzeFeatures();
initAccountTierState();

function openEmailModal() {
  const modal = document.getElementById("email-modal");
  const sendCopyCheckbox = document.getElementById("sendCopy");
  const copyEmailInput = document.getElementById("copyEmail");
  const suggestedCopyEmail = getSuggestedCopyEmail();

  if (!modal) {
    return;
  }

  copyEmailDirty = false;

  if (sendCopyCheckbox) {
    sendCopyCheckbox.checked = Boolean(suggestedCopyEmail);
  }

  if (copyEmailInput) {
    copyEmailInput.value = suggestedCopyEmail;
  }

  syncCopyEmailOption();
  modal.hidden = false;
  modal.classList.add("visible");
  document.body.classList.add("modal-open");

  window.setTimeout(() => {
    const focusTarget = sendCopyCheckbox && sendCopyCheckbox.checked
      ? document.getElementById("copyEmail")
      : sendCopyCheckbox;
    if (focusTarget) {
      focusTarget.focus({ preventScroll: true });
    }
  }, 40);
}

function closeEmailModal() {
  const modal = document.getElementById("email-modal");

  if (!modal) {
    return;
  }

  modal.classList.remove("visible");
  modal.hidden = true;
  document.body.classList.remove("modal-open");
}

function setSendEmailButtonState(state) {
  const button = document.getElementById("send-email-button");

  if (!button) {
    return;
  }

  if (!button.dataset.defaultText) {
    button.dataset.defaultText = button.textContent;
  }

  window.clearTimeout(sendEmailResetTimer);
  button.classList.remove("loading", "sent");
  button.disabled = false;
  sendEmailLockedAfterSuccess = false;

  if (state === "loading") {
    button.disabled = true;
    button.classList.add("loading");
    button.textContent = "Sending...";
    return;
  }

  if (state === "sent") {
    button.classList.add("sent");
    button.disabled = true;
    sendEmailLockedAfterSuccess = true;
    button.textContent = "Email Sent";
    return;
  }

  button.textContent = button.dataset.defaultText;
}

function getBrevoPayloadOrAlert() {
  return getBrevoPayloadOrAlertInternal(true);
}

function getBrevoPayloadOrAlertForModalOpen() {
  return getBrevoPayloadOrAlertInternal(false);
}

function getBrevoPayloadOrAlertInternal(includeCopyEmailValidation) {
  if (!requireConsent()) {
    return null;
  }

  if (!validateMessageSafety({ includeCopyEmailValidation })) {
    return null;
  }

  const payload = getReminderPayload();
  const email = payload.clientEmail;
  const message = payload.message;

  if (!email) {
    alert("Email is required");
    return null;
  }

  if (!EMAIL_PATTERN.test(email)) {
    alert("Enter a valid client email address.");
    return null;
  }

  if (!message) {
    alert("Message is required");
    return null;
  }

  return payload;
}

function sendBrevoEmail() {
  const payload = getBrevoPayloadOrAlertForModalOpen();

  if (!payload) {
    return;
  }

  openEmailModal();
}

function storeQaLastSentEmail(record) {
  if (!record) {
    return;
  }

  try {
    window.sessionStorage.setItem(QA_LAST_EMAIL_STORAGE_KEY, JSON.stringify(record));
  } catch (error) {
    console.warn("Unable to store QA last sent email.", error);
  }
}

async function confirmSendBrevoEmail() {
  const payload = getBrevoPayloadOrAlert();

  if (!payload) {
    return;
  }

  closeEmailModal();
  setSendEmailButtonState("loading");
  try {
    const clientId = isBronzeUser() ? await autoSaveBronzeContact() : null;
    const res = await fetch("/api/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...payload,
        trackingOwnerId: currentSignedInUser?.id || "",
        trackingClientId: clientId || "",
        trackingSource: "automated_email"
      })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      if (data.qaEmailDebug) {
        storeQaLastSentEmail(data.qaEmailDebug);
      }

      await upsertBronzeAppointment({
        clientId,
        channel: "email",
        source: "automated_email"
      });
      safeToLeaveAfterSend = true;
      setSendEmailButtonState("sent");
    } else {
      setSendEmailButtonState("idle");
      alert(data.error || "Error sending email");
    }
  } catch (error) {
    setSendEmailButtonState("idle");
    alert("Error sending email");
  }
}

async function sendLocalText() {
  if (!requireConsent()) {
    return;
  }

  if (!validateMessageSafety({ includeCopyEmailValidation: false })) {
    return;
  }

  const phone = getPhoneDigits();
  const message = getMessage();

  if (!phone) {
    alert("Client phone number is required");
    return;
  }

  if (!message) {
    alert("Message is required");
    return;
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(message);
    }
  } catch (error) {
    console.warn("Clipboard write failed", error);
  }

  const clientId = await autoSaveBronzeContact();
  await upsertBronzeAppointment({
    clientId,
    channel: "sms",
    source: "device_sms"
  });
  await logBronzeReminderHistory({
    clientId,
    channel: "sms",
    source: "device_sms",
    messagePreview: message
  });
  safeToLeaveAfterSend = true;

  const smsBody = encodeURIComponent(message);
  const separator = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "&" : "?";
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent);

  if (!isMobileDevice) {
    alert("We detected you on a desktop device. This feature usually only works on mobile devices, but we will still try to open your default texting app.");
  }

  temporarilySuppressBeforeUnload();
  window.location.href = `sms:${encodeURIComponent(phone)}${separator}body=${smsBody}`;
}
