import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import {
  BRANDING_TEMPLATE_OPTIONS,
  TEMPLATE_STYLE_PRESETS,
  buildReminderEmailHtml,
  buildReminderEmailSubject,
  hasSavedBrandingProfile,
  normalizeBrandingProfile
} from "./branding-templates.js?v=20260402e";

const statusBanner = document.getElementById("status-banner");
const authSetupNotice = document.getElementById("auth-setup-notice");
const signedOutShell = document.getElementById("signed-out-shell");
const signedInShell = document.getElementById("signed-in-shell");
const pricePill = document.getElementById("price-pill");
const brandingForm = document.getElementById("branding-form");
const saveBrandingButton = document.getElementById("save-branding-button");
const resetBrandingButton = document.getElementById("reset-branding-button");
const templateGrid = document.getElementById("template-grid");
const previewFrame = document.getElementById("branding-preview-frame");
const previewSubject = document.getElementById("branding-preview-subject");
const previewFrom = document.getElementById("branding-preview-from");
const previewEmail = document.getElementById("branding-preview-email");
const previewShell = document.getElementById("branding-preview-shell");
const previewFocusNote = document.getElementById("branding-preview-focus-note");
const editorModal = document.getElementById("branding-editor-modal");
const editorCloseButton = document.getElementById("branding-editor-close");
const editorHead = editorModal?.querySelector(".branding-editor-head") || null;
const editorHandle = document.getElementById("branding-editor-handle");
const editorTitle = document.getElementById("branding-editor-title");
const editorCopy = document.getElementById("branding-editor-copy");
const brandingEnabledNote = document.getElementById("branding-enabled-note");
const signOutButton = document.getElementById("branding-sign-out");
const qaToolsShell = document.getElementById("branding-qa-tools");
const qaLoadLastEmailButton = document.getElementById("qa-load-last-email-button");
const qaOpenRawEmailButton = document.getElementById("qa-open-raw-email-button");
const qaLastEmailStatus = document.getElementById("qa-last-email-status");
const qaLastEmailMeta = document.getElementById("qa-last-email-meta");
const qaLastEmailSubject = document.getElementById("qa-last-email-subject");
const qaLastEmailSentAt = document.getElementById("qa-last-email-sent-at");
const qaLastEmailRecipient = document.getElementById("qa-last-email-recipient");
const qaLastEmailMessageId = document.getElementById("qa-last-email-message-id");
const qaLastEmailViewer = document.getElementById("qa-last-email-viewer");
const qaLastEmailFrame = document.getElementById("qa-last-email-frame");
const qaLastEmailHtml = document.getElementById("qa-last-email-html");

const fieldIds = {
  templateStyle: "branding-template-style",
  brandingEnabled: "branding-enabled",
  businessName: "branding-business-name",
  tagline: "branding-tagline",
  headerLabel: "branding-header-label",
  accentColor: "branding-accent-color",
  accentHex: "branding-accent-hex",
  headerColor: "branding-header-color",
  headerHex: "branding-header-hex",
  secondaryColor: "branding-secondary-color",
  secondaryHex: "branding-secondary-hex",
  artShapeColor: "branding-art-shape-color",
  artShapeHex: "branding-art-shape-hex",
  panelColor: "branding-panel-color",
  panelHex: "branding-panel-hex",
  summaryGradientStyle: "branding-summary-gradient",
  detailsColor: "branding-details-color",
  detailsHex: "branding-details-hex",
  detailsGradientStyle: "branding-details-gradient",
  calendarColor: "branding-calendar-color",
  calendarHex: "branding-calendar-hex",
  calendarGradientStyle: "branding-calendar-gradient",
  tertiaryColor: "branding-tertiary-color",
  tertiaryHex: "branding-tertiary-hex",
  logoUrl: "branding-logo-url",
  buttonStyle: "branding-button-style",
  panelShape: "branding-panel-shape",
  heroGradientStyle: "branding-hero-gradient",
  artShape: "branding-art-shape",
  shapeIntensity: "branding-shape-intensity",
  shineStyle: "branding-shine-style",
  motionStyle: "branding-motion-style",
  contactEmail: "branding-contact-email",
  contactPhone: "branding-contact-phone",
  websiteUrl: "branding-website-url",
  rescheduleUrl: "branding-reschedule-url"
};

const helperTextIds = {
  headerColor: "branding-header-color-hint",
  secondaryColor: "branding-secondary-color-hint",
  artShapeColor: "branding-art-shape-color-hint",
  panelColor: "branding-panel-color-hint",
  detailsColor: "branding-details-color-hint",
  calendarColor: "branding-calendar-color-hint",
  tertiaryColor: "branding-tertiary-color-hint",
  buttonStyle: "branding-button-style-hint",
  panelShape: "branding-panel-shape-hint",
  heroGradientStyle: "branding-hero-gradient-hint",
  artShape: "branding-art-shape-hint",
  shapeIntensity: "branding-shape-intensity-hint",
  shineStyle: "branding-shine-style-hint",
  motionStyle: "branding-motion-style-hint"
};

const defaultPreviewFocusNote = "Click or focus a setting and the preview will highlight the part it changes.";

const PREVIEW_HIGHLIGHT_CONFIG = {
  [fieldIds.brandingEnabled]: {
    iframeAreas: ["hero", "secondary", "buttons", "footer"],
    selectors: ["#branding-preview-shell", "#branding-preview-subject"],
    note: "Toggle between your branded email and the simpler standard reminder layout."
  },
  [fieldIds.businessName]: {
    iframeAreas: ["hero", "logo", "footer"],
    selectors: [".branding-preview-from"],
    note: "Highlighting where your business name appears."
  },
  [fieldIds.tagline]: {
    iframeAreas: ["hero"],
    note: "Highlighting the short supporting line below your business name."
  },
  [fieldIds.headerLabel]: {
    iframeAreas: ["hero-label"],
    note: "Highlighting the small top label above the business name."
  },
  [fieldIds.accentColor]: {
    iframeAreas: ["buttons"],
    selectors: ["#branding-preview-subject"],
    note: "Highlighting the primary brand color areas like labels and main action accents."
  },
  [fieldIds.headerColor]: {
    iframeAreas: ["hero"],
    note: "Highlighting the large top company section so you can color that area directly."
  },
  [fieldIds.secondaryColor]: {
    iframeAreas: ["hero-secondary", "art"],
    note: "Highlighting the supporting color accent inside the top section and hero art."
  },
  [fieldIds.artShapeColor]: {
    iframeAreas: ["art"],
    note: "Highlighting the geometric art that uses your dedicated art color."
  },
  [fieldIds.panelColor]: {
    iframeAreas: ["summary"],
    note: "Highlighting the summary cards that use your summary section color."
  },
  [fieldIds.summaryGradientStyle]: {
    iframeAreas: ["summary"],
    note: "Highlighting how the summary cards blend their background color."
  },
  [fieldIds.detailsColor]: {
    iframeAreas: ["details"],
    note: "Highlighting the additional details card color."
  },
  [fieldIds.detailsGradientStyle]: {
    iframeAreas: ["details"],
    note: "Highlighting how the additional details card blends its background."
  },
  [fieldIds.calendarColor]: {
    iframeAreas: ["calendar"],
    note: "Highlighting the add-to-calendar section color."
  },
  [fieldIds.calendarGradientStyle]: {
    iframeAreas: ["calendar"],
    note: "Highlighting how the add-to-calendar section blends its background."
  },
  [fieldIds.tertiaryColor]: {
    iframeAreas: ["buttons", "footer"],
    note: "Highlighting the supporting accent areas like the website button and footer tint."
  },
  [fieldIds.logoUrl]: {
    iframeAreas: ["logo"],
    note: "Highlighting the logo area."
  },
  [fieldIds.buttonStyle]: {
    iframeAreas: ["buttons"],
    selectors: ["#branding-preview-subject", ".signature-card-cta"],
    note: "Highlighting the buttons and chips whose corners change shape."
  },
  [fieldIds.panelShape]: {
    iframeAreas: ["summary", "details", "calendar"],
    note: "Highlighting the summary, details, and calendar panels whose corners and shape will change."
  },
  [fieldIds.heroGradientStyle]: {
    iframeAreas: ["hero"],
    note: "Highlighting the top company section where the main and secondary colors blend together."
  },
  [fieldIds.artShape]: {
    iframeAreas: ["art"],
    selectors: [".signature-card-art"],
    note: "Highlighting the geometric art style on the right side."
  },
  [fieldIds.shapeIntensity]: {
    iframeAreas: ["art"],
    selectors: [".signature-card-art"],
    note: "Highlighting the geometric art that gets softer or bolder."
  },
  [fieldIds.shineStyle]: {
    iframeAreas: ["art"],
    selectors: ["#branding-preview-shell", ".signature-card"],
    note: "Highlighting the surfaces that get the glass shine effect."
  },
  [fieldIds.motionStyle]: {
    iframeAreas: ["art"],
    selectors: ["#branding-preview-shell", ".signature-card-art"],
    note: "Highlighting the live preview art that moves on this page."
  },
  [fieldIds.contactEmail]: {
    iframeAreas: ["contact", "footer", "buttons"],
    selectors: [".branding-preview-from"],
    note: "Highlighting where your business email appears."
  },
  [fieldIds.contactPhone]: {
    iframeAreas: ["contact", "buttons"],
    note: "Highlighting where your business phone appears."
  },
  [fieldIds.websiteUrl]: {
    iframeAreas: ["buttons", "footer"],
    note: "Highlighting the website button and footer link area."
  },
  [fieldIds.rescheduleUrl]: {
    iframeAreas: ["buttons"],
    note: "Highlighting the reschedule button area."
  }
};

const PREVIEW_AREA_TO_FIELD_ID = {
  hero: fieldIds.headerColor,
  "hero-secondary": fieldIds.secondaryColor,
  "hero-label": fieldIds.headerLabel,
  logo: fieldIds.logoUrl,
  contact: fieldIds.contactEmail,
  art: fieldIds.artShapeColor,
  summary: fieldIds.panelColor,
  details: fieldIds.detailsColor,
  calendar: fieldIds.calendarColor,
  buttons: fieldIds.buttonStyle,
  footer: fieldIds.tertiaryColor
};

const FIELD_TO_EDITOR_GROUP = {
  [fieldIds.brandingEnabled]: "hero",
  [fieldIds.businessName]: "hero",
  [fieldIds.tagline]: "hero",
  [fieldIds.headerLabel]: "hero",
  [fieldIds.accentColor]: "hero",
  [fieldIds.accentHex]: "hero",
  [fieldIds.headerColor]: "hero",
  [fieldIds.headerHex]: "hero",
  [fieldIds.secondaryColor]: "hero",
  [fieldIds.secondaryHex]: "hero",
  [fieldIds.heroGradientStyle]: "hero",
  [fieldIds.artShape]: "art",
  [fieldIds.artShapeColor]: "art",
  [fieldIds.artShapeHex]: "art",
  [fieldIds.shapeIntensity]: "art",
  [fieldIds.shineStyle]: "art",
  [fieldIds.motionStyle]: "art",
  [fieldIds.panelColor]: "summary",
  [fieldIds.panelHex]: "summary",
  [fieldIds.summaryGradientStyle]: "summary",
  [fieldIds.detailsColor]: "details",
  [fieldIds.detailsHex]: "details",
  [fieldIds.detailsGradientStyle]: "details",
  [fieldIds.calendarColor]: "calendar",
  [fieldIds.calendarHex]: "calendar",
  [fieldIds.calendarGradientStyle]: "calendar",
  [fieldIds.panelShape]: "summary",
  [fieldIds.buttonStyle]: "buttons",
  [fieldIds.tertiaryColor]: "buttons",
  [fieldIds.tertiaryHex]: "buttons",
  [fieldIds.websiteUrl]: "buttons",
  [fieldIds.rescheduleUrl]: "buttons",
  [fieldIds.logoUrl]: "contact",
  [fieldIds.contactEmail]: "contact",
  [fieldIds.contactPhone]: "contact"
};

const PREVIEW_AREA_TO_EDITOR_GROUP = {
  hero: "hero",
  "hero-secondary": "hero",
  "hero-label": "hero",
  logo: "contact",
  contact: "contact",
  art: "art",
  summary: "summary",
  details: "details",
  calendar: "calendar",
  buttons: "buttons",
  footer: "buttons"
};

const EDITOR_GROUP_COPY = {
  hero: {
    title: "Top section controls",
    copy: "Change the business name, hero copy, brand color, top section color, and secondary accent that appear at the top of the email."
  },
  art: {
    title: "Hero art controls",
    copy: "Change the geometric art style, art color, shape intensity, shine, and preview motion for the top-right artwork."
  },
  panels: {
    title: "Info panel controls",
    copy: "Adjust the fill color and panel shape for the date, time, location, and details boxes inside the email body."
  },
  summary: {
    title: "Summary card controls",
    copy: "Adjust the color, gradient, and shape of the date, time, and location cards."
  },
  details: {
    title: "Details card controls",
    copy: "Adjust the color, gradient, and shape of the additional details card."
  },
  calendar: {
    title: "Calendar section controls",
    copy: "Adjust the color, gradient, and button feel of the add-to-calendar section."
  },
  buttons: {
    title: "Button and footer controls",
    copy: "Adjust the button shape, supporting accent color, and the website or reschedule links that appear lower in the email."
  },
  contact: {
    title: "Logo and contact controls",
    copy: "Update the logo, business email, and phone details that show up in the hero area and footer."
  }
};

let supabase = null;
let appConfig = null;
let runtimeConfig = null;
let currentUser = null;
let currentSavedBranding = {};
let currentAuthUserId = "";
let previewRenderTimer = null;
let lastPreviewKey = "";
let currentPreviewFocusField = "";
let currentEditorGroup = "hero";
let previewRandomNonce = 0;
let lastSentEmailRecord = null;
let editorHasCustomPosition = false;
let editorDragState = null;
const QA_LAST_EMAIL_STORAGE_KEY = "appointment-reminder:last-sent-email-html";

const TEMPLATE_SHOWCASES = {
  signature: {
    company: "North Shore Wellness",
    line: "Boutique wellness studio",
    promise: "Clear reminders that still feel polished, modern, and premium.",
    service: "Appointments + rescheduling",
    email: "hello@northshorewellness.com",
    website: "northshorewellness.com",
    mark: "NS",
    themeClass: "is-glass"
  },
  spotlight: {
    company: "Harbor Legal Group",
    line: "Private client coordination",
    promise: "A lighter editorial layout for businesses that want a calm upscale feel.",
    service: "Consults + follow-up",
    email: "desk@harborlegal.com",
    website: "harborlegal.com",
    mark: "HL",
    themeClass: "is-studio"
  },
  executive: {
    company: "Aureline Concierge",
    line: "Executive service desk",
    promise: "Dark, sharper, and built for a more formal premium brand.",
    service: "Bookings + confirmations",
    email: "team@aureline.co",
    website: "aureline.co",
    mark: "AU",
    themeClass: "is-executive"
  }
};

function setStatus(message, type = "info") {
  if (!statusBanner) {
    return;
  }

  if (!message) {
    statusBanner.hidden = true;
    statusBanner.textContent = "";
    statusBanner.className = "status-banner";
    return;
  }

  statusBanner.hidden = false;
  statusBanner.textContent = message;
  statusBanner.className = `status-banner ${type}`;
}

function setButtonBusy(button, isBusy, busyText) {
  if (!button) {
    return;
  }

  if (!button.dataset.defaultText) {
    button.dataset.defaultText = button.textContent;
  }

  button.disabled = isBusy;
  button.textContent = isBusy ? busyText : button.dataset.defaultText;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function getTierLabel(user) {
  const tierKey = getTierKey(user);

  if (tierKey === "bronze") {
    return "Bronze Active";
  }

  if (tierKey === "free") {
    return "Free Account";
  }

  return tierKey.charAt(0).toUpperCase() + tierKey.slice(1);
}

function getPublicConfig() {
  return fetch("/api/public-config", { cache: "no-store" }).then(response => {
    if (!response.ok) {
      throw new Error("Unable to load account configuration.");
    }

    return response.json();
  });
}

function getRuntimeConfig() {
  return fetch("/api/runtime-env", { cache: "no-store" }).then(response => {
    if (!response.ok) {
      throw new Error("Unable to load runtime environment.");
    }

    return response.json();
  });
}

function isQaRuntime() {
  return runtimeConfig?.env === "preview"
    || runtimeConfig?.label === "DEV"
    || /qa/i.test(String(runtimeConfig?.branch || ""));
}

function getFieldElement(fieldId) {
  return document.getElementById(fieldId);
}

function buildSampleMessage(profile) {
  const businessContact = profile.contactPhone || profile.contactEmail || "your business";

  return [
    "Hello Ava Johnson,",
    "",
    "This is a friendly reminder about your upcoming appointment.",
    "Date: 04/05/2026",
    "Time: 4:00 PM",
    "Location: 1540 Bay Road",
    "",
    "Additional Details:",
    "Please call when you are on the way.",
    "",
    `If you need to reach us before your appointment, please contact us at ${businessContact}.`,
    "",
    "Thank you."
  ].join("\n");
}

function getDraftBranding() {
  const rawDraft = {
    templateStyle: getFieldElement(fieldIds.templateStyle)?.value || "signature",
    brandingEnabled: Boolean(getFieldElement(fieldIds.brandingEnabled)?.checked),
    businessName: getFieldElement(fieldIds.businessName)?.value || "",
    tagline: getFieldElement(fieldIds.tagline)?.value || "",
    headerLabel: getFieldElement(fieldIds.headerLabel)?.value || "",
    accentColor: getFieldElement(fieldIds.accentColor)?.value || getFieldElement(fieldIds.accentHex)?.value || "",
    headerColor: getFieldElement(fieldIds.headerColor)?.value || getFieldElement(fieldIds.headerHex)?.value || "",
    secondaryColor: getFieldElement(fieldIds.secondaryColor)?.value || getFieldElement(fieldIds.secondaryHex)?.value || "",
    artShapeColor: getFieldElement(fieldIds.artShapeColor)?.value || getFieldElement(fieldIds.artShapeHex)?.value || "",
    panelColor: getFieldElement(fieldIds.panelColor)?.value || getFieldElement(fieldIds.panelHex)?.value || "",
    summaryGradientStyle: getFieldElement(fieldIds.summaryGradientStyle)?.value || "soft",
    detailsColor: getFieldElement(fieldIds.detailsColor)?.value || getFieldElement(fieldIds.detailsHex)?.value || "",
    detailsGradientStyle: getFieldElement(fieldIds.detailsGradientStyle)?.value || "soft",
    calendarColor: getFieldElement(fieldIds.calendarColor)?.value || getFieldElement(fieldIds.calendarHex)?.value || "",
    calendarGradientStyle: getFieldElement(fieldIds.calendarGradientStyle)?.value || "soft",
    tertiaryColor: getFieldElement(fieldIds.tertiaryColor)?.value || getFieldElement(fieldIds.tertiaryHex)?.value || "",
    logoUrl: getFieldElement(fieldIds.logoUrl)?.value || "",
    buttonStyle: getFieldElement(fieldIds.buttonStyle)?.value || "pill",
    panelShape: getFieldElement(fieldIds.panelShape)?.value || "rounded",
    heroGradientStyle: getFieldElement(fieldIds.heroGradientStyle)?.value || "signature",
    artShape: getFieldElement(fieldIds.artShape)?.value || "classic",
    shapeIntensity: getFieldElement(fieldIds.shapeIntensity)?.value || "balanced",
    shineStyle: getFieldElement(fieldIds.shineStyle)?.value || "on",
    motionStyle: getFieldElement(fieldIds.motionStyle)?.value || "showcase",
    contactEmail: getFieldElement(fieldIds.contactEmail)?.value || "",
    contactPhone: getFieldElement(fieldIds.contactPhone)?.value || "",
    websiteUrl: getFieldElement(fieldIds.websiteUrl)?.value || "",
    rescheduleUrl: getFieldElement(fieldIds.rescheduleUrl)?.value || ""
  };

  return normalizeBrandingProfile(rawDraft, {
    forPreview: true,
    fallbackEmail: currentUser?.email || ""
  });
}

function applyBrandingToForm(branding) {
  const normalized = normalizeBrandingProfile(branding, {
    fallbackEmail: currentUser?.email || ""
  });

  getFieldElement(fieldIds.templateStyle).value = normalized.templateStyle;
  getFieldElement(fieldIds.brandingEnabled).checked = normalized.brandingEnabled !== false;
  getFieldElement(fieldIds.businessName).value = branding.businessName || "";
  getFieldElement(fieldIds.tagline).value = branding.tagline || "";
  getFieldElement(fieldIds.headerLabel).value = branding.headerLabel || normalized.headerLabel || "";
  getFieldElement(fieldIds.accentColor).value = normalized.accentColor;
  getFieldElement(fieldIds.accentHex).value = normalized.accentColor;
  getFieldElement(fieldIds.headerColor).value = normalized.headerColor;
  getFieldElement(fieldIds.headerHex).value = normalized.headerColor;
  getFieldElement(fieldIds.secondaryColor).value = normalized.secondaryColor;
  getFieldElement(fieldIds.secondaryHex).value = normalized.secondaryColor;
  getFieldElement(fieldIds.artShapeColor).value = normalized.artShapeColor;
  getFieldElement(fieldIds.artShapeHex).value = normalized.artShapeColor;
  getFieldElement(fieldIds.panelColor).value = normalized.panelColor;
  getFieldElement(fieldIds.panelHex).value = normalized.panelColor;
  getFieldElement(fieldIds.summaryGradientStyle).value = normalized.summaryGradientStyle;
  getFieldElement(fieldIds.detailsColor).value = normalized.detailsColor;
  getFieldElement(fieldIds.detailsHex).value = normalized.detailsColor;
  getFieldElement(fieldIds.detailsGradientStyle).value = normalized.detailsGradientStyle;
  getFieldElement(fieldIds.calendarColor).value = normalized.calendarColor;
  getFieldElement(fieldIds.calendarHex).value = normalized.calendarColor;
  getFieldElement(fieldIds.calendarGradientStyle).value = normalized.calendarGradientStyle;
  getFieldElement(fieldIds.tertiaryColor).value = normalized.tertiaryColor;
  getFieldElement(fieldIds.tertiaryHex).value = normalized.tertiaryColor;
  getFieldElement(fieldIds.logoUrl).value = branding.logoUrl || "";
  getFieldElement(fieldIds.buttonStyle).value = normalized.buttonStyle;
  getFieldElement(fieldIds.panelShape).value = normalized.panelShape;
  getFieldElement(fieldIds.heroGradientStyle).value = normalized.heroGradientStyle;
  getFieldElement(fieldIds.artShape).value = normalized.artShape;
  getFieldElement(fieldIds.shapeIntensity).value = normalized.shapeIntensity;
  getFieldElement(fieldIds.shineStyle).value = normalized.shineStyle;
  getFieldElement(fieldIds.motionStyle).value = normalized.motionStyle;
  getFieldElement(fieldIds.contactEmail).value = branding.contactEmail || currentUser?.email || "";
  getFieldElement(fieldIds.contactPhone).value = branding.contactPhone || "";
  getFieldElement(fieldIds.websiteUrl).value = branding.websiteUrl || "";
  getFieldElement(fieldIds.rescheduleUrl).value = branding.rescheduleUrl || "";
  updateHelperHints();
  syncTemplateCards();
  renderPreview();
}

function syncTemplateCards() {
  const activeTemplate = getFieldElement(fieldIds.templateStyle)?.value || "signature";

  document.querySelectorAll(".signature-card").forEach(card => {
    const isActive = card.dataset.template === activeTemplate;
    card.classList.toggle("is-active", isActive);
    card.setAttribute("aria-pressed", String(isActive));
    const cta = card.querySelector(".signature-card-cta");

    if (cta) {
      cta.textContent = isActive ? "Selected" : "Preview";
    }
  });
}

function applyTemplatePreset(templateId) {
  const preset = TEMPLATE_STYLE_PRESETS[templateId];

  if (!preset) {
    return;
  }

  getFieldElement(fieldIds.accentColor).value = preset.accentColor;
  getFieldElement(fieldIds.accentHex).value = preset.accentColor;
  getFieldElement(fieldIds.headerColor).value = preset.headerColor;
  getFieldElement(fieldIds.headerHex).value = preset.headerColor;
  getFieldElement(fieldIds.secondaryColor).value = preset.secondaryColor;
  getFieldElement(fieldIds.secondaryHex).value = preset.secondaryColor;
  getFieldElement(fieldIds.artShapeColor).value = preset.artShapeColor;
  getFieldElement(fieldIds.artShapeHex).value = preset.artShapeColor;
  getFieldElement(fieldIds.panelColor).value = preset.panelColor;
  getFieldElement(fieldIds.panelHex).value = preset.panelColor;
  getFieldElement(fieldIds.summaryGradientStyle).value = preset.summaryGradientStyle;
  getFieldElement(fieldIds.detailsColor).value = preset.detailsColor;
  getFieldElement(fieldIds.detailsHex).value = preset.detailsColor;
  getFieldElement(fieldIds.detailsGradientStyle).value = preset.detailsGradientStyle;
  getFieldElement(fieldIds.calendarColor).value = preset.calendarColor;
  getFieldElement(fieldIds.calendarHex).value = preset.calendarColor;
  getFieldElement(fieldIds.calendarGradientStyle).value = preset.calendarGradientStyle;
  getFieldElement(fieldIds.tertiaryColor).value = preset.tertiaryColor;
  getFieldElement(fieldIds.tertiaryHex).value = preset.tertiaryColor;
  getFieldElement(fieldIds.buttonStyle).value = preset.buttonStyle;
  getFieldElement(fieldIds.panelShape).value = preset.panelShape;
  getFieldElement(fieldIds.heroGradientStyle).value = preset.heroGradientStyle;
  getFieldElement(fieldIds.artShape).value = preset.artShape;
  getFieldElement(fieldIds.shapeIntensity).value = preset.shapeIntensity;
  getFieldElement(fieldIds.shineStyle).value = preset.shineStyle;
  getFieldElement(fieldIds.motionStyle).value = preset.motionStyle;
}

function renderPreview() {
  const draftBranding = getDraftBranding();
  const sampleMessage = buildSampleMessage(draftBranding);
  const randomSeed = draftBranding.artShape === "random" ? previewRandomNonce : 0;
  const previewKey = JSON.stringify({ ...draftBranding, __randomSeed: randomSeed, __sampleMessage: sampleMessage });

  if (previewKey === lastPreviewKey) {
    return;
  }

  lastPreviewKey = previewKey;
  const previewHtml = buildReminderEmailHtml({
    message: sampleMessage,
    calendarLinks: {
      apple: "#apple-calendar",
      outlook: "#outlook-calendar",
      google: "#google-calendar"
    },
    brandingProfile: draftBranding,
    previewMode: true,
    randomSeed
  });

  if (previewFrame) {
    previewFrame.srcdoc = previewHtml;
  }

  applyLiveBrandingState(draftBranding);

  if (previewSubject) {
    previewSubject.textContent = buildReminderEmailSubject(draftBranding, { message: sampleMessage });
  }

  if (previewFrom) {
    previewFrom.textContent = draftBranding.brandingEnabled === false
      ? "Standard Reminder Email"
      : draftBranding.businessName || "Your business name";
  }

  if (previewEmail) {
    previewEmail.textContent = draftBranding.brandingEnabled === false
      ? (currentUser?.email || "you@example.com")
      : (draftBranding.contactEmail || currentUser?.email || "you@example.com");
  }

  if (brandingEnabledNote) {
    brandingEnabledNote.textContent = draftBranding.brandingEnabled === false
      ? "Branding is off. Your design stays saved here, but outgoing emails use the standard reminder format."
      : "Branding is on. Outgoing emails will use your saved branded layout.";
  }

  applyPreviewHighlight(currentPreviewFocusField);
}

function setQaEmailStatus(message, type = "info") {
  if (!qaLastEmailStatus) {
    return;
  }

  qaLastEmailStatus.textContent = message || "";
  qaLastEmailStatus.className = `field-hint qa-email-status ${type}`;
}

function clearLastSentEmailRecord() {
  lastSentEmailRecord = null;

  if (qaOpenRawEmailButton) {
    qaOpenRawEmailButton.disabled = true;
  }

  if (qaLastEmailMeta) {
    qaLastEmailMeta.hidden = true;
  }

  if (qaLastEmailViewer) {
    qaLastEmailViewer.hidden = true;
  }

  if (qaLastEmailFrame) {
    qaLastEmailFrame.srcdoc = "";
  }

  if (qaLastEmailHtml) {
    qaLastEmailHtml.value = "";
  }
}

function formatQaDateTime(value) {
  const date = new Date(value || "");

  if (!Number.isFinite(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function renderLastSentEmailRecord(record) {
  lastSentEmailRecord = record;

  if (qaOpenRawEmailButton) {
    qaOpenRawEmailButton.disabled = false;
  }

  if (qaLastEmailSubject) {
    qaLastEmailSubject.textContent = record.subject || "No subject found";
  }

  if (qaLastEmailSentAt) {
    qaLastEmailSentAt.textContent = formatQaDateTime(record.sentAt);
  }

  if (qaLastEmailRecipient) {
    qaLastEmailRecipient.textContent = record.recipient || "No recipient found";
  }

  if (qaLastEmailMessageId) {
    qaLastEmailMessageId.textContent = record.messageId || "Not available";
  }

  if (qaLastEmailMeta) {
    qaLastEmailMeta.hidden = false;
  }

  if (qaLastEmailFrame) {
    qaLastEmailFrame.srcdoc = record.html || "";
  }

  if (qaLastEmailHtml) {
    qaLastEmailHtml.value = record.html || "";
  }

  if (qaLastEmailViewer) {
    qaLastEmailViewer.hidden = false;
  }
}

async function loadLastSentEmailHtml({ announce = true } = {}) {
  if (!currentUser || !isQaRuntime()) {
    return;
  }

  setButtonBusy(qaLoadLastEmailButton, true, "Loading...");

  if (announce) {
    setQaEmailStatus("Loading the exact HTML from this browser session...", "info");
  }

  try {
    const storedValue = window.sessionStorage.getItem(QA_LAST_EMAIL_STORAGE_KEY);

    if (!storedValue) {
      clearLastSentEmailRecord();
      setQaEmailStatus("No QA email HTML is stored in this browser session yet. Send a fresh automated email from this same tab, then load it here.", "info");
      return;
    }

    const match = JSON.parse(storedValue);
    const html = String(match?.html || "").trim();

    if (!html) {
      clearLastSentEmailRecord();
      setQaEmailStatus("The saved QA email HTML in this browser session is empty. Send a fresh automated email and try again.", "info");
      return;
    }

    renderLastSentEmailRecord({
      html,
      subject: String(match?.subject || "").trim(),
      sentAt: match?.sentAt || null,
      recipient: String(match?.recipient || "").trim(),
      messageId: String(match?.messageId || "").trim()
    });
    setQaEmailStatus("Loaded the exact HTML from the most recent QA email saved in this browser session.", "success");

    if (announce) {
      qaLastEmailViewer?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (error) {
    clearLastSentEmailRecord();
    setQaEmailStatus(error.message || "Unable to load the last sent email HTML right now.", "error");
  } finally {
    setButtonBusy(qaLoadLastEmailButton, false);
  }
}

function openLastSentEmailRaw() {
  if (!lastSentEmailRecord?.html) {
    setQaEmailStatus("Load a sent email first so there is raw HTML to open.", "error");
    return;
  }

  const rawPageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Raw Email HTML</title>
  <style>
    body { margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: #0f172a; color: #e2e8f0; }
    main { max-width: 1100px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 14px; font: 800 28px/1.1 system-ui, sans-serif; color: #f8fafc; }
    p { margin: 0 0 8px; color: #cbd5e1; font: 14px/1.6 system-ui, sans-serif; }
    pre { white-space: pre-wrap; word-break: break-word; background: #111827; border: 1px solid #334155; border-radius: 18px; padding: 18px; overflow: auto; color: #e2e8f0; font-size: 13px; line-height: 1.6; }
  </style>
</head>
<body>
  <main>
    <h1>Raw Email HTML</h1>
    <p><strong>Subject:</strong> ${escapeHtml(lastSentEmailRecord.subject || "No subject found")}</p>
    <p><strong>Sent:</strong> ${escapeHtml(formatQaDateTime(lastSentEmailRecord.sentAt))}</p>
    <p><strong>Recipient:</strong> ${escapeHtml(lastSentEmailRecord.recipient || "No recipient found")}</p>
    <pre>${escapeHtml(lastSentEmailRecord.html)}</pre>
  </main>
</body>
</html>`;

  const blob = new Blob([rawPageHtml], { type: "text/html;charset=utf-8" });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.target = "_blank";
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 60000);

  setQaEmailStatus("Opened the raw email HTML in a new tab.", "success");
}

function applyLiveBrandingState(branding) {
  document.body.style.setProperty("--branding-live-accent", branding.accentColor || "#2563eb");
  document.body.style.setProperty("--branding-live-button-radius", getLiveButtonRadius(branding.buttonStyle));
  document.body.dataset.brandingShine = branding.shineStyle || "on";
  document.body.dataset.brandingMotion = branding.motionStyle || "showcase";
  document.body.dataset.brandingButtonStyle = branding.buttonStyle || "pill";
}

function updateHelperHints() {
  updateHelperHint(helperTextIds.headerColor, getHeaderColorHint());
  updateHelperHint(helperTextIds.secondaryColor, getSecondaryColorHint());
  updateHelperHint(helperTextIds.artShapeColor, getArtShapeColorHint());
  updateHelperHint(helperTextIds.panelColor, getPanelColorHint());
  updateHelperHint(helperTextIds.detailsColor, getDetailsColorHint());
  updateHelperHint(helperTextIds.calendarColor, getCalendarColorHint());
  updateHelperHint(helperTextIds.tertiaryColor, getTertiaryColorHint());
  updateHelperHint(helperTextIds.buttonStyle, getButtonStyleHint());
  updateHelperHint(helperTextIds.panelShape, getPanelShapeHint());
  updateHelperHint(helperTextIds.heroGradientStyle, getHeroGradientHint());
  updateHelperHint(helperTextIds.artShape, getArtShapeHint());
  updateHelperHint(helperTextIds.shapeIntensity, getShapeIntensityHint());
  updateHelperHint(helperTextIds.shineStyle, getShineStyleHint());
  updateHelperHint(helperTextIds.motionStyle, getMotionStyleHint());
}

function updateHelperHint(elementId, text) {
  const element = document.getElementById(elementId);

  if (element) {
    element.textContent = text;
  }
}

function getHeaderColorHint() {
  return "Changes the large top company section behind the business name and tagline.";
}

function getSecondaryColorHint() {
  return "Used as the support accent inside the top section and hero art.";
}

function getArtShapeColorHint() {
  return "Changes the geometric art itself without recoloring the entire header.";
}

function getPanelColorHint() {
  return "Used behind the date, time, and location summary cards.";
}

function getDetailsColorHint() {
  return "Used behind the additional details section.";
}

function getCalendarColorHint() {
  return "Used behind the add-to-calendar section.";
}

function getTertiaryColorHint() {
  return "Used for the supporting accent areas like the website button and footer tint.";
}

function getButtonStyleHint() {
  const value = getFieldElement(fieldIds.buttonStyle)?.value || "pill";

  if (value === "crisp") {
    return "Makes the action buttons more squared and sharp.";
  }

  if (value === "bubbly") {
    return "Makes the action buttons puffier and more playful.";
  }

  if (value === "cloudy") {
    return "Gives the action buttons a softer cloud-like curve.";
  }

  if (value === "parallelogram") {
    return "Turns the action buttons into angled, executive-style shapes.";
  }

  if (value === "rounded") {
    return "Keeps the action buttons soft, but not fully pill-shaped.";
  }

  return "Makes the action buttons fully rounded and softer.";
}

function getPanelShapeHint() {
  const value = getFieldElement(fieldIds.panelShape)?.value || "rounded";

  if (value === "crisp") {
    return "Makes the email info boxes sharper and more structured.";
  }

  if (value === "bubbly") {
    return "Makes the email info boxes puffier and friendlier.";
  }

  if (value === "cloudy") {
    return "Gives the email info boxes softer organic curves.";
  }

  if (value === "parallelogram") {
    return "Turns the email info boxes into angled geometric panels.";
  }

  return "Keeps the email info boxes smooth and rounded.";
}

function getHeroGradientHint() {
  const value = getFieldElement(fieldIds.heroGradientStyle)?.value || "signature";

  if (value === "spotlight") {
    return "Uses a softer fade so the top section feels lighter and calmer.";
  }

  if (value === "split") {
    return "Pushes the secondary color harder into the top section for a bolder two-tone look.";
  }

  if (value === "solid") {
    return "Keeps the top section mostly on the main brand color with minimal blending.";
  }

  return "Blends the main and secondary colors in a premium signature-style gradient.";
}

function getArtShapeHint() {
  const value = getFieldElement(fieldIds.artShape)?.value || "classic";

  if (value === "none") {
    return "Turns the geometric hero art off completely for a cleaner, safer layout.";
  }

  if (value === "orbit") {
    return "Uses rings and orbit-like shapes around the main mark.";
  }

  if (value === "stacked") {
    return "Uses layered panels behind the main mark.";
  }

  if (value === "ribbon") {
    return "Uses flowing bar shapes with a sleeker ribbon feel.";
  }

  if (value === "prism") {
    return "Uses angular prism and diamond geometry.";
  }

  if (value === "frame") {
    return "Uses a stronger outlined frame around the main mark.";
  }

  if (value === "halo") {
    return "Uses circular rings and halo-style geometry around the main mark.";
  }

  if (value === "cascade") {
    return "Uses stepped descending panels for a stronger sculpted look.";
  }

  if (value === "split") {
    return "Uses split bars and a centered divider for a sharper art direction.";
  }

  if (value === "random") {
    return "Generates a fresh random art layout live in the preview.";
  }

  return "Uses the original geometric shape layout.";
}

function getShapeIntensityHint() {
  const value = getFieldElement(fieldIds.shapeIntensity)?.value || "balanced";

  if (value === "soft") {
    return "Uses calmer, lighter geometric art in the hero.";
  }

  if (value === "bold") {
    return "Makes the geometric art larger and more dramatic.";
  }

  return "Keeps the geometric art noticeable without overpowering the layout.";
}

function getShineStyleHint() {
  const value = getFieldElement(fieldIds.shineStyle)?.value || "on";
  return value === "off"
    ? "Turns off the glossy light sweep on the preview cards."
    : "Adds a soft glass sweep across the preview cards.";
}

function getMotionStyleHint() {
  const value = getFieldElement(fieldIds.motionStyle)?.value || "showcase";

  if (value === "float") {
    return "Focuses on the shards and art drifting gently.";
  }

  if (value === "pulse") {
    return "Focuses on the aura softly breathing in and out.";
  }

  if (value === "still") {
    return "Turns decorative motion off so the preview stays still.";
  }

  return "Mixes floating, pulsing, and shine for the most premium preview.";
}

function clampEditorPosition(left, top) {
  const editorCard = editorModal?.querySelector(".branding-editor-card");

  if (!editorCard) {
    return { left, top };
  }

  const width = editorCard.offsetWidth || 380;
  const height = editorCard.offsetHeight || 620;
  const maxLeft = Math.max(16, window.innerWidth - width - 16);
  const maxTop = Math.max(72, window.innerHeight - height - 16);

  return {
    left: Math.min(Math.max(16, left), maxLeft),
    top: Math.min(Math.max(72, top), maxTop)
  };
}

function setEditorPosition(left, top) {
  const next = clampEditorPosition(left, top);
  document.documentElement.style.setProperty("--branding-editor-left", `${next.left}px`);
  document.documentElement.style.setProperty("--branding-editor-top", `${next.top}px`);
}

function ensureDefaultEditorPosition() {
  if (window.innerWidth <= 760 || editorHasCustomPosition) {
    return;
  }

  const editorCard = editorModal?.querySelector(".branding-editor-card");
  const width = editorCard?.offsetWidth || 380;
  const defaultLeft = window.innerWidth - width - 28;
  setEditorPosition(defaultLeft, 104);
}

function openBrandingEditorModal(groupId = currentEditorGroup || "hero") {
  setActiveEditorGroup(groupId);

  if (editorModal) {
    editorModal.hidden = false;
  }

  document.body.classList.add("branding-modal-open");
  window.requestAnimationFrame(() => {
    ensureDefaultEditorPosition();
  });
}

function closeBrandingEditorModal() {
  if (editorModal) {
    editorModal.hidden = true;
  }

  document.body.classList.remove("branding-modal-open");
  applyPreviewHighlight("");
  clearIframePreviewHover();
}

function setActiveEditorGroup(groupId = "hero") {
  currentEditorGroup = EDITOR_GROUP_COPY[groupId] ? groupId : "hero";

  document.querySelectorAll("[data-editor-group]").forEach(element => {
    const groups = String(element.dataset.editorGroup || "").split(/\s+/).filter(Boolean);
    const isActive = groups.includes(currentEditorGroup);
    element.classList.toggle("is-active", isActive);
    element.hidden = !isActive;
  });

  if (editorTitle) {
    editorTitle.textContent = EDITOR_GROUP_COPY[currentEditorGroup]?.title || "Click a part of the email to edit it";
  }

  if (editorCopy) {
    editorCopy.textContent = EDITOR_GROUP_COPY[currentEditorGroup]?.copy
      || "Hover the preview and click the area you want to change. Only the matching controls will stay visible here.";
  }
}

function openEditorGroupForField(fieldId) {
  if (!fieldId) {
    return;
  }

  const groupId = FIELD_TO_EDITOR_GROUP[fieldId];

  if (groupId) {
    setActiveEditorGroup(groupId);
  }
}

function applyPreviewHighlight(fieldId) {
  currentPreviewFocusField = fieldId || "";
  const config = PREVIEW_HIGHLIGHT_CONFIG[currentPreviewFocusField];

  if (previewFocusNote) {
    previewFocusNote.textContent = config?.note || defaultPreviewFocusNote;
  }

  if (!config) {
    clearIframePreviewHighlights();
    return;
  }

  applyIframePreviewHighlights(config.iframeAreas || []);
}

function clearPreviewHighlightIfIdle() {
  window.setTimeout(() => {
    const activeElement = document.activeElement;
    const insideForm = brandingForm?.contains(activeElement);

    if (!insideForm) {
      applyPreviewHighlight("");
    }
  }, 0);
}

function clearPagePreviewHighlights() {
  document.querySelectorAll(".preview-highlighted").forEach(element => {
    element.classList.remove("preview-highlighted");
  });
}

function clearIframePreviewHighlights() {
  const frameDocument = previewFrame?.contentDocument;

  if (!frameDocument) {
    return;
  }

  frameDocument.querySelectorAll(".preview-focus").forEach(element => {
    element.classList.remove("preview-focus");
  });
}

function clearIframePreviewHover() {
  const frameDocument = previewFrame?.contentDocument;

  if (!frameDocument) {
    return;
  }

  frameDocument.querySelectorAll(".preview-hover").forEach(element => {
    element.classList.remove("preview-hover");
  });
}

function applyIframePreviewHighlights(areas) {
  const frameDocument = previewFrame?.contentDocument;

  if (!frameDocument) {
    return;
  }

  clearIframePreviewHighlights();

  areas.forEach(area => {
    frameDocument.querySelectorAll(`[data-preview-area="${area}"]`).forEach(element => {
      element.classList.add("preview-focus");
    });
  });
}

function focusFieldFromPreviewArea(area) {
  const targetFieldId = PREVIEW_AREA_TO_FIELD_ID[area];
  const groupId = PREVIEW_AREA_TO_EDITOR_GROUP[area];

  if (groupId) {
    openBrandingEditorModal(groupId);
  }

  if (!targetFieldId) {
    return;
  }

  const field = getFieldElement(targetFieldId);

  if (!field) {
    return;
  }

  applyPreviewHighlight(targetFieldId);
  field.scrollIntoView({ behavior: "smooth", block: "center" });

  window.setTimeout(() => {
    field.focus({ preventScroll: true });
    if (typeof field.select === "function" && (field.tagName === "INPUT" || field.tagName === "TEXTAREA")) {
      field.select();
    }
  }, 120);
}

function wirePreviewFrameInteractions() {
  const frameDocument = previewFrame?.contentDocument;

  if (!frameDocument) {
    return;
  }

  frameDocument.querySelectorAll("[data-preview-area]").forEach(element => {
    if (element.dataset.previewInteractiveBound === "true") {
      return;
    }

    element.dataset.previewInteractiveBound = "true";

    element.addEventListener("mouseenter", () => {
      clearIframePreviewHover();
      element.classList.add("preview-hover");
    });

    element.addEventListener("mouseleave", () => {
      element.classList.remove("preview-hover");
    });

    element.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      clearIframePreviewHover();
      focusFieldFromPreviewArea(element.dataset.previewArea || "");
    });
  });

  frameDocument.addEventListener("click", event => {
    const interactiveArea = event.target?.closest?.("[data-preview-area]");

    if (!interactiveArea) {
      applyPreviewHighlight("");
      clearIframePreviewHover();
    }
  });
}

function getLiveButtonRadius(style) {
  if (style === "crisp") {
    return "10px";
  }

  if (style === "rounded") {
    return "18px";
  }

  if (style === "bubbly") {
    return "28px";
  }

  if (style === "cloudy") {
    return "32px";
  }

  if (style === "parallelogram") {
    return "12px";
  }

  return "999px";
}

function queuePreviewRender() {
  if (getFieldElement(fieldIds.artShape)?.value === "random") {
    previewRandomNonce += 1;
  }

  window.clearTimeout(previewRenderTimer);
  previewRenderTimer = window.setTimeout(() => {
    renderPreview();
  }, 160);
}

function updateSignedInView(user) {
  const isSignedIn = Boolean(user);

  if (signedOutShell) {
    signedOutShell.hidden = isSignedIn;
  }

  if (signedInShell) {
    signedInShell.hidden = !isSignedIn;
  }

  document.querySelectorAll("[data-auth-only]").forEach(link => {
    link.hidden = !isSignedIn;
  });

  if (pricePill) {
    pricePill.textContent = isSignedIn ? getTierLabel(user) : "Sign in required";
  }

  if (qaToolsShell) {
    qaToolsShell.hidden = !(isSignedIn && isQaRuntime());
  }

  if (!isSignedIn) {
    clearLastSentEmailRecord();
  }
}

async function saveBranding() {
  if (!supabase || !currentUser) {
    setStatus("Please sign in first.", "error");
    return;
  }

  const rawBranding = {
    templateStyle: getFieldElement(fieldIds.templateStyle)?.value || "signature",
    brandingEnabled: Boolean(getFieldElement(fieldIds.brandingEnabled)?.checked),
    businessName: (getFieldElement(fieldIds.businessName)?.value || "").trim(),
    tagline: (getFieldElement(fieldIds.tagline)?.value || "").trim(),
    headerLabel: (getFieldElement(fieldIds.headerLabel)?.value || "").trim(),
    accentColor: getFieldElement(fieldIds.accentColor)?.value || getFieldElement(fieldIds.accentHex)?.value || "",
    headerColor: getFieldElement(fieldIds.headerColor)?.value || getFieldElement(fieldIds.headerHex)?.value || "",
    secondaryColor: getFieldElement(fieldIds.secondaryColor)?.value || getFieldElement(fieldIds.secondaryHex)?.value || "",
    artShapeColor: getFieldElement(fieldIds.artShapeColor)?.value || getFieldElement(fieldIds.artShapeHex)?.value || "",
    panelColor: getFieldElement(fieldIds.panelColor)?.value || getFieldElement(fieldIds.panelHex)?.value || "",
    summaryGradientStyle: getFieldElement(fieldIds.summaryGradientStyle)?.value || "soft",
    detailsColor: getFieldElement(fieldIds.detailsColor)?.value || getFieldElement(fieldIds.detailsHex)?.value || "",
    detailsGradientStyle: getFieldElement(fieldIds.detailsGradientStyle)?.value || "soft",
    calendarColor: getFieldElement(fieldIds.calendarColor)?.value || getFieldElement(fieldIds.calendarHex)?.value || "",
    calendarGradientStyle: getFieldElement(fieldIds.calendarGradientStyle)?.value || "soft",
    tertiaryColor: getFieldElement(fieldIds.tertiaryColor)?.value || getFieldElement(fieldIds.tertiaryHex)?.value || "",
    logoUrl: (getFieldElement(fieldIds.logoUrl)?.value || "").trim(),
    buttonStyle: getFieldElement(fieldIds.buttonStyle)?.value || "pill",
    panelShape: getFieldElement(fieldIds.panelShape)?.value || "rounded",
    heroGradientStyle: getFieldElement(fieldIds.heroGradientStyle)?.value || "signature",
    artShape: getFieldElement(fieldIds.artShape)?.value || "classic",
    shapeIntensity: getFieldElement(fieldIds.shapeIntensity)?.value || "balanced",
    shineStyle: getFieldElement(fieldIds.shineStyle)?.value || "on",
    motionStyle: getFieldElement(fieldIds.motionStyle)?.value || "showcase",
    contactEmail: (getFieldElement(fieldIds.contactEmail)?.value || "").trim(),
    contactPhone: (getFieldElement(fieldIds.contactPhone)?.value || "").trim(),
    websiteUrl: (getFieldElement(fieldIds.websiteUrl)?.value || "").trim(),
    rescheduleUrl: (getFieldElement(fieldIds.rescheduleUrl)?.value || "").trim()
  };

  if (!rawBranding.businessName) {
    setStatus("Business name is required before you save branding.", "error");
    getFieldElement(fieldIds.businessName)?.focus();
    return;
  }

  const normalizedForStorage = normalizeBrandingProfile(rawBranding, {
    fallbackEmail: currentUser.email || ""
  });

  setButtonBusy(saveBrandingButton, true, "Saving branding...");
  setStatus("");

  try {
    const metadata = {
      ...(currentUser.user_metadata || {}),
      branding_profile: normalizedForStorage
    };

    const { data, error } = await supabase.auth.updateUser({
      data: metadata
    });

    if (error) {
      throw error;
    }

    currentUser = data.user || currentUser;
    currentSavedBranding = { ...normalizedForStorage };
    applyBrandingToForm(currentSavedBranding);
    setStatus(
      normalizedForStorage.brandingEnabled === false
        ? "Branding saved. Outgoing emails will use the standard reminder layout until you turn branding back on."
        : "Branding saved. Your automated reminder emails will use this look.",
      "success"
    );
  } catch (error) {
    setStatus(error.message || "Unable to save branding right now.", "error");
  } finally {
    setButtonBusy(saveBrandingButton, false);
  }
}

function resetBranding() {
  applyBrandingToForm(currentSavedBranding);
  setStatus("Branding preview reset to your saved selections.", "info");
}

function renderTemplateCards() {
  if (!templateGrid) {
    return;
  }

  templateGrid.innerHTML = BRANDING_TEMPLATE_OPTIONS.map(option => {
    const showcase = TEMPLATE_SHOWCASES[option.id] || TEMPLATE_SHOWCASES.signature;

    return `
      <button class="signature-card ${showcase.themeClass}" type="button" data-template="${option.id}" aria-pressed="false">
        <span class="signature-card-rail" aria-hidden="true">
          <span class="signature-card-icon">www</span>
          <span class="signature-card-icon">@</span>
          <span class="signature-card-icon">in</span>
          <span class="signature-card-icon">tel</span>
        </span>
        <span class="signature-card-copy-wrap">
          <span class="signature-card-badge">${option.label}</span>
          <span class="signature-card-brand">${showcase.line}</span>
          <span class="signature-card-title">${showcase.company}</span>
          <span class="signature-card-copy">${showcase.promise}</span>
          <span class="signature-card-meta">
            <strong>${showcase.service}</strong>
            ${showcase.email}<br>
            ${showcase.website}
          </span>
        </span>
        <span class="signature-card-art" aria-hidden="true">
          <span class="signature-card-aura"></span>
          <span class="signature-card-shard one"></span>
          <span class="signature-card-shard two"></span>
          <span class="signature-card-shard three"></span>
          <span class="signature-card-mark">
            <span class="signature-card-mark-fill">${showcase.mark}</span>
          </span>
          <span class="signature-card-cta">Preview</span>
        </span>
      </button>
    `;
  }).join("");

  templateGrid.addEventListener("click", event => {
    const button = event.target.closest("[data-template]");

    if (!button) {
      return;
    }

    const nextTemplate = button.dataset.template || "signature";
    getFieldElement(fieldIds.templateStyle).value = nextTemplate;
    applyTemplatePreset(nextTemplate);
    setActiveEditorGroup("hero");
    applyPreviewHighlight("");
    syncTemplateCards();
    updateHelperHints();
    queuePreviewRender();
  });
}

function wireFormInputs() {
  if (!brandingForm) {
    return;
  }

  const accentColorInput = getFieldElement(fieldIds.accentColor);
  const accentHexInput = getFieldElement(fieldIds.accentHex);
  const headerColorInput = getFieldElement(fieldIds.headerColor);
  const headerHexInput = getFieldElement(fieldIds.headerHex);
  const secondaryColorInput = getFieldElement(fieldIds.secondaryColor);
  const secondaryHexInput = getFieldElement(fieldIds.secondaryHex);
  const artShapeColorInput = getFieldElement(fieldIds.artShapeColor);
  const artShapeHexInput = getFieldElement(fieldIds.artShapeHex);
  const panelColorInput = getFieldElement(fieldIds.panelColor);
  const panelHexInput = getFieldElement(fieldIds.panelHex);
  const detailsColorInput = getFieldElement(fieldIds.detailsColor);
  const detailsHexInput = getFieldElement(fieldIds.detailsHex);
  const calendarColorInput = getFieldElement(fieldIds.calendarColor);
  const calendarHexInput = getFieldElement(fieldIds.calendarHex);
  const tertiaryColorInput = getFieldElement(fieldIds.tertiaryColor);
  const tertiaryHexInput = getFieldElement(fieldIds.tertiaryHex);
  const artShapeInput = getFieldElement(fieldIds.artShape);

  brandingForm.addEventListener("input", event => {
    if (event.target === accentColorInput && accentHexInput) {
      accentHexInput.value = accentColorInput.value;
    }

    if (event.target === headerColorInput && headerHexInput) {
      headerHexInput.value = headerColorInput.value;
    }

    if (event.target === secondaryColorInput && secondaryHexInput) {
      secondaryHexInput.value = secondaryColorInput.value;
    }

    if (event.target === artShapeColorInput && artShapeHexInput) {
      artShapeHexInput.value = artShapeColorInput.value;
    }

    if (event.target === panelColorInput && panelHexInput) {
      panelHexInput.value = panelColorInput.value;
    }

    if (event.target === detailsColorInput && detailsHexInput) {
      detailsHexInput.value = detailsColorInput.value;
    }

    if (event.target === calendarColorInput && calendarHexInput) {
      calendarHexInput.value = calendarColorInput.value;
    }

    if (event.target === tertiaryColorInput && tertiaryHexInput) {
      tertiaryHexInput.value = tertiaryColorInput.value;
    }

    if (event.target === accentHexInput && accentColorInput && /^#[0-9a-f]{3,6}$/i.test(accentHexInput.value.trim())) {
      accentColorInput.value = accentHexInput.value.trim();
    }

    if (event.target === headerHexInput && headerColorInput && /^#[0-9a-f]{3,6}$/i.test(headerHexInput.value.trim())) {
      headerColorInput.value = headerHexInput.value.trim();
    }

    if (event.target === secondaryHexInput && secondaryColorInput && /^#[0-9a-f]{3,6}$/i.test(secondaryHexInput.value.trim())) {
      secondaryColorInput.value = secondaryHexInput.value.trim();
    }

    if (event.target === artShapeHexInput && artShapeColorInput && /^#[0-9a-f]{3,6}$/i.test(artShapeHexInput.value.trim())) {
      artShapeColorInput.value = artShapeHexInput.value.trim();
    }

    if (event.target === panelHexInput && panelColorInput && /^#[0-9a-f]{3,6}$/i.test(panelHexInput.value.trim())) {
      panelColorInput.value = panelHexInput.value.trim();
    }

    if (event.target === detailsHexInput && detailsColorInput && /^#[0-9a-f]{3,6}$/i.test(detailsHexInput.value.trim())) {
      detailsColorInput.value = detailsHexInput.value.trim();
    }

    if (event.target === calendarHexInput && calendarColorInput && /^#[0-9a-f]{3,6}$/i.test(calendarHexInput.value.trim())) {
      calendarColorInput.value = calendarHexInput.value.trim();
    }

    if (event.target === tertiaryHexInput && tertiaryColorInput && /^#[0-9a-f]{3,6}$/i.test(tertiaryHexInput.value.trim())) {
      tertiaryColorInput.value = tertiaryHexInput.value.trim();
    }

    if (event.target?.id) {
      openEditorGroupForField(event.target.id);
      applyPreviewHighlight(event.target.id);
    }

    updateHelperHints();
    queuePreviewRender();
  });

  brandingForm.addEventListener("change", event => {
    if (event.target === artShapeInput && artShapeInput?.value === "random") {
      previewRandomNonce += 1;
      setStatus("Random art mode is on. The preview will generate fresh geometric art live.", "info");
    }

    if (event.target instanceof HTMLSelectElement) {
      window.setTimeout(() => {
        event.target.blur();
        applyPreviewHighlight("");
      }, 0);
    } else if (event.target?.id) {
      openEditorGroupForField(event.target.id);
      applyPreviewHighlight(event.target.id);
    }

    updateHelperHints();
    queuePreviewRender();
  });

  brandingForm.addEventListener("focusin", event => {
    if (event.target?.id) {
      openEditorGroupForField(event.target.id);
      applyPreviewHighlight(event.target.id);
    }
  });

  brandingForm.addEventListener("focusout", () => {
    clearPreviewHighlightIfIdle();
  });

  document.addEventListener("pointerdown", event => {
    const target = event.target;
    const insideForm = brandingForm.contains(target);

    if (!insideForm) {
      applyPreviewHighlight("");
    }
  });

  if (editorCloseButton) {
    editorCloseButton.addEventListener("click", () => {
      closeBrandingEditorModal();
    });
  }

  if (editorModal) {
    editorModal.addEventListener("click", event => {
      if (event.target === editorModal) {
        closeBrandingEditorModal();
      }
    });
  }

  if (editorHead) {
    editorHead.addEventListener("pointerdown", event => {
      if (window.innerWidth <= 760) {
        return;
      }

      if (event.target instanceof HTMLElement && event.target.closest("button, input, select, textarea, label, a")) {
        return;
      }

      const editorCard = editorModal?.querySelector(".branding-editor-card");

      if (!editorCard) {
        return;
      }

      const rect = editorCard.getBoundingClientRect();
      editorDragState = {
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        pointerId: event.pointerId
      };

      editorHasCustomPosition = true;
      editorHead.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });

    editorHead.addEventListener("pointermove", event => {
      if (!editorDragState || editorDragState.pointerId !== event.pointerId) {
        return;
      }

      setEditorPosition(
        event.clientX - editorDragState.offsetX,
        event.clientY - editorDragState.offsetY
      );
    });

    const stopDragging = event => {
      if (!editorDragState || editorDragState.pointerId !== event.pointerId) {
        return;
      }

      editorHead.releasePointerCapture?.(event.pointerId);
      editorDragState = null;
    };

    editorHead.addEventListener("pointerup", stopDragging);
    editorHead.addEventListener("pointercancel", stopDragging);
  }

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && editorModal && !editorModal.hidden) {
      closeBrandingEditorModal();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth <= 760) {
      return;
    }

    if (editorHasCustomPosition) {
      const currentLeft = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--branding-editor-left")) || (window.innerWidth - 408);
      const currentTop = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--branding-editor-top")) || 104;
      setEditorPosition(currentLeft, currentTop);
      return;
    }

    ensureDefaultEditorPosition();
  });

  if (previewFrame) {
    previewFrame.addEventListener("load", () => {
      wirePreviewFrameInteractions();
      applyPreviewHighlight(currentPreviewFocusField);
    });
  }

  brandingForm.addEventListener("submit", event => {
    event.preventDefault();
    saveBranding();
  });

  if (resetBrandingButton) {
    resetBrandingButton.addEventListener("click", resetBranding);
  }

  if (signOutButton) {
    signOutButton.addEventListener("click", async () => {
      if (!supabase) {
        return;
      }

      const { error } = await supabase.auth.signOut();

      if (error) {
        setStatus(error.message || "Unable to sign out.", "error");
        return;
      }

      window.location.href = "signin.html";
    });
  }

  if (qaLoadLastEmailButton) {
    qaLoadLastEmailButton.addEventListener("click", () => {
      loadLastSentEmailHtml({ announce: true });
    });
  }

  if (qaOpenRawEmailButton) {
    qaOpenRawEmailButton.addEventListener("click", openLastSentEmailRaw);
  }
}

async function initBrandingPage() {
  renderTemplateCards();
  wireFormInputs();
  setActiveEditorGroup("hero");

  try {
    [appConfig, runtimeConfig] = await Promise.all([
      getPublicConfig(),
      getRuntimeConfig().catch(() => null)
    ]);
  } catch (error) {
    setStatus(error.message || "Unable to load this page.", "error");
    return;
  }

  if (!appConfig.accountsEnabled || !appConfig.supabaseUrl || !appConfig.supabasePublishableKey) {
    if (authSetupNotice) {
      authSetupNotice.hidden = false;
    }
    updateSignedInView(null);
    return;
  }

  supabase = createClient(appConfig.supabaseUrl, appConfig.supabasePublishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });

  const {
    data: { session }
  } = await supabase.auth.getSession();

  currentUser = session?.user || null;
  currentAuthUserId = session?.user?.id || "";
  updateSignedInView(currentUser);

  currentSavedBranding = currentUser?.user_metadata?.branding_profile || {};
  applyBrandingToForm(currentSavedBranding);
  if (currentUser && isQaRuntime()) {
    loadLastSentEmailHtml({ announce: false });
  }

  supabase.auth.onAuthStateChange((event, nextSession) => {
    if (event === "TOKEN_REFRESHED") {
      return;
    }

    const nextUserId = nextSession?.user?.id || "";

    if (nextUserId === currentAuthUserId && event !== "USER_UPDATED") {
      return;
    }

    currentAuthUserId = nextUserId;
    currentUser = nextSession?.user || null;
    currentSavedBranding = currentUser?.user_metadata?.branding_profile || {};
    updateSignedInView(currentUser);
    applyBrandingToForm(currentSavedBranding);
    if (currentUser && isQaRuntime()) {
      loadLastSentEmailHtml({ announce: false });
    }
  });

  if (currentUser && hasSavedBrandingProfile(currentSavedBranding)) {
    setStatus(
      currentSavedBranding.brandingEnabled === false
        ? "Branding is currently off. Your design is still saved here for later."
        : "This preview is using your saved branding profile.",
      "info"
    );
  }
}

initBrandingPage();
