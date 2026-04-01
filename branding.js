import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import {
  BRANDING_TEMPLATE_OPTIONS,
  buildReminderEmailHtml,
  buildReminderEmailSubject,
  hasSavedBrandingProfile,
  normalizeBrandingProfile
} from "./branding-templates.js";

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
const signOutButton = document.getElementById("branding-sign-out");

const fieldIds = {
  templateStyle: "branding-template-style",
  businessName: "branding-business-name",
  tagline: "branding-tagline",
  accentColor: "branding-accent-color",
  accentHex: "branding-accent-hex",
  logoUrl: "branding-logo-url",
  contactEmail: "branding-contact-email",
  contactPhone: "branding-contact-phone",
  websiteUrl: "branding-website-url",
  rescheduleUrl: "branding-reschedule-url"
};

let supabase = null;
let appConfig = null;
let currentUser = null;
let currentSavedBranding = {};
let currentAuthUserId = "";
let previewRenderTimer = null;
let lastPreviewKey = "";

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
    businessName: getFieldElement(fieldIds.businessName)?.value || "",
    tagline: getFieldElement(fieldIds.tagline)?.value || "",
    accentColor: getFieldElement(fieldIds.accentColor)?.value || getFieldElement(fieldIds.accentHex)?.value || "",
    logoUrl: getFieldElement(fieldIds.logoUrl)?.value || "",
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
  getFieldElement(fieldIds.businessName).value = branding.businessName || "";
  getFieldElement(fieldIds.tagline).value = branding.tagline || "";
  getFieldElement(fieldIds.accentColor).value = normalized.accentColor;
  getFieldElement(fieldIds.accentHex).value = normalized.accentColor;
  getFieldElement(fieldIds.logoUrl).value = branding.logoUrl || "";
  getFieldElement(fieldIds.contactEmail).value = branding.contactEmail || currentUser?.email || "";
  getFieldElement(fieldIds.contactPhone).value = branding.contactPhone || "";
  getFieldElement(fieldIds.websiteUrl).value = branding.websiteUrl || "";
  getFieldElement(fieldIds.rescheduleUrl).value = branding.rescheduleUrl || "";
  syncTemplateCards();
  renderPreview();
}

function syncTemplateCards() {
  const activeTemplate = getFieldElement(fieldIds.templateStyle)?.value || "signature";

  document.querySelectorAll(".template-card").forEach(card => {
    const isActive = card.dataset.template === activeTemplate;
    card.classList.toggle("is-active", isActive);
    card.setAttribute("aria-pressed", String(isActive));
  });
}

function renderPreview() {
  const draftBranding = getDraftBranding();
  const previewKey = JSON.stringify(draftBranding);

  if (previewKey === lastPreviewKey) {
    return;
  }

  lastPreviewKey = previewKey;
  const previewHtml = buildReminderEmailHtml({
    message: buildSampleMessage(draftBranding),
    calendarLinks: {
      apple: "#apple-calendar",
      outlook: "#outlook-calendar",
      google: "#google-calendar"
    },
    brandingProfile: draftBranding,
    previewMode: true
  });

  if (previewFrame) {
    previewFrame.srcdoc = previewHtml;
  }

  if (previewSubject) {
    previewSubject.textContent = buildReminderEmailSubject(draftBranding);
  }

  if (previewFrom) {
    previewFrom.textContent = draftBranding.businessName || "Your business name";
  }

  if (previewEmail) {
    previewEmail.textContent = draftBranding.contactEmail || currentUser?.email || "you@example.com";
  }
}

function queuePreviewRender() {
  window.clearTimeout(previewRenderTimer);
  previewRenderTimer = window.setTimeout(() => {
    renderPreview();
  }, 120);
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
}

async function saveBranding() {
  if (!supabase || !currentUser) {
    setStatus("Please sign in first.", "error");
    return;
  }

  const rawBranding = {
    templateStyle: getFieldElement(fieldIds.templateStyle)?.value || "signature",
    businessName: (getFieldElement(fieldIds.businessName)?.value || "").trim(),
    tagline: (getFieldElement(fieldIds.tagline)?.value || "").trim(),
    accentColor: getFieldElement(fieldIds.accentColor)?.value || getFieldElement(fieldIds.accentHex)?.value || "",
    logoUrl: (getFieldElement(fieldIds.logoUrl)?.value || "").trim(),
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
    setStatus("Branding saved. Your automated reminder emails will use this look.", "success");
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
    const previewClass = option.id === "executive"
      ? "dark"
      : option.id === "spotlight"
        ? "soft"
        : "";

    return `
      <button class="template-card" type="button" data-template="${option.id}" aria-pressed="false">
        <span class="template-card-badge">${option.label}</span>
        <span class="template-card-title">${option.label}</span>
        <span class="template-card-copy">${option.description}</span>
        <span class="template-card-preview" aria-hidden="true">
          <span class="template-card-preview-bar ${previewClass}"></span>
          <span class="template-card-preview-line short"></span>
          <span class="template-card-preview-line"></span>
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
    syncTemplateCards();
    queuePreviewRender();
  });
}

function wireFormInputs() {
  if (!brandingForm) {
    return;
  }

  const accentColorInput = getFieldElement(fieldIds.accentColor);
  const accentHexInput = getFieldElement(fieldIds.accentHex);

  brandingForm.addEventListener("input", event => {
    if (event.target === accentColorInput && accentHexInput) {
      accentHexInput.value = accentColorInput.value;
    }

    if (event.target === accentHexInput && accentColorInput && /^#[0-9a-f]{3,6}$/i.test(accentHexInput.value.trim())) {
      accentColorInput.value = accentHexInput.value.trim();
    }

    queuePreviewRender();
  });

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
}

async function initBrandingPage() {
  renderTemplateCards();
  wireFormInputs();

  try {
    appConfig = await getPublicConfig();
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
  });

  if (currentUser && hasSavedBrandingProfile(currentSavedBranding)) {
    setStatus("This preview is using your saved branding profile.", "info");
  }
}

initBrandingPage();
