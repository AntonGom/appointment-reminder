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
const BASE_FORM_FIELD_IDS = ["phone", "email", "name", "address", "businessContact", "date", "time", "notes"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const STRICT_LINK_PATTERN = /(https?:\/\/|www\.)/i;
const DOMAIN_PATTERN = /(^|\s)[a-z0-9-]+\.(com|net|org|io|co|info|biz|me|us|ly|app|gg|tv|xyz)(\/|\s|$)/i;
const ADDRESS_PREVIEW_MIN_LENGTH = 6;
const REMINDER_PREFILL_KEY = "appointment-reminder-selected-client";
const QA_LAST_EMAIL_STORAGE_KEY = "appointment-reminder:last-sent-email-html";
const BRANDING_TEMPLATE_MODULE_PATH = "./branding-templates.js?v=20260403a";
const CUSTOM_FORM_MODULE_PATH = "./custom-form-profile.js?v=20260405e";
const DEFAULT_FORM_SURFACE_COLOR = "#f6f8fc";
const DEFAULT_FORM_SURFACE_ACCENT_COLOR = "#ffffff";
const DEFAULT_FORM_SURFACE_GRADIENT = "solid";
const DEFAULT_FORM_TEXT_COLOR = "#111827";
const DEFAULT_FORM_TITLE_FONT_SIZE = 12;
const DEFAULT_STEP_TITLE_FONT_SIZE = 36;
const DEFAULT_STEP_COPY_FONT_SIZE = 15;
const DEFAULT_FIELD_LABEL_FONT_SIZE = 16;
const DEFAULT_FIELD_HELP_FONT_SIZE = 13;
const DEFAULT_STEP_NAV_BACKGROUND = "#f8fafc";
const DEFAULT_STEP_NAV_ACTIVE_BACKGROUND = "#dbeafe";
const DEFAULT_STEP_NAV_TEXT_COLOR = "#0f172a";
const DEFAULT_STEP_NAV_ACTIVE_TEXT_COLOR = "#1d4ed8";
const BRONZE_REVIEW_PREVIEW_WIDTH = 664;
const BRONZE_REVIEW_PREVIEW_MAX_HEIGHT = 1120;
const BRONZE_REVIEW_PREVIEW_MAX_HEIGHT_MOBILE = 520;
const BRONZE_REVIEW_PREVIEW_MIN_HEIGHT = 180;
const BRONZE_REVIEW_PREVIEW_MIN_HEIGHT_MOBILE = 140;
const BRONZE_REVIEW_MAX_SCALE_DESKTOP = 0.9;
const BRONZE_REVIEW_MAX_SCALE_MOBILE = 0.62;

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
let customFormModulePromise = null;
let bronzePreviewScaleTimer = null;
let bronzePreviewRenderToken = 0;
let bronzePreviewManualMessage = "";
let bronzePreviewUsesManualMessage = false;
let bronzePreviewResizeObserver = null;
let bronzePreviewViewportBound = false;
let activeCustomFormProfile = null;
let activeCustomFormFields = [];
let customFormFieldLookup = new Map();
let wizardControlsInitialized = false;
let requiredFieldAttemptIds = new Set();

const BUILT_IN_FORM_STEP_DEFAULTS = {
  phone: {
    title: "Client Phone Number",
    navLabel: "Phone",
    copy: "Add a phone number if you may want to text this client later.",
    label: "Client Phone Number",
    helpText: "You can skip this and use email instead.",
    placeholder: "Enter client's phone number",
    required: false
  },
  email: {
    title: "Client Email",
    navLabel: "Email",
    copy: "Add an email address if you may want to email this client later.",
    label: "Client Email",
    helpText: "You can skip this and use a phone number instead.",
    placeholder: "Enter client's email",
    required: false
  },
  name: {
    title: "Client Name",
    navLabel: "Name",
    copy: "Add the client's name if you want the reminder to feel more personal.",
    label: "Client Name",
    helpText: "",
    placeholder: "Enter client's name",
    required: false
  },
  date: {
    title: "Date of Service",
    navLabel: "Date",
    copy: "Add the appointment date if you want it included in the reminder.",
    label: "Date of Service",
    helpText: "",
    placeholder: "",
    required: false
  },
  time: {
    title: "Time of Service",
    navLabel: "Time",
    copy: "Add the appointment time if you want it included in the reminder.",
    label: "Time of Service",
    helpText: "",
    placeholder: "",
    required: false
  },
  address: {
    title: "Service Location",
    navLabel: "Location",
    copy: "Add the service location if you want it included in the reminder.",
    label: "Service Location",
    helpText: "",
    placeholder: "Enter service location",
    required: false
  },
  businessContact: {
    title: "Bussiness Contact Infoformation",
    navLabel: "Contact",
    copy: "This is the contact information your client will see in the reminder.",
    label: "Bussiness Contact Infoformation",
    helpText: "Use the phone number or email the client should use if they need to reschedule or reach you.",
    placeholder: "Business phone or email",
    required: false
  },
  notes: {
    title: "Additional Details",
    navLabel: "Details",
    copy: "Add any extra details you want the client to see.",
    label: "Additional Details",
    helpText: "",
    placeholder: "Parking instructions, gate code, or anything else the client should know",
    required: false
  }
};

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

    const publicKey = appPublicConfig.supabasePublishableKey || appPublicConfig.supabaseAnonKey || "";

    if (!appPublicConfig.accountsEnabled || !appPublicConfig.supabaseUrl || !publicKey) {
      renderBronzeFeatures();
      return;
    }

    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    appSupabase = createClient(appPublicConfig.supabaseUrl, publicKey, {
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
    await syncCustomFormFromUser(currentSignedInUser);

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
      syncCustomFormFromUser(currentSignedInUser);
    });
  } catch (error) {
    currentSignedInUser = null;
    currentUserTier = "free";
    renderBronzeFeatures();
    syncCustomFormFromUser(null);
  }
}

async function getBrandingTemplateModule() {
  if (!brandingTemplateModulePromise) {
    brandingTemplateModulePromise = import(BRANDING_TEMPLATE_MODULE_PATH);
  }

  return brandingTemplateModulePromise;
}

async function getCustomFormModule() {
  if (!customFormModulePromise) {
    customFormModulePromise = import(CUSTOM_FORM_MODULE_PATH);
  }

  return customFormModulePromise;
}

function getAllFormFieldIds() {
  return [...BASE_FORM_FIELD_IDS, ...activeCustomFormFields.map(field => field.id)];
}

function getCustomFieldConfig(fieldId) {
  return customFormFieldLookup.get(fieldId) || null;
}

function isPhoneLikeField(fieldId) {
  if (fieldId === "phone") {
    return true;
  }

  return getCustomFieldConfig(fieldId)?.type === "phone";
}

function formatCustomFieldDisplayValue(field, value) {
  const safeValue = String(value || "").trim();

  if (!safeValue) {
    return "";
  }

  if (field?.type === "date") {
    return formatDate(safeValue);
  }

  if (field?.type === "time") {
    return formatTime(safeValue);
  }

  if (field?.type === "phone") {
    return formatPhoneNumber(safeValue);
  }

  return safeValue;
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
  [0, 90, 220, 500, 900, 1400, 2200].forEach(delay => {
    window.setTimeout(() => {
      syncBronzePreviewScale();
    }, delay);
  });
}

function refreshBronzePreviewObservers() {
  if (typeof ResizeObserver === "undefined") {
    return;
  }

  if (!bronzePreviewResizeObserver) {
    bronzePreviewResizeObserver = new ResizeObserver(() => {
      scheduleBronzePreviewScale();
    });
  }

  bronzePreviewResizeObserver.disconnect();

  [
    getReviewDraftCard(),
    getPreviewBodyShell(),
    getBronzePreviewShell()
  ].forEach(element => {
    if (element) {
      bronzePreviewResizeObserver.observe(element);
    }
  });

  if (!bronzePreviewViewportBound && window.visualViewport) {
    window.visualViewport.addEventListener("resize", scheduleBronzePreviewScale);
    bronzePreviewViewportBound = true;
  }
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

      if (frameDocument.fonts?.ready) {
        frameDocument.fonts.ready.then(() => {
          if (currentToken === bronzePreviewRenderToken) {
            scheduleBronzePreviewScaleBurst();
          }
        }).catch(() => {});
      }
    }

    refreshBronzePreviewObservers();
    frameWindow.requestAnimationFrame(() => {
      frameWindow.requestAnimationFrame(() => {
        syncBronzePreviewScale();
      });
    });
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
  const shouldShowBronzePreview = Boolean(isBronzeUser() && getSavedBrandingProfile());

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

function applyCustomFormPresentation(profile) {
  const container = document.querySelector(".container");
  const sectionTitle = document.querySelector(".section-title");
  const normalizedTitle = String(profile?.formTitle || "").trim();

  if (sectionTitle) {
    sectionTitle.textContent = normalizedTitle || "Appointment Reminder";
    sectionTitle.classList.toggle("visible", Boolean(normalizedTitle));
    sectionTitle.style.fontSize = `${profile?.formTitleFontSize || DEFAULT_FORM_TITLE_FONT_SIZE}px`;
    sectionTitle.style.fontWeight = profile?.formTitleBold === false ? "500" : "800";
  }

  document.documentElement.style.setProperty("--bg-top", profile?.backgroundTop || "#10141c");
  document.documentElement.style.setProperty("--bg-bottom", profile?.backgroundBottom || "#1a2230");

  if (container) {
    container.style.setProperty("--card", profile?.formSurfaceColor || DEFAULT_FORM_SURFACE_COLOR);
    container.style.setProperty("--card-background", buildCustomFormSurfaceBackground(profile));
    container.style.setProperty("--text-main", profile?.formTextColor || DEFAULT_FORM_TEXT_COLOR);
    container.style.setProperty("--text-soft", profile?.formTextColor || DEFAULT_FORM_TEXT_COLOR);
  }

  document.title = normalizedTitle ? `${normalizedTitle} | Appointment Reminder` : "Appointment Reminder";
}

function buildCustomFormSurfaceBackground(profile) {
  const base = String(profile?.formSurfaceColor || DEFAULT_FORM_SURFACE_COLOR).trim() || DEFAULT_FORM_SURFACE_COLOR;
  const accent = String(profile?.formSurfaceAccentColor || DEFAULT_FORM_SURFACE_ACCENT_COLOR).trim() || DEFAULT_FORM_SURFACE_ACCENT_COLOR;
  const gradient = String(profile?.formSurfaceGradient || DEFAULT_FORM_SURFACE_GRADIENT).trim() || DEFAULT_FORM_SURFACE_GRADIENT;

  switch (gradient) {
    case "soft-blend":
      return `linear-gradient(180deg, ${accent} 0%, ${base} 100%)`;
    case "top-glow":
      return `radial-gradient(circle at top center, ${accent} 0%, ${base} 68%)`;
    case "diagonal":
      return `linear-gradient(135deg, ${accent} 0%, ${base} 62%)`;
    case "solid":
    default:
      return base;
  }
}

function getActiveStepTypography(stepElement) {
  const fieldId = stepElement?.dataset?.field || "";
  const customField = getCustomFieldConfig(fieldId);
  const builtInOverride = activeCustomFormProfile?.stepOverrides?.[fieldId] || null;
  const source = customField || builtInOverride || {};

  return {
    titleFontSize: Number(source.titleFontSize) || DEFAULT_STEP_TITLE_FONT_SIZE,
    titleBold: source.titleBold !== false,
    copyFontSize: Number(source.copyFontSize) || DEFAULT_STEP_COPY_FONT_SIZE,
    copyBold: Boolean(source.copyBold)
  };
}

function getStepNavigationAppearance(stepElement) {
  const fieldId = stepElement?.dataset?.field || "";
  const customField = getCustomFieldConfig(fieldId);
  const builtInOverride = activeCustomFormProfile?.stepOverrides?.[fieldId] || null;
  const source = customField || builtInOverride || {};
  const profile = activeCustomFormProfile || {};

  return {
    navLabelColor: typeof source.navLabelColor === "string" ? source.navLabelColor.trim() : "",
    stepNavBackgroundColor: typeof profile.stepNavBackgroundColor === "string" ? profile.stepNavBackgroundColor.trim() : "",
    stepNavTextColor: typeof profile.stepNavTextColor === "string" ? profile.stepNavTextColor.trim() : "",
    stepNavActiveBackgroundColor: typeof profile.stepNavActiveBackgroundColor === "string" ? profile.stepNavActiveBackgroundColor.trim() : "",
    stepNavActiveTextColor: typeof profile.stepNavActiveTextColor === "string" ? profile.stepNavActiveTextColor.trim() : ""
  };
}

function applyBuiltInStepOverrides() {
  Object.entries(BUILT_IN_FORM_STEP_DEFAULTS).forEach(([fieldId, defaults]) => {
    const stepElement = document.querySelector(`.wizard-step[data-field="${fieldId}"]`);

    if (!stepElement) {
      return;
    }

    const override = activeCustomFormProfile?.stepOverrides?.[fieldId] || {};
    const labelText = override.label || defaults.label;
    const helpText = override.helpText || defaults.helpText;
    const required = override.required === true;
    const badgeMarkup = required
      ? `<span class="label-badge" style="background:#fee2e2;color:#b91c1c;">Required</span>`
      : `<span class="label-badge">Optional</span>`;

    stepElement.dataset.title = override.title || defaults.title;
    stepElement.dataset.nav = override.navLabel || defaults.navLabel;
    stepElement.dataset.navColor = override.navLabelColor || "";
    stepElement.dataset.copy = override.copy || defaults.copy;
    stepElement.dataset.optional = required ? "false" : "true";

    const labelElement = stepElement.querySelector("label");
    if (labelElement) {
      labelElement.innerHTML = `${escapeHtml(labelText)} ${badgeMarkup}`;
      labelElement.style.fontSize = `${override.labelFontSize || DEFAULT_FIELD_LABEL_FONT_SIZE}px`;
      labelElement.style.fontWeight = override.labelBold === false ? "500" : "800";
    }

    const inputElement = stepElement.querySelector("input, textarea");
    if (inputElement && typeof defaults.placeholder === "string") {
      inputElement.placeholder = override.placeholder || defaults.placeholder;
    }

    let helpElement = stepElement.querySelector(".field-note");

    if (!helpElement && helpText) {
      helpElement = document.createElement("p");
      helpElement.className = "field-note";
      const errorElement = stepElement.querySelector(".field-error");
      if (errorElement?.parentNode) {
        errorElement.parentNode.insertBefore(helpElement, errorElement.nextSibling);
      }
    }

    if (helpElement) {
      helpElement.textContent = helpText;
      helpElement.classList.toggle("visible", Boolean(helpText));
      helpElement.style.fontSize = `${override.helpFontSize || DEFAULT_FIELD_HELP_FONT_SIZE}px`;
      helpElement.style.fontWeight = override.helpBold ? "800" : "500";
    }
  });
}

function buildCustomWizardStepMarkup(field) {
  const type = String(field?.type || "text").trim();
  const title = String(field?.title || field?.label || "Custom Question").trim();
  const label = String(field?.label || "Custom Question").trim();
  const navLabel = String(field?.navLabel || label || "Custom").trim();
  const stepCopy = String(field?.copy || field?.helpText || "").trim();
  const helpText = String(field?.helpText || "").trim();
  const placeholder = String(field?.placeholder || "").trim();
  const optionalBadge = field?.required
    ? `<span class="label-badge" style="background:#fee2e2;color:#b91c1c;">Required</span>`
    : `<span class="label-badge">Optional</span>`;
  const inputMarkup = type === "textarea"
    ? `<textarea id="${field.id}" placeholder="${placeholder.replace(/"/g, "&quot;")}"></textarea>`
    : `<input id="${field.id}" ${type === "email" ? 'type="email" inputmode="email" autocomplete="off" autocapitalize="off" spellcheck="false"' : ""} ${type === "date" ? 'type="date"' : ""} ${type === "time" ? 'type="time"' : ""} ${type === "phone" ? 'inputmode="tel" autocomplete="tel"' : ""} placeholder="${placeholder.replace(/"/g, "&quot;")}">`;

  return `
    <div class="wizard-step custom-wizard-step" data-title="${title.replace(/"/g, "&quot;")}" data-nav="${navLabel.replace(/"/g, "&quot;")}" data-nav-color="${(field.navLabelColor || "").replace(/"/g, "&quot;")}" data-field="${field.id}" data-copy="${stepCopy.replace(/"/g, "&quot;") || "Custom question added from Form Creator."}" data-optional="${field?.required ? "false" : "true"}">
      <div class="question-wrap">
        <label for="${field.id}" style="font-size:${field.labelFontSize || DEFAULT_FIELD_LABEL_FONT_SIZE}px;font-weight:${field.labelBold === false ? 500 : 800};">${label} ${optionalBadge}</label>
        ${inputMarkup}
        <div id="${field.id}-error" class="field-error"></div>
        ${helpText ? `<p class="field-note visible" style="font-size:${field.helpFontSize || DEFAULT_FIELD_HELP_FONT_SIZE}px;font-weight:${field.helpBold ? 800 : 500};">${helpText}</p>` : ""}
      </div>
    </div>
  `;
}

function renderCustomWizardSteps() {
  document.querySelectorAll(".custom-wizard-step").forEach(step => step.remove());

  const reviewStep = document.querySelector('.wizard-step[data-field="consent"]');

  if (!reviewStep || !activeCustomFormFields.length) {
    applyBuiltInStepOverrides();
    return;
  }

  activeCustomFormFields.forEach(field => {
    reviewStep.insertAdjacentHTML("beforebegin", buildCustomWizardStepMarkup(field));
  });

  applyBuiltInStepOverrides();
}

function bindCustomFieldInputListeners() {
  activeCustomFormFields.forEach(field => {
    const element = document.getElementById(field.id);

    if (!element || element.dataset.formCreatorBound === "true") {
      return;
    }

    element.dataset.formCreatorBound = "true";
    element.addEventListener("input", () => {
      if (field.type === "phone") {
        element.value = formatPhoneNumber(element.value);
      }

      refreshFormState();
    });
  });
}

async function syncCustomFormFromUser(user = currentSignedInUser) {
  const profile = user?.user_metadata?.custom_form_profile;

  if (!profile) {
    activeCustomFormProfile = null;
    activeCustomFormFields = [];
    customFormFieldLookup = new Map();
    renderCustomWizardSteps();
    applyCustomFormPresentation(null);
    currentStepIndex = 0;
    requiredFieldAttemptIds.clear();
    initWizard();
    refreshFormState();
    return;
  }

  try {
    const module = await getCustomFormModule();
    const normalizedProfile = module.normalizeCustomFormProfile(profile);

    if (normalizedProfile.isEnabled === false) {
      activeCustomFormProfile = null;
      activeCustomFormFields = [];
      customFormFieldLookup = new Map();
      renderCustomWizardSteps();
      applyCustomFormPresentation(null);
      currentStepIndex = 0;
      requiredFieldAttemptIds.clear();
      initWizard();
      refreshFormState();
      return;
    }

    activeCustomFormProfile = normalizedProfile;
    activeCustomFormFields = Array.isArray(activeCustomFormProfile.fields) ? activeCustomFormProfile.fields : [];
    customFormFieldLookup = new Map(activeCustomFormFields.map(field => [field.id, field]));
    renderCustomWizardSteps();
    bindCustomFieldInputListeners();
    applyCustomFormPresentation(activeCustomFormProfile);
    currentStepIndex = 0;
    requiredFieldAttemptIds.clear();
    initWizard();
    refreshFormState();
  } catch (error) {
    console.warn("Unable to load custom form profile.", error);
  }
}

function buildCustomFieldMessageLines() {
  const lines = [];

  activeCustomFormFields.forEach(field => {
    const rawValue = getFieldValue(field.id);
    const formattedValue = formatCustomFieldDisplayValue(field, rawValue);

    if (!formattedValue) {
      return;
    }

    lines.push("");

    if (field.type === "textarea") {
      lines.push(`${field.label}:`);
      lines.push(formattedValue);
      return;
    }

    lines.push(`${field.label}: ${formattedValue}`);
  });

  return lines;
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
  lines.push(...buildCustomFieldMessageLines());

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
  const customField = getCustomFieldConfig(fieldId);

  if (fieldId === "copyEmail") {
    return getCopyEmailValidationMessage();
  }

  if (customField) {
    if (!value) {
      return customField.required && requiredFieldAttemptIds.has(fieldId)
        ? `${customField.label} is required.`
        : "";
    }

    if (customField.type === "email" && !EMAIL_PATTERN.test(value)) {
      return "Enter a valid email address.";
    }

    if (customField.type === "phone" && normalizePhoneDigits(value).length < 7) {
      return "Enter a valid phone number.";
    }

    if ((customField.type === "text" || customField.type === "textarea" || customField.type === "phone") && hasDisallowedLink(value, false)) {
      return "Links are not allowed here.";
    }

    return "";
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
  const fieldIds = [...getAllFormFieldIds(), "copyEmail"];

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

function normalizeBronzeClientName(value) {
  return String(value || "").trim().toLowerCase();
}

function chooseSingleBronzeIdentityMatch(candidates, payload, options = {}) {
  const {
    idKey = "id",
    nameKey = "client_name",
    emailKey = "client_email",
    phoneKey = "client_phone"
  } = options;

  if (!Array.isArray(candidates) || !candidates.length || !payload) {
    return null;
  }

  const normalizedId = String(payload?.client_id || payload?.id || "").trim();
  const normalizedName = normalizeBronzeClientName(payload?.client_name || payload?.name || "");
  const normalizedEmail = String(payload?.client_email || payload?.email || "").trim().toLowerCase();
  const normalizedPhone = normalizePhoneDigits(payload?.client_phone || payload?.phone || "");
  const isCompatibleCandidate = candidate => {
    const candidateName = normalizeBronzeClientName(candidate?.[nameKey] || "");
    const candidateEmail = String(candidate?.[emailKey] || "").trim().toLowerCase();
    const candidatePhone = normalizePhoneDigits(candidate?.[phoneKey] || "");

    if (normalizedName && candidateName && normalizedName !== candidateName) {
      return false;
    }

    if (normalizedEmail && candidateEmail && normalizedEmail !== candidateEmail) {
      return false;
    }

    if (normalizedPhone && candidatePhone && normalizedPhone !== candidatePhone) {
      return false;
    }

    return true;
  };

  if (normalizedId) {
    const idMatch = candidates.find(candidate => String(candidate?.[idKey] || "").trim() === normalizedId);

    if (idMatch) {
      return idMatch;
    }
  }

  let narrowed = [...candidates];

  if (normalizedPhone) {
    const phoneMatches = narrowed.filter(candidate => normalizePhoneDigits(candidate?.[phoneKey] || "") === normalizedPhone);

    if (phoneMatches.length === 1) {
      return isCompatibleCandidate(phoneMatches[0]) ? phoneMatches[0] : null;
    }

    if (phoneMatches.length > 1) {
      narrowed = phoneMatches;
    }
  }

  if (normalizedName) {
    const nameMatches = narrowed.filter(candidate => normalizeBronzeClientName(candidate?.[nameKey] || "") === normalizedName);

    if (nameMatches.length === 1) {
      return isCompatibleCandidate(nameMatches[0]) ? nameMatches[0] : null;
    }

    if (nameMatches.length > 1) {
      narrowed = nameMatches;
    }
  }

  if (normalizedEmail) {
    const emailMatches = narrowed.filter(candidate => String(candidate?.[emailKey] || "").trim().toLowerCase() === normalizedEmail);

    if (emailMatches.length === 1) {
      return isCompatibleCandidate(emailMatches[0]) ? emailMatches[0] : null;
    }

    if (emailMatches.length > 1) {
      narrowed = emailMatches;
    }
  }

  if (narrowed.length !== 1) {
    return null;
  }

  const onlyCandidate = narrowed[0];
  return isCompatibleCandidate(onlyCandidate) ? onlyCandidate : null;
}

async function findExistingBronzeContactId(payload) {
  if (!appSupabase || !payload?.owner_id) {
    return null;
  }

  const candidatesById = new Map();
  const lookupRules = [];

  if (payload.client_phone) {
    lookupRules.push({ column: "client_phone", value: payload.client_phone });
  }

  if (payload.client_email) {
    lookupRules.push({ column: "client_email", value: payload.client_email });
  }

  for (const rule of lookupRules) {
    const { data, error } = await appSupabase
      .from("clients")
      .select("id, client_name, client_email, client_phone")
      .eq("owner_id", payload.owner_id)
      .eq(rule.column, rule.value)
      .limit(10);

    if (error || !Array.isArray(data)) {
      continue;
    }

    data.forEach(candidate => {
      const candidateId = String(candidate?.id || "").trim();

      if (candidateId) {
        candidatesById.set(candidateId, candidate);
      }
    });
  }

  return chooseSingleBronzeIdentityMatch(Array.from(candidatesById.values()), payload)?.id || null;
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

  if (payload.client_id) {
    let directQuery = appSupabase
      .from("appointments")
      .select("id")
      .eq("owner_id", payload.owner_id)
      .eq("client_id", payload.client_id)
      .eq("service_date", payload.service_date)
      .limit(1);

    directQuery = payload.service_time
      ? directQuery.eq("service_time", payload.service_time)
      : directQuery.is("service_time", null);

    const { data, error } = await directQuery.maybeSingle();

    if (!error && data?.id) {
      return data.id;
    }
  }

  const candidatesById = new Map();
  const lookupRules = [];

  if (payload.client_phone) {
    lookupRules.push({ column: "client_phone", value: payload.client_phone });
  }

  if (payload.client_email) {
    lookupRules.push({ column: "client_email", value: payload.client_email });
  }

  for (const rule of lookupRules) {
    let query = appSupabase
      .from("appointments")
      .select("id, client_name, client_email, client_phone")
      .eq("owner_id", payload.owner_id)
      .eq(rule.column, rule.value)
      .eq("service_date", payload.service_date)
      .limit(10);

    query = payload.service_time
      ? query.eq("service_time", payload.service_time)
      : query.is("service_time", null);

    const { data, error } = await query;

    if (error || !Array.isArray(data)) {
      continue;
    }

    data.forEach(candidate => {
      const candidateId = String(candidate?.id || "").trim();

      if (candidateId) {
        candidatesById.set(candidateId, candidate);
      }
    });
  }

  return chooseSingleBronzeIdentityMatch(Array.from(candidatesById.values()), payload)?.id || null;
}

async function upsertBronzeAppointment({ clientId, channel, source }) {
  if (!appSupabase || !currentSignedInUser || !isBronzeUser()) {
    return null;
  }

  const payload = buildBronzeAppointmentPayload({ clientId, channel, source });

  if (!payload) {
    return null;
  }

  if (!payload.client_id && (payload.client_email || payload.client_phone)) {
    payload.client_id = await findExistingBronzeContactId({
      owner_id: payload.owner_id,
      client_email: payload.client_email,
      client_phone: payload.client_phone
    }) || null;
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

  if (getAllFormFieldIds().some(fieldId => getFieldValue(fieldId).length > 0)) {
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

  const missingRequiredCustomField = activeCustomFormFields.find(field => field.required && !getFieldValue(field.id));

  if (missingRequiredCustomField) {
    requiredFieldAttemptIds.add(missingRequiredCustomField.id);
    syncFieldValidationErrors();
    renderStepNavigation();
    const missingStepIndex = wizardSteps.findIndex(step => step.dataset.field === missingRequiredCustomField.id);

    if (missingStepIndex >= 0) {
      setStep(missingStepIndex, missingStepIndex > currentStepIndex ? "forward" : "backward");
    }

    alert(`${missingRequiredCustomField.label} is required.`);
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

  activeCustomFormFields.forEach(field => {
    const value = getFieldValue(field.id);

    if (!value) {
      return;
    }

    restrictedFields.push({
      label: field.label,
      value,
      allowEmail: field.type === "email"
    });
  });

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

  if (isPhoneLikeField(fieldId)) {
    return normalizePhoneDigits(getFieldValue(fieldId)).length > 0;
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
    const navAppearance = getStepNavigationAppearance(step);
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

    button.style.setProperty("--step-nav-bg", navAppearance.stepNavBackgroundColor || DEFAULT_STEP_NAV_BACKGROUND);
    button.style.setProperty("--step-nav-text", navAppearance.stepNavTextColor || navAppearance.navLabelColor || DEFAULT_STEP_NAV_TEXT_COLOR);
    button.style.setProperty("--step-nav-active-bg", navAppearance.stepNavActiveBackgroundColor || DEFAULT_STEP_NAV_ACTIVE_BACKGROUND);
    button.style.setProperty("--step-nav-active-text", navAppearance.stepNavActiveTextColor || navAppearance.stepNavTextColor || navAppearance.navLabelColor || DEFAULT_STEP_NAV_ACTIVE_TEXT_COLOR);

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
  const stepTypography = getActiveStepTypography(currentStep);
  stepTitle.style.fontSize = `${stepTypography.titleFontSize}px`;
  stepTitle.style.fontWeight = stepTypography.titleBold ? "800" : "500";
  stepCopy.style.fontSize = `${stepTypography.copyFontSize}px`;
  stepCopy.style.fontWeight = stepTypography.copyBold ? "800" : "500";
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
  const currentStep = wizardSteps[currentStepIndex];
  const currentFieldId = currentStep?.dataset?.field || "";
  const currentCustomField = getCustomFieldConfig(currentFieldId);

  if (currentCustomField?.required && !getFieldValue(currentFieldId)) {
    requiredFieldAttemptIds.add(currentFieldId);
    syncFieldValidationErrors();
    renderStepNavigation();
    focusStepField(currentStep);
    return;
  }

  const validationMessage = getFieldValidationMessage(currentFieldId);

  if (currentFieldId && validationMessage) {
    requiredFieldAttemptIds.add(currentFieldId);
    syncFieldValidationErrors();
    renderStepNavigation();
    focusStepField(currentStep);
    return;
  }

  setStep(currentStepIndex + 1, "forward");
}

function initWizard() {
  wizardSteps = Array.from(document.querySelectorAll(".wizard-step"));
  visitedSteps = wizardSteps.map((_, index) => index === 0);
  currentStepIndex = Math.min(currentStepIndex, Math.max(wizardSteps.length - 1, 0));

  if (!wizardSteps.length) {
    return;
  }

  const backButton = document.getElementById("back-button");
  const skipButton = document.getElementById("skip-button");
  const nextButton = document.getElementById("next-button");

  if (!wizardControlsInitialized) {
    backButton.addEventListener("click", () => setStep(currentStepIndex - 1, "backward"));
    skipButton.addEventListener("click", moveToNextStep);
    nextButton.addEventListener("click", moveToNextStep);
    wizardControlsInitialized = true;
  }

  wizardSteps.forEach((step, index) => {
    step.querySelectorAll("input").forEach(input => {
      if (input.dataset.wizardEnterBound === "true") {
        return;
      }

      if (input.type === "date" || input.type === "time" || input.type === "checkbox") {
        input.dataset.wizardEnterBound = "true";
        return;
      }

      input.dataset.wizardEnterBound = "true";
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

function bindBaseFieldListeners() {
  BASE_FORM_FIELD_IDS.forEach(fieldId => {
    const element = document.getElementById(fieldId);

    if (!element || element.dataset.baseFieldBound === "true") {
      return;
    }

    element.dataset.baseFieldBound = "true";
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
}

bindBaseFieldListeners();

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
