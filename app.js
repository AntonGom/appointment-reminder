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
  businessContact: { label: "Business Contact Information", maxLength: 60 }
};

const PHONE_DIGIT_LIMIT = 10;
const BASE_FORM_FIELD_IDS = ["phone", "email", "name", "address", "businessContact", "date", "time", "notes"];
const DEFAULT_REMEMBERED_CLIENT_FIELD_IDS = new Set(["phone", "email", "name", "address"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const STRICT_LINK_PATTERN = /(https?:\/\/|www\.)/i;
const DOMAIN_PATTERN = /(^|\s)[a-z0-9-]+\.(com|net|org|io|co|info|biz|me|us|ly|app|gg|tv|xyz)(\/|\s|$)/i;
const ADDRESS_PREVIEW_MIN_LENGTH = 6;
const REMINDER_PREFILL_KEY = "appointment-reminder-selected-client";
const REMINDER_PREFILL_QUERY_PARAM = "prefillClientId";
const QA_LAST_EMAIL_STORAGE_KEY = "appointment-reminder:last-sent-email-html";
const WIZARD_STEP_STORAGE_KEY = "appointment-reminder:wizard-step";
const BRANDING_TEMPLATE_MODULE_PATH = "./branding-templates.js?v=20260429c";
const CUSTOM_FORM_MODULE_PATH = "./custom-form-profile.js?v=20260429d";
const DEFAULT_BACKGROUND_STYLE = "gradient";
const DEFAULT_BACKGROUND_SOLID_COLOR = "#182131";
const DEFAULT_FORM_SURFACE_COLOR = "#f6f8fc";
const DEFAULT_FORM_SURFACE_ACCENT_COLOR = "#ffffff";
const DEFAULT_FORM_SURFACE_GRADIENT = "solid";
const DEFAULT_FORM_SURFACE_SHINE_ENABLED = true;
const DEFAULT_FORM_SURFACE_SHINE_COLOR = "#ffffff";
const DEFAULT_FORM_SURFACE_SHAPE = "rounded";
const DEFAULT_FORM_SURFACE_LAYOUT = "compact";
const DEFAULT_FORM_TEXT_COLOR = "#111827";
const DEFAULT_QUESTION_SURFACE_COLOR = "#f8fafc";
const DEFAULT_QUESTION_TEXT_COLOR = "#111827";
const DEFAULT_FIELD_INPUT_TEXT_COLOR = "#111827";
const DEFAULT_FIELD_PLACEHOLDER_COLOR = "#6b7280";
const DEFAULT_FORM_TITLE_FONT_SIZE = 12;
const DEFAULT_STEP_TITLE_FONT_SIZE = 36;
const DEFAULT_STEP_COPY_FONT_SIZE = 15;
const DEFAULT_FIELD_LABEL_FONT_SIZE = 16;
const DEFAULT_FIELD_HELP_FONT_SIZE = 13;
const DEFAULT_STEP_NAV_BACKGROUND = "#f8fafc";
const DEFAULT_STEP_NAV_ACTIVE_BACKGROUND = "#dbeafe";
const DEFAULT_STEP_NAV_TEXT_COLOR = "#0f172a";
const DEFAULT_STEP_NAV_ACTIVE_TEXT_COLOR = "#1d4ed8";
const DEFAULT_STEP_NAV_SHAPE = "rounded";
const DEFAULT_STEP_NAV_SIZE = "medium";
const DEFAULT_STEP_NAV_PLACEMENT = "below-title";
const DEFAULT_STEP_NAV_CLICKABLE = true;
const DEFAULT_STEP_MOTION_STYLE = "slide-horizontal";
const DEFAULT_STEP_MOTION_SPEED = "smooth";
const DEFAULT_STEP_HEAD_MOTION = "lift";
const DEFAULT_STEP_CHIP_MOTION = "pop";
const BRONZE_REVIEW_PREVIEW_WIDTH = 664;
const BRONZE_REVIEW_PREVIEW_MAX_HEIGHT = 1120;
const BRONZE_REVIEW_PREVIEW_MAX_HEIGHT_MOBILE = 520;
const BRONZE_REVIEW_PREVIEW_MIN_HEIGHT = 180;
const BRONZE_REVIEW_PREVIEW_MIN_HEIGHT_MOBILE = 140;
const BRONZE_REVIEW_MAX_SCALE_DESKTOP = 0.9;
const BRONZE_REVIEW_MAX_SCALE_MOBILE = 0.62;
const PREVIEW_SCROLL_HINT_TEXT = "Scroll to review the rest of the message.";
const PREVIEW_FALLBACK_HINT_TEXT = "We couldn't load the branded preview, so review this plain message before sending.";

let currentStepIndex = 0;
let wizardSteps = [];
let visitedSteps = [];
let lastAddressLookup = "";
let copyEmailDirty = false;
let sendEmailResetTimer = null;
let sendStatusResetTimer = null;
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
let pendingClientProfilePrefillAnswers = {};
let latestSignedInUserSyncInFlight = false;
let liveFormFieldValueCache = new Map();
let pendingReminderClientPrefill = null;
let lastCustomFormSyncSignature = "";
let customFormLoadingExitTimer = null;

function getSharedSupabaseClient(supabaseUrl, publicKey, createClient) {
  const clientKey = `${supabaseUrl}::${publicKey}`;
  window.__appointmentReminderSupabaseClients = window.__appointmentReminderSupabaseClients || new Map();

  if (!window.__appointmentReminderSupabaseClients.has(clientKey)) {
    window.__appointmentReminderSupabaseClients.set(clientKey, createClient(supabaseUrl, publicKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    }));
  }

  return window.__appointmentReminderSupabaseClients.get(clientKey);
}

function setCustomFormLoading(isLoading) {
  window.clearTimeout(customFormLoadingExitTimer);
  customFormLoadingExitTimer = null;

  if (isLoading) {
    document.body.classList.remove("custom-form-loading-exiting", "custom-form-loaded");
    document.body.classList.add("custom-form-loading");
    document.body.setAttribute("aria-busy", "true");
    return;
  }

  document.body.setAttribute("aria-busy", "false");

  if (!document.body.classList.contains("custom-form-loading")) {
    document.body.classList.remove("custom-form-loading-exiting");
    document.body.classList.add("custom-form-loaded");
    return;
  }

  document.body.classList.add("custom-form-loading-exiting");
  document.body.classList.remove("custom-form-loading");
  customFormLoadingExitTimer = window.setTimeout(() => {
    document.body.classList.remove("custom-form-loading-exiting");
    document.body.classList.add("custom-form-loaded");
    customFormLoadingExitTimer = null;
  }, 780);
}

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
    title: "Business Contact Information",
    navLabel: "Contact",
    copy: "This is the contact information your client will see in the reminder.",
    label: "Business Contact Information",
    helpText: "Use the phone number or email the client should use if they need to reschedule or reach you.",
    placeholder: "Business phone or email",
    required: false
  },
  notes: {
    title: "Appointment Notes",
    navLabel: "Notes",
    copy: "Add appointment notes you want the client to see.",
    label: "Appointment Notes",
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
    appSupabase = getSharedSupabaseClient(appPublicConfig.supabaseUrl, publicKey, createClient);

    const {
      data: { session }
    } = await appSupabase.auth.getSession();

    currentSignedInUser = session?.user || null;
    currentAuthUserId = session?.user?.id || "";
    renderBronzeFeatures();
    updateDraftPreviewChrome();
    await syncCustomFormFromUser(currentSignedInUser);
    await hydrateReminderPrefillFromSelectedClient();
    setCustomFormLoading(false);
    if (session?.user) {
      syncLatestSignedInUser({ silent: true });
    }

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
  } finally {
    setCustomFormLoading(false);
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

function getFieldVisibility(field = {}) {
  const visibility = String(field?.visibleTo || "both").trim();
  return ["both", "staff", "client"].includes(visibility) ? visibility : "both";
}

function isFieldVisibleForStaff(field = {}) {
  return getFieldVisibility(field) !== "client";
}

function shouldIncludeFieldInReminder(field = {}) {
  return field?.includeInReminder !== false;
}

function shouldIncludeBuiltInAnswerInReminder(fieldId) {
  const normalizedFieldId = String(fieldId || "").trim();
  const mappedField = activeCustomFormFields.find(field => String(field?.semanticId || "").trim() === normalizedFieldId);

  if (mappedField) {
    return shouldIncludeFieldInReminder(mappedField);
  }

  const override = activeCustomFormProfile?.stepOverrides?.[normalizedFieldId] || {};
  return override.includeInReminder !== false;
}

function getFormControlValue(element) {
  if (!element) {
    return "";
  }

  if (element instanceof HTMLInputElement && element.type === "checkbox") {
    return element.checked ? "true" : "";
  }

  return typeof element.value === "string" ? element.value : "";
}

function setCachedFieldValue(fieldId, value) {
  const normalizedFieldId = String(fieldId || "").trim();

  if (!normalizedFieldId) {
    return;
  }

  liveFormFieldValueCache.set(normalizedFieldId, String(value ?? ""));
}

function cacheFormControlValue(element) {
  const fieldId = String(element?.id || "").trim();

  if (!fieldId) {
    return;
  }

  setCachedFieldValue(fieldId, getFormControlValue(element));
}

function snapshotWizardFieldValues() {
  document.querySelectorAll(".wizard-step input[id], .wizard-step textarea[id], .wizard-step select[id]").forEach(element => {
    cacheFormControlValue(element);
  });
}

function restoreWizardFieldValuesFromCache() {
  document.querySelectorAll(".wizard-step input[id], .wizard-step textarea[id], .wizard-step select[id]").forEach(element => {
    const fieldId = String(element.id || "").trim();

    if (!fieldId || !liveFormFieldValueCache.has(fieldId)) {
      return;
    }

    const cachedValue = liveFormFieldValueCache.get(fieldId) || "";

    if (element instanceof HTMLInputElement && element.type === "checkbox") {
      element.checked = cachedValue === "true";
      return;
    }

    if (element.value !== cachedValue) {
      element.value = cachedValue;
    }

    if (isPhoneLikeField(fieldId)) {
      element.value = formatPhoneNumber(element.value);
    }
  });
}

function getDirectFieldValue(fieldId) {
  const element = document.getElementById(fieldId);
  return element && typeof element.value === "string" ? element.value.trim() : "";
}

function getCachedFieldValue(fieldId) {
  return String(liveFormFieldValueCache.get(String(fieldId || "").trim()) || "").trim();
}

function getFieldSearchText(field) {
  return [
    field?.id,
    field?.semanticId,
    field?.label,
    field?.title,
    field?.navLabel,
    field?.helpText,
    field?.copy
  ]
    .map(value => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

function getRenderedFieldCandidates() {
  const candidates = [];

  document.querySelectorAll(".wizard-step input[id], .wizard-step textarea[id], .wizard-step select[id]").forEach(element => {
    const stepElement = element.closest(".wizard-step");
    const stepField = String(stepElement?.dataset?.field || "").trim();

    if (!stepField || ["consent", "review", "welcome", "thankyou"].includes(stepField)) {
      return;
    }

    const rawValue = getFormControlValue(element).trim();

    if (!rawValue) {
      return;
    }

    const fieldGroup = element.closest(".wizard-field-group");
    const labelText = fieldGroup?.querySelector("label")?.textContent || "";
    const helpText = fieldGroup?.querySelector(".field-note")?.textContent || "";
    const elementType = element.tagName === "TEXTAREA"
      ? "textarea"
      : element.tagName === "SELECT"
        ? "select"
        : String(element.getAttribute("type") || getCustomFieldConfig(element.id)?.type || "text").trim().toLowerCase();

    candidates.push({
      id: String(element.id || "").trim(),
      type: elementType,
      stepField,
      label: String(labelText || "").trim(),
      helpText: String(helpText || "").trim(),
      stepTitle: String(stepElement?.dataset?.title || "").trim(),
      stepNav: String(stepElement?.dataset?.nav || "").trim(),
      stepCopy: String(stepElement?.dataset?.copy || "").trim(),
      value: rawValue
    });
  });

  return candidates;
}

function getRenderedFieldSearchText(candidate) {
  return [
    candidate?.id,
    candidate?.label,
    candidate?.helpText,
    candidate?.stepField,
    candidate?.stepTitle,
    candidate?.stepNav,
    candidate?.stepCopy
  ]
    .map(value => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

function scoreRenderedFieldKeywords(candidate, keywords = []) {
  const haystack = getRenderedFieldSearchText(candidate);

  return keywords.reduce((score, keyword) => {
    return haystack.includes(keyword) ? score + 1 : score;
  }, 0);
}

function getRenderedFieldValueFallback(fieldId) {
  let bestValue = "";
  let bestScore = 0;

  getRenderedFieldCandidates().forEach(candidate => {
    let score = 0;

    if (candidate.id === fieldId) {
      score += 200;
    }

    if (candidate.stepField === fieldId) {
      score += 180;
    }

    if (fieldId === "phone") {
      score += candidate.type === "phone" || candidate.type === "tel" ? 90 : 0;
      score += scoreRenderedFieldKeywords(candidate, ["phone", "mobile", "cell"]) * 16;
    } else if (fieldId === "email") {
      score += candidate.type === "email" ? 90 : 0;
      score += scoreRenderedFieldKeywords(candidate, ["email", "e-mail"]) * 16;
    } else if (fieldId === "date") {
      score += candidate.type === "date" ? 90 : 0;
      score += scoreRenderedFieldKeywords(candidate, ["date", "service date", "appointment date"]) * 16;
    } else if (fieldId === "time") {
      score += candidate.type === "time" ? 90 : 0;
      score += scoreRenderedFieldKeywords(candidate, ["time", "service time", "appointment time"]) * 16;
    } else if (fieldId === "name") {
      score += candidate.type === "text" ? 12 : 0;
      score += scoreRenderedFieldKeywords(candidate, ["name", "client name", "customer name"]) * 18;
    } else if (fieldId === "address") {
      score += ["text", "textarea"].includes(candidate.type) ? 12 : 0;
      score += scoreRenderedFieldKeywords(candidate, ["address", "location", "service location", "property", "job site"]) * 18;
    } else if (fieldId === "businessContact") {
      score += ["text", "email", "phone", "tel"].includes(candidate.type) ? 12 : 0;
      score += scoreRenderedFieldKeywords(candidate, ["business contact", "contact", "reach us", "reschedule", "business phone", "business email"]) * 18;
    } else if (fieldId === "notes") {
      score += candidate.type === "textarea" ? 24 : 0;
      score += scoreRenderedFieldKeywords(candidate, ["appointment notes", "additional details", "details", "notes", "instructions", "message"]) * 18;
    }

    if (score > bestScore) {
      bestScore = score;
      bestValue = candidate.value;
    }
  });

  return bestValue;
}

function getRenderedPrefillTargets() {
  return Array.from(document.querySelectorAll(".wizard-step input[id], .wizard-step textarea[id], .wizard-step select[id]")).map(element => {
    const stepElement = element.closest(".wizard-step");
    const fieldGroup = element.closest(".wizard-field-group");

    return {
      element,
      id: String(element.id || "").trim(),
      type: element.tagName === "TEXTAREA"
        ? "textarea"
        : element.tagName === "SELECT"
          ? "select"
          : String(element.getAttribute("type") || getCustomFieldConfig(element.id)?.type || "text").trim().toLowerCase(),
      stepField: String(stepElement?.dataset?.field || "").trim(),
      label: String(fieldGroup?.querySelector("label")?.textContent || "").trim(),
      helpText: String(fieldGroup?.querySelector(".field-note")?.textContent || "").trim(),
      stepTitle: String(stepElement?.dataset?.title || "").trim(),
      stepNav: String(stepElement?.dataset?.nav || "").trim(),
      stepCopy: String(stepElement?.dataset?.copy || "").trim()
    };
  }).filter(target => target.id && !["consent", "review", "welcome", "thankyou"].includes(target.stepField));
}

function scoreRenderedPrefillTarget(fieldId, target) {
  let score = 0;
  const semanticFieldId = String(getCustomFieldConfig(target.id)?.semanticId || "").trim();

  if (target.id === fieldId) {
    score += 240;
  }

  if (target.stepField === fieldId) {
    score += 210;
  }

  if (semanticFieldId && semanticFieldId === fieldId) {
    score += 260;
  }

  if (fieldId === "phone") {
    score += target.type === "phone" || target.type === "tel" ? 90 : 0;
    score += scoreRenderedFieldKeywords(target, ["phone", "mobile", "cell"]) * 16;
  } else if (fieldId === "email") {
    score += target.type === "email" ? 90 : 0;
    score += scoreRenderedFieldKeywords(target, ["email", "e-mail"]) * 16;
  } else if (fieldId === "date") {
    score += target.type === "date" ? 90 : 0;
    score += scoreRenderedFieldKeywords(target, ["date", "service date", "appointment date"]) * 16;
  } else if (fieldId === "time") {
    score += target.type === "time" ? 90 : 0;
    score += scoreRenderedFieldKeywords(target, ["time", "service time", "appointment time"]) * 16;
  } else if (fieldId === "name") {
    score += target.type === "text" ? 12 : 0;
    score += scoreRenderedFieldKeywords(target, ["name", "client name", "customer name"]) * 18;
  } else if (fieldId === "address") {
    score += ["text", "textarea"].includes(target.type) ? 12 : 0;
    score += scoreRenderedFieldKeywords(target, ["address", "location", "service location", "property", "job site"]) * 18;
  } else if (fieldId === "businessContact") {
    score += ["text", "email", "phone", "tel"].includes(target.type) ? 12 : 0;
    score += scoreRenderedFieldKeywords(target, ["business contact", "contact", "reach us", "reschedule", "business phone", "business email"]) * 18;
  } else if (fieldId === "notes") {
    score += target.type === "textarea" ? 24 : 0;
    score += scoreRenderedFieldKeywords(target, ["appointment notes", "additional details", "details", "notes", "instructions", "message"]) * 18;
  }

  return score;
}

function applySinglePrefillFieldValue(fieldId, value) {
  const normalizedValue = String(value || "").trim();

  if (!fieldId || !normalizedValue) {
    return;
  }

  setCachedFieldValue(fieldId, normalizedValue);

  const exactElement = document.getElementById(fieldId);

  if (exactElement && !getFormControlValue(exactElement).trim()) {
    exactElement.value = isPhoneLikeField(fieldId) ? formatPhoneNumber(normalizedValue) : normalizedValue;
    cacheFormControlValue(exactElement);
  }

  let bestTarget = null;
  let bestScore = 0;

  getRenderedPrefillTargets().forEach(target => {
    if (target.id === fieldId) {
      return;
    }

    const score = scoreRenderedPrefillTarget(fieldId, target);

    if (score > bestScore) {
      bestScore = score;
      bestTarget = target;
    }
  });

  if (!bestTarget || bestScore < 48 || getFormControlValue(bestTarget.element).trim()) {
    return;
  }

  bestTarget.element.value = isPhoneLikeField(fieldId) || bestTarget.type === "phone" || bestTarget.type === "tel"
    ? formatPhoneNumber(normalizedValue)
    : normalizedValue;
  cacheFormControlValue(bestTarget.element);
}

function scoreFieldKeywords(field, keywords = []) {
  const haystack = getFieldSearchText(field);

  return keywords.reduce((score, keyword) => {
    return haystack.includes(keyword) ? score + 1 : score;
  }, 0);
}

function getSemanticFieldFallbackValue(fieldId) {
  const renderedFallback = getRenderedFieldValueFallback(fieldId);

  if (renderedFallback) {
    return renderedFallback;
  }

  const scoreField = {
    phone(field) {
      return (field.type === "phone" ? 120 : 0)
        + (scoreFieldKeywords(field, ["phone", "mobile", "cell"]) * 16);
    },
    email(field) {
      return (field.type === "email" ? 120 : 0)
        + (scoreFieldKeywords(field, ["email", "e-mail"]) * 16);
    },
    date(field) {
      return (field.type === "date" ? 120 : 0)
        + (scoreFieldKeywords(field, ["date", "service date", "appointment date"]) * 14);
    },
    time(field) {
      return (field.type === "time" ? 120 : 0)
        + (scoreFieldKeywords(field, ["time", "service time", "appointment time"]) * 14);
    },
    name(field) {
      return (field.type === "text" ? 18 : 0)
        + (scoreFieldKeywords(field, ["name", "client name", "customer name"]) * 20);
    },
    address(field) {
      return ((field.type === "text" || field.type === "textarea") ? 18 : 0)
        + (scoreFieldKeywords(field, ["address", "location", "service location", "job site", "property"]) * 18);
    },
    businessContact(field) {
      return ((field.type === "text" || field.type === "email" || field.type === "phone") ? 18 : 0)
        + (scoreFieldKeywords(field, ["business contact", "contact", "reach us", "reschedule", "business phone", "business email"]) * 18);
    },
    notes(field) {
      return (field.type === "textarea" ? 36 : 0)
        + (scoreFieldKeywords(field, ["appointment notes", "additional details", "details", "notes", "instructions", "message"]) * 18);
    }
  }[fieldId];

  if (typeof scoreField !== "function") {
    return "";
  }

  let bestMatch = "";
  let bestScore = 0;

  activeCustomFormFields.forEach(field => {
    const value = getDirectFieldValue(field.id) || getCachedFieldValue(field.id);

    if (!value) {
      return;
    }

    const score = scoreField(field) + (String(field.semanticId || "").trim() === fieldId ? 260 : 0);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = value;
    }
  });

  return bestMatch;
}

function isPhoneLikeField(fieldId) {
  if (fieldId === "phone") {
    return true;
  }

  return getCustomFieldConfig(fieldId)?.type === "phone";
}

function isContentBlockFieldType(type = "") {
  return ["content-text", "content-image", "content-divider"].includes(String(type || "").trim());
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

function isDefaultRememberedClientField(fieldId) {
  return DEFAULT_REMEMBERED_CLIENT_FIELD_IDS.has(String(fieldId || "").trim());
}

function shouldRememberClientAnswerField(field) {
  const fieldId = String(field?.id || "").trim();

  if (!fieldId) {
    return false;
  }

  const customField = getCustomFieldConfig(fieldId);

  if (customField) {
    return customField.rememberClientAnswer === true;
  }

  const builtInOverride = activeCustomFormProfile?.stepOverrides?.[fieldId] || null;

  if (builtInOverride && typeof builtInOverride.rememberClientAnswer === "boolean") {
    return builtInOverride.rememberClientAnswer;
  }

  return isDefaultRememberedClientField(fieldId);
}

function normalizeClientProfileAnswerMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce((accumulator, [fieldId, rawAnswer]) => {
    const normalizedFieldId = String(rawAnswer?.field_id || fieldId || "").trim();
    const displayValue = String(rawAnswer?.display_value ?? rawAnswer?.raw_value ?? rawAnswer?.value ?? "").trim();

    if (!normalizedFieldId || !displayValue) {
      return accumulator;
    }

    accumulator[normalizedFieldId] = {
      ...rawAnswer,
      field_id: normalizedFieldId,
      display_value: displayValue,
      raw_value: String(rawAnswer?.raw_value ?? rawAnswer?.value ?? displayValue).trim(),
      value: String(rawAnswer?.value ?? rawAnswer?.raw_value ?? displayValue).trim()
    };
    return accumulator;
  }, {});
}

function normalizeReminderPrefillPayload(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const id = String(value?.id || "").trim();
  const name = String(value?.name || "").trim();
  const email = String(value?.email || "").trim();
  const phone = String(value?.phone || "").trim();
  const address = String(value?.address || "").trim();
  const profileCustomAnswers = normalizeClientProfileAnswerMap(value?.profileCustomAnswers);

  if (!id && !name && !email && !phone && !address && !Object.keys(profileCustomAnswers).length) {
    return null;
  }

  return {
    id,
    name,
    email,
    phone,
    address,
    profileCustomAnswers
  };
}

function getStoredReminderPrefillPayload() {
  const storageCandidates = [
    window.sessionStorage,
    window.localStorage
  ];

  for (const storage of storageCandidates) {
    try {
      const rawValue = storage.getItem(REMINDER_PREFILL_KEY);

      if (!rawValue) {
        continue;
      }

      const parsed = normalizeReminderPrefillPayload(JSON.parse(rawValue));

      if (parsed) {
        return parsed;
      }
    } catch (error) {
      console.warn("Unable to read saved reminder prefill.", error);
    }
  }

  return null;
}

function clearStoredReminderPrefill() {
  try {
    window.sessionStorage.removeItem(REMINDER_PREFILL_KEY);
  } catch (error) {
    console.warn("Unable to clear reminder session prefill.", error);
  }

  try {
    window.localStorage.removeItem(REMINDER_PREFILL_KEY);
  } catch (error) {
    console.warn("Unable to clear reminder local prefill.", error);
  }
}

function getReminderPrefillClientIdFromUrl() {
  try {
    return String(new URLSearchParams(window.location.search).get(REMINDER_PREFILL_QUERY_PARAM) || "").trim();
  } catch (error) {
    return "";
  }
}

function clearReminderPrefillClientIdFromUrl() {
  try {
    const url = new URL(window.location.href);

    if (!url.searchParams.has(REMINDER_PREFILL_QUERY_PARAM)) {
      return;
    }

    url.searchParams.delete(REMINDER_PREFILL_QUERY_PARAM);
    const nextSearch = url.searchParams.toString();
    const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash || ""}`;
    window.history.replaceState({}, document.title, nextUrl);
  } catch (error) {
    console.warn("Unable to clear reminder prefill query param.", error);
  }
}

function getFieldPageTitle(field, fallbackStep) {
  const pageId = String(field?.pageId || field?.id || fallbackStep?.id || "").trim();
  const matchingStep = getOrderedActiveSteps().find(step => String(step?.id || "").trim() === pageId);
  return String(matchingStep?.title || fallbackStep?.title || field?.title || field?.label || "").trim();
}

function buildCustomFieldAnswerSnapshots() {
  const answers = [];
  const seenFieldIds = new Set();

  getOrderedActiveSteps().forEach(step => {
    const includeBaseField = step.type !== "page" && !BASE_FORM_FIELD_IDS.includes(step.id);
    const orderedFields = getOrderedFieldsForPage(step.id, includeBaseField ? step : null);

    orderedFields.forEach(field => {
      const semanticFieldId = String(field.semanticId || "").trim();

      if (BASE_FORM_FIELD_IDS.includes(field.id) || BASE_FORM_FIELD_IDS.includes(semanticFieldId) || seenFieldIds.has(field.id) || isContentBlockFieldType(field.type)) {
        return;
      }

      seenFieldIds.add(field.id);

      const rawValue = getFieldValue(field.id);
      const formattedValue = formatCustomFieldDisplayValue(field, rawValue);

      if (!formattedValue) {
        return;
      }

      answers.push({
        field_id: String(field.id || "").trim(),
        label: String(field.label || field.title || "Custom Question").trim(),
        type: String(field.type || "text").trim(),
        include_in_reminder: shouldIncludeFieldInReminder(field),
        visible_to: getFieldVisibility(field),
        save_target: String(field.saveTarget || "appointment_details").trim(),
        page_id: String(field.pageId || step.id || "").trim(),
        page_title: getFieldPageTitle(field, step),
        raw_value: String(rawValue || "").trim(),
        display_value: formattedValue,
        captured_at: new Date().toISOString()
      });
    });
  });

  return answers;
}

function buildRememberedClientAnswerSnapshots({ appointmentId = "" } = {}) {
  const serviceDate = getFieldValue("date");

  return buildCustomFieldAnswerSnapshots()
    .filter(answer => shouldRememberClientAnswerField({ id: answer.field_id }))
    .reduce((accumulator, answer) => {
      accumulator[answer.field_id] = {
        ...answer,
        source_appointment_id: String(appointmentId || "").trim(),
        source_service_date: serviceDate || "",
        updated_at: new Date().toISOString()
      };
      return accumulator;
    }, {});
}

function applyPendingClientProfilePrefill() {
  if (!pendingClientProfilePrefillAnswers || typeof pendingClientProfilePrefillAnswers !== "object") {
    return;
  }

  const remainingAnswers = {};

  Object.entries(pendingClientProfilePrefillAnswers).forEach(([fieldId, rawAnswer]) => {
    const normalizedFieldId = String(rawAnswer?.field_id || fieldId || "").trim();

    if (!normalizedFieldId) {
      return;
    }

    const element = document.getElementById(normalizedFieldId);

    if (!element) {
      remainingAnswers[normalizedFieldId] = rawAnswer;
      return;
    }

    const nextValue = String(rawAnswer?.raw_value ?? rawAnswer?.value ?? "").trim();
    const fieldType = String(rawAnswer?.type || getCustomFieldConfig(normalizedFieldId)?.type || "").trim().toLowerCase();

    element.value = fieldType === "phone" ? formatPhoneNumber(nextValue) : nextValue;
    cacheFormControlValue(element);
  });

  pendingClientProfilePrefillAnswers = remainingAnswers;
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

function getMainWizardShell() {
  return document.querySelector(".wizard-shell");
}

function getFormLogoWrap() {
  return document.getElementById("form-logo-wrap");
}

function getFormLogoImage() {
  return document.getElementById("form-logo-image");
}

function getThankYouShell() {
  return document.getElementById("thank-you-shell");
}

function getThankYouTitleElement() {
  return document.getElementById("thank-you-title");
}

function getThankYouCopyElement() {
  return document.getElementById("thank-you-copy");
}

function getThankYouButtonElement() {
  return document.getElementById("thank-you-reset");
}

function buildWelcomeWizardStepMarkup(profile = activeCustomFormProfile || {}) {
  const title = String(profile?.welcomeTitle || "Welcome").trim() || "Welcome";
  const copy = String(profile?.welcomeCopy || "Answer a few quick questions so we can personalize your reminder.").trim();
  const cta = String(profile?.welcomeButtonText || "Start").trim() || "Start";

  return `
    <div class="wizard-step custom-wizard-step wizard-step-screen" data-step-kind="welcome" data-title="${escapeHtml(title)}" data-nav="Start" data-field="welcome" data-copy="${escapeHtml(copy)}" data-optional="false" data-cta="${escapeHtml(cta)}">
      <div class="question-wrap screen-question-wrap">
        <div class="wizard-screen-content">
          <span class="wizard-screen-kicker">Welcome screen</span>
          <button class="wizard-screen-button" type="button" data-wizard-start-button>${escapeHtml(cta)}</button>
        </div>
      </div>
    </div>
  `;
}

function hideThankYouScreen() {
  const thankYouShell = getThankYouShell();
  const wizardShell = getMainWizardShell();

  if (thankYouShell) {
    thankYouShell.hidden = true;
  }

  if (wizardShell) {
    wizardShell.hidden = false;
  }
}

function showThankYouScreen() {
  const profile = activeCustomFormProfile;
  const thankYouShell = getThankYouShell();
  const wizardShell = getMainWizardShell();

  if (!thankYouShell || !profile?.thankYouScreenEnabled) {
    return false;
  }

  const title = String(profile.thankYouTitle || "You're all set").trim() || "You're all set";
  const copy = String(profile.thankYouCopy || "Your reminder details are ready to send.").trim()
    || "Your reminder details are ready to send.";
  const buttonText = String(profile.thankYouButtonText || "Create another reminder").trim()
    || "Create another reminder";
  const titleElement = getThankYouTitleElement();
  const copyElement = getThankYouCopyElement();
  const buttonElement = getThankYouButtonElement();

  if (titleElement) {
    titleElement.textContent = title;
    titleElement.style.fontSize = `${Number(profile.thankYouTitleFontSize) || DEFAULT_STEP_TITLE_FONT_SIZE}px`;
    titleElement.style.fontWeight = profile.thankYouTitleBold === false ? "500" : "800";
  }

  if (copyElement) {
    copyElement.textContent = copy;
    copyElement.style.fontSize = `${Number(profile.thankYouCopyFontSize) || DEFAULT_STEP_COPY_FONT_SIZE}px`;
    copyElement.style.fontWeight = profile.thankYouCopyBold ? "800" : "500";
  }

  if (buttonElement) {
    buttonElement.textContent = buttonText;
  }

  if (wizardShell) {
    wizardShell.hidden = true;
  }

  thankYouShell.hidden = false;
  return true;
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

function legacyGeneratePreviewSubject() {
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

function getBuiltInFieldLabel(fieldId) {
  const defaultLabel = BUILT_IN_FORM_STEP_DEFAULTS[fieldId]?.label || "";
  const overrideLabel = activeCustomFormProfile?.stepOverrides?.[fieldId]?.label;
  return String(overrideLabel || defaultLabel).trim();
}

function getAppointmentNotesLabel() {
  return getBuiltInFieldLabel("notes") || "Appointment Notes";
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
  const customFieldItems = Array.from(frameDocument.querySelectorAll('[data-review-edit="custom-field-value"]'))
    .map(element => ({
      label: String(element.dataset.fieldLabel || "").trim(),
      value: getEditableFrameText(element)
    }))
    .filter(item => item.label && item.value);
  const detailsContainer = frameDocument.querySelector('[data-preview-area="details"]');
  const detailText = getEditableFrameText(frameDocument.querySelector('[data-review-edit="details"]'));
  const detailLabel = String(detailsContainer?.dataset.detailsLabel || getAppointmentNotesLabel()).trim() || "Appointment Notes";
  const bodyParagraphs = Array.from(frameDocument.querySelectorAll('[data-review-edit="body-paragraph"]'))
    .map(getEditableFrameText)
    .filter(Boolean);
  const contactPrompt = getEditableFrameText(frameDocument.querySelector('[data-review-edit="contact"]'));
  const closing = getEditableFrameText(frameDocument.querySelector('[data-review-edit="closing"]')) || "Thank you.";
  const summaryItems = Array.from(frameDocument.querySelectorAll('[data-preview-area="summary"] > *')).map(cell => {
    const parts = Array.from(cell.querySelectorAll("div, span")).map(getEditableFrameText).filter(Boolean);
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

  customFieldItems.forEach(item => {
    lines.push("");

    if (item.value.includes("\n")) {
      lines.push(`${item.label}:`);
      lines.push(item.value);
      return;
    }

    lines.push(`${item.label}: ${item.value}`);
  });

  if (detailText) {
    lines.push("");
    lines.push(`${detailLabel}:`);
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

function clearBronzePreviewContentWatchers(frame) {
  if (!frame) {
    return;
  }

  const cleanup = frame.__bronzePreviewCleanup;

  if (typeof cleanup === "function") {
    cleanup();
  }

  frame.__bronzePreviewCleanup = null;
}

function bindBronzePreviewContentWatchers(frame, frameDocument, frameWindow, currentToken) {
  if (!frame || !frameDocument || !frameWindow) {
    return;
  }

  clearBronzePreviewContentWatchers(frame);

  const cleanupCallbacks = [];
  const scheduleIfCurrent = () => {
    if (currentToken !== bronzePreviewRenderToken) {
      return;
    }

    scheduleBronzePreviewScaleBurst();
  };

  if (typeof frameWindow.ResizeObserver === "function") {
    const resizeObserver = new frameWindow.ResizeObserver(() => {
      scheduleIfCurrent();
    });
    const resizeTargets = [
      frameDocument.documentElement,
      frameDocument.body,
      frameDocument.body?.lastElementChild
    ].filter(Boolean);

    resizeTargets.forEach(target => {
      resizeObserver.observe(target);
    });

    cleanupCallbacks.push(() => {
      resizeObserver.disconnect();
    });
  }

  frameDocument.querySelectorAll("img").forEach(image => {
    if (image.complete) {
      return;
    }

    const handleLoad = () => {
      scheduleIfCurrent();
    };

    image.addEventListener("load", handleLoad, { once: true });
    image.addEventListener("error", handleLoad, { once: true });

    cleanupCallbacks.push(() => {
      image.removeEventListener("load", handleLoad);
      image.removeEventListener("error", handleLoad);
    });
  });

  frame.__bronzePreviewCleanup = () => {
    cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.warn("Unable to clean up bronze preview watcher.", error);
      }
    });
  };
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
  const visibleHeight = Math.min(scaledHeight, maxPreviewHeight);

  frame.style.width = `${BRONZE_REVIEW_PREVIEW_WIDTH}px`;
  frame.style.height = `${contentHeight}px`;
  frame.style.transform = `scale(${scale})`;
  stage.style.height = `${scaledHeight}px`;
  shell.style.height = `${visibleHeight}px`;
  shell.style.maxHeight = `${maxPreviewHeight}px`;
  shell.classList.toggle("is-scrollable", scaledHeight > visibleHeight + 6);
  shell.style.setProperty("--bronze-preview-scale", String(scale));
  shell.style.setProperty("--bronze-preview-height", `${scaledHeight}px`);
}

function showPlainReviewPreviewFallback(message, error) {
  const preview = document.getElementById("preview");
  const previewHint = document.getElementById("preview-hint");
  const bronzePreviewShell = getBronzePreviewShell();
  const bronzePreviewHint = getBronzePreviewHint();
  const previewBodyShell = getPreviewBodyShell();
  const reviewDraftCard = getReviewDraftCard();
  const bronzePreviewEditorWrap = getBronzePreviewEditorWrap();
  const frame = getBronzePreviewFrame();

  if (error) {
    console.warn("Unable to render branded email preview.", error);
  }

  if (frame) {
    clearBronzePreviewContentWatchers(frame);
    frame.onload = null;
    frame.srcdoc = "";
  }

  if (preview) {
    preview.hidden = false;
    preview.readOnly = true;
    preview.classList.remove("is-bronze-editor");
    preview.value = message || getGeneratedReviewMessage();
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
    bronzePreviewEditorWrap.classList.add("visible");
  }

  if (bronzePreviewHint) {
    bronzePreviewHint.classList.remove("visible");
    bronzePreviewHint.hidden = true;
  }

  updatePreviewLayout();

  if (previewHint) {
    previewHint.textContent = PREVIEW_FALLBACK_HINT_TEXT;
    previewHint.classList.add("visible");
  }
}

async function renderBronzeReviewPreview(message) {
  const frame = getBronzePreviewFrame();

  if (!frame) {
    return;
  }

  clearBronzePreviewContentWatchers(frame);

  const currentToken = ++bronzePreviewRenderToken;
  let module;
  let html;

  try {
    module = await getBrandingTemplateModule();

    if (currentToken !== bronzePreviewRenderToken) {
      return;
    }

    html = module.buildReminderEmailHtml({
      message,
      calendarLinks: buildReviewPreviewCalendarLinks(message),
      brandingProfile: getSavedBrandingProfile(),
      previewMode: true
    });
  } catch (error) {
    if (currentToken === bronzePreviewRenderToken) {
      showPlainReviewPreviewFallback(message, error);
    }
    return;
  }

  frame.onload = () => {
    if (currentToken !== bronzePreviewRenderToken) {
      return;
    }

    try {
      const frameDocument = frame.contentDocument;
      const frameWindow = frame.contentWindow;

      if (!frameDocument || !frameWindow) {
        throw new Error("Branded preview frame did not load.");
      }

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

      bindBronzePreviewContentWatchers(frame, frameDocument, frameWindow, currentToken);

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

      refreshBronzePreviewObservers();
      frameWindow.requestAnimationFrame(() => {
        frameWindow.requestAnimationFrame(() => {
          syncBronzePreviewScale();
        });
      });
      scheduleBronzePreviewScaleBurst();
    } catch (error) {
      if (currentToken === bronzePreviewRenderToken) {
        showPlainReviewPreviewFallback(message, error);
      }
    }
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

    if (previewHint) {
      previewHint.textContent = PREVIEW_SCROLL_HINT_TEXT;
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
    previewHint.textContent = PREVIEW_SCROLL_HINT_TEXT;
    previewHint.classList.remove("visible");
  }

  if (bronzePreviewHint) {
    bronzePreviewHint.hidden = false;
    bronzePreviewHint.classList.add("visible");
  }

  renderBronzeReviewPreview(message);
}

function getFieldValue(id) {
  const directValue = getDirectFieldValue(id);

  if (directValue) {
    setCachedFieldValue(id, directValue);
    return directValue;
  }

  const cachedValue = getCachedFieldValue(id);

  if (cachedValue) {
    return cachedValue;
  }

  return getSemanticFieldFallbackValue(id);
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
  cacheFormControlValue(phoneInput);
}

function applyReminderClientPrefillPayload(prefillPayload) {
  const normalizedPayload = normalizeReminderPrefillPayload(prefillPayload);

  if (!normalizedPayload) {
    return false;
  }

  pendingReminderClientPrefill = normalizedPayload;
  linkedPrefillClientId = normalizedPayload.id || linkedPrefillClientId;
  pendingClientProfilePrefillAnswers = {
    ...pendingClientProfilePrefillAnswers,
    ...normalizedPayload.profileCustomAnswers
  };

  const mappedFields = {
    name: normalizedPayload.name,
    email: normalizedPayload.email,
    phone: normalizedPayload.phone,
    address: normalizedPayload.address
  };

  Object.entries(mappedFields).forEach(([fieldId, value]) => {
    applySinglePrefillFieldValue(fieldId, value);
  });

  applyPendingClientProfilePrefill();
  refreshFormState();
  return true;
}

function applySavedClientPrefill() {
  try {
    const storedPayload = getStoredReminderPrefillPayload();

    if (!storedPayload) {
      return;
    }

    applyReminderClientPrefillPayload(storedPayload);
    clearStoredReminderPrefill();
  } catch (error) {
    pendingClientProfilePrefillAnswers = {};
    pendingReminderClientPrefill = null;
    clearStoredReminderPrefill();
    console.warn("Saved client prefill failed", error);
  }
}

async function syncLatestSignedInUser(options = {}) {
  const { silent = true } = options;

  if (!appSupabase || latestSignedInUserSyncInFlight) {
    return;
  }

  latestSignedInUserSyncInFlight = true;

  try {
    const {
      data: { session }
    } = await appSupabase.auth.getSession();

    if (!session?.user) {
      currentSignedInUser = null;
      currentAuthUserId = "";
      renderBronzeFeatures();
      updateDraftPreviewChrome();
      await syncCustomFormFromUser(null);
      return;
    }

    const { data, error } = await appSupabase.auth.getUser();

    if (error) {
      throw error;
    }

    currentSignedInUser = data?.user || session.user;
    currentAuthUserId = currentSignedInUser?.id || session.user.id || "";
    renderBronzeFeatures();
    updateDraftPreviewChrome();
    await syncCustomFormFromUser(currentSignedInUser);
    await hydrateReminderPrefillFromSelectedClient();
  } catch (error) {
    if (!silent) {
      console.warn("Unable to refresh latest signed-in user.", error);
    }
  } finally {
    latestSignedInUserSyncInFlight = false;
  }
}

async function hydrateReminderPrefillFromSelectedClient() {
  const queryClientId = getReminderPrefillClientIdFromUrl();
  const pendingClientId = String(pendingReminderClientPrefill?.id || linkedPrefillClientId || "").trim();
  const clientId = queryClientId || pendingClientId;

  if (!appSupabase || !currentSignedInUser?.id || !clientId) {
    return;
  }

  try {
    let { data, error } = await appSupabase
      .from("clients")
      .select("id, client_name, client_email, client_phone, service_address, profile_custom_answers")
      .eq("id", clientId)
      .eq("owner_id", currentSignedInUser.id)
      .maybeSingle();

    if (error && isSupabaseMissingColumnError(error, "profile_custom_answers")) {
      ({ data, error } = await appSupabase
        .from("clients")
        .select("id, client_name, client_email, client_phone, service_address")
        .eq("id", clientId)
        .eq("owner_id", currentSignedInUser.id)
        .maybeSingle());
    }

    if (error) {
      throw error;
    }

    if (!data) {
      return;
    }

    applyReminderClientPrefillPayload({
      id: data.id || clientId,
      name: data.client_name || "",
      email: data.client_email || "",
      phone: data.client_phone ? formatPhoneNumber(data.client_phone) : "",
      address: data.service_address || "",
      profileCustomAnswers: normalizeClientProfileAnswerMap(data.profile_custom_answers)
    });
    clearStoredReminderPrefill();
  } catch (error) {
    console.warn("Unable to hydrate selected client prefill.", error);
  } finally {
    clearReminderPrefillClientIdFromUrl();
  }
}

function applyCustomFormPresentation(profile) {
  const container = document.querySelector(".container");
  const brandRow = document.querySelector(".form-brand-row");
  const sectionTitle = document.querySelector(".section-title");
  const normalizedTitle = String(profile?.formTitle || "").trim();
  const surfaceState = getCustomFormSurfaceState(profile);
  const questionState = getCustomQuestionSurfaceState(profile);

  if (sectionTitle) {
    sectionTitle.textContent = normalizedTitle || "Appointment Reminder";
    sectionTitle.classList.toggle("visible", Boolean(normalizedTitle));
    sectionTitle.style.fontSize = `${profile?.formTitleFontSize || DEFAULT_FORM_TITLE_FONT_SIZE}px`;
    sectionTitle.style.fontWeight = profile?.formTitleBold === false ? "500" : "800";
  }

  if (brandRow) {
    brandRow.hidden = !normalizedTitle && !String(profile?.formLogoUrl || "").trim();
  }

  document.documentElement.style.setProperty("--page-background", buildCustomPageBackground(profile));
  document.documentElement.style.setProperty("--bg-top", profile?.backgroundTop || "#10141c");
  document.documentElement.style.setProperty("--bg-bottom", profile?.backgroundBottom || "#1a2230");

  if (container) {
    container.style.setProperty("--card", profile?.formSurfaceColor || DEFAULT_FORM_SURFACE_COLOR);
    container.style.setProperty("--card-background", surfaceState.background);
    container.style.setProperty("--form-shine-background", buildCustomFormSurfaceShineBackground(profile));
    container.style.setProperty("--form-shine-opacity", surfaceState.shineOpacity);
    container.style.setProperty("--form-shell-max-width", surfaceState.maxWidth);
    container.style.setProperty("--form-shell-padding", surfaceState.padding);
    container.style.setProperty("--form-shell-padding-mobile", surfaceState.mobilePadding);
    container.style.setProperty("--form-shell-radius", surfaceState.radius);
    container.style.setProperty("--form-shell-radius-mobile", surfaceState.mobileRadius);
    container.style.setProperty("--form-shell-border", surfaceState.border);
    container.style.setProperty("--form-shell-shadow", surfaceState.shadow);
    container.style.setProperty("--form-shell-backdrop", surfaceState.backdrop);
    container.style.setProperty("--form-question-max-width", surfaceState.questionMaxWidth);
    container.style.setProperty("--form-question-wide-max-width", surfaceState.questionWideMaxWidth);
    container.style.setProperty("--text-main", profile?.formTextColor || DEFAULT_FORM_TEXT_COLOR);
    container.style.setProperty("--text-soft", profile?.formTextColor || DEFAULT_FORM_TEXT_COLOR);
    container.style.setProperty("--question-surface-background", questionState.background);
    container.style.setProperty("--question-surface-border", questionState.border);
    container.style.setProperty("--question-text-main", questionState.text);
    container.style.setProperty("--question-text-soft", questionState.textSoft);
    container.style.setProperty("--question-surface-shadow", questionState.shadow);
    container.style.setProperty("--field-text-main", DEFAULT_FIELD_INPUT_TEXT_COLOR);
    container.style.setProperty("--field-placeholder", DEFAULT_FIELD_PLACEHOLDER_COLOR);
  }

  applyWizardMotionPresentation(profile);
  updateCustomFormLogo(profile);

  document.title = normalizedTitle ? `${normalizedTitle} | Appointment Reminder` : "Appointment Reminder";
}

function updateCustomFormLogo(profile) {
  const logoWrap = getFormLogoWrap();
  const logoImage = getFormLogoImage();

  if (!logoWrap || !logoImage) {
    return;
  }

  const logoUrl = String(profile?.formLogoUrl || "").trim();

  if (!logoUrl) {
    logoWrap.hidden = true;
    logoImage.hidden = true;
    logoImage.removeAttribute("src");
    return;
  }

  logoWrap.hidden = false;
  logoImage.hidden = false;
  logoImage.onload = () => {
    logoWrap.hidden = false;
    logoImage.hidden = false;
  };
  logoImage.onerror = () => {
    logoWrap.hidden = true;
    logoImage.hidden = true;
  };

  if (logoImage.getAttribute("src") !== logoUrl) {
    logoImage.src = logoUrl;
  }
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

  if (fieldId === "welcome") {
    return {
      titleFontSize: Number(activeCustomFormProfile?.welcomeTitleFontSize) || DEFAULT_STEP_TITLE_FONT_SIZE,
      titleBold: activeCustomFormProfile?.welcomeTitleBold !== false,
      copyFontSize: Number(activeCustomFormProfile?.welcomeCopyFontSize) || DEFAULT_STEP_COPY_FONT_SIZE,
      copyBold: Boolean(activeCustomFormProfile?.welcomeCopyBold)
    };
  }

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

function getStepNavigationSurfaceState(profile = activeCustomFormProfile || {}) {
  const size = typeof profile?.stepNavSize === "string" && profile.stepNavSize.trim()
    ? profile.stepNavSize.trim()
    : DEFAULT_STEP_NAV_SIZE;
  const shape = typeof profile?.stepNavShape === "string" && profile.stepNavShape.trim()
    ? profile.stepNavShape.trim()
    : DEFAULT_STEP_NAV_SHAPE;

  const sizeState = {
    compact: {
      width: "72px",
      minHeight: "60px",
      padding: "8px 7px",
      itemGap: "5px",
      rowGap: "6px",
      labelSize: "10px",
      circleSize: "28px",
      circleFontSize: "11px"
    },
    large: {
      width: "96px",
      minHeight: "78px",
      padding: "12px 10px",
      itemGap: "7px",
      rowGap: "8px",
      labelSize: "12px",
      circleSize: "34px",
      circleFontSize: "13px"
    },
    medium: {
      width: "88px",
      minHeight: "68px",
      padding: "9px 8px",
      itemGap: "6px",
      rowGap: "8px",
      labelSize: "11px",
      circleSize: "30px",
      circleFontSize: "12px"
    }
  }[size] || {
    width: "88px",
    minHeight: "68px",
    padding: "9px 8px",
    itemGap: "6px",
    rowGap: "8px",
    labelSize: "11px",
    circleSize: "30px",
    circleFontSize: "12px"
  };

  const radius = {
    pill: "999px",
    rectangular: "8px",
    rounded: "16px"
  }[shape] || "16px";

  return {
    ...sizeState,
    radius
  };
}

function retriggerAnimationClass(element, className) {
  if (!element || !className) {
    return;
  }

  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function getWizardMotionState(profile = activeCustomFormProfile || {}) {
  const speed = typeof profile?.stepMotionSpeed === "string" && profile.stepMotionSpeed.trim()
    ? profile.stepMotionSpeed.trim()
    : DEFAULT_STEP_MOTION_SPEED;
  const durationState = {
    quick: {
      stepDuration: "0.18s",
      headDuration: "0.16s",
      chipDuration: "0.18s",
      progressDuration: "0.16s"
    },
    slow: {
      stepDuration: "0.4s",
      headDuration: "0.3s",
      chipDuration: "0.28s",
      progressDuration: "0.3s"
    },
    cinematic: {
      stepDuration: "0.56s",
      headDuration: "0.42s",
      chipDuration: "0.34s",
      progressDuration: "0.38s"
    },
    smooth: {
      stepDuration: "0.28s",
      headDuration: "0.22s",
      chipDuration: "0.24s",
      progressDuration: "0.22s"
    }
  }[speed] || {
    stepDuration: "0.28s",
    headDuration: "0.22s",
    chipDuration: "0.24s",
    progressDuration: "0.22s"
  };

  return {
    style: typeof profile?.stepMotionStyle === "string" && profile.stepMotionStyle.trim()
      ? profile.stepMotionStyle.trim()
      : DEFAULT_STEP_MOTION_STYLE,
    speed,
    head: typeof profile?.stepHeadMotion === "string" && profile.stepHeadMotion.trim()
      ? profile.stepHeadMotion.trim()
      : DEFAULT_STEP_HEAD_MOTION,
    chip: typeof profile?.stepChipMotion === "string" && profile.stepChipMotion.trim()
      ? profile.stepChipMotion.trim()
      : DEFAULT_STEP_CHIP_MOTION,
    ...durationState
  };
}

function applyWizardMotionPresentation(profile = activeCustomFormProfile || {}) {
  const wizardShell = document.querySelector(".wizard-shell");
  const motionState = getWizardMotionState(profile);

  if (!wizardShell) {
    return motionState;
  }

  wizardShell.dataset.stepMotionStyle = motionState.style;
  wizardShell.dataset.stepMotionSpeed = motionState.speed;
  wizardShell.dataset.stepHeadMotion = motionState.head;
  wizardShell.dataset.stepChipMotion = motionState.chip;
  wizardShell.style.setProperty("--step-motion-duration", motionState.stepDuration);
  wizardShell.style.setProperty("--step-head-duration", motionState.headDuration);
  wizardShell.style.setProperty("--step-chip-duration", motionState.chipDuration);
  wizardShell.style.setProperty("--step-progress-duration", motionState.progressDuration);
  return motionState;
}

function getBuiltInFieldType(fieldId) {
  if (fieldId === "phone") {
    return "phone";
  }

  if (fieldId === "email") {
    return "email";
  }

  if (fieldId === "date") {
    return "date";
  }

  if (fieldId === "time") {
    return "time";
  }

  if (fieldId === "notes") {
    return "textarea";
  }

  return "text";
}

function getInlineCustomFieldsForPage(pageId) {
  return activeCustomFormFields.filter(field => field.pageId === pageId);
}

function buildCustomPageBackground(profile) {
  const backgroundStyle = profile?.backgroundStyle === "solid" ? "solid" : DEFAULT_BACKGROUND_STYLE;
  const solidColor = String(profile?.backgroundSolidColor || DEFAULT_BACKGROUND_SOLID_COLOR).trim() || DEFAULT_BACKGROUND_SOLID_COLOR;
  const top = String(profile?.backgroundTop || "#10141c").trim() || "#10141c";
  const bottom = String(profile?.backgroundBottom || "#1a2230").trim() || "#1a2230";

  if (backgroundStyle === "solid") {
    return solidColor;
  }

  return `radial-gradient(circle at top left, rgba(59, 130, 246, 0.22), transparent 32%), radial-gradient(circle at right, rgba(148, 163, 184, 0.18), transparent 28%), linear-gradient(160deg, ${top} 0%, ${bottom} 100%)`;
}

function getActiveCustomPages() {
  return Array.isArray(activeCustomFormProfile?.customPages) ? activeCustomFormProfile.customPages : [];
}

function getOrderedActiveSteps() {
  const profile = activeCustomFormProfile || {};
  const inlinePageCounts = activeCustomFormFields.reduce((counts, field) => {
    if (field.pageId) {
      counts[field.pageId] = (counts[field.pageId] || 0) + 1;
    }

    return counts;
  }, {});
  const builtInSteps = BASE_FORM_FIELD_IDS.map(fieldId => {
    const defaults = BUILT_IN_FORM_STEP_DEFAULTS[fieldId];
    const override = profile.stepOverrides?.[fieldId] || {};
    const baseFieldVisible = override.hidden !== true && isFieldVisibleForStaff(override);

    if (!baseFieldVisible && !inlinePageCounts[fieldId]) {
      return null;
    }

    return {
      id: fieldId,
      type: getBuiltInFieldType(fieldId),
      builtIn: true,
      title: override.title || defaults.title,
      navLabel: override.navLabel || defaults.navLabel,
      copy: override.copy || defaults.copy,
      label: override.label || defaults.label,
      helpText: override.helpText || defaults.helpText,
      placeholder: override.placeholder || defaults.placeholder,
      required: override.required === true,
      baseFieldHidden: !baseFieldVisible,
      titleFontSize: override.titleFontSize || DEFAULT_STEP_TITLE_FONT_SIZE,
      titleBold: override.titleBold !== false,
      copyFontSize: override.copyFontSize || DEFAULT_STEP_COPY_FONT_SIZE,
      copyBold: Boolean(override.copyBold),
      labelFontSize: override.labelFontSize || DEFAULT_FIELD_LABEL_FONT_SIZE,
      labelBold: override.labelBold !== false,
      helpFontSize: override.helpFontSize || DEFAULT_FIELD_HELP_FONT_SIZE,
      helpBold: Boolean(override.helpBold),
      navLabelColor: override.navLabelColor || ""
    };
  }).filter(Boolean);
  const customPages = getActiveCustomPages().map(page => ({
    ...page,
    type: "page",
    builtIn: false
  }));
  const legacyFieldPages = activeCustomFormFields.filter(field => !field.pageId).map(field => ({
    ...field,
    builtIn: false
  }));
  const stepMap = new Map([...builtInSteps, ...customPages, ...legacyFieldPages].map(step => [step.id, step]));
  const ordered = [];

  (Array.isArray(profile.stepOrder) ? profile.stepOrder : []).forEach(id => {
    const step = stepMap.get(id);

    if (step) {
      ordered.push(step);
      stepMap.delete(id);
    }
  });

  [...builtInSteps, ...customPages, ...legacyFieldPages].forEach(step => {
    if (stepMap.has(step.id)) {
      ordered.push(step);
      stepMap.delete(step.id);
    }
  });

  return ordered;
}

function getOrderedFieldsForPage(pageId, baseField = null) {
  const inlineFields = getInlineCustomFieldsForPage(pageId);
  const combined = [...(baseField ? [baseField] : []), ...inlineFields];
  const orderedIds = Array.isArray(activeCustomFormProfile?.pageFieldOrder?.[pageId]) ? activeCustomFormProfile.pageFieldOrder[pageId] : [];

  if (!orderedIds.length) {
    return combined;
  }

  const fieldMap = new Map(combined.map(field => [field.id, field]));
  const ordered = [];

  orderedIds.forEach(id => {
    const field = fieldMap.get(id);

    if (field) {
      ordered.push(field);
      fieldMap.delete(id);
    }
  });

  combined.forEach(field => {
    if (fieldMap.has(field.id)) {
      ordered.push(field);
      fieldMap.delete(field.id);
    }
  });

  return ordered;
}

function buildWizardFieldControlMarkup(field, options = {}) {
  const type = String(field?.type || "text").trim();
  const label = String(field?.label || field?.title || "Custom Question").trim();
  const helpText = String(field?.helpText || "").trim();
  const placeholder = String(field?.placeholder || "").trim();
  const groupStyle = options.isBuiltIn || options.isFirst ? "" : ' style="margin-top:18px;"';

  if (isContentBlockFieldType(type)) {
    if (type === "content-text") {
      return `
        <div class="wizard-content-block wizard-content-block-text" data-inline-field="${field.id}"${groupStyle}>
          <span class="wizard-content-kicker">Text block</span>
          <div class="wizard-content-heading">${escapeHtml(label || "Text Block")}</div>
          <p class="wizard-content-body">${escapeHtml(helpText || field?.copy || "Use this space for context, notes, or a cleaner section intro.")}</p>
        </div>
      `;
    }

    if (type === "content-image") {
      const imageUrl = String(field?.imageUrl || "").trim();

      return `
        <div class="wizard-content-block wizard-content-block-image ${imageUrl ? "" : "is-placeholder"}" data-inline-field="${field.id}"${groupStyle}>
          <div class="wizard-content-media">
            ${imageUrl ? `<img class="wizard-content-image" src="${escapeHtml(imageUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true; this.parentElement.parentElement.classList.add('is-placeholder'); if (this.nextElementSibling) this.nextElementSibling.hidden=false;">` : ""}
            <span class="wizard-content-placeholder" ${imageUrl ? "hidden" : ""}>${imageUrl ? "Image blocked" : "Image block"}</span>
          </div>
          <div class="wizard-content-caption">${escapeHtml(label || "Image block")}</div>
          ${helpText ? `<p class="wizard-content-body">${escapeHtml(helpText)}</p>` : ""}
        </div>
      `;
    }

    return `
      <div class="wizard-content-block wizard-content-block-divider" data-inline-field="${field.id}"${groupStyle}>
        <span class="wizard-content-divider-line"></span>
        ${label ? `<span class="wizard-content-divider-label">${escapeHtml(label)}</span>` : ""}
        <span class="wizard-content-divider-line"></span>
      </div>
    `;
  }

  const isRequired = field?.required === true;
  const optionalBadge = isRequired
    ? `<span class="label-badge" style="background:#fee2e2;color:#b91c1c;">Required</span>`
    : `<span class="label-badge">Optional</span>`;
  const groupClassName = options.isBuiltIn
    ? "wizard-field-group is-built-in"
    : "wizard-field-group";
  const selectOptions = Array.isArray(field?.options)
    ? field.options
        .map(option => String(option || "").trim().slice(0, 60))
        .filter(Boolean)
        .slice(0, 20)
    : [];
  const inputMarkup = type === "textarea"
    ? `<textarea id="${field.id}" placeholder="${placeholder.replace(/"/g, "&quot;")}"></textarea>`
    : type === "select"
      ? `
        <select id="${field.id}">
          <option value="">${escapeHtml(placeholder || "Choose an option")}</option>
          ${selectOptions.length
            ? selectOptions.map(option => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("")
            : `<option value="" disabled>Add dropdown options in Form Creator</option>`}
        </select>
      `
      : `<input id="${field.id}" ${type === "email" ? 'type="email" inputmode="email" autocomplete="off" autocapitalize="off" spellcheck="false"' : ""} ${type === "date" ? 'type="date"' : ""} ${type === "time" ? 'type="time"' : ""} ${type === "phone" ? 'inputmode="tel" autocomplete="tel"' : ""} placeholder="${(type === "date" || type === "time" ? "" : placeholder).replace(/"/g, "&quot;")}">`;
  const mapMarkup = options.includeMapPreview
    ? `
      <div id="map-preview" class="map-preview" aria-live="polite">
        <iframe id="map-preview-frame" class="map-preview-frame" title="Location map preview" loading="lazy"></iframe>
        <p id="map-preview-note" class="map-preview-note"></p>
      </div>
    `
    : "";

  return `
    <div class="${groupClassName}" data-inline-field="${field.id}"${groupStyle}>
      <label for="${field.id}" style="font-size:${field.labelFontSize || DEFAULT_FIELD_LABEL_FONT_SIZE}px;font-weight:${field.labelBold === false ? 500 : 800};">${escapeHtml(label)} ${optionalBadge}</label>
      ${inputMarkup}
      <div id="${field.id}-error" class="field-error"></div>
      ${mapMarkup}
      ${helpText ? `<p class="field-note visible" style="font-size:${field.helpFontSize || DEFAULT_FIELD_HELP_FONT_SIZE}px;font-weight:${field.helpBold ? 800 : 500};">${escapeHtml(helpText)}</p>` : ""}
    </div>
  `;
}

function applyBuiltInStepOverrides() {
  Object.entries(BUILT_IN_FORM_STEP_DEFAULTS).forEach(([fieldId, defaults]) => {
    const stepElement = document.querySelector(`.wizard-step[data-field="${fieldId}"]`);

    if (!stepElement) {
      return;
    }

    const override = activeCustomFormProfile?.stepOverrides?.[fieldId] || {};
    const inlineFields = getInlineCustomFieldsForPage(fieldId);
    const baseFieldVisible = override.hidden !== true && isFieldVisibleForStaff(override);
    const shouldShowStep = baseFieldVisible || inlineFields.length > 0;
    const required = (baseFieldVisible && override.required === true) || inlineFields.some(field => field.required);

    stepElement.hidden = !shouldShowStep;

    if (!shouldShowStep) {
      return;
    }

    stepElement.dataset.title = override.title || defaults.title;
    stepElement.dataset.nav = override.navLabel || defaults.navLabel;
    stepElement.dataset.navColor = override.navLabelColor || "";
    stepElement.dataset.copy = override.copy || defaults.copy;
    stepElement.dataset.optional = required ? "false" : "true";

    const questionWrap = stepElement.querySelector(".question-wrap");

    if (questionWrap) {
      const baseField = baseFieldVisible
        ? {
            id: fieldId,
            type: getBuiltInFieldType(fieldId),
            label: override.label || defaults.label,
            placeholder: override.placeholder || defaults.placeholder,
            helpText: override.helpText || defaults.helpText,
            required: override.required === true,
            labelFontSize: override.labelFontSize || DEFAULT_FIELD_LABEL_FONT_SIZE,
            labelBold: override.labelBold,
            helpFontSize: override.helpFontSize || DEFAULT_FIELD_HELP_FONT_SIZE,
            helpBold: override.helpBold
          }
        : null;
      const orderedFields = getOrderedFieldsForPage(fieldId, baseField);
      const fieldMarkup = [];

      orderedFields.forEach((field, index) => {
        const isBaseField = field.id === fieldId;
        fieldMarkup.push(buildWizardFieldControlMarkup(field, {
          isBuiltIn: isBaseField,
          isFirst: index === 0,
          includeMapPreview: isBaseField && fieldId === "address"
        }));
      });

      questionWrap.innerHTML = fieldMarkup.join("");
    }
  });
}

function buildCustomWizardStepMarkup(step) {
  const title = String(step?.title || step?.label || "Custom Question").trim();
  const label = String(step?.label || "Custom Question").trim();
  const navLabel = String(step?.navLabel || label || "Custom").trim();
  const stepCopy = String(step?.copy || step?.helpText || "").trim();
  const includeBaseField = step?.type !== "page";
  const baseField = includeBaseField
    ? {
        ...step,
        title,
        label
      }
    : null;
  const orderedFields = getOrderedFieldsForPage(step.id, baseField);
  const pageRequired = Boolean(step?.required) || orderedFields.some(entry => entry.required);
  const fieldMarkup = orderedFields.length
    ? orderedFields.map((field, index) => buildWizardFieldControlMarkup(field, {
        isBuiltIn: includeBaseField && field.id === step.id,
        isFirst: index === 0
      })).join("")
    : `<div class="field-note visible">This custom page is empty right now.</div>`;

  return `
    <div class="wizard-step custom-wizard-step" data-title="${title.replace(/"/g, "&quot;")}" data-nav="${navLabel.replace(/"/g, "&quot;")}" data-nav-color="${(step.navLabelColor || "").replace(/"/g, "&quot;")}" data-field="${step.id}" data-copy="${stepCopy.replace(/"/g, "&quot;") || "Custom question added from Form Creator."}" data-optional="${pageRequired ? "false" : "true"}">
      <div class="question-wrap">
        ${fieldMarkup}
      </div>
    </div>
  `;
}

function renderCustomWizardSteps() {
  snapshotWizardFieldValues();
  document.querySelectorAll(".custom-wizard-step").forEach(step => step.remove());

  const reviewStep = document.querySelector('.wizard-step[data-field="consent"]');
  const orderedSteps = getOrderedActiveSteps().filter(step => step.id !== "review");

  if (!reviewStep) {
    applyBuiltInStepOverrides();
    bindBaseFieldListeners();
    bindCustomFieldInputListeners();
    restoreWizardFieldValuesFromCache();
    return;
  }

  if (activeCustomFormProfile?.welcomeScreenEnabled) {
    reviewStep.insertAdjacentHTML("beforebegin", buildWelcomeWizardStepMarkup(activeCustomFormProfile));
  }

  orderedSteps.forEach(step => {
    if (step.builtIn) {
      const builtInStep = document.querySelector(`.wizard-step[data-field="${step.id}"]`);

      if (builtInStep) {
        reviewStep.parentNode?.insertBefore(builtInStep, reviewStep);
      }

      return;
    }

    reviewStep.insertAdjacentHTML("beforebegin", buildCustomWizardStepMarkup(step));
  });

  applyBuiltInStepOverrides();
  bindBaseFieldListeners();
  bindCustomFieldInputListeners();
  restoreWizardFieldValuesFromCache();
}

function getCurrentWizardStepSnapshot() {
  const currentStep = wizardSteps[currentStepIndex];

  if (!currentStep) {
    return null;
  }

  return {
    index: currentStepIndex,
    field: String(currentStep.dataset.field || "").trim(),
    stepKind: String(currentStep.dataset.stepKind || "").trim(),
    title: String(currentStep.dataset.title || "").trim()
  };
}

function persistWizardStepSnapshot(snapshot = getCurrentWizardStepSnapshot()) {
  try {
    if (!snapshot) {
      window.sessionStorage.removeItem(WIZARD_STEP_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(WIZARD_STEP_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn("Unable to persist wizard step snapshot.", error);
  }
}

function readPersistedWizardStepSnapshot() {
  try {
    const rawValue = window.sessionStorage.getItem(WIZARD_STEP_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      index: Number.isFinite(Number(parsed.index)) ? Number(parsed.index) : 0,
      field: String(parsed.field || "").trim(),
      stepKind: String(parsed.stepKind || "").trim(),
      title: String(parsed.title || "").trim()
    };
  } catch (error) {
    console.warn("Unable to read persisted wizard step snapshot.", error);
    return null;
  }
}

function buildCustomFormSyncSignature(user = currentSignedInUser) {
  const userId = String(user?.id || "");
  const profile = user?.user_metadata?.custom_form_profile ?? null;

  try {
    return `${userId}::${JSON.stringify(profile)}`;
  } catch (error) {
    console.warn("Unable to serialize custom form profile signature.", error);
    return `${userId}::${profile ? "profile-present" : "profile-empty"}`;
  }
}

function getRestoredWizardStepIndex(snapshot) {
  const visibleSteps = Array.from(document.querySelectorAll(".wizard-step")).filter(step => !step.hidden);

  if (!visibleSteps.length) {
    return 0;
  }

  if (!snapshot) {
    return Math.min(currentStepIndex, visibleSteps.length - 1);
  }

  let restoredIndex = -1;

  if (snapshot.field) {
    restoredIndex = visibleSteps.findIndex(step => String(step.dataset.field || "").trim() === snapshot.field);
  }

  if (restoredIndex < 0 && snapshot.stepKind) {
    restoredIndex = visibleSteps.findIndex(step => String(step.dataset.stepKind || "").trim() === snapshot.stepKind);
  }

  if (restoredIndex < 0 && snapshot.title) {
    restoredIndex = visibleSteps.findIndex(step => String(step.dataset.title || "").trim() === snapshot.title);
  }

  if (restoredIndex >= 0) {
    return restoredIndex;
  }

  return Math.min(snapshot.index || 0, visibleSteps.length - 1);
}

function bindCustomFieldInputListeners() {
  activeCustomFormFields.forEach(field => {
    const element = document.getElementById(field.id);

    if (!element || element.dataset.formCreatorBound === "true") {
      return;
    }

    const handleFieldValueChange = () => {
      if (field.type === "phone") {
        element.value = formatPhoneNumber(element.value);
      }

      cacheFormControlValue(element);
      refreshFormState();
    };

    element.dataset.formCreatorBound = "true";
    element.addEventListener("input", handleFieldValueChange);
    element.addEventListener("change", handleFieldValueChange);
  });
}

async function syncCustomFormFromUser(user = currentSignedInUser, options = {}) {
  const { force = false } = options;
  const profile = user?.user_metadata?.custom_form_profile;
  const nextCustomFormSyncSignature = buildCustomFormSyncSignature(user);
  const currentStepSnapshot = getCurrentWizardStepSnapshot() || readPersistedWizardStepSnapshot();

  if (!force && nextCustomFormSyncSignature === lastCustomFormSyncSignature) {
    applyPendingClientProfilePrefill();
    applyReminderClientPrefillPayload(pendingReminderClientPrefill);
    refreshFormState();
    return;
  }

  if (!profile) {
    activeCustomFormProfile = null;
    activeCustomFormFields = [];
    customFormFieldLookup = new Map();
    hideThankYouScreen();
    renderCustomWizardSteps();
    applyPendingClientProfilePrefill();
    applyReminderClientPrefillPayload(pendingReminderClientPrefill);
    applyCustomFormPresentation(null);
    currentStepIndex = getRestoredWizardStepIndex(currentStepSnapshot);
    requiredFieldAttemptIds.clear();
    lastCustomFormSyncSignature = nextCustomFormSyncSignature;
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
      hideThankYouScreen();
      renderCustomWizardSteps();
      applyPendingClientProfilePrefill();
      applyReminderClientPrefillPayload(pendingReminderClientPrefill);
      applyCustomFormPresentation(null);
      currentStepIndex = getRestoredWizardStepIndex(currentStepSnapshot);
      requiredFieldAttemptIds.clear();
      lastCustomFormSyncSignature = nextCustomFormSyncSignature;
      initWizard();
      refreshFormState();
      return;
    }

    activeCustomFormProfile = normalizedProfile;
    activeCustomFormFields = Array.isArray(activeCustomFormProfile.fields)
      ? activeCustomFormProfile.fields.filter(isFieldVisibleForStaff)
      : [];
    customFormFieldLookup = new Map(activeCustomFormFields.map(field => [field.id, field]));
    hideThankYouScreen();
    renderCustomWizardSteps();
    bindCustomFieldInputListeners();
    applyPendingClientProfilePrefill();
    applyReminderClientPrefillPayload(pendingReminderClientPrefill);
    applyCustomFormPresentation(activeCustomFormProfile);
    currentStepIndex = getRestoredWizardStepIndex(currentStepSnapshot);
    requiredFieldAttemptIds.clear();
    lastCustomFormSyncSignature = nextCustomFormSyncSignature;
    initWizard();
    refreshFormState();
  } catch (error) {
    console.warn("Unable to load custom form profile.", error);
  }
}

function buildCustomFieldMessageLines() {
  const lines = [];
  buildCustomFieldAnswerSnapshots().filter(answer => answer.include_in_reminder !== false).forEach(answer => {
    lines.push("");

    if (answer.type === "textarea") {
      lines.push(`${answer.label}:`);
      lines.push(answer.display_value);
      return;
    }

    lines.push(`${answer.label}: ${answer.display_value}`);
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

  if (date && shouldIncludeBuiltInAnswerInReminder("date")) lines.push("Date: " + formatDate(date));
  if (time && shouldIncludeBuiltInAnswerInReminder("time")) lines.push("Time: " + formatTime(time));
  if (address && shouldIncludeBuiltInAnswerInReminder("address")) lines.push("Location: " + address);
  lines.push(...buildCustomFieldMessageLines());

  if (notes && shouldIncludeBuiltInAnswerInReminder("notes")) {
    lines.push("");
    lines.push(`${getAppointmentNotesLabel()}:`);
    lines.push(notes);
  }

  lines.push("");
  if (businessContact && shouldIncludeBuiltInAnswerInReminder("businessContact")) {
    lines.push("If you need to reach us before your appointment, please contact us at " + businessContact + ".");
    lines.push("");
  }
  lines.push("Thank you.");

  return lines.join("\n");
}

function invalidateBronzeReviewManualMessage() {
  bronzePreviewUsesManualMessage = false;
  bronzePreviewManualMessage = generateMessage();
}

function refreshFormState() {
  if (sendEmailLockedAfterSuccess) {
    setSendEmailButtonState("idle");
  }

  if (safeToLeaveAfterSend) {
    safeToLeaveAfterSend = false;
  }

  setSendStatus("");
  syncCopyEmailOption();
  invalidateBronzeReviewManualMessage();

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

function getCustomFormSurfaceState(profile) {
  const shape = profile?.formSurfaceShape === "rectangular" || profile?.formSurfaceShape === "invisible"
    ? profile.formSurfaceShape
    : DEFAULT_FORM_SURFACE_SHAPE;
  const layout = profile?.formSurfaceLayout === "medium" || profile?.formSurfaceLayout === "extended"
    ? profile.formSurfaceLayout
    : DEFAULT_FORM_SURFACE_LAYOUT;
  const isInvisible = shape === "invisible";
  const isMedium = layout === "medium";
  const isExtended = layout === "extended";

  return {
    shape,
    layout,
    background: isInvisible ? "transparent" : buildCustomFormSurfaceBackground(profile),
    shineOpacity: isInvisible || profile?.formSurfaceShineEnabled === false ? "0" : "1",
    radius: shape === "rectangular" ? "8px" : isInvisible ? "0px" : "28px",
    mobileRadius: shape === "rectangular" ? "6px" : isInvisible ? "0px" : "22px",
    border: isInvisible ? "1px solid transparent" : "1px solid var(--card-border)",
    shadow: isInvisible ? "none" : "0 26px 60px rgba(15, 23, 42, 0.22)",
    backdrop: isInvisible ? "none" : "blur(12px)",
    maxWidth: isExtended ? "calc(100vw - 28px)" : isMedium ? "760px" : "560px",
    padding: isInvisible ? "0px" : isExtended ? "32px" : isMedium ? "30px" : "28px",
    mobilePadding: isInvisible ? "0px" : isExtended ? "26px" : isMedium ? "24px" : "22px",
    questionMaxWidth: isExtended ? "100%" : isMedium ? "560px" : "470px",
    questionWideMaxWidth: isExtended ? "100%" : isMedium ? "640px" : "560px"
  };
}

function getCustomQuestionSurfaceState(profile) {
  const isVisible = profile?.questionSurfaceVisible !== false;
  const textColor = String(profile?.questionTextColor || DEFAULT_QUESTION_TEXT_COLOR).trim() || DEFAULT_QUESTION_TEXT_COLOR;

  return {
    background: isVisible ? (String(profile?.questionSurfaceColor || DEFAULT_QUESTION_SURFACE_COLOR).trim() || DEFAULT_QUESTION_SURFACE_COLOR) : "transparent",
    border: isVisible ? "1px solid rgba(148, 163, 184, 0.22)" : "1px solid transparent",
    text: textColor,
    textSoft: `color-mix(in srgb, ${textColor} 72%, white 28%)`,
    shadow: "none"
  };
}

function buildCustomFormSurfaceShineBackground(profile) {
  const shineColor = String(profile?.formSurfaceShineColor || DEFAULT_FORM_SURFACE_SHINE_COLOR).trim() || DEFAULT_FORM_SURFACE_SHINE_COLOR;

  if (profile?.formSurfaceShineEnabled === false) {
    return "linear-gradient(135deg, transparent 0%, transparent 100%)";
  }

  return `linear-gradient(135deg, ${shineColor}70 0%, ${shineColor}26 34%, transparent 76%)`;
}

async function persistBronzeClientProfileAnswers(clientId, appointmentId) {
  if (!appSupabase || !currentSignedInUser || !isBronzeUser() || !clientId) {
    return;
  }

  const rememberedAnswers = buildRememberedClientAnswerSnapshots({ appointmentId });

  if (!Object.keys(rememberedAnswers).length) {
    return;
  }

  try {
    let { data, error } = await appSupabase
      .from("clients")
      .select("profile_custom_answers")
      .eq("id", clientId)
      .eq("owner_id", currentSignedInUser.id)
      .maybeSingle();

    if (error && isSupabaseMissingColumnError(error, "profile_custom_answers")) {
      return;
    }

    if (error) {
      throw error;
    }

    const nextProfileAnswers = {
      ...normalizeClientProfileAnswerMap(data?.profile_custom_answers),
      ...rememberedAnswers
    };

    ({ error } = await appSupabase
      .from("clients")
      .update({
        profile_custom_answers: nextProfileAnswers,
        updated_at: new Date().toISOString()
      })
      .eq("id", clientId)
      .eq("owner_id", currentSignedInUser.id));

    if (error && isSupabaseMissingColumnError(error, "profile_custom_answers")) {
      return;
    }

    if (error) {
      throw error;
    }
  } catch (error) {
    console.warn("Unable to save remembered client answers.", error);
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
    custom_answers: buildCustomFieldAnswerSnapshots(),
    last_channel: channel || null,
    last_source: source || "",
    updated_at: new Date().toISOString()
  };
}

function isSupabaseMissingColumnError(error, columnName) {
  const normalizedColumn = String(columnName || "").trim().toLowerCase();
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return Boolean(normalizedColumn && message.includes(normalizedColumn));
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
      let { error } = await appSupabase
        .from("appointments")
        .update(payload)
        .eq("id", existingId)
        .eq("owner_id", payload.owner_id);

      if (error && isSupabaseMissingColumnError(error, "custom_answers")) {
        const fallbackPayload = { ...payload };
        delete fallbackPayload.custom_answers;

        ({ error } = await appSupabase
          .from("appointments")
          .update(fallbackPayload)
          .eq("id", existingId)
          .eq("owner_id", payload.owner_id));
      }

      if (error) {
        throw error;
      }

      return existingId;
    }

    let { data, error } = await appSupabase
      .from("appointments")
      .insert(payload)
      .select("id")
      .single();

    if (error && isSupabaseMissingColumnError(error, "custom_answers")) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.custom_answers;

      ({ data, error } = await appSupabase
        .from("appointments")
        .insert(fallbackPayload)
        .select("id")
        .single());
    }

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

  const missingRequiredCustomField = activeCustomFormFields.find(field => !isContentBlockFieldType(field.type) && field.required && !getFieldValue(field.id));

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
    { label: getAppointmentNotesLabel(), value: notes },
    { label: "Message Preview", value: message }
  ];

  activeCustomFormFields.forEach(field => {
    if (isContentBlockFieldType(field.type)) {
      return;
    }

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

  if (step.dataset.stepKind === "welcome") {
    return Boolean(visitedSteps[index]);
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

  if (step.dataset.stepKind === "welcome") {
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

  const stepSurfaceState = getStepNavigationSurfaceState(activeCustomFormProfile || {});
  const stepNavClickable = (activeCustomFormProfile?.stepNavClickable ?? DEFAULT_STEP_NAV_CLICKABLE) !== false;

  stepper.style.setProperty("--step-nav-width", stepSurfaceState.width);
  stepper.style.setProperty("--step-nav-min-height", stepSurfaceState.minHeight);
  stepper.style.setProperty("--step-nav-padding", stepSurfaceState.padding);
  stepper.style.setProperty("--step-nav-item-gap", stepSurfaceState.itemGap);
  stepper.style.setProperty("--step-nav-gap-size", stepSurfaceState.rowGap);
  stepper.style.setProperty("--step-nav-label-size", stepSurfaceState.labelSize);
  stepper.style.setProperty("--step-nav-circle-size", stepSurfaceState.circleSize);
  stepper.style.setProperty("--step-nav-circle-font-size", stepSurfaceState.circleFontSize);
  stepper.style.setProperty("--step-nav-radius", stepSurfaceState.radius);
  stepper.classList.toggle("is-readonly", !stepNavClickable);
  stepper.innerHTML = "";

  wizardSteps.forEach((step, index) => {
    const button = document.createElement("button");
    const label = step.dataset.nav || step.dataset.title || `Step ${index + 1}`;
    const navAppearance = getStepNavigationAppearance(step);
    const invalid = isStepInvalid(step);
    const complete = isStepComplete(step, index);
    const canActivateStep = stepNavClickable || index <= currentStepIndex || complete;
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

    if (canActivateStep) {
      button.addEventListener("click", () => setStep(index));
    }
    stepper.appendChild(button);
  });
}

function focusStepField(step) {
  if (step?.dataset?.stepKind === "welcome") {
    return;
  }

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
  const wizardHead = document.getElementById("wizard-head");
  const stepCount = document.getElementById("step-count");
  const stepTitle = document.getElementById("step-title");
  const stepCopy = document.getElementById("step-copy");
  const stepPill = document.getElementById("step-pill");
  const progressWrap = document.getElementById("progress-wrap");
  const progressStatus = document.getElementById("progress-status");
  const progressFill = document.getElementById("progress-fill");
  const backButton = document.getElementById("back-button");
  const skipButton = document.getElementById("skip-button");
  const nextButton = document.getElementById("next-button");
  const wizardControls = document.querySelector(".wizard-controls");
  const isFinalStep = currentStepIndex === totalSteps - 1;
  const isOptional = currentStep.dataset.optional === "true";
  const stepNavPlacement = activeCustomFormProfile?.stepNavPlacement || DEFAULT_STEP_NAV_PLACEMENT;
  const isWelcomeStep = currentStep.dataset.stepKind === "welcome";
  const motionState = applyWizardMotionPresentation(activeCustomFormProfile || {});

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

  if (wizardHead) {
    wizardHead.classList.toggle("is-nav-above", stepNavPlacement === "above-title");
    wizardHead.classList.toggle("is-nav-hidden", stepNavPlacement === "hidden");

    if (motionState.head !== "none") {
      retriggerAnimationClass(wizardHead, "is-step-motion-head");
    } else {
      wizardHead.classList.remove("is-step-motion-head");
    }
  }

  if (progressWrap) {
    progressWrap.hidden = stepNavPlacement === "hidden";
  }

  if (isWelcomeStep) {
    stepPill.textContent = "Welcome";
    stepPill.className = "step-pill";
  } else if (isFinalStep) {
    stepPill.textContent = "Final Step";
    stepPill.className = "step-pill final";
  } else {
    stepPill.textContent = isOptional ? "Optional" : "Required";
    stepPill.className = "step-pill";
  }

  backButton.hidden = currentStepIndex === 0;
  skipButton.hidden = isFinalStep || !isOptional || isWelcomeStep;
  nextButton.hidden = isFinalStep;
  nextButton.textContent = isWelcomeStep
    ? (currentStep.dataset.cta || "Start")
    : currentStepIndex === totalSteps - 2
      ? "Review"
      : "Next";

  if (wizardControls) {
    wizardControls.hidden = isWelcomeStep;
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
  persistWizardStepSnapshot();
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
  wizardSteps = Array.from(document.querySelectorAll(".wizard-step")).filter(step => !step.hidden);
  visitedSteps = wizardSteps.map((_, index) => index === 0);
  currentStepIndex = getRestoredWizardStepIndex(readPersistedWizardStepSnapshot());
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

    const startButton = step.querySelector("[data-wizard-start-button]");

    if (startButton && startButton.dataset.wizardStartBound !== "true") {
      startButton.dataset.wizardStartBound = "true";
      startButton.addEventListener("click", () => {
        if (index === currentStepIndex) {
          moveToNextStep();
        }
      });
    }
  });

  renderStepNavigation();
  updateWizardUI();
  persistWizardStepSnapshot();
}

function bindBaseFieldListeners() {
  BASE_FORM_FIELD_IDS.forEach(fieldId => {
    const element = document.getElementById(fieldId);

    if (!element || element.dataset.baseFieldBound === "true") {
      return;
    }

    const handleFieldValueChange = () => {
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

      cacheFormControlValue(element);
      refreshFormState();
    };

    element.dataset.baseFieldBound = "true";
    element.addEventListener("input", handleFieldValueChange);
    element.addEventListener("change", handleFieldValueChange);
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

getThankYouButtonElement()?.addEventListener("click", () => {
  window.location.reload();
});

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
window.addEventListener("focus", () => {
  syncLatestSignedInUser({ silent: true });
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    syncLatestSignedInUser({ silent: true });
  }
});

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

function setSendStatus(message, type = "info", options = {}) {
  const status = document.getElementById("send-status");

  if (!status) {
    return;
  }

  window.clearTimeout(sendStatusResetTimer);
  sendStatusResetTimer = null;

  if (!message) {
    status.hidden = true;
    status.textContent = "";
    status.className = "send-status";
    return;
  }

  status.hidden = false;
  status.textContent = message;
  status.className = `send-status ${type}`;

  if (options.autoHide) {
    sendStatusResetTimer = window.setTimeout(() => {
      setSendStatus("");
    }, options.autoHide);
  }
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

  setSendStatus("");
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
  setSendStatus("Sending email...", "info");
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

      const appointmentId = await upsertBronzeAppointment({
        clientId,
        channel: "email",
        source: "automated_email"
      });
      await persistBronzeClientProfileAnswers(clientId, appointmentId);
      safeToLeaveAfterSend = true;
      setSendEmailButtonState("sent");
      setSendStatus(
        isBronzeUser()
          ? "Email sent and saved to Client Details."
          : "Email sent.",
        "success"
      );
      showThankYouScreen();
    } else {
      setSendEmailButtonState("idle");
      const message = data.error || "Email could not be sent. Review the details and try again.";
      setSendStatus(message, "error");
      alert(message);
    }
  } catch (error) {
    console.warn("Unable to send automated email.", error);
    setSendEmailButtonState("idle");
    const message = "Email could not be sent. Check your connection and try again.";
    setSendStatus(message, "error");
    alert(message);
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
  const appointmentId = await upsertBronzeAppointment({
    clientId,
    channel: "sms",
    source: "device_sms"
  });
  await persistBronzeClientProfileAnswers(clientId, appointmentId);
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
