import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import {
  BRANDING_TEMPLATE_OPTIONS,
  TEMPLATE_STYLE_PRESETS,
  buildReminderEmailHtml,
  buildReminderEmailSubject,
  hasSavedBrandingProfile,
  normalizeBrandingProfile
} from "./branding-templates.js?v=20260402w";

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
const previewStage = document.getElementById("branding-preview-stage");
const previewSubject = document.getElementById("branding-preview-subject");
const previewTo = document.getElementById("branding-preview-to");
const previewEmail = document.getElementById("branding-preview-email");
const previewBusinessName = document.getElementById("branding-preview-business-name");
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
const addSocialLinkButton = document.getElementById("branding-add-social-link");
const socialLinksContainer = document.getElementById("branding-social-links");
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
const BRANDING_PREVIEW_WIDTH = 664;
const BRANDING_PREVIEW_MAX_HEIGHT_MOBILE = 340;
const BRANDING_PREVIEW_MIN_HEIGHT_MOBILE = 220;
const BRANDING_PREVIEW_MAX_SCALE_MOBILE = 0.54;

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
  heroGradientColor: "branding-hero-gradient-color",
  heroGradientHex: "branding-hero-gradient-hex",
  heroTextColor: "branding-hero-text-color",
  heroTextHex: "branding-hero-text-hex",
  artShapeColor: "branding-art-shape-color",
  artShapeHex: "branding-art-shape-hex",
  panelColor: "branding-panel-color",
  panelHex: "branding-panel-hex",
  summaryGradientStyle: "branding-summary-gradient",
  summaryTextColor: "branding-summary-text-color",
  summaryTextHex: "branding-summary-text-hex",
  bodyTextColor: "branding-body-text-color",
  bodyTextHex: "branding-body-text-hex",
  bodyColor: "branding-body-color",
  bodyHex: "branding-body-hex",
  bodyGradientStyle: "branding-body-gradient",
  detailsColor: "branding-details-color",
  detailsHex: "branding-details-hex",
  detailsGradientStyle: "branding-details-gradient",
  detailsTextColor: "branding-details-text-color",
  detailsTextHex: "branding-details-text-hex",
  calendarColor: "branding-calendar-color",
  calendarHex: "branding-calendar-hex",
  calendarGradientStyle: "branding-calendar-gradient",
  calendarTextColor: "branding-calendar-text-color",
  calendarTextHex: "branding-calendar-text-hex",
  calendarButtonColor: "branding-calendar-button-color",
  calendarButtonHex: "branding-calendar-button-hex",
  calendarButtonSecondaryColor: "branding-calendar-button-secondary-color",
  calendarButtonSecondaryHex: "branding-calendar-button-secondary-hex",
  calendarButtonGradientStyle: "branding-calendar-button-gradient",
  calendarButtonTextColor: "branding-calendar-button-text-color",
  calendarButtonTextHex: "branding-calendar-button-text-hex",
  buttonColor: "branding-button-color",
  buttonHex: "branding-button-hex",
  tertiaryColor: "branding-tertiary-color",
  tertiaryHex: "branding-tertiary-hex",
  buttonGradientStyle: "branding-button-gradient",
  buttonTextColor: "branding-button-text-color",
  buttonTextHex: "branding-button-text-hex",
  logoUrl: "branding-logo-url",
  buttonStyle: "branding-button-style",
  panelShape: "branding-panel-shape",
  heroGradientStyle: "branding-hero-gradient",
  showHeroArt: "branding-show-hero-art",
  artShape: "branding-art-shape",
  shapeIntensity: "branding-shape-intensity",
  shineStyle: "branding-shine-style",
  motionStyle: "branding-motion-style",
  contactEmail: "branding-contact-email",
  contactPhone: "branding-contact-phone",
  websiteUrl: "branding-website-url",
  rescheduleUrl: "branding-reschedule-url",
  footerColor: "branding-footer-color",
  footerHex: "branding-footer-hex",
  footerTextColor: "branding-footer-text-color",
  footerTextHex: "branding-footer-text-hex",
  socialLinks: "branding-social-links"
};

const helperTextIds = {
  headerColor: "branding-header-color-hint",
  secondaryColor: "branding-secondary-color-hint",
  heroGradientColor: "branding-hero-gradient-color-hint",
  heroTextColor: "branding-hero-text-color-hint",
  artShapeColor: "branding-art-shape-color-hint",
  panelColor: "branding-panel-color-hint",
  summaryTextColor: "branding-summary-text-color-hint",
  bodyTextColor: "branding-body-text-color-hint",
  bodyColor: "branding-body-color-hint",
  bodyGradientStyle: "branding-body-gradient-hint",
  detailsColor: "branding-details-color-hint",
  detailsTextColor: "branding-details-text-color-hint",
  calendarColor: "branding-calendar-color-hint",
  calendarTextColor: "branding-calendar-text-color-hint",
  calendarButtonColor: "branding-calendar-button-color-hint",
  calendarButtonSecondaryColor: "branding-calendar-button-secondary-color-hint",
  calendarButtonGradientStyle: "branding-calendar-button-gradient-hint",
  calendarButtonTextColor: "branding-calendar-button-text-color-hint",
  buttonColor: "branding-button-color-hint",
  tertiaryColor: "branding-tertiary-color-hint",
  buttonGradientStyle: "branding-button-gradient-hint",
  buttonTextColor: "branding-button-text-color-hint",
  showHeroArt: "branding-show-hero-art-hint",
  buttonStyle: "branding-button-style-hint",
  panelShape: "branding-panel-shape-hint",
  heroGradientStyle: "branding-hero-gradient-hint",
  artShape: "branding-art-shape-hint",
  shapeIntensity: "branding-shape-intensity-hint",
  shineStyle: "branding-shine-style-hint",
  motionStyle: "branding-motion-style-hint",
  logoUrl: "branding-logo-url-hint",
  footerColor: "branding-footer-color-hint",
  footerTextColor: "branding-footer-text-color-hint"
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
    selectors: [],
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
  [fieldIds.heroGradientColor]: {
    iframeAreas: ["hero"],
    note: "Highlighting the second color used in the top section gradient."
  },
  [fieldIds.secondaryColor]: {
    iframeAreas: ["hero-secondary", "art"],
    note: "Highlighting the supporting color accent inside the top section and hero art."
  },
  [fieldIds.heroTextColor]: {
    iframeAreas: ["hero", "hero-label", "contact"],
    note: "Highlighting the text that appears in the top company section."
  },
  [fieldIds.artShapeColor]: {
    iframeAreas: ["art"],
    note: "Highlighting the geometric art that uses your dedicated art color."
  },
  [fieldIds.panelColor]: {
    iframeAreas: ["summary"],
    note: "Highlighting the summary cards that use your summary section color."
  },
  [fieldIds.summaryTextColor]: {
    iframeAreas: ["summary"],
    note: "Highlighting the text used inside the date, time, and location cards."
  },
  [fieldIds.summaryGradientStyle]: {
    iframeAreas: ["summary"],
    note: "Highlighting how the summary cards blend their background color."
  },
  [fieldIds.bodyColor]: {
    iframeAreas: ["body"],
    note: "Highlighting the background area behind the main body copy."
  },
  [fieldIds.bodyGradientStyle]: {
    iframeAreas: ["body"],
    note: "Highlighting how the main body section blends its background."
  },
  [fieldIds.bodyTextColor]: {
    iframeAreas: ["body"],
    note: "Highlighting the main body copy text."
  },
  [fieldIds.detailsColor]: {
    iframeAreas: ["details"],
    note: "Highlighting the additional details card color."
  },
  [fieldIds.detailsGradientStyle]: {
    iframeAreas: ["details"],
    note: "Highlighting how the additional details card blends its background."
  },
  [fieldIds.detailsTextColor]: {
    iframeAreas: ["details"],
    note: "Highlighting the text inside the additional details card."
  },
  [fieldIds.calendarColor]: {
    iframeAreas: ["calendar"],
    note: "Highlighting the add-to-calendar section color."
  },
  [fieldIds.calendarGradientStyle]: {
    iframeAreas: ["calendar"],
    note: "Highlighting how the add-to-calendar section blends its background."
  },
  [fieldIds.calendarTextColor]: {
    iframeAreas: ["calendar"],
    note: "Highlighting the text used in the add-to-calendar section."
  },
  [fieldIds.calendarButtonColor]: {
    iframeAreas: ["calendar"],
    note: "Highlighting the calendar app buttons only."
  },
  [fieldIds.calendarButtonSecondaryColor]: {
    iframeAreas: ["calendar"],
    note: "Highlighting the secondary tone used in the calendar app button gradients."
  },
  [fieldIds.calendarButtonGradientStyle]: {
    iframeAreas: ["calendar"],
    note: "Highlighting how the calendar app buttons blend their colors together."
  },
  [fieldIds.calendarButtonTextColor]: {
    iframeAreas: ["calendar"],
    note: "Highlighting the text used inside the calendar app buttons."
  },
  [fieldIds.buttonColor]: {
    iframeAreas: ["buttons"],
    note: "Highlighting the main color used on the main reminder buttons."
  },
  [fieldIds.tertiaryColor]: {
    iframeAreas: ["buttons"],
    note: "Highlighting the secondary tone used in the main reminder button gradients."
  },
  [fieldIds.buttonGradientStyle]: {
    iframeAreas: ["buttons"],
    note: "Highlighting how the main reminder buttons blend their two colors."
  },
  [fieldIds.buttonTextColor]: {
    iframeAreas: ["buttons"],
    note: "Highlighting the text used inside the main reminder buttons."
  },
  [fieldIds.logoUrl]: {
    iframeAreas: ["logo"],
    note: "Highlighting the logo area."
  },
  [fieldIds.buttonStyle]: {
    iframeAreas: ["buttons"],
    selectors: ["#branding-preview-subject", ".signature-card-cta"],
    note: "Highlighting the main reminder buttons whose corners change shape."
  },
  [fieldIds.panelShape]: {
    iframeAreas: ["summary", "details", "calendar"],
    note: "Highlighting the summary, details, and calendar panels whose corners and shape will change."
  },
  [fieldIds.heroGradientStyle]: {
    iframeAreas: ["hero"],
    note: "Highlighting the top company section where the main and secondary colors blend together."
  },
  [fieldIds.showHeroArt]: {
    iframeAreas: ["art"],
    note: "Highlighting the hero art area that can be shown or hidden in the top section."
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
    selectors: [],
    note: "Highlighting where your business email appears."
  },
  [fieldIds.contactPhone]: {
    iframeAreas: ["contact"],
    note: "Highlighting where your business phone appears."
  },
  [fieldIds.websiteUrl]: {
    iframeAreas: ["buttons", "footer"],
    note: "Highlighting the website button and footer link area."
  },
  [fieldIds.rescheduleUrl]: {
    iframeAreas: ["buttons"],
    note: "Highlighting the reschedule button area."
  },
  [fieldIds.footerColor]: {
    iframeAreas: ["footer"],
    note: "Highlighting the footer background and tint at the bottom of the email."
  },
  [fieldIds.footerTextColor]: {
    iframeAreas: ["footer"],
    note: "Highlighting the footer text color."
  },
  [fieldIds.socialLinks]: {
    iframeAreas: ["footer"],
    note: "Highlighting the footer social icons that appear when you add social links."
  }
};

const PREVIEW_AREA_TO_FIELD_ID = {
  hero: fieldIds.headerColor,
  "hero-secondary": fieldIds.secondaryColor,
  "hero-label": fieldIds.headerLabel,
  logo: fieldIds.logoUrl,
  contact: fieldIds.contactEmail,
  art: fieldIds.artShapeColor,
  body: fieldIds.bodyTextColor,
  summary: fieldIds.panelColor,
  details: fieldIds.detailsColor,
  calendar: fieldIds.calendarColor,
  buttons: fieldIds.buttonStyle,
  footer: fieldIds.footerColor
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
  [fieldIds.heroGradientColor]: "hero",
  [fieldIds.heroGradientHex]: "hero",
  [fieldIds.heroTextColor]: "hero",
  [fieldIds.heroTextHex]: "hero",
  [fieldIds.heroGradientStyle]: "hero",
  [fieldIds.showHeroArt]: "hero",
  [fieldIds.artShape]: "art",
  [fieldIds.artShapeColor]: "art",
  [fieldIds.artShapeHex]: "art",
  [fieldIds.shapeIntensity]: "art",
  [fieldIds.shineStyle]: "art",
  [fieldIds.motionStyle]: "art",
  [fieldIds.panelColor]: "summary",
  [fieldIds.panelHex]: "summary",
  [fieldIds.summaryGradientStyle]: "summary",
  [fieldIds.summaryTextColor]: "summary",
  [fieldIds.summaryTextHex]: "summary",
  [fieldIds.bodyTextColor]: "body",
  [fieldIds.bodyTextHex]: "body",
  [fieldIds.bodyColor]: "body",
  [fieldIds.bodyHex]: "body",
  [fieldIds.bodyGradientStyle]: "body",
  [fieldIds.detailsColor]: "details",
  [fieldIds.detailsHex]: "details",
  [fieldIds.detailsGradientStyle]: "details",
  [fieldIds.detailsTextColor]: "details",
  [fieldIds.detailsTextHex]: "details",
  [fieldIds.calendarColor]: "calendar",
  [fieldIds.calendarHex]: "calendar",
  [fieldIds.calendarGradientStyle]: "calendar",
  [fieldIds.calendarTextColor]: "calendar",
  [fieldIds.calendarTextHex]: "calendar",
  [fieldIds.calendarButtonColor]: "calendar",
  [fieldIds.calendarButtonHex]: "calendar",
  [fieldIds.calendarButtonSecondaryColor]: "calendar",
  [fieldIds.calendarButtonSecondaryHex]: "calendar",
  [fieldIds.calendarButtonGradientStyle]: "calendar",
  [fieldIds.calendarButtonTextColor]: "calendar",
  [fieldIds.calendarButtonTextHex]: "calendar",
  [fieldIds.panelShape]: "summary",
  [fieldIds.buttonStyle]: "buttons",
  [fieldIds.buttonColor]: "buttons",
  [fieldIds.buttonHex]: "buttons",
  [fieldIds.tertiaryColor]: "buttons",
  [fieldIds.tertiaryHex]: "buttons",
  [fieldIds.buttonGradientStyle]: "buttons",
  [fieldIds.buttonTextColor]: "buttons",
  [fieldIds.buttonTextHex]: "buttons",
  [fieldIds.websiteUrl]: "buttons",
  [fieldIds.rescheduleUrl]: "buttons",
  [fieldIds.footerColor]: "footer",
  [fieldIds.footerHex]: "footer",
  [fieldIds.footerTextColor]: "footer",
  [fieldIds.footerTextHex]: "footer",
  [fieldIds.socialLinks]: "footer",
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
  body: "body",
  summary: "summary",
  details: "details",
  calendar: "calendar",
  buttons: "buttons",
  footer: "footer"
};

const EDITOR_GROUP_COPY = {
  hero: {
    title: "Top section controls",
    copy: "Change the business name, hero copy, top section color, and supporting accent colors that appear at the top of the email."
  },
  art: {
    title: "Hero art controls",
    copy: "Change the geometric art style, art color, shape intensity, shine, and preview motion for the top-right artwork."
  },
  body: {
    title: "Body controls",
    copy: "Adjust the main body text color and the background section behind the reminder copy."
  },
  panels: {
    title: "Info panel controls",
    copy: "Adjust the fill color and panel shape for the date, time, location, and details boxes inside the email body."
  },
  summary: {
    title: "Summary card controls",
    copy: "Adjust the color, gradient, text color, and shape of the date, time, and location cards."
  },
  details: {
    title: "Details card controls",
    copy: "Adjust the color, gradient, and shape of the additional details card."
  },
  calendar: {
    title: "Calendar section controls",
    copy: "Adjust the add-to-calendar section color, gradient, text, and the calendar app button styling."
  },
  buttons: {
    title: "Button controls",
    copy: "Adjust the button shape, supporting button color, text color, and the website or reschedule links."
  },
  footer: {
    title: "Footer controls",
    copy: "Adjust the footer background, text color, and social icons shown at the bottom of the email."
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
let previewHeightSyncTimer = null;
let brandingToggleSaveToken = 0;
const QA_LAST_EMAIL_STORAGE_KEY = "appointment-reminder:last-sent-email-html";

const TEMPLATE_SHOWCASES = {
  signature: {
    company: "North Shore Wellness",
    line: "Cool premium clarity",
    promise: "Bright reminders with a polished modern tone clients can read quickly.",
    service: "Appointments + reminders",
    email: "hello@northshorewellness.com",
    website: "northshorewellness.com",
    mark: "NS",
    social: ["IG", "FB"],
    themeClass: "is-cobalt"
  },
  spotlight: {
    company: "Harbor Legal Group",
    line: "Calm editorial luxury",
    promise: "An airy layout for brands that want a softer upscale client experience.",
    service: "Consults + follow-up",
    email: "desk@harborlegal.com",
    website: "harborlegal.com",
    mark: "HL",
    social: ["LI"],
    themeClass: "is-verdant"
  },
  executive: {
    company: "Aureline Concierge",
    line: "Formal dark reserve",
    promise: "Dark, sharper, and built for a more formal premium brand.",
    service: "Bookings + confirmations",
    email: "team@aureline.co",
    website: "aureline.co",
    mark: "AU",
    social: ["LI", "X"],
    themeClass: "is-slate"
  },
  ember: {
    company: "Rose Atelier",
    line: "Warm boutique energy",
    promise: "Coral and blush styling for service brands that want more warmth.",
    service: "Appointments + prep notes",
    email: "bookings@roseatelier.co",
    website: "roseatelier.co",
    mark: "RA",
    social: ["IG", "TT"],
    themeClass: "is-ember"
  },
  ivory: {
    company: "Ivory House Studio",
    line: "Refined hospitality polish",
    promise: "Soft neutrals and high contrast detail for a more luxurious feel.",
    service: "Consults + calendar links",
    email: "desk@ivoryhouse.studio",
    website: "ivoryhouse.studio",
    mark: "IH",
    social: ["LI", "WEB"],
    themeClass: "is-ivory"
  }
};

function buildTemplateThumbHeroBackground(preset) {
  const primary = preset.headerColor || preset.accentColor || "#2563eb";
  const secondary = preset.heroGradientColor || preset.secondaryColor || primary;
  const style = preset.heroGradientStyle || "solid";

  if (style === "split") {
    return `linear-gradient(118deg, ${primary} 0%, ${primary} 48%, ${secondary} 48%, ${secondary} 100%)`;
  }

  if (style === "spotlight" || style === "signature") {
    return `linear-gradient(135deg, ${primary} 0%, ${primary} 58%, ${secondary} 100%)`;
  }

  return primary;
}

function buildTemplateThumbSectionBackground(color, gradientStyle) {
  const sectionColor = color || "#eef4ff";

  if (gradientStyle === "split") {
    return `linear-gradient(135deg, #ffffff 0%, #ffffff 52%, ${sectionColor} 100%)`;
  }

  if (gradientStyle === "glow" || gradientStyle === "soft") {
    return `linear-gradient(180deg, #ffffff 0%, ${sectionColor} 100%)`;
  }

  return sectionColor;
}

function buildTemplateThumbButtonBackground(primaryColor, secondaryColor, gradientStyle) {
  const primary = primaryColor || "#2563eb";
  const secondary = secondaryColor || primary;

  if (gradientStyle === "split") {
    return `linear-gradient(135deg, ${primary} 0%, ${primary} 50%, ${secondary} 50%, ${secondary} 100%)`;
  }

  if (gradientStyle === "glow" || gradientStyle === "soft") {
    return `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`;
  }

  return primary;
}

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

function inferSocialPlatformLabel(url) {
  const value = String(url || "").toLowerCase();

  if (value.includes("instagram.")) {
    return "Instagram";
  }
  if (value.includes("facebook.") || value.includes("fb.com")) {
    return "Facebook";
  }
  if (value.includes("linkedin.")) {
    return "LinkedIn";
  }
  if (value.includes("x.com") || value.includes("twitter.")) {
    return "X";
  }
  if (value.includes("tiktok.")) {
    return "TikTok";
  }
  if (value.includes("youtube.") || value.includes("youtu.be")) {
    return "YouTube";
  }
  if (value.includes("threads.")) {
    return "Threads";
  }
  if (value.includes("pinterest.")) {
    return "Pinterest";
  }

  return "Link";
}

function getSocialPlaceholder(index = 0) {
  const placeholders = [
    "https://instagram.com/yourbusiness",
    "https://facebook.com/yourbusiness",
    "https://linkedin.com/company/yourbusiness"
  ];

  return placeholders[index % placeholders.length];
}

function readSocialLinksFromForm() {
  if (!socialLinksContainer) {
    return [];
  }

  return Array.from(socialLinksContainer.querySelectorAll(".branding-social-link-input"))
    .map(input => String(input.value || "").trim())
    .filter(Boolean);
}

function renderSocialLinksEditor(links = []) {
  if (!socialLinksContainer) {
    return;
  }

  const normalizedLinks = Array.isArray(links)
    ? links.slice(0, 6).map(link => String(link ?? ""))
    : [];

  socialLinksContainer.innerHTML = normalizedLinks.length
    ? normalizedLinks.map((link, index) => `
        <div class="branding-social-row" data-social-index="${index}">
          <div class="branding-social-chip" aria-hidden="true">${escapeHtml(inferSocialPlatformLabel(link))}</div>
          <input class="branding-input branding-social-link-input" type="url" inputmode="url" value="${escapeHtml(link)}" placeholder="${getSocialPlaceholder(index)}">
          <button class="secondary-button branding-social-remove" type="button" data-remove-social="${index}">Remove</button>
        </div>
      `).join("")
    : `
      <div class="branding-social-empty">
        Add social links here and the footer will turn them into platform icons automatically.
      </div>
    `;
}

function addSocialLinkRow(url = "") {
  const nextLinks = [...readSocialLinksFromForm(), url].slice(0, 6);
  renderSocialLinksEditor(nextLinks);
  queuePreviewRender();
  const newestInput = socialLinksContainer?.querySelector(".branding-social-row:last-child .branding-social-link-input");
  newestInput?.focus();
}

function triggerPreviewStudioAnimation(activeTemplateCard = null) {
  const toggleCard = document.querySelector(".branding-toggle-card");
  const animatedElements = [toggleCard, previewShell, activeTemplateCard].filter(Boolean);

  animatedElements.forEach(element => {
    element.classList.remove("is-switching-on");
    void element.offsetWidth;
    element.classList.add("is-switching-on");
  });

  window.setTimeout(() => {
    animatedElements.forEach(element => {
      element.classList.remove("is-switching-on");
    });
  }, 1450);
}

function getDraftBranding() {
  const rawDraft = {
    templateStyle: getFieldElement(fieldIds.templateStyle)?.value || "signature",
    brandingEnabled: Boolean(getFieldElement(fieldIds.brandingEnabled)?.checked),
    businessName: getFieldElement(fieldIds.businessName)?.value || "",
    tagline: getFieldElement(fieldIds.tagline)?.value || "",
    headerLabel: getFieldElement(fieldIds.headerLabel)?.value || "",
    headerColor: getFieldElement(fieldIds.headerColor)?.value || getFieldElement(fieldIds.headerHex)?.value || "",
    secondaryColor: getFieldElement(fieldIds.secondaryColor)?.value || getFieldElement(fieldIds.secondaryHex)?.value || "",
    heroGradientColor: getFieldElement(fieldIds.heroGradientColor)?.value || getFieldElement(fieldIds.heroGradientHex)?.value || "",
    heroTextColor: getFieldElement(fieldIds.heroTextColor)?.value || getFieldElement(fieldIds.heroTextHex)?.value || "",
    artShapeColor: "",
    panelColor: getFieldElement(fieldIds.panelColor)?.value || getFieldElement(fieldIds.panelHex)?.value || "",
    summaryGradientStyle: getFieldElement(fieldIds.summaryGradientStyle)?.value || "soft",
    summaryTextColor: getFieldElement(fieldIds.summaryTextColor)?.value || getFieldElement(fieldIds.summaryTextHex)?.value || "",
    bodyTextColor: getFieldElement(fieldIds.bodyTextColor)?.value || getFieldElement(fieldIds.bodyTextHex)?.value || "",
    bodyColor: getFieldElement(fieldIds.bodyColor)?.value || getFieldElement(fieldIds.bodyHex)?.value || "",
    bodyGradientStyle: getFieldElement(fieldIds.bodyGradientStyle)?.value || "solid",
    detailsColor: getFieldElement(fieldIds.detailsColor)?.value || getFieldElement(fieldIds.detailsHex)?.value || "",
    detailsGradientStyle: getFieldElement(fieldIds.detailsGradientStyle)?.value || "soft",
    detailsTextColor: getFieldElement(fieldIds.detailsTextColor)?.value || getFieldElement(fieldIds.detailsTextHex)?.value || "",
    calendarColor: getFieldElement(fieldIds.calendarColor)?.value || getFieldElement(fieldIds.calendarHex)?.value || "",
    calendarGradientStyle: getFieldElement(fieldIds.calendarGradientStyle)?.value || "soft",
    calendarTextColor: getFieldElement(fieldIds.calendarTextColor)?.value || getFieldElement(fieldIds.calendarTextHex)?.value || "",
    calendarButtonColor: getFieldElement(fieldIds.calendarButtonColor)?.value || getFieldElement(fieldIds.calendarButtonHex)?.value || "",
    calendarButtonSecondaryColor: getFieldElement(fieldIds.calendarButtonSecondaryColor)?.value || getFieldElement(fieldIds.calendarButtonSecondaryHex)?.value || "",
    calendarButtonGradientStyle: getFieldElement(fieldIds.calendarButtonGradientStyle)?.value || "solid",
    calendarButtonTextColor: getFieldElement(fieldIds.calendarButtonTextColor)?.value || getFieldElement(fieldIds.calendarButtonTextHex)?.value || "",
    buttonColor: getFieldElement(fieldIds.buttonColor)?.value || getFieldElement(fieldIds.buttonHex)?.value || "",
    tertiaryColor: getFieldElement(fieldIds.tertiaryColor)?.value || getFieldElement(fieldIds.tertiaryHex)?.value || "",
    buttonGradientStyle: getFieldElement(fieldIds.buttonGradientStyle)?.value || "solid",
    buttonTextColor: getFieldElement(fieldIds.buttonTextColor)?.value || getFieldElement(fieldIds.buttonTextHex)?.value || "",
    logoUrl: getFieldElement(fieldIds.logoUrl)?.value || "",
    buttonStyle: getFieldElement(fieldIds.buttonStyle)?.value || "pill",
    panelShape: getFieldElement(fieldIds.panelShape)?.value || "rounded",
    heroGradientStyle: getFieldElement(fieldIds.heroGradientStyle)?.value || "signature",
    showHeroArt: false,
    artShape: "none",
    shapeIntensity: "balanced",
    shineStyle: getFieldElement(fieldIds.shineStyle)?.value || "on",
    motionStyle: getFieldElement(fieldIds.motionStyle)?.value || "showcase",
    contactEmail: getFieldElement(fieldIds.contactEmail)?.value || "",
    contactPhone: getFieldElement(fieldIds.contactPhone)?.value || "",
    websiteUrl: getFieldElement(fieldIds.websiteUrl)?.value || "",
    rescheduleUrl: getFieldElement(fieldIds.rescheduleUrl)?.value || "",
    footerColor: getFieldElement(fieldIds.footerColor)?.value || getFieldElement(fieldIds.footerHex)?.value || "",
    footerTextColor: getFieldElement(fieldIds.footerTextColor)?.value || getFieldElement(fieldIds.footerTextHex)?.value || "",
    socialLinks: readSocialLinksFromForm()
  };
  rawDraft.accentColor = rawDraft.headerColor || rawDraft.buttonColor || "";

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
  getFieldElement(fieldIds.heroGradientColor).value = normalized.heroGradientColor;
  getFieldElement(fieldIds.heroGradientHex).value = normalized.heroGradientColor;
  getFieldElement(fieldIds.heroTextColor).value = normalized.heroTextColor;
  getFieldElement(fieldIds.heroTextHex).value = normalized.heroTextColor;
  getFieldElement(fieldIds.artShapeColor).value = "";
  getFieldElement(fieldIds.artShapeHex).value = "";
  getFieldElement(fieldIds.panelColor).value = normalized.panelColor;
  getFieldElement(fieldIds.panelHex).value = normalized.panelColor;
  getFieldElement(fieldIds.summaryGradientStyle).value = normalized.summaryGradientStyle;
  getFieldElement(fieldIds.summaryTextColor).value = normalized.summaryTextColor;
  getFieldElement(fieldIds.summaryTextHex).value = normalized.summaryTextColor;
  getFieldElement(fieldIds.bodyTextColor).value = normalized.bodyTextColor;
  getFieldElement(fieldIds.bodyTextHex).value = normalized.bodyTextColor;
  getFieldElement(fieldIds.bodyColor).value = normalized.bodyColor;
  getFieldElement(fieldIds.bodyHex).value = normalized.bodyColor;
  getFieldElement(fieldIds.bodyGradientStyle).value = normalized.bodyGradientStyle;
  getFieldElement(fieldIds.detailsColor).value = normalized.detailsColor;
  getFieldElement(fieldIds.detailsHex).value = normalized.detailsColor;
  getFieldElement(fieldIds.detailsGradientStyle).value = normalized.detailsGradientStyle;
  getFieldElement(fieldIds.detailsTextColor).value = normalized.detailsTextColor;
  getFieldElement(fieldIds.detailsTextHex).value = normalized.detailsTextColor;
  getFieldElement(fieldIds.calendarColor).value = normalized.calendarColor;
  getFieldElement(fieldIds.calendarHex).value = normalized.calendarColor;
  getFieldElement(fieldIds.calendarGradientStyle).value = normalized.calendarGradientStyle;
  getFieldElement(fieldIds.calendarTextColor).value = normalized.calendarTextColor;
  getFieldElement(fieldIds.calendarTextHex).value = normalized.calendarTextColor;
  getFieldElement(fieldIds.calendarButtonColor).value = normalized.calendarButtonColor;
  getFieldElement(fieldIds.calendarButtonHex).value = normalized.calendarButtonColor;
  getFieldElement(fieldIds.calendarButtonSecondaryColor).value = normalized.calendarButtonSecondaryColor;
  getFieldElement(fieldIds.calendarButtonSecondaryHex).value = normalized.calendarButtonSecondaryColor;
  getFieldElement(fieldIds.calendarButtonGradientStyle).value = normalized.calendarButtonGradientStyle;
  getFieldElement(fieldIds.calendarButtonTextColor).value = normalized.calendarButtonTextColor;
  getFieldElement(fieldIds.calendarButtonTextHex).value = normalized.calendarButtonTextColor;
  getFieldElement(fieldIds.buttonColor).value = normalized.buttonColor;
  getFieldElement(fieldIds.buttonHex).value = normalized.buttonColor;
  getFieldElement(fieldIds.tertiaryColor).value = normalized.tertiaryColor;
  getFieldElement(fieldIds.tertiaryHex).value = normalized.tertiaryColor;
  getFieldElement(fieldIds.buttonGradientStyle).value = normalized.buttonGradientStyle;
  getFieldElement(fieldIds.buttonTextColor).value = normalized.buttonTextColor;
  getFieldElement(fieldIds.buttonTextHex).value = normalized.buttonTextColor;
  getFieldElement(fieldIds.logoUrl).value = branding.logoUrl || "";
  getFieldElement(fieldIds.buttonStyle).value = normalized.buttonStyle;
  getFieldElement(fieldIds.panelShape).value = normalized.panelShape;
  getFieldElement(fieldIds.heroGradientStyle).value = normalized.heroGradientStyle;
  getFieldElement(fieldIds.showHeroArt).checked = false;
  getFieldElement(fieldIds.artShape).value = "none";
  getFieldElement(fieldIds.shapeIntensity).value = "balanced";
  getFieldElement(fieldIds.shineStyle).value = normalized.shineStyle;
  getFieldElement(fieldIds.motionStyle).value = normalized.motionStyle;
  getFieldElement(fieldIds.contactEmail).value = branding.contactEmail || "";
  getFieldElement(fieldIds.contactPhone).value = branding.contactPhone || "";
  getFieldElement(fieldIds.websiteUrl).value = branding.websiteUrl || "";
  getFieldElement(fieldIds.rescheduleUrl).value = branding.rescheduleUrl || "";
  getFieldElement(fieldIds.footerColor).value = normalized.footerColor;
  getFieldElement(fieldIds.footerHex).value = normalized.footerColor;
  getFieldElement(fieldIds.footerTextColor).value = normalized.footerTextColor;
  getFieldElement(fieldIds.footerTextHex).value = normalized.footerTextColor;
  renderSocialLinksEditor(Array.isArray(branding.socialLinks) ? branding.socialLinks : []);
  updateHelperHints();
  syncTemplateCards();
  updateBrandingEditorAvailability();
  renderPreview();
}

function syncTemplateCards() {
  const activeTemplate = getFieldElement(fieldIds.templateStyle)?.value || "signature";

  document.querySelectorAll(".signature-card").forEach(card => {
    const isActive = card.dataset.template === activeTemplate;
    card.classList.toggle("is-active", isActive);
    card.setAttribute("aria-pressed", String(isActive));
    card.classList.toggle("is-disabled", !isBrandingEditingEnabled());
    const cta = card.querySelector(".signature-card-cta");

    if (cta) {
      cta.textContent = !isBrandingEditingEnabled() ? "Off" : (isActive ? "Selected" : "Preview");
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
  getFieldElement(fieldIds.heroGradientColor).value = preset.heroGradientColor;
  getFieldElement(fieldIds.heroGradientHex).value = preset.heroGradientColor;
  getFieldElement(fieldIds.heroTextColor).value = preset.heroTextColor;
  getFieldElement(fieldIds.heroTextHex).value = preset.heroTextColor;
  getFieldElement(fieldIds.artShapeColor).value = "";
  getFieldElement(fieldIds.artShapeHex).value = "";
  getFieldElement(fieldIds.panelColor).value = preset.panelColor;
  getFieldElement(fieldIds.panelHex).value = preset.panelColor;
  getFieldElement(fieldIds.summaryGradientStyle).value = preset.summaryGradientStyle;
  getFieldElement(fieldIds.summaryTextColor).value = preset.summaryTextColor;
  getFieldElement(fieldIds.summaryTextHex).value = preset.summaryTextColor;
  getFieldElement(fieldIds.bodyTextColor).value = preset.bodyTextColor;
  getFieldElement(fieldIds.bodyTextHex).value = preset.bodyTextColor;
  getFieldElement(fieldIds.bodyColor).value = preset.bodyColor;
  getFieldElement(fieldIds.bodyHex).value = preset.bodyColor;
  getFieldElement(fieldIds.bodyGradientStyle).value = preset.bodyGradientStyle;
  getFieldElement(fieldIds.detailsColor).value = preset.detailsColor;
  getFieldElement(fieldIds.detailsHex).value = preset.detailsColor;
  getFieldElement(fieldIds.detailsGradientStyle).value = preset.detailsGradientStyle;
  getFieldElement(fieldIds.detailsTextColor).value = preset.detailsTextColor;
  getFieldElement(fieldIds.detailsTextHex).value = preset.detailsTextColor;
  getFieldElement(fieldIds.calendarColor).value = preset.calendarColor;
  getFieldElement(fieldIds.calendarHex).value = preset.calendarColor;
  getFieldElement(fieldIds.calendarGradientStyle).value = preset.calendarGradientStyle;
  getFieldElement(fieldIds.calendarTextColor).value = preset.calendarTextColor;
  getFieldElement(fieldIds.calendarTextHex).value = preset.calendarTextColor;
  getFieldElement(fieldIds.calendarButtonColor).value = preset.calendarButtonColor;
  getFieldElement(fieldIds.calendarButtonHex).value = preset.calendarButtonColor;
  getFieldElement(fieldIds.calendarButtonSecondaryColor).value = preset.calendarButtonSecondaryColor;
  getFieldElement(fieldIds.calendarButtonSecondaryHex).value = preset.calendarButtonSecondaryColor;
  getFieldElement(fieldIds.calendarButtonGradientStyle).value = preset.calendarButtonGradientStyle;
  getFieldElement(fieldIds.calendarButtonTextColor).value = preset.calendarButtonTextColor;
  getFieldElement(fieldIds.calendarButtonTextHex).value = preset.calendarButtonTextColor;
  getFieldElement(fieldIds.buttonColor).value = preset.buttonColor;
  getFieldElement(fieldIds.buttonHex).value = preset.buttonColor;
  getFieldElement(fieldIds.tertiaryColor).value = preset.tertiaryColor;
  getFieldElement(fieldIds.tertiaryHex).value = preset.tertiaryColor;
  getFieldElement(fieldIds.buttonGradientStyle).value = preset.buttonGradientStyle;
  getFieldElement(fieldIds.buttonTextColor).value = preset.buttonTextColor;
  getFieldElement(fieldIds.buttonTextHex).value = preset.buttonTextColor;
  getFieldElement(fieldIds.buttonStyle).value = preset.buttonStyle;
  getFieldElement(fieldIds.panelShape).value = preset.panelShape;
  getFieldElement(fieldIds.heroGradientStyle).value = preset.heroGradientStyle;
  getFieldElement(fieldIds.showHeroArt).checked = false;
  getFieldElement(fieldIds.artShape).value = "none";
  getFieldElement(fieldIds.shapeIntensity).value = "balanced";
  getFieldElement(fieldIds.shineStyle).value = preset.shineStyle;
  getFieldElement(fieldIds.motionStyle).value = preset.motionStyle;
  getFieldElement(fieldIds.footerColor).value = preset.footerColor;
  getFieldElement(fieldIds.footerHex).value = preset.footerColor;
  getFieldElement(fieldIds.footerTextColor).value = preset.footerTextColor;
  getFieldElement(fieldIds.footerTextHex).value = preset.footerTextColor;
}

function renderPreview() {
  const draftBranding = getDraftBranding();
  const sampleMessage = buildSampleMessage(draftBranding);
  const randomSeed = 0;
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
    schedulePreviewFrameResize();
  }

  applyLiveBrandingState(draftBranding);

  if (previewSubject) {
    previewSubject.textContent = buildReminderEmailSubject(draftBranding, { message: sampleMessage });
  }

  if (previewTo) {
    previewTo.textContent = "client@example.com";
    previewTo.classList.toggle("muted", true);
  }

  if (previewEmail) {
    const previewEmailValue = draftBranding.brandingEnabled === false
      ? (currentUser?.email || "")
      : (draftBranding.contactEmail || "");

    previewEmail.textContent = previewEmailValue;
    previewEmail.hidden = !previewEmailValue;
  }

  if (previewBusinessName) {
    previewBusinessName.textContent = draftBranding.brandingEnabled === false
      ? "Standard Reminder Email"
      : (draftBranding.businessName || "Your business name");
  }

  if (brandingEnabledNote) {
    brandingEnabledNote.textContent = draftBranding.brandingEnabled === false
      ? "Branding is off. Your design stays saved here, but outgoing emails use the standard reminder format."
      : "Branding is on. Outgoing emails will use your saved branded layout.";
  }

  applyPreviewHighlight(currentPreviewFocusField);
}

function syncPreviewFrameHeight() {
  if (!previewFrame || !previewStage) {
    return;
  }

  const frameDocument = previewFrame.contentDocument;
  const frameWindow = previewFrame.contentWindow;

  if (!frameDocument || !frameWindow) {
    return;
  }

  const body = frameDocument.body;
  const html = frameDocument.documentElement;

  if (!body || !html) {
    return;
  }

  const nextHeight = Math.max(
    body.scrollHeight,
    body.offsetHeight,
    html.scrollHeight,
    html.offsetHeight,
    640
  );

  const isMobileViewport = window.innerWidth <= 760;

  if (isMobileViewport) {
    const availableWidth = Math.max(previewShell?.clientWidth || previewStage.clientWidth || 260, 260);
    const widthScale = Math.min(availableWidth / BRANDING_PREVIEW_WIDTH, 1);
    const heightScale = Math.min(BRANDING_PREVIEW_MAX_HEIGHT_MOBILE / nextHeight, 1);
    const scale = Math.min(widthScale, heightScale, BRANDING_PREVIEW_MAX_SCALE_MOBILE, 1);
    const scaledWidth = Math.ceil(BRANDING_PREVIEW_WIDTH * scale);
    const scaledHeight = Math.max(Math.ceil(nextHeight * scale), BRANDING_PREVIEW_MIN_HEIGHT_MOBILE);

    previewStage.style.width = `${scaledWidth}px`;
    previewStage.style.height = `${scaledHeight}px`;
    previewStage.style.margin = "0 auto";
    previewFrame.style.width = `${BRANDING_PREVIEW_WIDTH}px`;
    previewFrame.style.height = `${nextHeight}px`;
    previewFrame.style.transform = `scale(${scale})`;
    previewFrame.style.transformOrigin = "top left";
    return;
  }

  previewStage.style.width = "100%";
  previewStage.style.height = `${nextHeight}px`;
  previewStage.style.margin = "0";
  previewFrame.style.width = "100%";
  previewFrame.style.height = `${nextHeight}px`;
  previewFrame.style.transform = "none";
  previewFrame.style.transformOrigin = "top left";
}

function schedulePreviewFrameResize() {
  if (previewHeightSyncTimer) {
    window.clearTimeout(previewHeightSyncTimer);
  }

  previewHeightSyncTimer = window.setTimeout(() => {
    syncPreviewFrameHeight();
  }, 50);
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
  updateHelperHint(helperTextIds.heroGradientColor, getHeroGradientColorHint());
  updateHelperHint(helperTextIds.heroTextColor, getHeroTextColorHint());
  updateHelperHint(helperTextIds.artShapeColor, getArtShapeColorHint());
  updateHelperHint(helperTextIds.panelColor, getPanelColorHint());
  updateHelperHint(helperTextIds.summaryTextColor, getSummaryTextColorHint());
  updateHelperHint(helperTextIds.bodyTextColor, getBodyTextColorHint());
  updateHelperHint(helperTextIds.bodyColor, getBodyColorHint());
  updateHelperHint(helperTextIds.bodyGradientStyle, getBodyGradientHint());
  updateHelperHint(helperTextIds.detailsColor, getDetailsColorHint());
  updateHelperHint(helperTextIds.detailsTextColor, getDetailsTextColorHint());
  updateHelperHint(helperTextIds.calendarColor, getCalendarColorHint());
  updateHelperHint(helperTextIds.calendarTextColor, getCalendarTextColorHint());
  updateHelperHint(helperTextIds.calendarButtonColor, getCalendarButtonColorHint());
  updateHelperHint(helperTextIds.calendarButtonSecondaryColor, getCalendarButtonSecondaryColorHint());
  updateHelperHint(helperTextIds.calendarButtonGradientStyle, getCalendarButtonGradientHint());
  updateHelperHint(helperTextIds.calendarButtonTextColor, getCalendarButtonTextColorHint());
  updateHelperHint(helperTextIds.buttonColor, getButtonColorHint());
  updateHelperHint(helperTextIds.tertiaryColor, getTertiaryColorHint());
  updateHelperHint(helperTextIds.buttonGradientStyle, getButtonGradientHint());
  updateHelperHint(helperTextIds.buttonTextColor, getButtonTextColorHint());
  updateHelperHint(helperTextIds.showHeroArt, getShowHeroArtHint());
  updateHelperHint(helperTextIds.buttonStyle, getButtonStyleHint());
  updateHelperHint(helperTextIds.panelShape, getPanelShapeHint());
  updateHelperHint(helperTextIds.heroGradientStyle, getHeroGradientHint());
  updateHelperHint(helperTextIds.artShape, getArtShapeHint());
  updateHelperHint(helperTextIds.shapeIntensity, getShapeIntensityHint());
  updateHelperHint(helperTextIds.shineStyle, getShineStyleHint());
  updateHelperHint(helperTextIds.motionStyle, getMotionStyleHint());
  updateHelperHint(helperTextIds.logoUrl, getLogoUrlHint());
  updateHelperHint(helperTextIds.footerColor, getFooterColorHint());
  updateHelperHint(helperTextIds.footerTextColor, getFooterTextColorHint());
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
  return "Used as the support accent inside the top section and supporting surfaces.";
}

function getHeroTextColorHint() {
  return "Changes the business name, tagline, and contact text inside the top section.";
}

function getArtShapeColorHint() {
  return "Changes the geometric art itself without recoloring the entire header.";
}

function getPanelColorHint() {
  return "Used behind the date, time, and location summary cards.";
}

function getSummaryTextColorHint() {
  return "Changes the text color inside the date, time, and location summary cards.";
}

function getBodyTextColorHint() {
  return "Changes the main body copy text color.";
}

function getDetailsColorHint() {
  return "Used behind the additional details section.";
}

function getCalendarColorHint() {
  return "Used behind the add-to-calendar section.";
}

function getHeroGradientColorHint() {
  return "Used as the second color in the top section gradient.";
}

function getBodyColorHint() {
  return "Used behind the main body copy area.";
}

function getBodyGradientHint() {
  return "Controls how the body section blends from white into its chosen color.";
}

function getDetailsTextColorHint() {
  return "Changes the text color inside the additional details card.";
}

function getCalendarTextColorHint() {
  return "Changes the text color inside the add-to-calendar section.";
}

function getCalendarButtonColorHint() {
  return "Used as the main color on the Apple, Outlook, and Google Calendar buttons.";
}

function getCalendarButtonSecondaryColorHint() {
  return "Used as the second color when the calendar buttons use a gradient.";
}

function getCalendarButtonGradientHint() {
  return "Controls how the calendar button colors blend together.";
}

function getCalendarButtonTextColorHint() {
  return "Changes the text color used inside the calendar app buttons.";
}

function getButtonColorHint() {
  return "Used as the main color on the main reminder buttons like Visit website or Reschedule.";
}

function getTertiaryColorHint() {
  return "Used as the second color when the main reminder buttons use a gradient.";
}

function getButtonGradientHint() {
  return "Controls how the main reminder button colors blend together.";
}

function getButtonTextColorHint() {
  return "Changes the text color used on the main reminder buttons.";
}

function getLogoUrlHint() {
  const value = String(getFieldElement(fieldIds.logoUrl)?.value || "").trim();

  if (!value) {
    return "Use a direct image link like `.png`, `.jpg`, `.svg`, or `.webp`, not a webpage URL.";
  }

  const normalized = value.split("?")[0].toLowerCase();
  const looksDirect = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(normalized);

  if (looksDirect) {
    return "This looks like a direct image file URL.";
  }

  return "This looks like a webpage URL, not a direct image file. Open the image itself in a new tab and paste that image URL instead.";
}

function getShowHeroArtHint() {
  return getFieldElement(fieldIds.showHeroArt)?.checked
    ? "Hero art is on. Turn this off for a cleaner top section with no artwork."
    : "Hero art is off. Turn this on to show the geometric artwork again.";
}

function getFooterColorHint() {
  return "Changes the footer background and tint at the bottom of the email.";
}

function getFooterTextColorHint() {
  return "Changes the text color used in the footer area.";
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

function isBrandingEditingEnabled() {
  return Boolean(getFieldElement(fieldIds.brandingEnabled)?.checked);
}

function openBrandingEditorModal(groupId = currentEditorGroup || "hero") {
  if (groupId !== "hero" && !isBrandingEditingEnabled()) {
    return;
  }

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

function updateBrandingEditorAvailability() {
  const isEnabled = isBrandingEditingEnabled();

  if (previewShell) {
    previewShell.classList.toggle("is-readonly", !isEnabled);
  }

  if (templateGrid) {
    templateGrid.classList.toggle("is-readonly", !isEnabled);
    templateGrid.querySelectorAll("[data-template]").forEach(button => {
      button.disabled = !isEnabled;
      button.classList.toggle("is-disabled", !isEnabled);
      button.setAttribute("aria-disabled", String(!isEnabled));
      button.tabIndex = isEnabled ? 0 : -1;
    });
  }

  if (brandingForm) {
    brandingForm.querySelectorAll("input, select, textarea, button").forEach(element => {
      if (element.id === fieldIds.brandingEnabled) {
        element.disabled = false;
        return;
      }

      if (element.type === "hidden" || element.type === "submit") {
        return;
      }

      element.disabled = !isEnabled;
    });
  }

  if (!isEnabled) {
    closeBrandingEditorModal();
  }
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

  const field = getFieldElement(fieldId);
  const host = field?.closest?.("[data-editor-group]");
  const groups = String(host?.dataset?.editorGroup || "").split(/\s+/).filter(Boolean);

  if (groups.includes(currentEditorGroup)) {
    setActiveEditorGroup(currentEditorGroup);
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
  if (!isBrandingEditingEnabled()) {
    return;
  }

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
      if (!isBrandingEditingEnabled()) {
        return;
      }

      clearIframePreviewHover();
      element.classList.add("preview-hover");
    });

    element.addEventListener("mouseleave", () => {
      element.classList.remove("preview-hover");
    });

    element.addEventListener("click", event => {
      if (!isBrandingEditingEnabled()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      clearIframePreviewHover();
      focusFieldFromPreviewArea(element.dataset.previewArea || "");
    });
  });

  frameDocument.addEventListener("click", event => {
    if (!isBrandingEditingEnabled()) {
      clearIframePreviewHover();
      return;
    }

    const interactiveArea = event.target?.closest?.("[data-preview-area]");

    if (!interactiveArea) {
      applyPreviewHighlight("");
      clearIframePreviewHover();
    }
  });

  syncPreviewFrameHeight();
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
    headerColor: getFieldElement(fieldIds.headerColor)?.value || getFieldElement(fieldIds.headerHex)?.value || "",
    secondaryColor: getFieldElement(fieldIds.secondaryColor)?.value || getFieldElement(fieldIds.secondaryHex)?.value || "",
    heroGradientColor: getFieldElement(fieldIds.heroGradientColor)?.value || getFieldElement(fieldIds.heroGradientHex)?.value || "",
    heroTextColor: getFieldElement(fieldIds.heroTextColor)?.value || getFieldElement(fieldIds.heroTextHex)?.value || "",
    artShapeColor: "",
    panelColor: getFieldElement(fieldIds.panelColor)?.value || getFieldElement(fieldIds.panelHex)?.value || "",
    summaryGradientStyle: getFieldElement(fieldIds.summaryGradientStyle)?.value || "soft",
    summaryTextColor: getFieldElement(fieldIds.summaryTextColor)?.value || getFieldElement(fieldIds.summaryTextHex)?.value || "",
    bodyTextColor: getFieldElement(fieldIds.bodyTextColor)?.value || getFieldElement(fieldIds.bodyTextHex)?.value || "",
    bodyColor: getFieldElement(fieldIds.bodyColor)?.value || getFieldElement(fieldIds.bodyHex)?.value || "",
    bodyGradientStyle: getFieldElement(fieldIds.bodyGradientStyle)?.value || "solid",
    detailsColor: getFieldElement(fieldIds.detailsColor)?.value || getFieldElement(fieldIds.detailsHex)?.value || "",
    detailsGradientStyle: getFieldElement(fieldIds.detailsGradientStyle)?.value || "soft",
    detailsTextColor: getFieldElement(fieldIds.detailsTextColor)?.value || getFieldElement(fieldIds.detailsTextHex)?.value || "",
    calendarColor: getFieldElement(fieldIds.calendarColor)?.value || getFieldElement(fieldIds.calendarHex)?.value || "",
    calendarGradientStyle: getFieldElement(fieldIds.calendarGradientStyle)?.value || "soft",
    calendarTextColor: getFieldElement(fieldIds.calendarTextColor)?.value || getFieldElement(fieldIds.calendarTextHex)?.value || "",
    calendarButtonColor: getFieldElement(fieldIds.calendarButtonColor)?.value || getFieldElement(fieldIds.calendarButtonHex)?.value || "",
    calendarButtonSecondaryColor: getFieldElement(fieldIds.calendarButtonSecondaryColor)?.value || getFieldElement(fieldIds.calendarButtonSecondaryHex)?.value || "",
    calendarButtonGradientStyle: getFieldElement(fieldIds.calendarButtonGradientStyle)?.value || "solid",
    calendarButtonTextColor: getFieldElement(fieldIds.calendarButtonTextColor)?.value || getFieldElement(fieldIds.calendarButtonTextHex)?.value || "",
    buttonColor: getFieldElement(fieldIds.buttonColor)?.value || getFieldElement(fieldIds.buttonHex)?.value || "",
    tertiaryColor: getFieldElement(fieldIds.tertiaryColor)?.value || getFieldElement(fieldIds.tertiaryHex)?.value || "",
    buttonGradientStyle: getFieldElement(fieldIds.buttonGradientStyle)?.value || "solid",
    buttonTextColor: getFieldElement(fieldIds.buttonTextColor)?.value || getFieldElement(fieldIds.buttonTextHex)?.value || "",
    logoUrl: (getFieldElement(fieldIds.logoUrl)?.value || "").trim(),
    buttonStyle: getFieldElement(fieldIds.buttonStyle)?.value || "pill",
    panelShape: getFieldElement(fieldIds.panelShape)?.value || "rounded",
    heroGradientStyle: getFieldElement(fieldIds.heroGradientStyle)?.value || "signature",
    showHeroArt: false,
    artShape: "none",
    shapeIntensity: "balanced",
    shineStyle: getFieldElement(fieldIds.shineStyle)?.value || "on",
    motionStyle: getFieldElement(fieldIds.motionStyle)?.value || "showcase",
    contactEmail: (getFieldElement(fieldIds.contactEmail)?.value || "").trim(),
    contactPhone: (getFieldElement(fieldIds.contactPhone)?.value || "").trim(),
    websiteUrl: (getFieldElement(fieldIds.websiteUrl)?.value || "").trim(),
    rescheduleUrl: (getFieldElement(fieldIds.rescheduleUrl)?.value || "").trim(),
    footerColor: getFieldElement(fieldIds.footerColor)?.value || getFieldElement(fieldIds.footerHex)?.value || "",
    footerTextColor: getFieldElement(fieldIds.footerTextColor)?.value || getFieldElement(fieldIds.footerTextHex)?.value || "",
    socialLinks: readSocialLinksFromForm()
  };
  rawBranding.accentColor = rawBranding.headerColor || rawBranding.buttonColor || "";

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

async function persistBrandingToggleState(enabled) {
  if (!supabase || !currentUser) {
    return;
  }

  const thisSaveToken = ++brandingToggleSaveToken;
  const baseBranding = Object.keys(currentSavedBranding || {}).length
    ? currentSavedBranding
    : getDraftBranding();
  const normalizedForStorage = normalizeBrandingProfile(
    {
      ...baseBranding,
      brandingEnabled: enabled
    },
    {
      fallbackEmail: currentUser.email || ""
    }
  );

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

    if (thisSaveToken !== brandingToggleSaveToken) {
      return;
    }

    currentUser = data.user || currentUser;
    currentSavedBranding = {
      ...currentSavedBranding,
      ...normalizedForStorage,
      brandingEnabled: enabled
    };

    setStatus(
      enabled
        ? "Branding toggle saved. Branded reminder emails are on."
        : "Branding toggle saved. Outgoing emails will use the standard reminder layout.",
      "info"
    );
  } catch (error) {
    if (thisSaveToken !== brandingToggleSaveToken) {
      return;
    }

    const brandingEnabledInput = getFieldElement(fieldIds.brandingEnabled);

    if (brandingEnabledInput) {
      brandingEnabledInput.checked = !enabled;
    }

    updateBrandingEditorAvailability();
    updateHelperHints();
    queuePreviewRender();
    setStatus(error.message || "Unable to save the branding toggle right now.", "error");
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
    const preset = TEMPLATE_STYLE_PRESETS[option.id] || TEMPLATE_STYLE_PRESETS.signature;
    const heroBackground = buildTemplateThumbHeroBackground(preset);
    const buttonBackground = buildTemplateThumbButtonBackground(
      preset.calendarButtonColor || preset.buttonColor,
      preset.calendarButtonSecondaryColor || preset.tertiaryColor,
      preset.calendarButtonGradientStyle || "solid"
    );
    const socialPills = (showcase.social || []).map(label => `
      <span class="signature-card-social-pill">${label}</span>
    `).join("");

    return `
      <button class="signature-card ${showcase.themeClass}" type="button" data-template="${option.id}" aria-pressed="false">
        <span class="template-thumb-window" aria-hidden="true">
          <span class="template-thumb-browser">
            <span class="template-thumb-dots">
              <span></span>
              <span></span>
              <span></span>
            </span>
            <span class="signature-card-badge">${option.label}</span>
          </span>
          <span class="signature-card-canvas" style="background:${heroBackground};color:${preset.heroTextColor};">
            <span class="signature-card-copy-wrap">
              <span class="signature-card-brand">${showcase.line}</span>
              <span class="signature-card-title">${showcase.company}</span>
              <span class="signature-card-meta">
                <strong>${showcase.service}</strong>
                ${showcase.website}
              </span>
            </span>
            <span class="signature-card-side">
              <span class="signature-card-preview-badge" style="background:${buttonBackground};color:${preset.calendarButtonTextColor};">Preview</span>
              <span class="signature-card-side-mark">${showcase.mark}</span>
              <span class="signature-card-side-panels">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </span>
          </span>
          <span class="signature-card-footer">
            <span class="signature-card-socials">
              ${socialPills}
            </span>
            <span class="signature-card-cta" style="background:${buttonBackground};color:${preset.calendarButtonTextColor};">Use look</span>
          </span>
        </span>
        <span class="template-thumb-info">
          <span class="template-thumb-line">${option.description}</span>
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
    window.setTimeout(() => {
      triggerPreviewStudioAnimation(button);
    }, 40);
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
  const heroGradientColorInput = getFieldElement(fieldIds.heroGradientColor);
  const heroGradientHexInput = getFieldElement(fieldIds.heroGradientHex);
  const heroTextColorInput = getFieldElement(fieldIds.heroTextColor);
  const heroTextHexInput = getFieldElement(fieldIds.heroTextHex);
  const artShapeColorInput = getFieldElement(fieldIds.artShapeColor);
  const artShapeHexInput = getFieldElement(fieldIds.artShapeHex);
  const panelColorInput = getFieldElement(fieldIds.panelColor);
  const panelHexInput = getFieldElement(fieldIds.panelHex);
  const summaryTextColorInput = getFieldElement(fieldIds.summaryTextColor);
  const summaryTextHexInput = getFieldElement(fieldIds.summaryTextHex);
  const bodyTextColorInput = getFieldElement(fieldIds.bodyTextColor);
  const bodyTextHexInput = getFieldElement(fieldIds.bodyTextHex);
  const bodyColorInput = getFieldElement(fieldIds.bodyColor);
  const bodyHexInput = getFieldElement(fieldIds.bodyHex);
  const detailsColorInput = getFieldElement(fieldIds.detailsColor);
  const detailsHexInput = getFieldElement(fieldIds.detailsHex);
  const detailsTextColorInput = getFieldElement(fieldIds.detailsTextColor);
  const detailsTextHexInput = getFieldElement(fieldIds.detailsTextHex);
  const calendarColorInput = getFieldElement(fieldIds.calendarColor);
  const calendarHexInput = getFieldElement(fieldIds.calendarHex);
  const calendarTextColorInput = getFieldElement(fieldIds.calendarTextColor);
  const calendarTextHexInput = getFieldElement(fieldIds.calendarTextHex);
  const calendarButtonColorInput = getFieldElement(fieldIds.calendarButtonColor);
  const calendarButtonHexInput = getFieldElement(fieldIds.calendarButtonHex);
  const calendarButtonSecondaryColorInput = getFieldElement(fieldIds.calendarButtonSecondaryColor);
  const calendarButtonSecondaryHexInput = getFieldElement(fieldIds.calendarButtonSecondaryHex);
  const calendarButtonTextColorInput = getFieldElement(fieldIds.calendarButtonTextColor);
  const calendarButtonTextHexInput = getFieldElement(fieldIds.calendarButtonTextHex);
  const buttonColorInput = getFieldElement(fieldIds.buttonColor);
  const buttonHexInput = getFieldElement(fieldIds.buttonHex);
  const tertiaryColorInput = getFieldElement(fieldIds.tertiaryColor);
  const tertiaryHexInput = getFieldElement(fieldIds.tertiaryHex);
  const buttonTextColorInput = getFieldElement(fieldIds.buttonTextColor);
  const buttonTextHexInput = getFieldElement(fieldIds.buttonTextHex);
  const footerColorInput = getFieldElement(fieldIds.footerColor);
  const footerHexInput = getFieldElement(fieldIds.footerHex);
  const footerTextColorInput = getFieldElement(fieldIds.footerTextColor);
  const footerTextHexInput = getFieldElement(fieldIds.footerTextHex);
  const artShapeInput = getFieldElement(fieldIds.artShape);
  const showHeroArtInput = getFieldElement(fieldIds.showHeroArt);
  const brandingEnabledInput = getFieldElement(fieldIds.brandingEnabled);

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

    if (event.target === heroGradientColorInput && heroGradientHexInput) {
      heroGradientHexInput.value = heroGradientColorInput.value;
    }

    if (event.target === heroTextColorInput && heroTextHexInput) {
      heroTextHexInput.value = heroTextColorInput.value;
    }

    if (event.target === artShapeColorInput && artShapeHexInput) {
      artShapeHexInput.value = artShapeColorInput.value;
    }

    if (event.target === panelColorInput && panelHexInput) {
      panelHexInput.value = panelColorInput.value;
    }

    if (event.target === summaryTextColorInput && summaryTextHexInput) {
      summaryTextHexInput.value = summaryTextColorInput.value;
    }

    if (event.target === bodyTextColorInput && bodyTextHexInput) {
      bodyTextHexInput.value = bodyTextColorInput.value;
    }

    if (event.target === bodyColorInput && bodyHexInput) {
      bodyHexInput.value = bodyColorInput.value;
    }

    if (event.target === detailsColorInput && detailsHexInput) {
      detailsHexInput.value = detailsColorInput.value;
    }

    if (event.target === detailsTextColorInput && detailsTextHexInput) {
      detailsTextHexInput.value = detailsTextColorInput.value;
    }

    if (event.target === calendarColorInput && calendarHexInput) {
      calendarHexInput.value = calendarColorInput.value;
    }

    if (event.target === calendarTextColorInput && calendarTextHexInput) {
      calendarTextHexInput.value = calendarTextColorInput.value;
    }

    if (event.target === calendarButtonColorInput && calendarButtonHexInput) {
      calendarButtonHexInput.value = calendarButtonColorInput.value;
    }

    if (event.target === calendarButtonSecondaryColorInput && calendarButtonSecondaryHexInput) {
      calendarButtonSecondaryHexInput.value = calendarButtonSecondaryColorInput.value;
    }

    if (event.target === calendarButtonTextColorInput && calendarButtonTextHexInput) {
      calendarButtonTextHexInput.value = calendarButtonTextColorInput.value;
    }

    if (event.target === buttonColorInput && buttonHexInput) {
      buttonHexInput.value = buttonColorInput.value;
    }

    if (event.target === tertiaryColorInput && tertiaryHexInput) {
      tertiaryHexInput.value = tertiaryColorInput.value;
    }

    if (event.target === buttonTextColorInput && buttonTextHexInput) {
      buttonTextHexInput.value = buttonTextColorInput.value;
    }

    if (event.target === footerColorInput && footerHexInput) {
      footerHexInput.value = footerColorInput.value;
    }

    if (event.target === footerTextColorInput && footerTextHexInput) {
      footerTextHexInput.value = footerTextColorInput.value;
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

    if (event.target === heroGradientHexInput && heroGradientColorInput && /^#[0-9a-f]{3,6}$/i.test(heroGradientHexInput.value.trim())) {
      heroGradientColorInput.value = heroGradientHexInput.value.trim();
    }

    if (event.target === heroTextHexInput && heroTextColorInput && /^#[0-9a-f]{3,6}$/i.test(heroTextHexInput.value.trim())) {
      heroTextColorInput.value = heroTextHexInput.value.trim();
    }

    if (event.target === artShapeHexInput && artShapeColorInput && /^#[0-9a-f]{3,6}$/i.test(artShapeHexInput.value.trim())) {
      artShapeColorInput.value = artShapeHexInput.value.trim();
    }

    if (event.target === panelHexInput && panelColorInput && /^#[0-9a-f]{3,6}$/i.test(panelHexInput.value.trim())) {
      panelColorInput.value = panelHexInput.value.trim();
    }

    if (event.target === summaryTextHexInput && summaryTextColorInput && /^#[0-9a-f]{3,6}$/i.test(summaryTextHexInput.value.trim())) {
      summaryTextColorInput.value = summaryTextHexInput.value.trim();
    }

    if (event.target === bodyTextHexInput && bodyTextColorInput && /^#[0-9a-f]{3,6}$/i.test(bodyTextHexInput.value.trim())) {
      bodyTextColorInput.value = bodyTextHexInput.value.trim();
    }

    if (event.target === bodyHexInput && bodyColorInput && /^#[0-9a-f]{3,6}$/i.test(bodyHexInput.value.trim())) {
      bodyColorInput.value = bodyHexInput.value.trim();
    }

    if (event.target === detailsHexInput && detailsColorInput && /^#[0-9a-f]{3,6}$/i.test(detailsHexInput.value.trim())) {
      detailsColorInput.value = detailsHexInput.value.trim();
    }

    if (event.target === detailsTextHexInput && detailsTextColorInput && /^#[0-9a-f]{3,6}$/i.test(detailsTextHexInput.value.trim())) {
      detailsTextColorInput.value = detailsTextHexInput.value.trim();
    }

    if (event.target === calendarHexInput && calendarColorInput && /^#[0-9a-f]{3,6}$/i.test(calendarHexInput.value.trim())) {
      calendarColorInput.value = calendarHexInput.value.trim();
    }

    if (event.target === calendarTextHexInput && calendarTextColorInput && /^#[0-9a-f]{3,6}$/i.test(calendarTextHexInput.value.trim())) {
      calendarTextColorInput.value = calendarTextHexInput.value.trim();
    }

    if (event.target === calendarButtonHexInput && calendarButtonColorInput && /^#[0-9a-f]{3,6}$/i.test(calendarButtonHexInput.value.trim())) {
      calendarButtonColorInput.value = calendarButtonHexInput.value.trim();
    }

    if (event.target === calendarButtonSecondaryHexInput && calendarButtonSecondaryColorInput && /^#[0-9a-f]{3,6}$/i.test(calendarButtonSecondaryHexInput.value.trim())) {
      calendarButtonSecondaryColorInput.value = calendarButtonSecondaryHexInput.value.trim();
    }

    if (event.target === calendarButtonTextHexInput && calendarButtonTextColorInput && /^#[0-9a-f]{3,6}$/i.test(calendarButtonTextHexInput.value.trim())) {
      calendarButtonTextColorInput.value = calendarButtonTextHexInput.value.trim();
    }

    if (event.target === buttonHexInput && buttonColorInput && /^#[0-9a-f]{3,6}$/i.test(buttonHexInput.value.trim())) {
      buttonColorInput.value = buttonHexInput.value.trim();
    }

    if (event.target === tertiaryHexInput && tertiaryColorInput && /^#[0-9a-f]{3,6}$/i.test(tertiaryHexInput.value.trim())) {
      tertiaryColorInput.value = tertiaryHexInput.value.trim();
    }

    if (event.target === buttonTextHexInput && buttonTextColorInput && /^#[0-9a-f]{3,6}$/i.test(buttonTextHexInput.value.trim())) {
      buttonTextColorInput.value = buttonTextHexInput.value.trim();
    }

    if (event.target === footerHexInput && footerColorInput && /^#[0-9a-f]{3,6}$/i.test(footerHexInput.value.trim())) {
      footerColorInput.value = footerHexInput.value.trim();
    }

    if (event.target === footerTextHexInput && footerTextColorInput && /^#[0-9a-f]{3,6}$/i.test(footerTextHexInput.value.trim())) {
      footerTextColorInput.value = footerTextHexInput.value.trim();
    }

    if (event.target?.id) {
      openEditorGroupForField(event.target.id);
      applyPreviewHighlight(event.target.id);
    }

    updateHelperHints();
    queuePreviewRender();
  });

  brandingForm.addEventListener("change", event => {
    if (event.target === showHeroArtInput && showHeroArtInput?.checked && artShapeInput?.value === "none") {
      artShapeInput.value = "classic";
    }

    if (event.target === artShapeInput && artShapeInput?.value === "random") {
      previewRandomNonce += 1;
      setStatus("Random art mode is on. The preview will generate fresh geometric art live.", "info");
    }

    if (event.target === artShapeInput && showHeroArtInput) {
      if (artShapeInput.value === "none") {
        showHeroArtInput.checked = false;
      } else if (!showHeroArtInput.checked) {
        showHeroArtInput.checked = true;
      }
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

  if (brandingEnabledInput) {
    brandingEnabledInput.addEventListener("change", () => {
      const nextEnabled = Boolean(brandingEnabledInput.checked);

      if (brandingEnabledInput.checked) {
        triggerPreviewStudioAnimation();
      }

      updateBrandingEditorAvailability();
      applyPreviewHighlight(fieldIds.brandingEnabled);
      updateHelperHints();
      queuePreviewRender();
      void persistBrandingToggleState(nextEnabled);
      window.setTimeout(() => {
        applyPreviewHighlight("");
      }, 180);
    });

    brandingEnabledInput.addEventListener("focus", () => {
      applyPreviewHighlight(fieldIds.brandingEnabled);
    });

    brandingEnabledInput.addEventListener("blur", () => {
      clearPreviewHighlightIfIdle();
    });
  }

  document.addEventListener("pointerdown", event => {
    const target = event.target;
    const insideForm = brandingForm.contains(target);

    if (!insideForm) {
      applyPreviewHighlight("");
    }
  });

  if (previewFrame) {
    previewFrame.addEventListener("load", () => {
      schedulePreviewFrameResize();
      window.setTimeout(() => {
        syncPreviewFrameHeight();
      }, 180);
    });
  }

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
    schedulePreviewFrameResize();

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

  if (addSocialLinkButton) {
    addSocialLinkButton.addEventListener("click", () => {
      openEditorGroupForField(fieldIds.socialLinks);
      applyPreviewHighlight(fieldIds.socialLinks);
      addSocialLinkRow("");
    });
  }

  if (socialLinksContainer) {
    socialLinksContainer.addEventListener("input", event => {
      const input = event.target.closest(".branding-social-link-input");

      if (!input) {
        return;
      }

      const chip = input.closest(".branding-social-row")?.querySelector(".branding-social-chip");

      if (chip) {
        chip.textContent = inferSocialPlatformLabel(input.value);
      }

      openEditorGroupForField(fieldIds.socialLinks);
      applyPreviewHighlight(fieldIds.socialLinks);
      queuePreviewRender();
    });

    socialLinksContainer.addEventListener("click", event => {
      const removeButton = event.target.closest("[data-remove-social]");

      if (!removeButton) {
        return;
      }

      const index = Number.parseInt(removeButton.dataset.removeSocial || "-1", 10);
      const nextLinks = readSocialLinksFromForm().filter((_, itemIndex) => itemIndex !== index);
      renderSocialLinksEditor(nextLinks);
      openEditorGroupForField(fieldIds.socialLinks);
      applyPreviewHighlight(fieldIds.socialLinks);
      queuePreviewRender();
    });

    socialLinksContainer.addEventListener("focusin", () => {
      openEditorGroupForField(fieldIds.socialLinks);
      applyPreviewHighlight(fieldIds.socialLinks);
    });
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
