import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import {
  BASE_REMINDER_STEPS,
  CUSTOM_FIELD_TYPES,
  FORM_BACKGROUND_PRESETS,
  FORM_SURFACE_GRADIENT_OPTIONS,
  FORM_SURFACE_SHAPE_OPTIONS,
  FORM_SURFACE_LAYOUT_OPTIONS,
  DEFAULT_FORM_TITLE,
  DEFAULT_FORM_SURFACE_COLOR,
  DEFAULT_FORM_SURFACE_ACCENT_COLOR,
  DEFAULT_FORM_SURFACE_GRADIENT,
  DEFAULT_FORM_SURFACE_SHINE_ENABLED,
  DEFAULT_FORM_SURFACE_SHINE_COLOR,
  DEFAULT_FORM_SURFACE_SHAPE,
  DEFAULT_FORM_SURFACE_LAYOUT,
  DEFAULT_FORM_TEXT_COLOR,
  DEFAULT_BACKGROUND_TOP,
  DEFAULT_BACKGROUND_BOTTOM,
  DEFAULT_BACKGROUND_STYLE,
  DEFAULT_BACKGROUND_SOLID_COLOR,
  DEFAULT_QUESTION_SURFACE_COLOR,
  DEFAULT_QUESTION_TEXT_COLOR,
  DEFAULT_FORM_TITLE_FONT_SIZE,
  DEFAULT_STEP_TITLE_FONT_SIZE,
  DEFAULT_STEP_COPY_FONT_SIZE,
  DEFAULT_FIELD_LABEL_FONT_SIZE,
  DEFAULT_FIELD_HELP_FONT_SIZE,
  DEFAULT_STEP_NAV_BACKGROUND,
  DEFAULT_STEP_NAV_ACTIVE_BACKGROUND,
  DEFAULT_STEP_NAV_TEXT_COLOR,
  DEFAULT_STEP_NAV_ACTIVE_TEXT_COLOR,
  DEFAULT_STEP_NAV_SHAPE,
  DEFAULT_STEP_NAV_SIZE,
  DEFAULT_STEP_NAV_PLACEMENT,
  DEFAULT_STEP_NAV_CLICKABLE,
  DEFAULT_STEP_MOTION_STYLE,
  DEFAULT_STEP_MOTION_SPEED,
  DEFAULT_STEP_HEAD_MOTION,
  DEFAULT_STEP_CHIP_MOTION,
  FIELD_VISIBILITY_OPTIONS,
  FIELD_SAVE_TARGET_OPTIONS,
  STEP_NAV_SHAPE_OPTIONS,
  STEP_NAV_SIZE_OPTIONS,
  STEP_NAV_PLACEMENT_OPTIONS,
  STEP_MOTION_STYLE_OPTIONS,
  STEP_MOTION_SPEED_OPTIONS,
  STEP_HEAD_MOTION_OPTIONS,
  STEP_CHIP_MOTION_OPTIONS,
  normalizeCustomFormProfile,
  createCustomField,
  createCustomPage,
  buildPreviewStepList,
  getInlineFieldsForPage,
  getCustomFieldTypeMeta,
  normalizeSelectFieldOptions,
  getBackgroundPresetMatch,
  isDefaultRememberedClientField,
  isContentBlockType,
  getAutoClientFieldText,
  getFieldVisibility,
  isFieldVisibleForPerspective,
  getPerspectiveField
} from "./custom-form-profile.js?v=20260429d";

const OPTIONAL_BUILT_IN_REMEMBER_FIELD_IDS = new Set(["notes"]);

function canToggleBuiltInRememberField(fieldId) {
  return OPTIONAL_BUILT_IN_REMEMBER_FIELD_IDS.has(String(fieldId || "").trim());
}

const statusBanner = document.getElementById("status-banner");
const authSetupNotice = document.getElementById("auth-setup-notice");
const signedOutShell = document.getElementById("signed-out-shell");
const signedInShell = document.getElementById("signed-in-shell");
const formCreatorCanvas = document.getElementById("form-creator-canvas");
const formPreviewStage = document.getElementById("form-preview-stage");
const previewModeToolbar = document.getElementById("form-preview-mode-toolbar");
const previewModeKicker = document.getElementById("form-preview-mode-kicker");
const previewModeTitle = document.getElementById("form-preview-mode-title");
const previewModeDetail = document.getElementById("form-preview-mode-detail");
const previewPerspectiveButtons = Array.from(document.querySelectorAll("[data-preview-perspective]"));
const previewModeToggles = Array.from(document.querySelectorAll("[data-preview-mode-toggle]"));
const studioPanel = document.getElementById("form-studio-panel");
const studioPanelHandle = document.getElementById("form-studio-panel-handle");
const studioPanelResizeHandle = document.getElementById("form-studio-panel-resize");
const studioMobileResizeHandle = document.getElementById("form-studio-mobile-resize");
const studioScrollHint = document.getElementById("form-studio-scroll-hint");
const saveFormButton = document.getElementById("save-form-button");
const resetFormButton = document.getElementById("reset-form-button");
const formEnabledToggle = document.getElementById("form-enabled-toggle");
const mobileStudioSizeButtons = Array.from(document.querySelectorAll("[data-mobile-studio-size]"));
const fieldRailList = document.getElementById("field-rail-list");
const templateList = document.getElementById("template-list");
const studioTabButtons = Array.from(document.querySelectorAll("[data-studio-tab]"));
const studioTabPanels = Array.from(document.querySelectorAll("[data-studio-panel]"));
const backgroundPresetRow = document.getElementById("background-preset-row");
const globalBgStyleSelect = document.getElementById("global-bg-style");
const globalBgTopInput = document.getElementById("global-bg-top");
const globalBgBottomInput = document.getElementById("global-bg-bottom");
const globalBgSolidInput = document.getElementById("global-bg-solid");
const globalBgGradientWrap = document.getElementById("global-bg-gradient-wrap");
const globalBgSolidWrap = document.getElementById("global-bg-solid-wrap");
const formSurfaceControls = document.getElementById("form-surface-controls");
const questionSurfaceControls = document.getElementById("question-surface-controls");
const stepNavigationControls = document.getElementById("step-navigation-controls");
const motionControls = document.getElementById("motion-controls");
const welcomeScreenControls = document.getElementById("welcome-screen-controls");
const thankYouScreenControls = document.getElementById("thank-you-screen-controls");
const previewShell = document.getElementById("form-preview-shell");
const previewShellZones = Array.from(document.querySelectorAll("[data-form-shell-zone]"));
const previewTitle = document.getElementById("form-preview-title");
const previewLogoWrap = document.getElementById("form-preview-logo-wrap");
const previewLogoImage = document.getElementById("form-preview-logo-image");
const previewWizardHead = document.getElementById("preview-wizard-head");
const previewStepCount = document.getElementById("preview-step-count");
const previewStepPill = document.getElementById("preview-step-pill");
const previewStepTitle = document.getElementById("preview-step-title");
const previewStepCopy = document.getElementById("preview-step-copy");
const previewProgressWrap = document.getElementById("preview-progress-wrap");
const previewProgressFill = document.getElementById("preview-progress-fill");
const previewStepper = document.getElementById("preview-stepper");
const previewStepHost = document.getElementById("preview-step-host");
const previewBackButton = document.getElementById("preview-back-button");
const previewSkipButton = document.getElementById("preview-skip-button");
const previewNextButton = document.getElementById("preview-next-button");
const editorPopover = document.getElementById("form-editor-popover");
const editorHead = editorPopover?.querySelector(".form-editor-head") || null;
const editorTitle = document.getElementById("form-editor-title");
const editorCopy = document.getElementById("form-editor-copy");
const editorBody = document.getElementById("form-editor-body");
const editorBackButton = document.getElementById("form-editor-back");
const editorCloseButton = document.getElementById("form-editor-close");
const studioContextCard = document.getElementById("studio-context-card");
const studioContextKicker = document.getElementById("studio-context-kicker");
const studioContextChip = document.getElementById("studio-context-chip");
const studioContextTitle = document.getElementById("studio-context-title");
const studioContextMeta = document.getElementById("studio-context-meta");
const studioContextAction = document.getElementById("studio-context-action");

let supabase = null;
let appConfig = null;
let currentUser = null;
let currentFormProfile = normalizeCustomFormProfile({});
let savedFormProfile = normalizeCustomFormProfile({});
let selectedPreviewStepId = BASE_REMINDER_STEPS[0]?.id || "phone";
let previewStepDirection = "forward";
let dragFieldId = "";
let editorDragState = null;
let editorHasCustomPosition = false;
let studioPanelDragState = null;
let studioPanelResizeState = null;
let studioPanelMobileResizeState = null;
let studioPanelHasCustomFrame = false;
let studioPanelScrollDiscovered = false;
let dragPayload = null;
let statusBannerTimer = null;
let activeStudioTab = "add-fields";
let previewPerspective = "staff";
let previewOnlyMode = false;
let activeMenuPreviewHoverTarget = "";
let latestUserSyncInFlight = false;
let latestUserSyncInterval = null;
let stepPointerDragState = null;
let suppressNextStepperClick = false;
let fieldRailPointerDragState = null;
let suppressNextFieldRailClick = false;
let previewFieldTapIntent = { fieldId: "", at: 0 };
let previewFieldDirectEditIntent = { fieldId: "", expiresAt: 0 };
let mobileStudioResumeState = null;
let mobileStudioExpandedState = { kind: "preset", size: "balanced" };
let suppressNextMobileStudioHandleClick = false;
let studioViewAnimationTimer = null;
let editorTransitionTimer = null;

function getSharedSupabaseClient(supabaseUrl, publicKey, createClientFn) {
  const clientKey = `${supabaseUrl}::${publicKey}`;
  window.__appointmentReminderSupabaseClients = window.__appointmentReminderSupabaseClients || new Map();

  if (!window.__appointmentReminderSupabaseClients.has(clientKey)) {
    window.__appointmentReminderSupabaseClients.set(clientKey, createClientFn(supabaseUrl, publicKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    }));
  }

  return window.__appointmentReminderSupabaseClients.get(clientKey);
}

const MOBILE_STUDIO_BREAKPOINT = 1040;
const MOBILE_CANVAS_WIDTH = 560;
const MOBILE_CANVAS_HEIGHT = 760;
const MOBILE_STUDIO_SIZE_STORAGE_KEY = "form_creator_mobile_studio_size";
const MOBILE_STUDIO_HEIGHT_STORAGE_KEY = "form_creator_mobile_studio_height";
const PREVIEW_FIELD_DIRECT_EDIT_MS = 500;
const STUDIO_VIEW_TRANSITION_MS = 220;
let mobileStudioSize = "balanced";
let mobileStudioHeightOverride = null;
const BUILDER_CUSTOM_FIELD_TYPES = CUSTOM_FIELD_TYPES.filter(option => ["text", "textarea", "select"].includes(option.id));
const BUILT_IN_STEP_MAP = new Map(BASE_REMINDER_STEPS.map(step => [step.id, step]));

function readStoredStudioValue(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (_error) {
    return null;
  }
}

function writeStoredStudioValue(key, value) {
  try {
    if (value == null || value === "") {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, String(value));
    }
  } catch (_error) {
  }
}

function normalizeMobileStudioSize(value) {
  return ["peek", "compact", "balanced", "expanded"].includes(String(value || "").trim()) ? String(value).trim() : "balanced";
}

function getMobileStudioMetrics() {
  const isNarrowPhone = window.innerWidth <= 720;
  const minPanelHeight = isNarrowPhone ? 40 : 42;
  const maxPanelHeight = isNarrowPhone
    ? Math.min(640, Math.round(window.innerHeight * 0.74))
    : Math.min(620, Math.round(window.innerHeight * 0.68));
  const presetHeightMap = isNarrowPhone
    ? {
        peek: Math.max(minPanelHeight, Math.min(maxPanelHeight, minPanelHeight)),
        compact: Math.max(250, Math.min(maxPanelHeight, Math.round(window.innerHeight * 0.34))),
        balanced: Math.max(340, Math.min(maxPanelHeight, Math.round(window.innerHeight * 0.46))),
        expanded: Math.max(430, Math.min(maxPanelHeight, Math.round(window.innerHeight * 0.62)))
      }
    : {
        peek: Math.max(minPanelHeight, Math.min(maxPanelHeight, minPanelHeight)),
        compact: Math.max(260, Math.min(maxPanelHeight, Math.round(window.innerHeight * 0.3))),
        balanced: Math.max(350, Math.min(maxPanelHeight, Math.round(window.innerHeight * 0.42))),
        expanded: Math.max(430, Math.min(maxPanelHeight, Math.round(window.innerHeight * 0.56)))
      };

  return {
    isNarrowPhone,
    minPanelHeight,
    maxPanelHeight,
    presetHeightMap,
    collapseSnapThreshold: presetHeightMap.peek + 56
  };
}

function getEffectiveMobileStudioHeight() {
  if (window.innerWidth > MOBILE_STUDIO_BREAKPOINT) {
    return null;
  }

  const { minPanelHeight, maxPanelHeight, presetHeightMap } = getMobileStudioMetrics();
  return mobileStudioHeightOverride != null
    ? clampMobileStudioHeight(mobileStudioHeightOverride, minPanelHeight, maxPanelHeight)
    : (presetHeightMap[mobileStudioSize] || presetHeightMap.balanced);
}

function rememberExpandedMobileStudioState(nextState = null) {
  if (nextState) {
    mobileStudioExpandedState = nextState;
    return;
  }

  if (mobileStudioHeightOverride != null) {
    mobileStudioExpandedState = {
      kind: "override",
      height: mobileStudioHeightOverride
    };
    return;
  }

  if (mobileStudioSize !== "peek") {
    mobileStudioExpandedState = {
      kind: "preset",
      size: mobileStudioSize
    };
  }
}

function isMobileStudioCollapsed() {
  if (window.innerWidth > MOBILE_STUDIO_BREAKPOINT) {
    return false;
  }

  const effectiveHeight = getEffectiveMobileStudioHeight();
  if (effectiveHeight == null) {
    return false;
  }

  const { collapseSnapThreshold } = getMobileStudioMetrics();
  return effectiveHeight <= collapseSnapThreshold;
}

function updateMobileStudioHandleState() {
  if (!studioMobileResizeHandle) {
    return;
  }

  const isCollapsed = isMobileStudioCollapsed();
  studioMobileResizeHandle.classList.toggle("is-collapsed", isCollapsed);
  studioMobileResizeHandle.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
  studioMobileResizeHandle.setAttribute("aria-label", isCollapsed ? "Expand form studio" : "Collapse form studio");
}

function toggleMobileStudioCollapsed() {
  if (window.innerWidth > MOBILE_STUDIO_BREAKPOINT || !studioPanel) {
    return;
  }

  if (editorPopover && !editorPopover.hidden) {
    return;
  }

  if (isMobileStudioCollapsed()) {
    if (mobileStudioExpandedState?.kind === "override" && Number.isFinite(mobileStudioExpandedState.height)) {
      mobileStudioHeightOverride = mobileStudioExpandedState.height;
      writeStoredStudioValue(MOBILE_STUDIO_HEIGHT_STORAGE_KEY, mobileStudioHeightOverride);
      syncMobileStudioSizeButtons();
      applyMobileStudioScale();
      updateStudioPanelOverflowState();
      return;
    }

    setMobileStudioSize(mobileStudioExpandedState?.size || "balanced");
    return;
  }

  rememberExpandedMobileStudioState();
  setMobileStudioSize("peek");
}

function triggerStudioViewAnimation(className) {
  if (!studioPanel) {
    return;
  }

  if (studioViewAnimationTimer) {
    window.clearTimeout(studioViewAnimationTimer);
    studioViewAnimationTimer = null;
  }

  studioPanel.classList.remove("is-view-entering", "is-view-returning");
  void studioPanel.offsetWidth;
  studioPanel.classList.add(className);

  studioViewAnimationTimer = window.setTimeout(() => {
    studioPanel.classList.remove(className);
    studioViewAnimationTimer = null;
  }, STUDIO_VIEW_TRANSITION_MS + 40);
}

function syncMobileStudioSizeButtons() {
  mobileStudioSizeButtons.forEach(button => {
    const isActive = !mobileStudioHeightOverride && button.dataset.mobileStudioSize === mobileStudioSize;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function setMobileStudioSize(nextSize) {
  mobileStudioSize = normalizeMobileStudioSize(nextSize);
  mobileStudioHeightOverride = null;
  mobileStudioResumeState = null;
  if (mobileStudioSize !== "peek") {
    rememberExpandedMobileStudioState({ kind: "preset", size: mobileStudioSize });
  }
  writeStoredStudioValue(MOBILE_STUDIO_SIZE_STORAGE_KEY, mobileStudioSize);
  writeStoredStudioValue(MOBILE_STUDIO_HEIGHT_STORAGE_KEY, "");
  syncMobileStudioSizeButtons();
  applyMobileStudioScale();
  updateStudioPanelOverflowState();
}

function expandPeekedMobileStudioForEditor() {
  if (window.innerWidth > MOBILE_STUDIO_BREAKPOINT) {
    return;
  }

  const { isNarrowPhone, minPanelHeight, maxPanelHeight, presetHeightMap, collapseSnapThreshold } = getMobileStudioMetrics();
  const effectiveHeight = mobileStudioHeightOverride != null
    ? clampMobileStudioHeight(mobileStudioHeightOverride, minPanelHeight, maxPanelHeight)
    : (presetHeightMap[mobileStudioSize] || presetHeightMap.balanced);
  const isPeekPreset = mobileStudioHeightOverride == null && mobileStudioSize === "peek";
  const isCollapsedOverride = mobileStudioHeightOverride != null && effectiveHeight <= collapseSnapThreshold;

  if (!(isPeekPreset || isCollapsedOverride) || mobileStudioResumeState) {
    return;
  }

  mobileStudioResumeState = mobileStudioHeightOverride != null
    ? { kind: "override", height: mobileStudioHeightOverride }
    : { kind: "preset", size: mobileStudioSize };

  if (mobileStudioExpandedState?.kind === "override" && Number.isFinite(mobileStudioExpandedState.height)) {
    mobileStudioHeightOverride = clampMobileStudioHeight(mobileStudioExpandedState.height, minPanelHeight, maxPanelHeight);
    writeStoredStudioValue(MOBILE_STUDIO_HEIGHT_STORAGE_KEY, mobileStudioHeightOverride);
    syncMobileStudioSizeButtons();
    applyMobileStudioScale();
    return;
  }

  if (mobileStudioExpandedState?.kind === "preset" && mobileStudioExpandedState.size && mobileStudioExpandedState.size !== "peek") {
    mobileStudioSize = normalizeMobileStudioSize(mobileStudioExpandedState.size);
    mobileStudioHeightOverride = null;
    writeStoredStudioValue(MOBILE_STUDIO_SIZE_STORAGE_KEY, mobileStudioSize);
    writeStoredStudioValue(MOBILE_STUDIO_HEIGHT_STORAGE_KEY, "");
    syncMobileStudioSizeButtons();
    applyMobileStudioScale();
    return;
  }

  mobileStudioHeightOverride = isNarrowPhone ? presetHeightMap.expanded : presetHeightMap.balanced;
  writeStoredStudioValue(MOBILE_STUDIO_HEIGHT_STORAGE_KEY, mobileStudioHeightOverride);
  syncMobileStudioSizeButtons();
  applyMobileStudioScale();
}

function restoreMobileStudioAfterEditor() {
  if (!mobileStudioResumeState) {
    return;
  }

  if (mobileStudioResumeState.kind === "override") {
    mobileStudioHeightOverride = mobileStudioResumeState.height;
    writeStoredStudioValue(MOBILE_STUDIO_HEIGHT_STORAGE_KEY, mobileStudioHeightOverride);
  } else {
    mobileStudioSize = normalizeMobileStudioSize(mobileStudioResumeState.size);
    mobileStudioHeightOverride = null;
    writeStoredStudioValue(MOBILE_STUDIO_SIZE_STORAGE_KEY, mobileStudioSize);
    writeStoredStudioValue(MOBILE_STUDIO_HEIGHT_STORAGE_KEY, "");
  }

  mobileStudioResumeState = null;
  syncMobileStudioSizeButtons();
  applyMobileStudioScale();
}

function clampMobileStudioHeight(height, minHeight, maxHeight) {
  return Math.min(Math.max(minHeight, Math.round(height)), Math.max(minHeight, maxHeight));
}

function buildTemplateField(config) {
  const base = createCustomField(config.type || "text");

  return {
    ...base,
    id: config.id,
    semanticId: config.semanticId || base.semanticId || "",
    type: config.type || base.type,
    title: config.title || config.label || base.title,
    copy: config.copy || config.helpText || "",
    label: config.label || base.label,
    navLabel: safeShortLabel(config.navLabel || config.label || base.navLabel),
    placeholder: typeof config.placeholder === "string" ? config.placeholder : base.placeholder,
    helpText: config.helpText || "",
    required: Boolean(config.required),
    rememberClientAnswer: config.rememberClientAnswer === true
  };
}

const FORM_TEMPLATE_LIBRARY = [
  {
    id: "barbershop",
    name: "Barbershop",
    subtitle: "Classic, polished, and built for high-touch service shops",
    badge: "Professional",
    points: [
      "Service request and preferred barber",
      "Hair goals or reference details",
      "Beard trim and add-on notes"
    ],
    swatches: ["#0f172a", "#e6c891", "#f7f3eb", "#201c18"],
    profile: {
      templateId: "barbershop",
      formTitle: "Barbershop Reminder",
      backgroundTop: "#0f172a",
      backgroundBottom: "#29313f",
      formSurfaceColor: "#f7f3eb",
      formSurfaceAccentColor: "#e6c891",
      formSurfaceGradient: "soft-blend",
      formSurfaceShineEnabled: true,
      formSurfaceShineColor: "#fff3d3",
      formTextColor: "#1f2937",
      stepNavBackgroundColor: "#ede3d2",
      stepNavTextColor: "#4b3c2a",
      stepNavActiveBackgroundColor: "#201c18",
      stepNavActiveTextColor: "#f8fafc",
      stepOverrides: {
        address: {
          title: "Shop Address",
          label: "Shop Address",
          copy: "Add the shop location the client should use for the visit.",
          placeholder: "Enter shop address"
        },
        businessContact: {
          title: "Shop Contact",
          label: "Shop Contact",
          copy: "Share the best shop number or email for reschedules.",
          helpText: "Use the contact the client should use for questions or changes.",
          placeholder: "Shop phone or email"
        },
        notes: {
          title: "Style Notes",
          navLabel: "Notes",
          label: "Style Notes",
          copy: "Add anything the barber should know before the cut.",
          placeholder: "Reference link, beard details, parking notes, or timing requests"
        }
      },
      fields: [
        buildTemplateField({
          id: "custom_service_request",
          type: "text",
          label: "Requested Service",
          navLabel: "Service",
          placeholder: "Haircut, beard trim, shave, or lineup",
          helpText: "Barbers often collect service type and add-ons before the appointment.",
          required: true
        }),
        buildTemplateField({
          id: "custom_preferred_barber",
          type: "text",
          label: "Preferred Barber",
          navLabel: "Barber",
          placeholder: "If they have one",
          helpText: "Useful when shops route bookings by barber.",
          rememberClientAnswer: true
        }),
        buildTemplateField({
          id: "custom_hair_goal",
          type: "textarea",
          label: "Hair Goals",
          navLabel: "Style",
          placeholder: "Describe the look they want or paste a reference link",
          helpText: "Many barber consult forms ask for current style and target look."
        }),
        buildTemplateField({
          id: "custom_beard_addon",
          type: "text",
          label: "Beard or Add-On Request",
          navLabel: "Add-On",
          placeholder: "Beard trim, razor line-up, wash, or nothing",
          helpText: "Use this to clarify beard services or extras."
        })
      ]
    }
  },
  {
    id: "pet-grooming",
    name: "Pet Grooming",
    subtitle: "Playful, bright, and perfect for pet-first intake details",
    badge: "Creative",
    points: [
      "Pet name, breed, and size",
      "Temperament and handling notes",
      "Allergy, skin, and vaccine info"
    ],
    swatches: ["#0f4c5c", "#8ecae6", "#f4fbff", "#2a9d8f"],
    profile: {
      templateId: "pet-grooming",
      formTitle: "Pet Grooming Reminder",
      backgroundTop: "#0f3d4a",
      backgroundBottom: "#1e6f7d",
      formSurfaceColor: "#f4fbff",
      formSurfaceAccentColor: "#d7f2ff",
      formSurfaceGradient: "top-glow",
      formSurfaceShineEnabled: true,
      formSurfaceShineColor: "#d9fbff",
      formTextColor: "#12303a",
      stepNavBackgroundColor: "#dff5fb",
      stepNavTextColor: "#115e73",
      stepNavActiveBackgroundColor: "#2a9d8f",
      stepNavActiveTextColor: "#f8fafc",
      stepOverrides: {
        address: {
          title: "Salon Address",
          label: "Salon Address",
          copy: "Add the salon or drop-off location.",
          placeholder: "Enter salon address"
        },
        businessContact: {
          title: "Salon Contact",
          label: "Salon Contact",
          copy: "Share the best number or email for appointment changes.",
          helpText: "Use the salon line clients should call for updates."
        },
        notes: {
          title: "Pickup Notes",
          navLabel: "Pickup",
          label: "Pickup Notes",
          copy: "Add anything the pet parent should know before pickup.",
          placeholder: "Late policy, parking notes, or drop-off reminders"
        }
      },
      fields: [
        buildTemplateField({
          id: "custom_pet_name",
          type: "text",
          label: "Pet Name",
          navLabel: "Pet",
          placeholder: "Enter pet name",
          helpText: "Pet grooming intake forms typically collect the pet's name first.",
          required: true,
          rememberClientAnswer: true
        }),
        buildTemplateField({
          id: "custom_pet_breed",
          type: "text",
          label: "Breed / Size",
          navLabel: "Breed",
          placeholder: "Breed, weight, or size",
          helpText: "Breed and size help groomers estimate timing and coat needs.",
          required: true,
          rememberClientAnswer: true
        }),
        buildTemplateField({
          id: "custom_grooming_service",
          type: "text",
          label: "Requested Grooming Service",
          navLabel: "Service",
          placeholder: "Bath, full groom, nail trim, de-shed",
          helpText: "Useful for package selection before the appointment.",
          required: true
        }),
        buildTemplateField({
          id: "custom_temperament_notes",
          type: "textarea",
          label: "Temperament / Handling Notes",
          navLabel: "Temper",
          placeholder: "Anxious, senior, reactive, or okay with dryers",
          helpText: "Groomers often ask about handling and behavior in advance."
        }),
        buildTemplateField({
          id: "custom_pet_health",
          type: "textarea",
          label: "Allergies or Skin Notes",
          navLabel: "Health",
          placeholder: "Skin sensitivity, allergies, or hotspots",
          helpText: "This helps groomers choose products and avoid irritation."
        }),
        buildTemplateField({
          id: "custom_vaccine_notes",
          type: "text",
          label: "Vaccine / Flea-Tick Notes",
          navLabel: "Vaccine",
          placeholder: "Anything the groomer should confirm",
          helpText: "Many grooming intake forms ask for vaccine or parasite notes."
        })
      ]
    }
  },
  {
    id: "massage",
    name: "Massage Therapy",
    subtitle: "Calm, elevated, and designed for premium wellness brands",
    badge: "Luxe",
    points: [
      "Primary pain or tension areas",
      "Pressure preference and comfort",
      "Health, injury, or mobility notes"
    ],
    swatches: ["#4b2e83", "#c4b5fd", "#faf7ff", "#7c3aed"],
    profile: {
      templateId: "massage",
      formTitle: "Massage Appointment Reminder",
      backgroundTop: "#1f1634",
      backgroundBottom: "#5b3f8a",
      formSurfaceColor: "#faf7ff",
      formSurfaceAccentColor: "#ede9fe",
      formSurfaceGradient: "soft-blend",
      formSurfaceShineEnabled: true,
      formSurfaceShineColor: "#f4ebff",
      formTextColor: "#221b34",
      stepNavBackgroundColor: "#efe7ff",
      stepNavTextColor: "#5b21b6",
      stepNavActiveBackgroundColor: "#7c3aed",
      stepNavActiveTextColor: "#f8fafc",
      stepOverrides: {
        businessContact: {
          title: "Clinic Contact",
          label: "Clinic Contact",
          copy: "Share the best number or email for appointment changes.",
          helpText: "Use the clinic contact the client should reach if they need to reschedule."
        },
        notes: {
          title: "Session Notes",
          navLabel: "Notes",
          label: "Session Notes",
          copy: "Add anything the client should know before the session.",
          placeholder: "Arrival notes, parking, or aftercare reminders"
        }
      },
      fields: [
        buildTemplateField({
          id: "custom_focus_areas",
          type: "textarea",
          label: "Focus Areas",
          navLabel: "Focus",
          placeholder: "Neck, low back, shoulders, legs, or full body",
          helpText: "Massage intake forms usually ask where the client wants work focused.",
          required: true
        }),
        buildTemplateField({
          id: "custom_pressure_preference",
          type: "text",
          label: "Pressure Preference",
          navLabel: "Pressure",
          placeholder: "Light, medium, deep, or unsure",
          helpText: "Pressure preference is a standard question for massage bookings.",
          required: true,
          rememberClientAnswer: true
        }),
        buildTemplateField({
          id: "custom_health_notes",
          type: "textarea",
          label: "Injuries or Health Notes",
          navLabel: "Health",
          placeholder: "Recent surgery, injury, or medical concerns",
          helpText: "Many intake forms ask about injuries, medications, or contraindications."
        }),
        buildTemplateField({
          id: "custom_accommodations",
          type: "text",
          label: "Pregnancy or Mobility Accommodations",
          navLabel: "Access",
          placeholder: "Anything the therapist should plan around",
          helpText: "This helps clinics prepare table setup or positioning."
        })
      ]
    }
  },
  {
    id: "house-cleaning",
    name: "House Cleaning",
    subtitle: "Clean, trustworthy, and built for operational service teams",
    badge: "Operational",
    points: [
      "Bedrooms, bathrooms, and property type",
      "Deep clean or recurring service",
      "Pets, access, and special instructions"
    ],
    swatches: ["#123c69", "#7dd3fc", "#f8fbff", "#0ea5e9"],
    profile: {
      templateId: "house-cleaning",
      formTitle: "Cleaning Service Reminder",
      backgroundTop: "#10273d",
      backgroundBottom: "#245f8f",
      formSurfaceColor: "#f8fbff",
      formSurfaceAccentColor: "#dbeafe",
      formSurfaceGradient: "diagonal",
      formSurfaceShineEnabled: true,
      formSurfaceShineColor: "#eff8ff",
      formTextColor: "#102a43",
      stepNavBackgroundColor: "#e0f2fe",
      stepNavTextColor: "#0c4a6e",
      stepNavActiveBackgroundColor: "#0ea5e9",
      stepNavActiveTextColor: "#f8fafc",
      stepOverrides: {
        address: {
          title: "Service Address",
          label: "Service Address",
          copy: "Add the home or property address for the cleaning visit."
        },
        businessContact: {
          title: "Cleaner Contact",
          label: "Cleaner Contact",
          copy: "Share the number or email clients should use for schedule changes."
        },
        notes: {
          title: "Arrival Notes",
          navLabel: "Arrival",
          label: "Arrival Notes",
          copy: "Add gate codes, parking tips, or other arrival reminders.",
          placeholder: "Gate code, parking notes, or alarm instructions"
        }
      },
      fields: [
        buildTemplateField({
          id: "custom_cleaning_type",
          type: "text",
          label: "Cleaning Type",
          navLabel: "Type",
          placeholder: "Standard, deep clean, move-out, recurring",
          helpText: "Cleaning businesses usually confirm the type of clean before arrival.",
          required: true
        }),
        buildTemplateField({
          id: "custom_home_size",
          type: "text",
          label: "Bedrooms / Bathrooms",
          navLabel: "Rooms",
          placeholder: "Example: 3 bed / 2 bath",
          helpText: "Home size helps estimate timing and staffing.",
          required: true,
          rememberClientAnswer: true
        }),
        buildTemplateField({
          id: "custom_pets_home",
          type: "text",
          label: "Pets in the Home",
          navLabel: "Pets",
          placeholder: "Dog, cat, none, or crate info",
          helpText: "Helpful for access and cleaning planning.",
          rememberClientAnswer: true
        }),
        buildTemplateField({
          id: "custom_access_notes",
          type: "textarea",
          label: "Access / Special Instructions",
          navLabel: "Access",
          placeholder: "How to enter, areas to avoid, or anything fragile",
          helpText: "Access notes and special instructions are common before home-service visits."
        })
      ]
    }
  },
  {
    id: "auto-detailing",
    name: "Auto Detailing",
    subtitle: "Bold, high-contrast, and made for premium mobile detailing brands",
    badge: "Bold",
    points: [
      "Make, model, and year",
      "Detail package and add-ons",
      "Vehicle condition and access notes"
    ],
    swatches: ["#111827", "#f59e0b", "#fffaf0", "#1f2937"],
    profile: {
      templateId: "auto-detailing",
      formTitle: "Detailing Appointment Reminder",
      backgroundTop: "#111827",
      backgroundBottom: "#374151",
      formSurfaceColor: "#fffaf0",
      formSurfaceAccentColor: "#fde68a",
      formSurfaceGradient: "soft-blend",
      formSurfaceShineEnabled: true,
      formSurfaceShineColor: "#fff0bf",
      formTextColor: "#1f2937",
      stepNavBackgroundColor: "#fef3c7",
      stepNavTextColor: "#92400e",
      stepNavActiveBackgroundColor: "#111827",
      stepNavActiveTextColor: "#f8fafc",
      stepOverrides: {
        address: {
          title: "Service Address",
          label: "Service Address",
          copy: "Add the address where the vehicle will be serviced."
        },
        businessContact: {
          title: "Detailer Contact",
          label: "Detailer Contact",
          copy: "Share the best number or email for schedule changes."
        },
        notes: {
          title: "Arrival Notes",
          navLabel: "Notes",
          label: "Arrival Notes",
          copy: "Add access notes the client should know before service.",
          placeholder: "Parking deck, gate code, or arrival timing"
        }
      },
      fields: [
        buildTemplateField({
          id: "custom_vehicle_make_model",
          type: "text",
          label: "Vehicle Make / Model",
          navLabel: "Vehicle",
          placeholder: "Example: Toyota Camry",
          helpText: "Detailing forms usually collect make and model before booking.",
          required: true,
          rememberClientAnswer: true
        }),
        buildTemplateField({
          id: "custom_vehicle_year",
          type: "text",
          label: "Vehicle Year",
          navLabel: "Year",
          placeholder: "Example: 2021",
          rememberClientAnswer: true
        }),
        buildTemplateField({
          id: "custom_detail_package",
          type: "text",
          label: "Requested Package",
          navLabel: "Package",
          placeholder: "Interior, exterior, full detail, ceramic add-on",
          helpText: "Packages and add-ons are a common pre-booking question.",
          required: true
        }),
        buildTemplateField({
          id: "custom_vehicle_condition",
          type: "textarea",
          label: "Vehicle Condition Notes",
          navLabel: "Condition",
          placeholder: "Pet hair, stains, odor, heavy dirt, or scratch concerns",
          helpText: "Condition notes help set expectations before the job."
        }),
        buildTemplateField({
          id: "custom_power_water",
          type: "text",
          label: "Water / Power Access",
          navLabel: "Access",
          placeholder: "Available on-site or mobile setup needed",
          helpText: "Mobile detailers often ask about outlet and water access."
        })
      ]
    }
  }
];

function setStatus(message, type = "info") {
  if (!statusBanner) {
    return;
  }

  if (statusBannerTimer) {
    clearTimeout(statusBannerTimer);
    statusBannerTimer = null;
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

  const autoHideDelay = type === "error" ? 7000 : type === "success" ? 4200 : 3600;
  statusBannerTimer = window.setTimeout(() => {
    setStatus("");
  }, autoHideDelay);
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

function flashButtonConfirmation(button, text = "Saved") {
  if (!button) {
    return;
  }

  if (!button.dataset.defaultText) {
    button.dataset.defaultText = button.textContent;
  }

  button.textContent = text;
  window.setTimeout(() => {
    if (!button.disabled) {
      button.textContent = button.dataset.defaultText;
    }
  }, 1800);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getCustomFields() {
  return Array.isArray(currentFormProfile.fields) ? currentFormProfile.fields : [];
}

function getBuilderFieldTypeOptions(currentType = "") {
  if (BUILDER_CUSTOM_FIELD_TYPES.some(option => option.id === currentType)) {
    return BUILDER_CUSTOM_FIELD_TYPES;
  }

  if (!currentType) {
    return BUILDER_CUSTOM_FIELD_TYPES;
  }

  return [getCustomFieldTypeMeta(currentType), ...BUILDER_CUSTOM_FIELD_TYPES.filter(option => option.id !== currentType)];
}

function getCustomPages() {
  return Array.isArray(currentFormProfile.customPages) ? currentFormProfile.customPages : [];
}

function getAllPreviewSteps() {
  return buildPreviewStepList(currentFormProfile);
}

function getPreviewSteps() {
  const steps = getAllPreviewSteps()
    .map(step => getPerspectiveStep(step, previewPerspective));

  return previewOnlyMode
    ? steps.filter(step => isStepVisibleForPerspective(step, previewPerspective))
    : steps;
}

function getTopLevelCustomFields() {
  return getCustomFields().filter(field => !field.pageId);
}

function getSelectedPreviewStep() {
  const steps = getPreviewSteps();
  return steps.find(step => step.id === selectedPreviewStepId) || steps[0] || null;
}

function getEditableStep(stepId) {
  if (!stepId) {
    return null;
  }

  return getAllPreviewSteps().find(step => step.id === stepId)
    || getCustomFields().find(field => field.id === stepId)
    || getCustomPages().find(page => page.id === stepId)
    || null;
}

function getCurrentPageId() {
  return selectedPreviewStepId;
}

function getPerspectiveStep(step, perspective = previewPerspective) {
  if (!step) {
    return step;
  }

  if (step.type === "review" && perspective === "client") {
    return {
      ...step,
      title: "Review and Submit",
      navLabel: "Submit",
      copy: "Review your appointment request before sending it to the business.",
      label: "Review and Submit"
    };
  }

  return getPerspectiveField(step, perspective);
}

function getVisibleFieldForPerspective(field, perspective = previewPerspective) {
  return isFieldVisibleForPerspective(field, perspective)
    ? getPerspectiveField(field, perspective)
    : null;
}

function isStepVisibleForPerspective(step, perspective = previewPerspective) {
  if (!step) {
    return false;
  }

  if (step.type === "welcome" || step.type === "thankyou" || step.type === "review") {
    return true;
  }

  return getPageFieldsForStep(step.id, { forPreview: true, perspective }).length > 0;
}

function getPageFieldsForStep(stepId, options = {}) {
  const { forPreview = false, perspective = previewPerspective } = options;
  const page = getEditableStep(stepId);

  if (!page || ["review", "welcome", "thankyou"].includes(page.id) || ["review", "welcome", "thankyou"].includes(String(page.type || "").trim())) {
    return [];
  }

  const baseFieldHidden = Boolean(page.baseFieldHidden);
  const isBuiltInPage = BASE_REMINDER_STEPS.some(step => step.id === page.id);
  const isLegacyFieldPage = !isBuiltInPage && getCustomFields().some(field => !field.pageId && field.id === page.id);
  const baseField = (!baseFieldHidden && (isBuiltInPage || isLegacyFieldPage))
    ? {
        ...page,
        builtIn: isBuiltInPage,
        pageId: "",
        isBaseField: true
      }
    : null;

  const inlineFields = getInlineFieldsForPage(currentFormProfile, page.id).map(field => ({
    ...field,
    isBaseField: false
  }));
  const allFields = [baseField, ...inlineFields].filter(Boolean);
  const perspectiveFields = forPreview
    ? allFields.map(field => getVisibleFieldForPerspective(field, perspective)).filter(Boolean)
    : allFields;
  const orderedIds = Array.isArray(currentFormProfile.pageFieldOrder?.[page.id]) ? currentFormProfile.pageFieldOrder[page.id] : [];

  if (!orderedIds.length) {
    return perspectiveFields;
  }

  const fieldMap = new Map(perspectiveFields.map(field => [field.id, field]));
  const orderedFields = [];

  orderedIds.forEach(id => {
    const field = fieldMap.get(id);

    if (field) {
      orderedFields.push(field);
      fieldMap.delete(id);
    }
  });

  perspectiveFields.forEach(field => {
    if (fieldMap.has(field.id)) {
      orderedFields.push(field);
      fieldMap.delete(field.id);
    }
  });

  return orderedFields;
}

function getCurrentPageFields() {
  return getPageFieldsForStep(getCurrentPageId());
}

function isCustomStep(stepId) {
  return getCustomFields().some(field => field.id === stepId) || getCustomPages().some(page => page.id === stepId);
}

function patchStepConfig(stepId, updates) {
  if (getCustomFields().some(field => field.id === stepId)) {
    currentFormProfile = {
      ...currentFormProfile,
      fields: getCustomFields().map(entry => entry.id === stepId ? { ...entry, ...updates } : entry)
    };
    return;
  }

  if (getCustomPages().some(page => page.id === stepId)) {
    currentFormProfile = {
      ...currentFormProfile,
      customPages: getCustomPages().map(entry => entry.id === stepId ? { ...entry, ...updates } : entry)
    };
    return;
  }

  currentFormProfile = {
    ...currentFormProfile,
    stepOverrides: {
      ...(currentFormProfile.stepOverrides || {}),
      [stepId]: {
        ...(currentFormProfile.stepOverrides?.[stepId] || {}),
        ...updates
      }
    }
  };
}

function ensureStepOrderIds(stepIds) {
  const filteredIds = stepIds.filter(id => id && id !== "review");
  currentFormProfile = {
    ...currentFormProfile,
    stepOrder: [...new Set(filteredIds)]
  };
}

function getCurrentStepOrder() {
  return getAllPreviewSteps().filter(isReorderablePreviewStep).map(step => step.id);
}

function setFieldOrderForPage(pageId, orderedIds) {
  if (!pageId) {
    return;
  }

  currentFormProfile = {
    ...currentFormProfile,
    pageFieldOrder: {
      ...(currentFormProfile.pageFieldOrder || {}),
      [pageId]: [...new Set(orderedIds.filter(Boolean))]
    }
  };
}

function insertFieldIntoCurrentPage(type, insertIndex = null) {
  const nextField = createCustomField(type);
  const currentPageId = getCurrentPageId();

  if (!currentPageId || ["review", "welcome", "thankyou"].includes(currentPageId)) {
    setStatus("Pick a question page first, then add fields to that page.", "error");
    return;
  }

  const currentFields = getCurrentPageFields();
  const normalizedIndex = typeof insertIndex === "number"
    ? Math.max(0, Math.min(insertIndex, currentFields.length))
    : currentFields.length;
  const nextOrder = [...currentFields.map(field => field.id)];
  nextOrder.splice(normalizedIndex, 0, nextField.id);

  currentFormProfile = {
    ...currentFormProfile,
    fields: [...getCustomFields(), { ...nextField, pageId: currentPageId }]
  };
  setFieldOrderForPage(currentPageId, nextOrder);
  renderBuilder();
  openFieldEditor(nextField.id);
}

function buildEssentialField(stepId) {
  const baseStep = BUILT_IN_STEP_MAP.get(stepId);

  if (!baseStep) {
    return null;
  }

  const override = currentFormProfile.stepOverrides?.[stepId] || {};
  const nextField = createCustomField(baseStep.type);
  const label = override.label || baseStep.label || nextField.label;
  const navLabel = safeShortLabel(override.navLabel || baseStep.navLabel || label || nextField.navLabel);
  const placeholder = typeof override.placeholder === "string"
    ? override.placeholder
    : (typeof baseStep.placeholder === "string" ? baseStep.placeholder : nextField.placeholder);
  const helpText = override.helpText || baseStep.helpText || nextField.helpText || "";
  const copy = override.copy || baseStep.copy || nextField.copy || "";

  return {
    ...nextField,
    semanticId: stepId,
    type: baseStep.type || nextField.type,
    title: override.title || baseStep.title || label || nextField.title,
    copy,
    label,
    navLabel,
    placeholder,
    helpText,
    required: override.required === true,
    rememberClientAnswer: override.rememberClientAnswer === true
      || (override.rememberClientAnswer == null && isDefaultRememberedClientField(stepId)),
    visibleTo: override.visibleTo || baseStep.visibleTo || "both",
    clientTitle: override.clientTitle || "",
    clientCopy: override.clientCopy || "",
    clientLabel: override.clientLabel || "",
    clientNavLabel: override.clientNavLabel || "",
    clientPlaceholder: override.clientPlaceholder || "",
    clientHelpText: override.clientHelpText || "",
    saveTarget: override.saveTarget || baseStep.saveTarget || "appointment_details",
    includeInReminder: override.includeInReminder == null ? baseStep.includeInReminder !== false : override.includeInReminder !== false
  };
}

function getEssentialFields(stepId) {
  return getCustomFields().filter(field => String(field.semanticId || "").trim() === String(stepId || "").trim());
}

function isBuiltInStepHidden(stepId) {
  return currentFormProfile.stepOverrides?.[stepId]?.hidden === true;
}

function addEssentialFieldFromToolbar(stepId) {
  if (isBuiltInStepHidden(stepId) && !getEssentialFields(stepId).length) {
    restoreBuiltInStep(stepId, { openEditor: true });
    return;
  }

  insertEssentialFieldIntoCurrentPage(stepId, { openEditor: true });
}

function insertEssentialFieldIntoCurrentPage(stepId, options = {}) {
  const baseStep = BUILT_IN_STEP_MAP.get(stepId);
  const currentPageId = getCurrentPageId();

  if (!baseStep) {
    return;
  }

  if (!currentPageId || ["review", "welcome", "thankyou"].includes(currentPageId)) {
    setStatus("Pick a question page first, then add essentials to that page.", "error");
    return;
  }

  if (currentPageId === stepId) {
    if (isBuiltInStepHidden(stepId)) {
      restoreBuiltInStep(stepId, { openEditor: options.openEditor });
      return;
    }

    selectedPreviewStepId = stepId;
    renderBuilder();

    if (options.openEditor) {
      openFieldEditor(stepId);
    }

    setStatus(`${baseStep.navLabel} is already the main field on this page.`, "info");
    return;
  }

  const existingEssentialFields = getEssentialFields(stepId);
  const primaryField = existingEssentialFields[0] || null;
  const duplicateIds = new Set(existingEssentialFields.slice(1).map(field => field.id));
  const targetField = primaryField
    ? { ...primaryField, pageId: currentPageId }
    : { ...buildEssentialField(stepId), pageId: currentPageId };

  if (!targetField) {
    return;
  }

  const currentFields = getCurrentPageFields()
    .filter(field => field.id !== targetField.id && !duplicateIds.has(field.id));
  const normalizedIndex = typeof options.insertIndex === "number"
    ? Math.max(0, Math.min(options.insertIndex, currentFields.length))
    : currentFields.length;
  const nextCurrentOrder = [...currentFields.map(field => field.id)];
  nextCurrentOrder.splice(normalizedIndex, 0, targetField.id);

  const nextFields = getCustomFields()
    .filter(field => !duplicateIds.has(field.id))
    .map(field => field.id === targetField.id ? targetField : field);

  if (!nextFields.some(field => field.id === targetField.id)) {
    nextFields.push(targetField);
  }

  const nextPageFieldOrder = Object.fromEntries(
    Object.entries(currentFormProfile.pageFieldOrder || {}).map(([pageId, ids]) => [
      pageId,
      Array.isArray(ids)
        ? ids.filter(id => id !== targetField.id && !duplicateIds.has(id))
        : []
    ])
  );
  nextPageFieldOrder[currentPageId] = [...new Set(nextCurrentOrder.filter(Boolean))];

  currentFormProfile = {
    ...currentFormProfile,
    stepOverrides: {
      ...(currentFormProfile.stepOverrides || {}),
      [stepId]: {
        ...(currentFormProfile.stepOverrides?.[stepId] || {}),
        hidden: true
      }
    },
    fields: nextFields,
    stepOrder: (Array.isArray(currentFormProfile.stepOrder) ? currentFormProfile.stepOrder : getCurrentStepOrder())
      .filter(id => id !== stepId),
    pageFieldOrder: nextPageFieldOrder
  };

  selectedPreviewStepId = currentPageId;
  renderBuilder();

  if (options.openEditor) {
    openFieldEditor(targetField.id);
  }

  setStatus(primaryField
    ? `${baseStep.navLabel} moved onto this page.`
    : `${baseStep.navLabel} added to this page.`, "success");
}

function restoreBuiltInStep(stepId, options = {}) {
  const baseStep = BUILT_IN_STEP_MAP.get(stepId);

  if (!baseStep) {
    return;
  }

  const { insertIndex = null, openEditor = false } = options;
  const currentOrder = getCurrentStepOrder();
  const existingIndex = currentOrder.indexOf(stepId);
  const isReorderingExistingStep = existingIndex >= 0 && typeof insertIndex === "number";
  const nextOrder = [...currentOrder];
  const wasHidden = currentFormProfile.stepOverrides?.[stepId]?.hidden === true;

  if (existingIndex >= 0 && typeof insertIndex === "number") {
    const [movedId] = nextOrder.splice(existingIndex, 1);
    const normalizedIndex = Math.max(0, Math.min(insertIndex, nextOrder.length));
    nextOrder.splice(normalizedIndex, 0, movedId);
  } else if (existingIndex < 0) {
    const selectedIndex = nextOrder.indexOf(getCurrentPageId());
    const fallbackIndex = selectedIndex >= 0 ? selectedIndex + 1 : nextOrder.length;
    const normalizedIndex = typeof insertIndex === "number"
      ? Math.max(0, Math.min(insertIndex, nextOrder.length))
      : fallbackIndex;
    nextOrder.splice(normalizedIndex, 0, stepId);
  }

  patchStepConfig(stepId, { hidden: false });
  ensureStepOrderIds(nextOrder);
  selectedPreviewStepId = stepId;
  renderBuilder();

  if (openEditor) {
    openFieldEditor(stepId);
  }

  if (wasHidden) {
    setStatus(`${baseStep.navLabel} restored to your form.`, "success");
  } else if (isReorderingExistingStep) {
    setStatus(`${baseStep.navLabel} moved in your form.`, "success");
  } else if (existingIndex < 0) {
    setStatus(`${baseStep.navLabel} added to your form.`, "success");
  } else {
    setStatus(`${baseStep.navLabel} is already part of your form.`, "info");
  }
}

function addBlankPage(insertIndex = null) {
  const nextPage = createCustomPage();
  const currentOrder = getCurrentStepOrder();
  const normalizedIndex = typeof insertIndex === "number"
    ? Math.max(0, Math.min(insertIndex, currentOrder.length))
    : currentOrder.length;
  const nextOrder = [...currentOrder];
  nextOrder.splice(normalizedIndex, 0, nextPage.id);

  currentFormProfile = {
    ...currentFormProfile,
    customPages: [...getCustomPages(), nextPage]
  };
  ensureStepOrderIds(nextOrder);
  selectedPreviewStepId = nextPage.id;
  renderBuilder();
  openSelectedStepTextEditor("step-title");
  setStatus("Blank page added. Click inside the page to start building it.", "info");
}

function removeCustomPage(stepId) {
  const page = getCustomPages().find(entry => entry.id === stepId);

  if (!page) {
    return false;
  }

  const removedFieldIds = new Set(
    getCustomFields()
      .filter(entry => entry.id === stepId || entry.pageId === stepId)
      .map(entry => entry.id)
  );
  const nextPageFieldOrder = Object.fromEntries(
    Object.entries(currentFormProfile.pageFieldOrder || {})
      .filter(([pageId]) => pageId !== stepId)
      .map(([pageId, ids]) => [
        pageId,
        Array.isArray(ids) ? ids.filter(id => !removedFieldIds.has(id)) : []
      ])
  );
  const nextStepOrder = (Array.isArray(currentFormProfile.stepOrder) ? currentFormProfile.stepOrder : getCurrentStepOrder())
    .filter(id => id !== stepId);

  currentFormProfile = {
    ...currentFormProfile,
    customPages: getCustomPages().filter(entry => entry.id !== stepId),
    fields: getCustomFields().filter(entry => entry.id !== stepId && entry.pageId !== stepId),
    stepOrder: [...new Set(nextStepOrder)],
    pageFieldOrder: nextPageFieldOrder
  };

  if (selectedPreviewStepId === stepId || !buildPreviewStepList(currentFormProfile).some(step => step.id === selectedPreviewStepId)) {
    const nextPreviewSteps = buildPreviewStepList(currentFormProfile);
    selectedPreviewStepId = nextPreviewSteps.find(isReorderablePreviewStep)?.id
      || nextPreviewSteps[0]?.id
      || BASE_REMINDER_STEPS[0]?.id
      || "phone";
  }

  closeEditor();
  renderBuilder();
  setStatus(`${page.title || "Custom page"} removed from your form.`, "success");
  return true;
}

function clearDragIndicators() {
  document.querySelectorAll(".preview-field-dropzone.is-over, .preview-step-dropzone.is-over").forEach(zone => {
    zone.classList.remove("is-over");
  });
  document.querySelectorAll(".field-rail-card.is-drop-before, .field-rail-card.is-drop-after").forEach(card => {
    card.classList.remove("is-drop-before", "is-drop-after");
  });
}

function getReorderablePreviewStepButtons() {
  if (!previewStepper) {
    return [];
  }

  return Array.from(previewStepper.querySelectorAll("[data-preview-step]")).filter(button => {
    const stepId = button.dataset.previewStep || "";
    const step = getPreviewSteps().find(entry => entry.id === stepId);
    return isReorderablePreviewStep(step);
  });
}

function getStepDropzoneByIndex(insertIndex) {
  return previewStepper?.querySelector(`[data-drop-step-index="${insertIndex}"]`) || null;
}

function showStepDropIndicator(insertIndex) {
  clearDragIndicators();
  getStepDropzoneByIndex(insertIndex)?.classList.add("is-over");
}

function getStepInsertIndexFromPointer(clientX) {
  const buttons = getReorderablePreviewStepButtons();

  if (!buttons.length || typeof clientX !== "number") {
    return buttons.length ? 0 : null;
  }

  for (let index = 0; index < buttons.length; index += 1) {
    const rect = buttons[index].getBoundingClientRect();
    const midpoint = rect.left + (rect.width / 2);

    if (clientX < midpoint) {
      return index;
    }
  }

  return buttons.length;
}

function getStepInsertIndexFromTarget(target, clientX = null) {
  if (!previewStepper || !target) {
    return null;
  }

  const dropzone = target.closest?.("[data-drop-step-index]");

  if (dropzone) {
    return Number(dropzone.dataset.dropStepIndex || "0");
  }

  const button = target.closest?.("[data-preview-step]");

  if (!button) {
    return null;
  }

  const buttons = getReorderablePreviewStepButtons();
  const buttonIndex = buttons.findIndex(entry => entry.dataset.previewStep === (button.dataset.previewStep || ""));

  if (buttonIndex < 0) {
    return null;
  }

  if (typeof clientX !== "number") {
    return buttonIndex;
  }

  const rect = button.getBoundingClientRect();
  const midpoint = rect.left + (rect.width / 2);
  return clientX < midpoint ? buttonIndex : buttonIndex + 1;
}

function autoScrollPreviewStepper(clientX = null) {
  if (!previewStepper) {
    return;
  }

  if (typeof clientX !== "number") {
    const activeButton = previewStepper.querySelector(".preview-stepper-button.is-active");
    activeButton?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center"
    });
    return;
  }

  const rect = previewStepper.getBoundingClientRect();
  const edgeThreshold = 56;
  const scrollAmount = 28;

  if (clientX <= rect.left + edgeThreshold) {
    previewStepper.scrollBy({ left: -scrollAmount, behavior: "auto" });
  } else if (clientX >= rect.right - edgeThreshold) {
    previewStepper.scrollBy({ left: scrollAmount, behavior: "auto" });
  }
}

function clearStepPointerDragState({ preserveSuppressClick = false } = {}) {
  if (stepPointerDragState?.button) {
    stepPointerDragState.button.classList.remove("is-dragging");
    stepPointerDragState.button.style.removeProperty("--fc-step-drag-x");
    stepPointerDragState.button.style.removeProperty("--fc-step-drag-y");
    if (typeof stepPointerDragState.pointerId === "number") {
      try {
        stepPointerDragState.button.releasePointerCapture(stepPointerDragState.pointerId);
      } catch (error) {
        // Ignore release failures when capture was never acquired.
      }
    }
  }

  if (!preserveSuppressClick) {
    suppressNextStepperClick = false;
  }

  stepPointerDragState = null;
  document.body.classList.remove("is-step-chip-dragging");
  previewStepper?.classList.remove("is-dragging-steps", "is-pointer-dragging-steps");
  clearDragIndicators();
}

function beginStepPointerDrag() {
  if (!stepPointerDragState?.button || !previewStepper) {
    return;
  }

  stepPointerDragState.dragging = true;
  previewStepper.classList.add("is-dragging-steps", "is-pointer-dragging-steps");
  stepPointerDragState.button.classList.add("is-dragging");
  stepPointerDragState.button.style.setProperty("--fc-step-drag-x", "0px");
  stepPointerDragState.button.style.setProperty("--fc-step-drag-y", "0px");
  document.body.classList.add("is-step-chip-dragging");
}

function updateStepPointerDrag(clientX, clientY) {
  if (!stepPointerDragState?.stepId || !previewStepper) {
    return;
  }

  const deltaX = clientX - stepPointerDragState.startX;
  const deltaY = clientY - stepPointerDragState.startY;
  stepPointerDragState.button?.style.setProperty("--fc-step-drag-x", `${deltaX}px`);
  stepPointerDragState.button?.style.setProperty("--fc-step-drag-y", `${deltaY}px`);

  autoScrollPreviewStepper(clientX);
  const insertIndex = getStepInsertIndexFromPointer(clientX);

  if (insertIndex === null) {
    return;
  }

  stepPointerDragState.insertIndex = insertIndex;
  showStepDropIndicator(insertIndex);
}

function maybeStartStepPointerDrag(event) {
  if (stepPointerDragState || previewOnlyMode || !previewStepper || event.button !== 0) {
    return;
  }

  const button = event.target.closest?.("[data-preview-step]");
  const stepId = button?.dataset.previewStep || "";
  const step = getPreviewSteps().find(entry => entry.id === stepId);

  if (!button || !isReorderablePreviewStep(step)) {
    return;
  }

  event.preventDefault();

  stepPointerDragState = {
    pointerId: event.pointerId,
    stepId,
    button,
    startX: event.clientX,
    startY: event.clientY,
    clientY: event.clientY,
    insertIndex: null,
    dragging: false
  };

  suppressNextStepperClick = false;

  try {
    button.setPointerCapture(event.pointerId);
  } catch (error) {
    // Some browsers do not support pointer capture in every context.
  }
}

function maybeStartStepMouseDrag(event) {
  if (stepPointerDragState || previewOnlyMode || !previewStepper || event.button !== 0) {
    return;
  }

  const button = event.target.closest?.("[data-preview-step]");
  const stepId = button?.dataset.previewStep || "";
  const step = getPreviewSteps().find(entry => entry.id === stepId);

  if (!button || !isReorderablePreviewStep(step)) {
    return;
  }

  event.preventDefault();

  stepPointerDragState = {
    pointerId: "mouse",
    stepId,
    button,
    startX: event.clientX,
    startY: event.clientY,
    clientY: event.clientY,
    insertIndex: null,
    dragging: false
  };

  suppressNextStepperClick = false;
}

function handleStepPointerMove(event) {
  if (!stepPointerDragState || event.pointerId !== stepPointerDragState.pointerId) {
    return;
  }

  stepPointerDragState.clientY = event.clientY;
  const movedX = Math.abs(event.clientX - stepPointerDragState.startX);
  const movedY = Math.abs(event.clientY - stepPointerDragState.startY);

  if (!stepPointerDragState.dragging) {
    if (Math.max(movedX, movedY) < 8) {
      return;
    }

    beginStepPointerDrag();
  }

  event.preventDefault();
  updateStepPointerDrag(event.clientX, event.clientY);
}

function handleStepMouseMove(event) {
  if (!stepPointerDragState || stepPointerDragState.pointerId !== "mouse") {
    return;
  }

  stepPointerDragState.clientY = event.clientY;
  const movedX = Math.abs(event.clientX - stepPointerDragState.startX);
  const movedY = Math.abs(event.clientY - stepPointerDragState.startY);

  if (!stepPointerDragState.dragging) {
    if (Math.max(movedX, movedY) < 8) {
      return;
    }

    beginStepPointerDrag();
  }

  event.preventDefault();
  updateStepPointerDrag(event.clientX, event.clientY);
}

function finishStepPointerDrop() {
  if (!stepPointerDragState) {
    return;
  }

  const { dragging, stepId, insertIndex } = stepPointerDragState;

  if (dragging && stepId && typeof insertIndex === "number") {
    reorderStep(stepId, insertIndex);
    suppressNextStepperClick = true;
    window.setTimeout(() => {
      suppressNextStepperClick = false;
    }, 180);
  }

  clearStepPointerDragState({ preserveSuppressClick: suppressNextStepperClick });
}

function cancelStepPointerDrag() {
  clearStepPointerDragState();
}

function getFieldRailCards() {
  if (!fieldRailList) {
    return [];
  }

  return Array.from(fieldRailList.querySelectorAll("[data-field-id]"));
}

function getFieldRailInsertStateFromPointer(clientY) {
  const cards = getFieldRailCards();

  if (!cards.length || typeof clientY !== "number") {
    return {
      insertIndex: 0,
      targetCard: cards[0] || null,
      placement: "before"
    };
  }

  for (let index = 0; index < cards.length; index += 1) {
    const rect = cards[index].getBoundingClientRect();
    const midpoint = rect.top + (rect.height / 2);

    if (clientY < midpoint) {
      return {
        insertIndex: index,
        targetCard: cards[index],
        placement: "before"
      };
    }
  }

  return {
    insertIndex: cards.length,
    targetCard: cards[cards.length - 1] || null,
    placement: "after"
  };
}

function autoScrollFieldRailList(clientY = null) {
  if (!fieldRailList || typeof clientY !== "number") {
    return;
  }

  const rect = fieldRailList.getBoundingClientRect();
  const edgeThreshold = 44;
  const scrollAmount = 24;

  if (clientY <= rect.top + edgeThreshold) {
    fieldRailList.scrollBy({ top: -scrollAmount, behavior: "auto" });
  } else if (clientY >= rect.bottom - edgeThreshold) {
    fieldRailList.scrollBy({ top: scrollAmount, behavior: "auto" });
  }
}

function showFieldRailDropIndicator(targetCard, placement = "before") {
  clearDragIndicators();

  if (!targetCard) {
    return;
  }

  targetCard.classList.add(placement === "after" ? "is-drop-after" : "is-drop-before");
}

function clearFieldRailPointerDragState({ preserveSuppressClick = false } = {}) {
  if (fieldRailPointerDragState?.card) {
    fieldRailPointerDragState.card.classList.remove("is-dragging");
    fieldRailPointerDragState.card.style.removeProperty("--fc-field-rail-drag-x");
    fieldRailPointerDragState.card.style.removeProperty("--fc-field-rail-drag-y");
    if (typeof fieldRailPointerDragState.pointerId === "number") {
      try {
        fieldRailPointerDragState.card.releasePointerCapture(fieldRailPointerDragState.pointerId);
      } catch (_error) {
        // Ignore release failures when capture was never acquired.
      }
    }
  }

  if (!preserveSuppressClick) {
    suppressNextFieldRailClick = false;
  }

  fieldRailPointerDragState = null;
  document.body.classList.remove("is-field-rail-dragging");
  clearDragIndicators();
}

function beginFieldRailPointerDrag() {
  if (!fieldRailPointerDragState?.card) {
    return;
  }

  fieldRailPointerDragState.dragging = true;
  fieldRailPointerDragState.card.classList.add("is-dragging");
  fieldRailPointerDragState.card.style.setProperty("--fc-field-rail-drag-x", "0px");
  fieldRailPointerDragState.card.style.setProperty("--fc-field-rail-drag-y", "0px");
  document.body.classList.add("is-field-rail-dragging");
}

function updateFieldRailPointerDrag(clientX, clientY) {
  if (!fieldRailPointerDragState?.fieldId) {
    return;
  }

  const deltaX = clientX - fieldRailPointerDragState.startX;
  const deltaY = clientY - fieldRailPointerDragState.startY;
  fieldRailPointerDragState.card?.style.setProperty("--fc-field-rail-drag-x", `${deltaX}px`);
  fieldRailPointerDragState.card?.style.setProperty("--fc-field-rail-drag-y", `${deltaY}px`);
  autoScrollFieldRailList(clientY);

  const insertState = getFieldRailInsertStateFromPointer(clientY);
  fieldRailPointerDragState.insertIndex = insertState.insertIndex;
  fieldRailPointerDragState.targetCard = insertState.targetCard;
  fieldRailPointerDragState.placement = insertState.placement;
  showFieldRailDropIndicator(insertState.targetCard, insertState.placement);
}

function maybeStartFieldRailPointerDrag(event) {
  if (!fieldRailList || event.button !== 0) {
    return;
  }

  const grip = event.target.closest?.("[data-field-rail-grip]");
  const card = grip?.closest?.("[data-field-id]");
  const fieldId = card?.dataset.fieldId || "";

  if (!grip || !card || !fieldId) {
    return;
  }

  fieldRailPointerDragState = {
    pointerId: event.pointerId,
    fieldId,
    card,
    startX: event.clientX,
    startY: event.clientY,
    insertIndex: null,
    targetCard: null,
    placement: "before",
    dragging: false
  };
  suppressNextFieldRailClick = false;
  event.preventDefault();

  try {
    card.setPointerCapture(event.pointerId);
  } catch (_error) {
    // Some browsers do not support pointer capture in every context.
  }
}

function handleFieldRailPointerMove(event) {
  if (!fieldRailPointerDragState || event.pointerId !== fieldRailPointerDragState.pointerId) {
    return;
  }

  const movedX = Math.abs(event.clientX - fieldRailPointerDragState.startX);
  const movedY = Math.abs(event.clientY - fieldRailPointerDragState.startY);

  if (!fieldRailPointerDragState.dragging) {
    if (Math.max(movedX, movedY) < 8) {
      return;
    }

    beginFieldRailPointerDrag();
  }

  event.preventDefault();
  updateFieldRailPointerDrag(event.clientX, event.clientY);
}

function finishFieldRailPointerDrop() {
  if (!fieldRailPointerDragState) {
    return;
  }

  const { dragging, fieldId, insertIndex } = fieldRailPointerDragState;

  if (dragging && fieldId && typeof insertIndex === "number") {
    reorderCurrentPageField(fieldId, insertIndex);
    suppressNextFieldRailClick = true;
    window.setTimeout(() => {
      suppressNextFieldRailClick = false;
    }, 180);
  }

  clearFieldRailPointerDragState({ preserveSuppressClick: suppressNextFieldRailClick });
}

function cancelFieldRailPointerDrag() {
  clearFieldRailPointerDragState();
}

function startDrag(payload, event, draggedElement = null) {
  cancelStepPointerDrag();
  cancelFieldRailPointerDrag();
  dragPayload = payload;

  if (payload?.kind === "existing-field") {
    dragFieldId = payload.fieldId || "";
  }

  if (previewStepper) {
    previewStepper.classList.toggle(
      "is-dragging-steps",
      payload?.kind === "step" || payload?.kind === "page-template"
    );
  }

  if (draggedElement) {
    draggedElement.classList.add("is-dragging");
  }

  event.dataTransfer?.setData("text/plain", JSON.stringify(payload));
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
}

function finishDrag(draggedElement = null) {
  dragPayload = null;
  dragFieldId = "";
  clearDragIndicators();

  previewStepper?.classList.remove("is-dragging-steps", "is-pointer-dragging-steps");

  if (draggedElement) {
    draggedElement.classList.remove("is-dragging");
  }
}

function reorderCurrentPageField(fieldId, insertIndex) {
  const currentPageId = getCurrentPageId();

  if (!currentPageId || ["review", "welcome", "thankyou"].includes(currentPageId)) {
    return;
  }

  const pageFields = getCurrentPageFields();
  const orderedIds = pageFields.map(field => field.id);
  const fromIndex = orderedIds.indexOf(fieldId);

  if (fromIndex < 0) {
    return;
  }

  const [movedId] = orderedIds.splice(fromIndex, 1);
  const normalizedIndex = Math.max(0, Math.min(insertIndex, orderedIds.length));
  orderedIds.splice(normalizedIndex, 0, movedId);
  setFieldOrderForPage(currentPageId, orderedIds);
  renderBuilder();
}

function reorderStep(stepId, insertIndex) {
  const currentOrder = getCurrentStepOrder();
  const fromIndex = currentOrder.indexOf(stepId);

  if (fromIndex < 0) {
    return;
  }

  const [movedId] = currentOrder.splice(fromIndex, 1);
  const normalizedIndex = Math.max(0, Math.min(insertIndex, currentOrder.length));
  currentOrder.splice(normalizedIndex, 0, movedId);
  ensureStepOrderIds(currentOrder);
  renderBuilder();
}

function buildFormSurfaceBackground(profile = currentFormProfile) {
  const base = profile?.formSurfaceColor || DEFAULT_FORM_SURFACE_COLOR;
  const accent = profile?.formSurfaceAccentColor || DEFAULT_FORM_SURFACE_ACCENT_COLOR;
  const gradient = profile?.formSurfaceGradient || DEFAULT_FORM_SURFACE_GRADIENT;

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

function buildFormSurfaceShineBackground(profile = currentFormProfile) {
  const shineColor = String(profile?.formSurfaceShineColor || DEFAULT_FORM_SURFACE_SHINE_COLOR).trim() || DEFAULT_FORM_SURFACE_SHINE_COLOR;

  if (profile?.formSurfaceShineEnabled === false) {
    return "linear-gradient(135deg, transparent 0%, transparent 100%)";
  }

  return `linear-gradient(135deg, ${shineColor}70 0%, ${shineColor}26 34%, transparent 76%)`;
}

function getFormSurfaceState(profile = currentFormProfile) {
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
    background: isInvisible ? "transparent" : buildFormSurfaceBackground(profile),
    shineOpacity: isInvisible || profile?.formSurfaceShineEnabled === false ? "0" : "1",
    border: isInvisible ? "1px solid transparent" : "1px solid var(--fc-card-border)",
    shadow: isInvisible ? "none" : "0 26px 60px rgba(15, 23, 42, 0.22)",
    backdrop: isInvisible ? "none" : "blur(12px)",
    radius: shape === "rectangular" ? "8px" : isInvisible ? "0px" : "28px",
    width: isExtended
      ? "min(1400px, calc(100vw - 48px))"
      : isMedium
        ? "min(760px, calc(100vw - 410px))"
        : "min(560px, calc(100vw - 450px))",
    minWidth: isExtended ? "0px" : isMedium ? "460px" : "360px",
    mobileWidth: isExtended ? "980px" : isMedium ? "700px" : "560px",
    mobileMinWidth: isExtended ? "920px" : isMedium ? "700px" : "560px",
    padding: isInvisible ? "0px" : isExtended ? "32px" : isMedium ? "30px" : "28px",
    questionMaxWidth: isExtended ? "100%" : isMedium ? "560px" : "470px",
    questionWideMaxWidth: isExtended ? "100%" : isMedium ? "640px" : "560px",
    shellOutlineInset: isInvisible ? "0px" : "10px",
    shellOutlineRadius: isInvisible ? "0px" : shape === "rectangular" ? "6px" : "22px"
  };
}

function getQuestionSurfaceState(profile = currentFormProfile) {
  const isInvisible = profile?.questionSurfaceVisible === false;
  const textColor = String(profile?.questionTextColor || DEFAULT_QUESTION_TEXT_COLOR).trim() || DEFAULT_QUESTION_TEXT_COLOR;

  return {
    background: isInvisible ? "transparent" : (profile?.questionSurfaceColor || DEFAULT_QUESTION_SURFACE_COLOR),
    border: isInvisible ? "1px solid transparent" : "1px solid rgba(148, 163, 184, 0.22)",
    text: textColor,
    textSoft: `color-mix(in srgb, ${textColor} 72%, white 28%)`,
    shadow: "none",
    selectedBorder: isInvisible ? "transparent" : "rgba(37, 99, 235, 0.38)",
    selectedShadow: isInvisible ? "none" : "0 18px 34px rgba(37, 99, 235, 0.12)"
  };
}

function buildPageBackground(profile = currentFormProfile) {
  const backgroundStyle = profile?.backgroundStyle === "solid" ? "solid" : DEFAULT_BACKGROUND_STYLE;
  const solidColor = String(profile?.backgroundSolidColor || DEFAULT_BACKGROUND_SOLID_COLOR).trim() || DEFAULT_BACKGROUND_SOLID_COLOR;
  const top = String(profile?.backgroundTop || DEFAULT_BACKGROUND_TOP).trim() || DEFAULT_BACKGROUND_TOP;
  const bottom = String(profile?.backgroundBottom || DEFAULT_BACKGROUND_BOTTOM).trim() || DEFAULT_BACKGROUND_BOTTOM;

  if (backgroundStyle === "solid") {
    return solidColor;
  }

  return `radial-gradient(circle at top left, rgba(59, 130, 246, 0.22), transparent 32%), radial-gradient(circle at right, rgba(148, 163, 184, 0.18), transparent 28%), linear-gradient(160deg, ${top} 0%, ${bottom} 100%)`;
}

function setActiveStudioTab(tabId = activeStudioTab) {
  const availableTabIds = new Set(studioTabPanels.map(panel => panel.dataset.studioPanel || ""));
  activeStudioTab = availableTabIds.has(tabId) ? tabId : "add-fields";

  studioTabButtons.forEach(button => {
    const isActive = button.dataset.studioTab === activeStudioTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  studioTabPanels.forEach(panel => {
    const isActive = panel.dataset.studioPanel === activeStudioTab;
    panel.hidden = !isActive;
    panel.classList.toggle("is-active", isActive);
  });

  const activePanel = studioTabPanels.find(panel => panel.dataset.studioPanel === activeStudioTab && !panel.hidden);
  if (activePanel) {
    activePanel.classList.remove("is-animating-in");
    void activePanel.offsetWidth;
    activePanel.classList.add("is-animating-in");
    window.setTimeout(() => {
      activePanel.classList.remove("is-animating-in");
    }, STUDIO_VIEW_TRANSITION_MS);
  }

  requestAnimationFrame(() => {
    updateStudioPanelOverflowState();
  });
}

function updateStudioPanelOverflowState() {
  if (!studioPanel) {
    return;
  }

  const isMobileStudio = window.innerWidth <= MOBILE_STUDIO_BREAKPOINT;
  const maxScrollTop = Math.max(0, studioPanel.scrollHeight - studioPanel.clientHeight);
  const canScroll = isMobileStudio && maxScrollTop > 14;
  const isAtTop = studioPanel.scrollTop <= 8;
  const isAtBottom = studioPanel.scrollTop >= maxScrollTop - 8;

  studioPanel.classList.toggle("is-scrollable", canScroll);
  studioPanel.classList.toggle("can-scroll-up", canScroll && !isAtTop);
  studioPanel.classList.toggle("can-scroll-down", canScroll && !isAtBottom);
  studioPanel.classList.toggle("is-scroll-discovered", canScroll && studioPanelScrollDiscovered);

  if (studioScrollHint) {
    studioScrollHint.hidden = !canScroll;
  }

  updateMobileStudioHandleState();
}

function syncStudioEditorState() {
  if (!studioPanel || !editorPopover) {
    return;
  }

  const isEditorOpen = !editorPopover.hidden;
  studioPanel.classList.toggle("is-editor-open", isEditorOpen);

  if (window.innerWidth <= MOBILE_STUDIO_BREAKPOINT) {
    applyMobileStudioScale();
  }

  if (isEditorOpen && window.innerWidth <= MOBILE_STUDIO_BREAKPOINT) {
    requestAnimationFrame(() => {
      studioPanel.scrollTop = 0;
    });
  }

  requestAnimationFrame(() => {
    updateStudioPanelOverflowState();
  });
}

function getStudioContextDescriptor(step) {
  if (!step) {
    return {
      kicker: "Selected",
      chipLabel: "",
      title: "Nothing selected",
      meta: "Click a page, field, or style area to edit it.",
      actionLabel: "",
      actionMode: ""
    };
  }

  if (step.type === "welcome") {
    return {
      kicker: "Selected",
      chipLabel: "Welcome",
      title: step.title || "Welcome screen",
      meta: "Intro screen before the form begins.",
      actionLabel: "Edit screen",
      actionMode: "edit-selected"
    };
  }

  if (step.type === "thankyou") {
    return {
      kicker: "Selected",
      chipLabel: "Finish",
      title: step.title || "Thank-you screen",
      meta: "Finish screen shown after the review step.",
      actionLabel: "Edit screen",
      actionMode: "edit-selected"
    };
  }

  if (step.type === "review") {
    return {
      kicker: "Selected",
      chipLabel: "Review",
      title: step.title || "Review and Send",
      meta: "Final review step before the reminder is sent.",
      actionLabel: "Edit step row",
      actionMode: "edit-selected"
    };
  }

  const pageFields = getPageFieldsForStep(step.id);
  const itemCount = pageFields.length;
  const itemLabel = `${itemCount} ${itemCount === 1 ? "item" : "items"} on this page`;
  const isCustomPage = getCustomPages().some(page => page.id === step.id);

  return {
    kicker: isCustomPage ? "Custom page" : "Reminder page",
    chipLabel: isCustomPage ? "Custom" : "Mapped",
    title: step.title || step.label || "Current page",
    meta: itemLabel,
    actionLabel: isCustomPage ? "Edit page" : "Edit page",
    actionMode: "edit-selected"
  };
}

function updateStudioContextCard() {
  if (!studioContextCard || !studioContextKicker || !studioContextChip || !studioContextTitle || !studioContextMeta || !studioContextAction || !editorPopover) {
    return;
  }

  const isEditorOpen = !editorPopover.hidden;
  const descriptor = isEditorOpen
    ? {
        kicker: "Inspector",
        chipLabel: "Editing",
        title: editorTitle?.textContent || "Editing",
        meta: editorCopy?.textContent || "Adjust the selected part of your form here.",
        actionLabel: "Back to builder",
        actionMode: "close-editor"
      }
    : getStudioContextDescriptor(getSelectedPreviewStep());

  studioContextCard.classList.toggle("is-inspector", isEditorOpen);
  studioContextKicker.textContent = descriptor.kicker;
  studioContextChip.textContent = descriptor.chipLabel || "";
  studioContextChip.hidden = !descriptor.chipLabel;
  studioContextTitle.textContent = descriptor.title;
  studioContextMeta.textContent = descriptor.meta;
  studioContextAction.textContent = descriptor.actionLabel || "Edit selected";
  studioContextAction.hidden = !descriptor.actionLabel;
  studioContextAction.dataset.actionMode = descriptor.actionMode || "";
}

function openSelectedStudioInspector() {
  const selectedStep = getSelectedPreviewStep();

  if (!selectedStep) {
    return;
  }

  if (selectedStep.type === "welcome" || selectedStep.type === "thankyou") {
    openCustomPageEditor(selectedStep);
    return;
  }

  if (selectedStep.type === "review") {
    openStepNavigationEditor();
    return;
  }

  openCustomPageEditor(selectedStep);
}

function showEditorView(title, copy, markup) {
  if (!editorPopover || !editorBody || !editorTitle || !editorCopy) {
    return false;
  }

  if (editorTransitionTimer) {
    window.clearTimeout(editorTransitionTimer);
    editorTransitionTimer = null;
  }

  expandPeekedMobileStudioForEditor();
  editorPopover.hidden = false;
  editorPopover.classList.remove("is-transition-out", "is-transition-in");
  editorTitle.textContent = title;
  editorCopy.textContent = copy;
  editorBody.innerHTML = markup;
  editorPopover.scrollTop = 0;
  requestAnimationFrame(() => {
    editorPopover.classList.add("is-transition-in");
  });
  window.setTimeout(() => {
    editorPopover.classList.remove("is-transition-in");
  }, STUDIO_VIEW_TRANSITION_MS);
  bindPreviewHoverTargets(editorBody);
  syncStudioEditorState();
  updateStudioContextCard();
  triggerStudioViewAnimation("is-view-entering");
  return true;
}

function getTypographyInline(fontSize, isBold) {
  const styles = [];

  if (fontSize) {
    styles.push(`font-size:${fontSize}px`);
  }

  styles.push(`font-weight:${isBold ? 800 : 500}`);
  return styles.join(";");
}

function setSignedInView(user) {
  const isSignedIn = Boolean(user);

  document.querySelectorAll("[data-auth-only]").forEach(link => {
    link.hidden = !isSignedIn;
  });

  if (signedOutShell) {
    signedOutShell.hidden = isSignedIn;
    signedOutShell.style.display = isSignedIn ? "none" : "grid";
  }

  if (signedInShell) {
    signedInShell.hidden = !isSignedIn;
    signedInShell.style.display = isSignedIn ? "block" : "none";
  }
}

function areProfilesEquivalent(a, b) {
  return JSON.stringify(normalizeCustomFormProfile(a || {})) === JSON.stringify(normalizeCustomFormProfile(b || {}));
}

async function getLatestSignedInUser() {
  if (!supabase) {
    return null;
  }

  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return data?.user || session.user;
}

async function syncLatestUserProfile(options = {}) {
  const { silent = true, preserveDirty = true } = options;

  if (!supabase || latestUserSyncInFlight) {
    return;
  }

  latestUserSyncInFlight = true;

  try {
    const latestUser = await getLatestSignedInUser();

    if (!latestUser) {
      hydrateBuilderFromUser(null);
      return;
    }

    const latestProfile = normalizeCustomFormProfile(latestUser.user_metadata?.custom_form_profile || {});
    const savedProfileChanged = !areProfilesEquivalent(latestProfile, savedFormProfile);
    const localProfileDirty = !areProfilesEquivalent(currentFormProfile, savedFormProfile);

    currentUser = latestUser;
    setSignedInView(currentUser);

    if (!savedProfileChanged) {
      return;
    }

    if (localProfileDirty && preserveDirty) {
      savedFormProfile = latestProfile;
      if (!silent) {
        setStatus("A newer saved form was found from another device. Save here to overwrite it, or Reset to load it.", "info");
      }
      return;
    }

    currentFormProfile = latestProfile;
    savedFormProfile = normalizeCustomFormProfile(latestProfile);
    selectedPreviewStepId = getPreviewSteps()[0]?.id || BASE_REMINDER_STEPS[0]?.id || "phone";
    closeEditor();
    renderBuilder();

    if (!silent) {
      setStatus("Loaded your latest saved form.", "success");
    }
  } catch (error) {
    if (!silent) {
      setStatus(error.message || "Unable to refresh the latest saved form right now.", "error");
    }
  } finally {
    latestUserSyncInFlight = false;
  }
}

function stopLatestUserSyncLoop() {
  if (!latestUserSyncInterval) {
    return;
  }

  window.clearInterval(latestUserSyncInterval);
  latestUserSyncInterval = null;
}

function startLatestUserSyncLoop() {
  stopLatestUserSyncLoop();

  if (!supabase) {
    return;
  }

  latestUserSyncInterval = window.setInterval(() => {
    if (document.visibilityState !== "visible") {
      return;
    }

    syncLatestUserProfile({ silent: true, preserveDirty: true });
  }, 12000);
}

function syncMenuPreviewHoverState() {
  const isMotionHighlight = activeMenuPreviewHoverTarget === "motion";
  const shouldHighlight = !previewOnlyMode;

  if (previewShell) {
    previewShell.classList.toggle("is-shell-edit-hover", shouldHighlight && activeMenuPreviewHoverTarget === "shell");
  }

  if (formPreviewStage) {
    formPreviewStage.classList.toggle("is-background-edit-hover", shouldHighlight && activeMenuPreviewHoverTarget === "background");
  }

  if (previewProgressWrap) {
    previewProgressWrap.classList.toggle("is-menu-highlight", shouldHighlight && (activeMenuPreviewHoverTarget === "steps" || isMotionHighlight));
  }

  if (previewStepper) {
    previewStepper.classList.toggle("is-menu-highlight", shouldHighlight && (activeMenuPreviewHoverTarget === "steps" || isMotionHighlight));
  }

  if (previewWizardHead) {
    previewWizardHead.classList.toggle("is-menu-highlight", shouldHighlight && isMotionHighlight);
  }

  const questionWrap = previewStepHost?.querySelector(".question-wrap");
  if (questionWrap) {
    questionWrap.classList.toggle("is-menu-highlight", shouldHighlight && (activeMenuPreviewHoverTarget === "question" || isMotionHighlight));
  }

  const welcomeWrap = previewStepHost?.querySelector('[data-preview-area="welcome"]');
  if (welcomeWrap) {
    welcomeWrap.classList.toggle("is-menu-highlight", shouldHighlight && activeMenuPreviewHoverTarget === "welcome");
  }

  const thankYouWrap = previewStepHost?.querySelector('[data-preview-area="thankyou"]');
  if (thankYouWrap) {
    thankYouWrap.classList.toggle("is-menu-highlight", shouldHighlight && activeMenuPreviewHoverTarget === "thankyou");
  }
}

function setMenuPreviewHoverTarget(target = "") {
  activeMenuPreviewHoverTarget = target || "";
  syncMenuPreviewHoverState();
}

function bindPreviewHoverTargets(root = document) {
  if (!root || typeof root.querySelectorAll !== "function") {
    return;
  }

  root.querySelectorAll("[data-preview-hover]").forEach(element => {
    if (element.dataset.previewHoverBound === "true") {
      return;
    }

    element.dataset.previewHoverBound = "true";
    element.addEventListener("mouseenter", () => {
      setMenuPreviewHoverTarget(element.dataset.previewHover || "");
    });
    element.addEventListener("mouseleave", () => {
      setMenuPreviewHoverTarget("");
    });
  });
}

function refreshPreviewOnly() {
  renderPreview();
  applyMobileStudioScale();
  syncMenuPreviewHoverState();
  syncPreviewModeChrome();
}

function getPreviewPerspectiveCopy() {
  if (previewPerspective === "client") {
    return {
      title: "Client View",
      detail: "Shows the version clients see from a QR code or shared link."
    };
  }

  return {
    title: "Business View",
    detail: "Shows the version your team fills out inside Send Reminder."
  };
}

function syncPreviewModeChrome() {
  const perspectiveCopy = getPreviewPerspectiveCopy();

  if (previewModeKicker) {
    previewModeKicker.textContent = previewOnlyMode ? "Preview only" : "Editing form";
  }

  if (previewModeTitle) {
    previewModeTitle.textContent = perspectiveCopy.title;
  }

  if (previewModeDetail) {
    previewModeDetail.textContent = previewOnlyMode
      ? `${perspectiveCopy.detail} Editing controls are hidden.`
      : perspectiveCopy.detail;
  }

  previewPerspectiveButtons.forEach(button => {
    const isActive = button.dataset.previewPerspective === previewPerspective;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  previewModeToggles.forEach(toggle => {
    toggle.checked = previewOnlyMode;
  });

  signedInShell?.classList.toggle("is-preview-only-mode", previewOnlyMode);
  formCreatorCanvas?.classList.toggle("is-preview-only-mode", previewOnlyMode);
  previewShell?.classList.toggle("is-preview-only-mode", previewOnlyMode);

  if (previewOnlyMode) {
    previewShell?.classList.remove("is-shell-edit-hover");
    formPreviewStage?.classList.remove("is-background-edit-hover");
    previewStepHost?.querySelectorAll(".is-card-edit-hover").forEach(element => {
      element.classList.remove("is-card-edit-hover");
    });
  }
}

function setPreviewPerspective(nextPerspective) {
  const normalized = nextPerspective === "client" ? "client" : "staff";

  if (previewPerspective === normalized) {
    syncPreviewModeChrome();
    return;
  }

  previewPerspective = normalized;
  const visibleSteps = getPreviewSteps();

  if (!visibleSteps.some(step => step.id === selectedPreviewStepId)) {
    selectedPreviewStepId = visibleSteps[0]?.id || "review";
  }

  closeEditor();
  renderBuilder();
}

function setPreviewOnlyMode(nextValue) {
  previewOnlyMode = Boolean(nextValue);

  if (previewOnlyMode) {
    closeEditor();
  }

  renderBuilder();
}

function applyBackgroundToPreview() {
  if (!previewShell) {
    return;
  }

  const surfaceState = getFormSurfaceState(currentFormProfile);
  const questionState = getQuestionSurfaceState(currentFormProfile);

  previewShell.dataset.formShape = surfaceState.shape;
  previewShell.dataset.formLayout = surfaceState.layout;
  document.documentElement.style.setProperty("--fc-page-background", buildPageBackground(currentFormProfile));
  document.documentElement.style.setProperty("--fc-bg-top", currentFormProfile.backgroundTop || DEFAULT_BACKGROUND_TOP);
  document.documentElement.style.setProperty("--fc-bg-bottom", currentFormProfile.backgroundBottom || DEFAULT_BACKGROUND_BOTTOM);
  previewShell.style.setProperty("--fc-form-surface-background", surfaceState.background);
  previewShell.style.setProperty("--fc-form-shine-background", buildFormSurfaceShineBackground(currentFormProfile));
  previewShell.style.setProperty("--fc-form-shine-opacity", surfaceState.shineOpacity);
  previewShell.style.setProperty("--fc-form-shell-width", surfaceState.width);
  previewShell.style.setProperty("--fc-form-shell-min-width", surfaceState.minWidth);
  previewShell.style.setProperty("--fc-form-shell-mobile-width", surfaceState.mobileWidth);
  previewShell.style.setProperty("--fc-form-shell-mobile-min-width", surfaceState.mobileMinWidth);
  previewShell.style.setProperty("--fc-form-shell-padding", surfaceState.padding);
  previewShell.style.setProperty("--fc-form-shell-radius", surfaceState.radius);
  previewShell.style.setProperty("--fc-form-shell-border", surfaceState.border);
  previewShell.style.setProperty("--fc-form-shell-shadow", surfaceState.shadow);
  previewShell.style.setProperty("--fc-form-shell-backdrop", surfaceState.backdrop);
  previewShell.style.setProperty("--fc-form-question-max-width", surfaceState.questionMaxWidth);
  previewShell.style.setProperty("--fc-form-question-wide-max-width", surfaceState.questionWideMaxWidth);
  previewShell.style.setProperty("--fc-form-shell-outline-inset", surfaceState.shellOutlineInset);
  previewShell.style.setProperty("--fc-form-shell-outline-radius", surfaceState.shellOutlineRadius);
  previewShell.style.setProperty("--fc-form-text-main", currentFormProfile.formTextColor || DEFAULT_FORM_TEXT_COLOR);
  previewShell.style.setProperty("--fc-form-text-soft", currentFormProfile.formTextColor || DEFAULT_FORM_TEXT_COLOR);
  previewShell.style.setProperty("--fc-question-surface-background", questionState.background);
  previewShell.style.setProperty("--fc-question-surface-border", questionState.border);
  previewShell.style.setProperty("--fc-question-text-main", questionState.text);
  previewShell.style.setProperty("--fc-question-text-soft", questionState.textSoft);
  previewShell.style.setProperty("--fc-question-surface-shadow", questionState.shadow);
  previewShell.style.setProperty("--fc-question-selected-border", questionState.selectedBorder);
  previewShell.style.setProperty("--fc-question-selected-shadow", questionState.selectedShadow);

  if (formPreviewStage) {
    formPreviewStage.style.setProperty("--fc-form-shell-width", surfaceState.width);
    formPreviewStage.style.setProperty("--fc-form-shell-min-width", surfaceState.minWidth);
  }
}

function getStepNavigationSurfaceState(profile = currentFormProfile) {
  const size = profile?.stepNavSize || DEFAULT_STEP_NAV_SIZE;
  const shape = profile?.stepNavShape || DEFAULT_STEP_NAV_SHAPE;

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
      width: "78px",
      minHeight: "68px",
      padding: "9px 8px",
      itemGap: "6px",
      rowGap: "6px",
      labelSize: "11px",
      circleSize: "30px",
      circleFontSize: "12px"
    }
  }[size] || {
    width: "78px",
    minHeight: "68px",
    padding: "9px 8px",
    itemGap: "6px",
    rowGap: "6px",
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

function applyStepNavigationStyles() {
  if (!previewStepper) {
    return;
  }

  const stepSurfaceState = getStepNavigationSurfaceState();
  const stepNavPlacement = currentFormProfile.stepNavPlacement || DEFAULT_STEP_NAV_PLACEMENT;

  previewStepper.style.setProperty("--fc-step-nav-bg", currentFormProfile.stepNavBackgroundColor || DEFAULT_STEP_NAV_BACKGROUND);
  previewStepper.style.setProperty("--fc-step-nav-active-bg", currentFormProfile.stepNavActiveBackgroundColor || DEFAULT_STEP_NAV_ACTIVE_BACKGROUND);
  previewStepper.style.setProperty("--fc-step-nav-text", currentFormProfile.stepNavTextColor || DEFAULT_STEP_NAV_TEXT_COLOR);
  previewStepper.style.setProperty("--fc-step-nav-active-text", currentFormProfile.stepNavActiveTextColor || DEFAULT_STEP_NAV_ACTIVE_TEXT_COLOR);
  previewStepper.style.setProperty("--fc-step-nav-width", stepSurfaceState.width);
  previewStepper.style.setProperty("--fc-step-nav-min-height", stepSurfaceState.minHeight);
  previewStepper.style.setProperty("--fc-step-nav-padding", stepSurfaceState.padding);
  previewStepper.style.setProperty("--fc-step-nav-item-gap", stepSurfaceState.itemGap);
  previewStepper.style.setProperty("--fc-step-nav-gap-size", stepSurfaceState.rowGap);
  previewStepper.style.setProperty("--fc-step-nav-label-size", stepSurfaceState.labelSize);
  previewStepper.style.setProperty("--fc-step-nav-circle-size", stepSurfaceState.circleSize);
  previewStepper.style.setProperty("--fc-step-nav-circle-font-size", stepSurfaceState.circleFontSize);
  previewStepper.style.setProperty("--fc-step-nav-radius", stepSurfaceState.radius);
  previewStepper.classList.remove("is-group-editable");

  if (previewWizardHead) {
    previewWizardHead.classList.toggle("is-nav-above", stepNavPlacement === "above-title");
    previewWizardHead.classList.toggle("is-nav-hidden", stepNavPlacement === "hidden");
  }

  if (previewProgressWrap) {
    previewProgressWrap.hidden = stepNavPlacement === "hidden";
  }
}

function isSpecialPreviewScreen(step) {
  const stepType = String(step?.type || step?.id || "").trim().toLowerCase();
  return stepType === "welcome" || stepType === "thankyou";
}

function isReorderablePreviewStep(step) {
  return Boolean(step) && step.id !== "review" && !isSpecialPreviewScreen(step);
}

function isContentBlockField(field) {
  return isContentBlockType(field?.type || "");
}

function buildPreviewContentBlockMarkup(field) {
  const type = String(field?.type || "").trim();
  const offsetStyle = field?.__isFirst ? "" : ' style="margin-top:18px;"';

  if (type === "content-text") {
    const heading = String(field?.label || field?.title || "Text Block").trim() || "Text Block";
    const body = String(field?.helpText || field?.copy || "Add a short note, explainer, or section intro here.").trim()
      || "Add a short note, explainer, or section intro here.";

    return `
      <div class="preview-field-sortable" data-sortable-field-id="${escapeHtml(field.id)}" draggable="true"${offsetStyle}>
        <div class="preview-content-block preview-content-block-text" data-preview-field-group="${escapeHtml(field.id)}">
          <div class="preview-content-kicker">Text block</div>
          <div class="preview-content-heading">${escapeHtml(heading)}</div>
          <p class="preview-content-body">${escapeHtml(body)}</p>
        </div>
      </div>
    `;
  }

  if (type === "content-image") {
    const imageUrl = String(field?.imageUrl || "").trim();
    const caption = String(field?.label || field?.title || "Image block").trim() || "Image block";
    const body = String(field?.helpText || field?.copy || "").trim();
    const mediaMarkup = imageUrl
      ? `<img class="preview-content-image" src="${escapeHtml(imageUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true; this.parentElement.parentElement.classList.add('is-placeholder'); if (this.nextElementSibling) this.nextElementSibling.hidden=false;">`
      : "";

    return `
      <div class="preview-field-sortable" data-sortable-field-id="${escapeHtml(field.id)}" draggable="true"${offsetStyle}>
        <div class="preview-content-block preview-content-block-image ${imageUrl ? "" : "is-placeholder"}" data-preview-field-group="${escapeHtml(field.id)}">
          <div class="preview-content-media">
            ${mediaMarkup}
            <span class="preview-content-placeholder" ${imageUrl ? "hidden" : ""}>${imageUrl ? "Image blocked" : "Image block"}</span>
          </div>
          <div class="preview-content-caption">${escapeHtml(caption)}</div>
          ${body ? `<p class="preview-content-body">${escapeHtml(body)}</p>` : ""}
        </div>
      </div>
    `;
  }

  const dividerLabel = String(field?.label || field?.title || "").trim();

  return `
    <div class="preview-field-sortable" data-sortable-field-id="${escapeHtml(field.id)}" draggable="true"${offsetStyle}>
      <div class="preview-content-block preview-content-block-divider" data-preview-field-group="${escapeHtml(field.id)}">
        <span class="preview-content-divider-line"></span>
        ${dividerLabel ? `<span class="preview-content-divider-label">${escapeHtml(dividerLabel)}</span>` : ""}
        <span class="preview-content-divider-line"></span>
      </div>
    </div>
  `;
}

function buildPreviewFieldControlMarkup(field, options = {}) {
  if (isContentBlockField(field)) {
    return buildPreviewContentBlockMarkup({ ...field, __isFirst: Boolean(options.isPrimary) });
  }

  const isRequired = field.required === true;
  const badge = isRequired
    ? `<span class="label-badge required">Required</span>`
    : `<span class="label-badge">Optional</span>`;
  const fieldLabel = field.label || field.title || "Custom Question";
  const fieldType = field.type || "text";
  const placeholder = escapeHtml(field.placeholder || (fieldType === "textarea" ? "Type your answer" : ""));
  const selectOptions = normalizeSelectFieldOptions(field.options);

  const inputMarkup = fieldType === "textarea"
    ? `<textarea class="preview-field-control" data-preview-field-id="${escapeHtml(field.id)}" placeholder="${placeholder}"></textarea>`
    : fieldType === "select"
      ? `
        <select class="preview-field-control" data-preview-field-id="${escapeHtml(field.id)}">
          <option value="">${escapeHtml(field.placeholder || "Choose an option")}</option>
          ${selectOptions.length
            ? selectOptions.map(option => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("")
            : `<option value="" disabled>Add dropdown options</option>`}
        </select>
      `
      : `<input class="preview-field-control" data-preview-field-id="${escapeHtml(field.id)}" ${fieldType === "email" ? 'type="email"' : ""} ${fieldType === "date" ? 'type="date"' : ""} ${fieldType === "time" ? 'type="time"' : ""} ${fieldType === "phone" ? 'inputmode="tel"' : ""} placeholder="${fieldType === "date" || fieldType === "time" ? "" : placeholder}">`;

  return `
    <div class="preview-field-sortable ${field.isBaseField ? "is-base-field" : ""}" data-sortable-field-id="${escapeHtml(field.id)}" draggable="true">
      <div class="preview-field-group ${options.isPrimary ? "is-primary" : ""}" data-preview-field-group="${escapeHtml(field.id)}">
      <label data-edit-target="field-label" data-edit-field-id="${escapeHtml(field.id)}" style="${getTypographyInline(field.labelFontSize || DEFAULT_FIELD_LABEL_FONT_SIZE, field.labelBold !== false)}">${escapeHtml(fieldLabel)} ${badge}</label>
      ${inputMarkup}
      ${field.helpText ? `<p class="preview-field-help" data-edit-target="field-help" data-edit-field-id="${escapeHtml(field.id)}" style="${getTypographyInline(field.helpFontSize || DEFAULT_FIELD_HELP_FONT_SIZE, Boolean(field.helpBold))}">${escapeHtml(field.helpText)}</p>` : ""}
      </div>
    </div>
  `;
}

function getBuiltInFieldSemanticName(fieldId) {
  const normalizedFieldId = String(fieldId || "").trim();
  const semanticFieldId = String(getCustomFields().find(field => field.id === normalizedFieldId)?.semanticId || "").trim();
  const builtInStep = BUILT_IN_STEP_MAP.get(normalizedFieldId) || BUILT_IN_STEP_MAP.get(semanticFieldId);
  return builtInStep?.title || builtInStep?.label || "core reminder field";
}

function getBuiltInFieldSemanticNote(fieldId) {
  const semanticName = getBuiltInFieldSemanticName(fieldId);
  return `This still fills ${semanticName} everywhere else in Send Reminder, client memory, and reminder emails. If you need a new meaning, add a custom question instead of repurposing this core field.`;
}

function getVisibilityLabel(visibility) {
  return FIELD_VISIBILITY_OPTIONS.find(option => option.id === getFieldVisibility({ visibleTo: visibility }))?.label || "Business and client";
}

function getSaveTargetLabel(saveTarget) {
  return FIELD_SAVE_TARGET_OPTIONS.find(option => option.id === saveTarget)?.label || "Appointment details";
}

function getFieldMappingLabel(field, { isBuiltInStep = false, semanticFieldId = "" } = {}) {
  const fieldId = semanticFieldId || field?.semanticId || field?.id || "";

  if (isBuiltInStep || BUILT_IN_STEP_MAP.has(fieldId)) {
    if (fieldId === "name" || fieldId === "email" || fieldId === "phone") {
      return "Client profile";
    }

    if (fieldId === "notes") {
      return "Appointment notes";
    }

    return "Appointment details";
  }

  return getSaveTargetLabel(field?.saveTarget || "appointment_details");
}

function shouldShowReminderIncludeToggle(field, options = {}) {
  const { isContentBlock = false, semanticFieldId = "" } = options;
  const mappedFieldId = String(semanticFieldId || field?.semanticId || field?.id || "").trim();

  if (!field || isContentBlock) {
    return false;
  }

  return !["name", "email", "phone"].includes(mappedFieldId);
}

function buildFieldAudienceSettingsMarkup(step, options = {}) {
  const {
    isContentBlock = false,
    isBuiltInStep = false,
    semanticFieldId = ""
  } = options;
  const visibility = getFieldVisibility(step);
  const mappingLabel = getFieldMappingLabel(step, { isBuiltInStep, semanticFieldId });
  const includeInReminder = step.includeInReminder !== false;
  const autoClientTitle = getAutoClientFieldText(step, "title") || step.title || step.label || "";
  const autoClientLabel = getAutoClientFieldText(step, "label") || step.label || step.title || "";
  const autoClientPlaceholder = getAutoClientFieldText(step, "placeholder") || step.placeholder || "";
  const clientTitle = step.clientTitle || "";
  const clientLabel = step.clientLabel || "";
  const clientPlaceholder = step.clientPlaceholder || "";

  return `
    <div class="field-audience-card">
      <div class="field-audience-head">
        <strong>Who sees this?</strong>
        <span>${escapeHtml(getVisibilityLabel(visibility))}</span>
      </div>
      <div class="field-audience-toggle" role="group" aria-label="Who sees this field">
        ${FIELD_VISIBILITY_OPTIONS.map(option => `
          <button class="field-audience-option ${visibility === option.id ? "is-active" : ""}" type="button" data-field-visibility="${escapeHtml(option.id)}" aria-pressed="${visibility === option.id ? "true" : "false"}">${escapeHtml(option.label)}</button>
        `).join("")}
      </div>
      <div class="field-mapping-line">
        <span>Saves to</span>
        <strong>${escapeHtml(mappingLabel)}</strong>
      </div>
      ${shouldShowReminderIncludeToggle(step, { isContentBlock, semanticFieldId }) ? `
        <label class="toggle-row">
          <span>Show this answer in the reminder email</span>
          <input id="editor-field-include-reminder" type="checkbox" ${includeInReminder ? "checked" : ""}>
        </label>
      ` : ""}
    </div>
    <details class="client-wording-details">
      <summary>
        <span>Client wording</span>
        <span>${visibility === "staff" ? "Hidden in client view" : escapeHtml(clientLabel || autoClientLabel || "Auto-generated")}</span>
      </summary>
      <div class="client-wording-body">
        <div class="editor-inline-note">The app writes the client version automatically. Only customize this if the preview sounds off.</div>
        <label>
          Client page title
          <input id="editor-field-client-title" type="text" value="${escapeHtml(clientTitle)}" placeholder="${escapeHtml(autoClientTitle)}" maxlength="60" ${visibility === "staff" ? "disabled" : ""}>
        </label>
        <label>
          Client question label
          <input id="editor-field-client-label" type="text" value="${escapeHtml(clientLabel)}" placeholder="${escapeHtml(autoClientLabel)}" maxlength="60" ${visibility === "staff" ? "disabled" : ""}>
        </label>
        <label>
          Client input hint
          <input id="editor-field-client-placeholder" type="text" value="${escapeHtml(clientPlaceholder)}" placeholder="${escapeHtml(autoClientPlaceholder)}" maxlength="120" ${visibility === "staff" ? "disabled" : ""}>
        </label>
      </div>
    </details>
  `;
}

function bindFieldAudienceSettings(fieldId, step, options = {}) {
  const visibilityButtons = editorBody?.querySelectorAll("[data-field-visibility]") || [];
  const includeReminderInput = document.getElementById("editor-field-include-reminder");
  const clientTitleInput = document.getElementById("editor-field-client-title");
  const clientLabelInput = document.getElementById("editor-field-client-label");
  const clientPlaceholderInput = document.getElementById("editor-field-client-placeholder");

  const patchAudience = updates => {
    patchStepConfig(fieldId, updates);
    renderBuilder();
    const refreshedStep = getEditableStep(fieldId);
    if (refreshedStep) {
      openFieldEditor(fieldId);
    }
  };

  visibilityButtons.forEach(button => {
    button.addEventListener("click", () => {
      patchAudience({ visibleTo: button.dataset.fieldVisibility || "both" });
    });
  });

  includeReminderInput?.addEventListener("change", event => {
    patchStepConfig(fieldId, { includeInReminder: Boolean(event.target.checked) });
    renderBuilder();
  });

  clientTitleInput?.addEventListener("input", event => {
    patchStepConfig(fieldId, { clientTitle: event.target.value.slice(0, 60) });
    refreshPreviewOnly();
  });

  clientLabelInput?.addEventListener("input", event => {
    patchStepConfig(fieldId, { clientLabel: event.target.value.slice(0, 60) });
    refreshPreviewOnly();
  });

  clientPlaceholderInput?.addEventListener("input", event => {
    patchStepConfig(fieldId, { clientPlaceholder: event.target.value.slice(0, 120) });
    refreshPreviewOnly();
  });
}

function removeBuilderField(fieldId) {
  const step = getEditableStep(fieldId);
  const isBuiltInStep = Boolean(step?.builtIn && step.id !== "review");

  if (!step) {
    return;
  }

  if (isBuiltInStep) {
    patchStepConfig(fieldId, { hidden: true });
    const remainingFields = getInlineFieldsForPage(currentFormProfile, fieldId);
    const previewSteps = getPreviewSteps();

    if (!remainingFields.length && !previewSteps.some(entry => entry.id === fieldId)) {
      selectedPreviewStepId = previewSteps[0]?.id || BASE_REMINDER_STEPS[0]?.id || "phone";
    }
  } else {
    currentFormProfile = {
      ...currentFormProfile,
      fields: getCustomFields().filter(entry => entry.id !== fieldId && entry.pageId !== fieldId)
    };

    if (!getPreviewSteps().some(entry => entry.id === selectedPreviewStepId)) {
      selectedPreviewStepId = getPreviewSteps()[0]?.id || BASE_REMINDER_STEPS[0]?.id || "phone";
    }
  }

  closeEditor();
  renderBuilder();
}

function removeBuilderPage(stepId) {
  const step = getEditableStep(stepId);
  const stepType = String(step?.type || step?.id || "").trim().toLowerCase();

  if (!step || stepType === "review") {
    return false;
  }

  if (stepType === "welcome" || stepType === "thankyou") {
    currentFormProfile = {
      ...currentFormProfile,
      [stepType === "thankyou" ? "thankYouScreenEnabled" : "welcomeScreenEnabled"]: false
    };

    if (selectedPreviewStepId === step.id || !buildPreviewStepList(currentFormProfile).some(entry => entry.id === selectedPreviewStepId)) {
      const nextPreviewSteps = buildPreviewStepList(currentFormProfile);
      selectedPreviewStepId = nextPreviewSteps.find(isReorderablePreviewStep)?.id
        || nextPreviewSteps[0]?.id
        || BASE_REMINDER_STEPS[0]?.id
        || "phone";
    }

    closeEditor();
    renderBuilder();
    setStatus(`${stepType === "thankyou" ? "Finish" : "Start"} screen removed from your form.`, "success");
    return true;
  }

  if (getCustomPages().some(page => page.id === stepId)) {
    return removeCustomPage(stepId);
  }

  const pageFieldIds = new Set(getPageFieldsForStep(stepId).map(field => field.id));
  const nextStepOrder = (Array.isArray(currentFormProfile.stepOrder) ? currentFormProfile.stepOrder : getCurrentStepOrder())
    .filter(id => id !== stepId);
  const nextPageFieldOrder = Object.fromEntries(
    Object.entries(currentFormProfile.pageFieldOrder || {})
      .filter(([pageId]) => pageId !== stepId)
      .map(([pageId, ids]) => [
        pageId,
        Array.isArray(ids) ? ids.filter(id => !pageFieldIds.has(id)) : []
      ])
  );

  currentFormProfile = {
    ...currentFormProfile,
    fields: getCustomFields().filter(entry => entry.id !== stepId && entry.pageId !== stepId),
    stepOrder: [...new Set(nextStepOrder)],
    pageFieldOrder: nextPageFieldOrder,
    stepOverrides: {
      ...(currentFormProfile.stepOverrides || {}),
      [stepId]: {
        ...(currentFormProfile.stepOverrides?.[stepId] || {}),
        hidden: true
      }
    }
  };

  if (selectedPreviewStepId === stepId || !buildPreviewStepList(currentFormProfile).some(entry => entry.id === selectedPreviewStepId)) {
    const nextPreviewSteps = buildPreviewStepList(currentFormProfile);
    selectedPreviewStepId = nextPreviewSteps.find(isReorderablePreviewStep)?.id
      || nextPreviewSteps[0]?.id
      || BASE_REMINDER_STEPS[0]?.id
      || "phone";
  }

  closeEditor();
  renderBuilder();
  setStatus(`${step.title || step.label || "Page"} removed from your form.`, "success");
  return true;
}

function consumePreviewFieldDirectEdit(fieldId) {
  const canUse = previewFieldDirectEditIntent.fieldId === fieldId && Date.now() <= previewFieldDirectEditIntent.expiresAt;

  if (canUse) {
    previewFieldDirectEditIntent = { fieldId: "", expiresAt: 0 };
    previewFieldTapIntent = { fieldId: "", at: 0 };
  }

  return canUse;
}

function buildPreviewFieldMarkup(step) {
  if (step.type === "welcome" || step.type === "thankyou") {
    return `
      <div class="question-wrap is-selected is-screen-preview" data-preview-area="${escapeHtml(step.type)}">
        <div class="screen-preview-shell">
          <div class="screen-preview-content">
            <span class="screen-preview-kicker">${step.type === "thankyou" ? "After send" : "First screen"}</span>
            <div class="screen-preview-copy">${escapeHtml(step.type === "thankyou" ? "This preview matches the optional finish your client sees after a send." : "This preview matches the optional first screen that appears before the questions start.")}</div>
            <button class="screen-preview-button" type="button" ${step.type === "welcome" ? "data-preview-start-button" : "tabindex=\"-1\""}>${escapeHtml(step.buttonText || (step.type === "thankyou" ? "Create another reminder" : "Start"))}</button>
          </div>
        </div>
      </div>
    `;
  }

  if (step.type === "review") {
    return `
      <div class="question-wrap is-selected">
        <div class="review-preview-card">
          <div class="review-preview-panel">
            <strong>Draft Email Preview</strong>
            <p>Your custom questions will flow into the generated reminder message here, just like the real Send Reminder review screen.</p>
          </div>
          <div class="review-preview-consent">Consent checkbox and send buttons stay on the real review step.</div>
        </div>
      </div>
    `;
  }

  const currentPageFields = getPageFieldsForStep(step.id, { forPreview: true });
  const fallbackField = !currentPageFields.length && !step.baseFieldHidden && step.type !== "page"
    ? getVisibleFieldForPerspective({ ...step, isBaseField: true }, previewPerspective)
    : null;
  const visibleFields = currentPageFields.length
    ? currentPageFields
    : (fallbackField ? [fallbackField] : []);
  const fieldMarkup = visibleFields.length
    ? visibleFields.map((field, index) => `
        <div class="preview-field-dropzone" data-drop-field-index="${index}" data-drop-page-id="${escapeHtml(step.id)}">Drop here</div>
        ${buildPreviewFieldControlMarkup(field, { isPrimary: index === 0 })}
      `).join("") + `<div class="preview-field-dropzone" data-drop-field-index="${visibleFields.length}" data-drop-page-id="${escapeHtml(step.id)}">Drop here</div>`
    : `
      <div class="preview-field-dropzone is-empty-state" data-drop-field-index="0" data-drop-page-id="${escapeHtml(step.id)}">
        Drop a question here or use the add tools.
      </div>
    `;

  return `
    <div class="question-wrap is-selected" data-preview-step-id="${escapeHtml(step.id)}">
      <div class="question-shell-edit-zone question-shell-edit-zone-left" data-question-shell-zone="left" aria-hidden="true"></div>
      <div class="question-shell-edit-zone question-shell-edit-zone-right" data-question-shell-zone="right" aria-hidden="true"></div>
      ${fieldMarkup}
    </div>
  `;
}

function renderPreview() {
  const steps = getPreviewSteps();
  let selectedStep = getSelectedPreviewStep();

  if (!selectedStep) {
    return;
  }

  if (!steps.some(step => step.id === selectedPreviewStepId)) {
    selectedPreviewStepId = selectedStep.id;
  }

  const selectedIndex = Math.max(0, steps.findIndex(step => step.id === selectedStep.id));
  const isRequired = selectedStep.type === "review"
    ? true
    : getPageFieldsForStep(selectedStep.id, { forPreview: true }).some(field => field.required) || selectedStep.required === true;

  if (previewTitle) {
    previewTitle.textContent = currentFormProfile.formTitle || DEFAULT_FORM_TITLE;
    previewTitle.style.fontSize = `${currentFormProfile.formTitleFontSize || DEFAULT_FORM_TITLE_FONT_SIZE}px`;
    previewTitle.style.fontWeight = currentFormProfile.formTitleBold === false ? "500" : "800";
  }

  updatePreviewLogo();

  if (previewStepCount) {
    previewStepCount.textContent = `Step ${selectedIndex + 1} of ${steps.length}`;
  }

  if (previewStepPill) {
    if (selectedStep.type === "welcome") {
      previewStepPill.textContent = "Welcome";
      previewStepPill.classList.remove("is-required");
    } else if (selectedStep.type === "thankyou") {
      previewStepPill.textContent = "Thank You";
      previewStepPill.classList.remove("is-required");
    } else {
      previewStepPill.textContent = isRequired ? "Required" : "Optional";
      previewStepPill.classList.toggle("is-required", isRequired);
    }
  }

  if (previewStepTitle) {
    previewStepTitle.textContent = selectedStep.title;
    previewStepTitle.style.fontSize = `${selectedStep.titleFontSize || DEFAULT_STEP_TITLE_FONT_SIZE}px`;
    previewStepTitle.style.fontWeight = selectedStep.titleBold === false ? "500" : "800";
  }

  if (previewStepCopy) {
    previewStepCopy.textContent = selectedStep.copy || "Custom question";
    previewStepCopy.style.fontSize = `${selectedStep.copyFontSize || DEFAULT_STEP_COPY_FONT_SIZE}px`;
    previewStepCopy.style.fontWeight = selectedStep.copyBold ? "800" : "500";
  }

  if (previewProgressFill) {
    previewProgressFill.style.width = `${((selectedIndex + 1) / steps.length) * 100}%`;
  }

  if (previewStepper) {
    let reorderableIndex = 0;
    previewStepper.innerHTML = steps.map((step, index) => {
      const dropIndex = reorderableIndex;
      const isReorderable = isReorderablePreviewStep(step);
      if (isReorderable) {
        reorderableIndex += 1;
      }

      return `
      <div class="preview-step-dropzone" data-drop-step-index="${dropIndex}"></div>
      <button class="preview-stepper-button ${step.id === selectedStep.id ? "is-active" : ""}" type="button" data-preview-step="${escapeHtml(step.id)}" draggable="${isReorderable ? "true" : "false"}">
        <span class="preview-stepper-circle">${escapeHtml(step.icon || String(index + 1))}</span>
        <span class="preview-stepper-label">${escapeHtml(step.navLabel)}</span>
      </button>
    `;
    }).join("") + `<div class="preview-step-dropzone" data-drop-step-index="${reorderableIndex}"></div>`;
  }

  if (previewStepHost) {
    previewStepHost.innerHTML = buildPreviewFieldMarkup(selectedStep);
  }

  if (previewBackButton) {
    previewBackButton.disabled = selectedIndex === 0;
  }

  if (previewSkipButton) {
    previewSkipButton.disabled = isRequired || selectedIndex >= steps.length - 1;
  }

  if (previewNextButton) {
    if (selectedStep.type === "welcome") {
      previewNextButton.textContent = selectedStep.buttonText || "Start";
    } else if (selectedStep.type === "review" && steps[selectedIndex + 1]?.type === "thankyou") {
      previewNextButton.textContent = "Thank You";
    } else if (selectedIndex === steps.length - 2) {
      previewNextButton.textContent = "Review";
    } else {
      previewNextButton.textContent = "Next";
    }
    previewNextButton.disabled = selectedIndex >= steps.length - 1;
  }

  const previewControls = previewNextButton?.closest(".form-preview-controls");

  if (previewControls) {
    previewControls.hidden = selectedStep.type === "welcome";
  }

  applyBackgroundToPreview();
  applyStepNavigationStyles();
  applyPreviewMotionStyles();
  syncMenuPreviewHoverState();
  window.requestAnimationFrame(() => {
    autoScrollPreviewStepper();
  });
}

function updatePreviewLogo() {
  if (!previewLogoWrap || !previewLogoImage) {
    return;
  }

  const logoUrl = String(currentFormProfile.formLogoUrl || "").trim();

  if (!logoUrl) {
    previewLogoWrap.hidden = true;
    previewLogoImage.removeAttribute("src");
    return;
  }

  previewLogoWrap.hidden = false;
  previewLogoImage.hidden = false;
  previewLogoImage.onerror = () => {
    previewLogoWrap.hidden = true;
  };
  previewLogoImage.onload = () => {
    previewLogoWrap.hidden = false;
  };
  if (previewLogoImage.getAttribute("src") !== logoUrl) {
    previewLogoImage.src = logoUrl;
  }
}

function renderFieldRail() {
  if (!fieldRailList) {
    return;
  }

  const fields = getCurrentPageFields();
  const currentPage = getSelectedPreviewStep();

  if (!currentPage || ["review", "welcome", "thankyou"].includes(currentPage.id) || isSpecialPreviewScreen(currentPage)) {
    const pageLabel = currentPage?.type === "welcome"
      ? "Welcome screen selected"
      : currentPage?.type === "thankyou"
        ? "Thank-you screen selected"
        : "Review step selected";
    const pageMeta = currentPage?.type === "welcome"
      ? "Welcome screens do not hold question fields. Use Form Settings to edit the title, copy, button text, and image."
      : currentPage?.type === "thankyou"
        ? "Thank-you screens do not hold question fields. Use Form Settings to edit the title, copy, button text, and image."
        : "Add fields from any question page, not from the review step.";
    fieldRailList.innerHTML = `
      <div class="field-rail-card is-empty">
        <span class="field-rail-icon">+</span>
        <div class="field-rail-body">
          <span class="field-rail-title">${pageLabel}</span>
          <span class="field-rail-meta">${pageMeta}</span>
        </div>
      </div>
    `;
    return;
  }

  if (!fields.length) {
    fieldRailList.innerHTML = `
      <div class="field-rail-card is-empty">
        <span class="field-rail-icon">+</span>
        <div class="field-rail-body">
          <span class="field-rail-title">Nothing on this page yet</span>
          <span class="field-rail-meta">Use the add buttons above to place new questions or content blocks on the current page.</span>
        </div>
      </div>
    `;
    return;
  }

  fieldRailList.innerHTML = fields.map(field => {
    const meta = getCustomFieldTypeMeta(field.type);
    const isContentBlock = isContentBlockField(field);
    const kindLabel = field.isBaseField ? "Built-in" : isContentBlock ? "Content" : "Custom";
    const kindTone = field.isBaseField ? "built-in" : isContentBlock ? "content" : "custom";
    const fieldMeta = isContentBlock
      ? `${escapeHtml(meta.label)} block`
      : `${escapeHtml(meta.label)}`;
    const visibilityLabel = getVisibilityLabel(field.visibleTo);
    const mappingLabel = getFieldMappingLabel(field, {
      isBuiltInStep: Boolean(field.isBaseField && BUILT_IN_STEP_MAP.has(field.id)),
      semanticFieldId: field.semanticId || field.id
    });
    return `
      <button
        class="field-rail-card ${field.isBaseField ? "is-built-in" : ""}"
        type="button"
        draggable="${window.innerWidth > MOBILE_STUDIO_BREAKPOINT ? "true" : "false"}"
        data-field-id="${escapeHtml(field.id)}"
      >
        <span class="field-rail-icon">${escapeHtml(meta.icon)}</span>
        <span class="field-rail-body">
          <span class="field-rail-tags">
            <span class="field-rail-tag is-${kindTone}">${kindLabel}</span>
            <span class="field-rail-tag is-visibility">${escapeHtml(visibilityLabel)}</span>
            ${field.required ? `<span class="field-rail-tag is-required">Required</span>` : ""}
          </span>
          <span class="field-rail-title">${escapeHtml(field.label || field.title || "Field")}</span>
          <span class="field-rail-meta">${fieldMeta} - Saves to ${escapeHtml(mappingLabel)}</span>
        </span>
        <span class="field-rail-grip" data-field-rail-grip aria-hidden="true">
          <span></span><span></span><span></span>
        </span>
      </button>
    `;
  }).join("");

  fieldRailList.querySelectorAll("[data-field-id]").forEach(card => {
    const fieldId = card.dataset.fieldId || "";

    card.addEventListener("click", () => {
      if (suppressNextFieldRailClick) {
        suppressNextFieldRailClick = false;
        return;
      }

      closeEditor();
      openFieldEditor(fieldId);
    });

    card.addEventListener("dragstart", event => {
      if (window.innerWidth <= MOBILE_STUDIO_BREAKPOINT) {
        event.preventDefault();
        return;
      }
      dragFieldId = fieldId;
      dragPayload = { kind: "existing-field", fieldId };
      card.classList.add("is-dragging");
      event.dataTransfer?.setData("text/plain", fieldId);
      event.dataTransfer.effectAllowed = "move";
    });

    card.addEventListener("dragend", () => {
      dragFieldId = "";
      dragPayload = null;
      card.classList.remove("is-dragging");
    });

    card.addEventListener("dragover", event => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });

    card.addEventListener("drop", event => {
      event.preventDefault();
      const targetId = fieldId;

      if (!dragFieldId || dragFieldId === targetId) {
        return;
      }

      const pageId = currentPage.id;
      const pageFields = getCurrentPageFields();
      const fromIndex = pageFields.findIndex(entry => entry.id === dragFieldId);
      const toIndex = pageFields.findIndex(entry => entry.id === targetId);

      if (fromIndex < 0 || toIndex < 0) {
        return;
      }

      const reorderedIds = pageFields.map(entry => entry.id);
      const [movedId] = reorderedIds.splice(fromIndex, 1);
      reorderedIds.splice(toIndex, 0, movedId);
      setFieldOrderForPage(pageId, reorderedIds);
      renderBuilder();
    });
  });
}

function applyFormTemplate(templateId) {
  const template = FORM_TEMPLATE_LIBRARY.find(entry => entry.id === templateId);

  if (!template) {
    return;
  }

  currentFormProfile = normalizeCustomFormProfile({
    ...template.profile,
    isEnabled: currentFormProfile.isEnabled !== false
  });
  selectedPreviewStepId = buildPreviewStepList(currentFormProfile)[0]?.id || BASE_REMINDER_STEPS[0]?.id || "phone";
  closeEditor();
  renderBuilder();
  setStatus(`${template.name} template loaded. Save when you're ready to use it.`, "info");
}

function renderFormTemplates() {
  if (!templateList) {
    return;
  }

  templateList.innerHTML = FORM_TEMPLATE_LIBRARY.map(template => `
    <button
      class="form-template-card ${currentFormProfile.templateId === template.id ? "is-active" : ""}"
      type="button"
      data-template-id="${escapeHtml(template.id)}"
      style="--template-top:${escapeHtml(template.profile.backgroundTop)};--template-bottom:${escapeHtml(template.profile.backgroundBottom)};--template-surface:${escapeHtml(template.profile.formSurfaceColor)};--template-accent:${escapeHtml(template.profile.formSurfaceAccentColor)};--template-text:${escapeHtml(template.profile.formTextColor)};"
    >
      <div class="form-template-preview-shell">
        <div class="form-template-preview-hero">
          <span class="form-template-preview-badge">${escapeHtml(template.badge || "Template")}</span>
          <span class="form-template-preview-mark"></span>
        </div>
        <div class="form-template-preview-body">
          <span class="form-template-preview-line form-template-preview-line-title"></span>
          <span class="form-template-preview-line"></span>
          <span class="form-template-preview-line form-template-preview-line-soft"></span>
          <div class="form-template-preview-grid">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
      <div class="form-template-top">
        <span class="form-template-title-wrap">
          <span class="form-template-title">${escapeHtml(template.name)}</span>
          <span class="form-template-subtitle">${escapeHtml(template.subtitle)}</span>
        </span>
        <span class="form-template-swatches">
          ${template.swatches.map(color => `<span class="form-template-swatch" style="background:${escapeHtml(color)};"></span>`).join("")}
        </span>
      </div>
      <ul class="form-template-points">
        ${template.points.map(point => `<li>${escapeHtml(point)}</li>`).join("")}
      </ul>
    </button>
  `).join("");

  templateList.querySelectorAll("[data-template-id]").forEach(button => {
    button.addEventListener("click", () => {
      applyFormTemplate(button.dataset.templateId || "");
    });
  });
}

function renderGlobalSettingsTab() {
  const backgroundStyle = currentFormProfile.backgroundStyle === "solid" ? "solid" : DEFAULT_BACKGROUND_STYLE;

  if (globalBgStyleSelect) {
    globalBgStyleSelect.value = backgroundStyle;
  }

  if (globalBgTopInput) {
    globalBgTopInput.value = currentFormProfile.backgroundTop || DEFAULT_BACKGROUND_TOP;
  }

  if (globalBgBottomInput) {
    globalBgBottomInput.value = currentFormProfile.backgroundBottom || DEFAULT_BACKGROUND_BOTTOM;
  }

  if (globalBgSolidInput) {
    globalBgSolidInput.value = currentFormProfile.backgroundSolidColor || DEFAULT_BACKGROUND_SOLID_COLOR;
  }

  if (globalBgGradientWrap) {
    globalBgGradientWrap.hidden = backgroundStyle === "solid";
    globalBgGradientWrap.style.display = backgroundStyle === "solid" ? "none" : "grid";
  }

  if (globalBgSolidWrap) {
    globalBgSolidWrap.hidden = backgroundStyle !== "solid";
    globalBgSolidWrap.style.display = backgroundStyle === "solid" ? "grid" : "none";
  }

  if (!backgroundPresetRow) {
    return;
  }

  const activePresetId = getBackgroundPresetMatch(currentFormProfile)?.id || "";
  backgroundPresetRow.hidden = backgroundStyle === "solid";

  backgroundPresetRow.innerHTML = FORM_BACKGROUND_PRESETS.map(preset => `
    <button
      class="preset-chip ${preset.id === activePresetId ? "is-active" : ""}"
      type="button"
      data-background-preset="${escapeHtml(preset.id)}"
    >
      ${escapeHtml(preset.label)}
    </button>
  `).join("");

  backgroundPresetRow.querySelectorAll("[data-background-preset]").forEach(button => {
    button.addEventListener("click", () => {
      const preset = FORM_BACKGROUND_PRESETS.find(entry => entry.id === button.dataset.backgroundPreset);

      if (!preset) {
        return;
      }

      currentFormProfile = {
        ...currentFormProfile,
        backgroundStyle: "gradient",
        backgroundTop: preset.top,
        backgroundBottom: preset.bottom
      };

      renderBuilder();
    });
  });
}

function buildStepNavigationSettingsMarkup(prefix = "inline-step-nav") {
  return `
    <div class="form-editor-grid">
      <label>
        Navigation placement
        <select id="${prefix}-placement">
          ${STEP_NAV_PLACEMENT_OPTIONS.map(option => `<option value="${escapeHtml(option.id)}" ${option.id === (currentFormProfile.stepNavPlacement || DEFAULT_STEP_NAV_PLACEMENT) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
        </select>
      </label>
      <label>
        Step box shape
        <select id="${prefix}-shape">
          ${STEP_NAV_SHAPE_OPTIONS.map(option => `<option value="${escapeHtml(option.id)}" ${option.id === (currentFormProfile.stepNavShape || DEFAULT_STEP_NAV_SHAPE) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
        </select>
      </label>
      <label>
        Step box size
        <select id="${prefix}-size">
          ${STEP_NAV_SIZE_OPTIONS.map(option => `<option value="${escapeHtml(option.id)}" ${option.id === (currentFormProfile.stepNavSize || DEFAULT_STEP_NAV_SIZE) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
        </select>
      </label>
    </div>
    <label class="toggle-row">
      <span>Allow clients to click step boxes</span>
      <input id="${prefix}-clickable" type="checkbox" ${currentFormProfile.stepNavClickable !== false ? "checked" : ""}>
    </label>
    <div class="form-editor-grid">
      <label>
        Default box color
        <input id="${prefix}-bg" type="color" value="${escapeHtml(currentFormProfile.stepNavBackgroundColor || DEFAULT_STEP_NAV_BACKGROUND)}">
      </label>
      <label>
        Default text color
        <input id="${prefix}-text-color" type="color" value="${escapeHtml(currentFormProfile.stepNavTextColor || DEFAULT_STEP_NAV_TEXT_COLOR)}">
      </label>
      <label>
        Active box color
        <input id="${prefix}-active-bg" type="color" value="${escapeHtml(currentFormProfile.stepNavActiveBackgroundColor || DEFAULT_STEP_NAV_ACTIVE_BACKGROUND)}">
      </label>
      <label>
        Active text color
        <input id="${prefix}-active-text" type="color" value="${escapeHtml(currentFormProfile.stepNavActiveTextColor || DEFAULT_STEP_NAV_ACTIVE_TEXT_COLOR)}">
      </label>
    </div>
    <div class="editor-inline-note" data-preview-hover="steps">
      Edit each step chip name from that page's <strong>Edit page</strong> menu. This section is now only for styling the whole step row.
    </div>
  `;
}

function bindStepNavigationSettings(root, prefix = "inline-step-nav") {
  if (!root) {
    return;
  }

  root.querySelector(`#${prefix}-placement`)?.addEventListener("change", event => {
    currentFormProfile = {
      ...currentFormProfile,
      stepNavPlacement: event.target.value || DEFAULT_STEP_NAV_PLACEMENT
    };
    renderPreview();
  });

  root.querySelector(`#${prefix}-shape`)?.addEventListener("change", event => {
    currentFormProfile = {
      ...currentFormProfile,
      stepNavShape: event.target.value || DEFAULT_STEP_NAV_SHAPE
    };
    renderPreview();
  });

  root.querySelector(`#${prefix}-size`)?.addEventListener("change", event => {
    currentFormProfile = {
      ...currentFormProfile,
      stepNavSize: event.target.value || DEFAULT_STEP_NAV_SIZE
    };
    renderPreview();
  });

  root.querySelector(`#${prefix}-clickable`)?.addEventListener("change", event => {
    currentFormProfile = {
      ...currentFormProfile,
      stepNavClickable: Boolean(event.target.checked)
    };
    renderPreview();
  });

  root.querySelector(`#${prefix}-bg`)?.addEventListener("input", event => {
    currentFormProfile = {
      ...currentFormProfile,
      stepNavBackgroundColor: event.target.value
    };
    renderPreview();
  });

  root.querySelector(`#${prefix}-text-color`)?.addEventListener("input", event => {
    currentFormProfile = {
      ...currentFormProfile,
      stepNavTextColor: event.target.value
    };
    renderPreview();
  });

  root.querySelector(`#${prefix}-active-bg`)?.addEventListener("input", event => {
    currentFormProfile = {
      ...currentFormProfile,
      stepNavActiveBackgroundColor: event.target.value
    };
    renderPreview();
  });

  root.querySelector(`#${prefix}-active-text`)?.addEventListener("input", event => {
    currentFormProfile = {
      ...currentFormProfile,
      stepNavActiveTextColor: event.target.value
    };
    renderPreview();
  });

  bindPreviewHoverTargets(root);
}

function replayAnimationClass(element, className) {
  if (!element || !className) {
    return;
  }

  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function getStepMotionState(profile = currentFormProfile) {
  const speed = profile?.stepMotionSpeed || DEFAULT_STEP_MOTION_SPEED;
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
    style: profile?.stepMotionStyle || DEFAULT_STEP_MOTION_STYLE,
    speed,
    head: profile?.stepHeadMotion || DEFAULT_STEP_HEAD_MOTION,
    chip: profile?.stepChipMotion || DEFAULT_STEP_CHIP_MOTION,
    ...durationState
  };
}

function applyPreviewMotionStyles() {
  if (!previewShell) {
    return;
  }

  const motionState = getStepMotionState();
  previewShell.dataset.stepMotionStyle = motionState.style;
  previewShell.dataset.stepMotionSpeed = motionState.speed;
  previewShell.dataset.stepHeadMotion = motionState.head;
  previewShell.dataset.stepChipMotion = motionState.chip;
  previewShell.dataset.stepDirection = previewStepDirection;
  previewShell.style.setProperty("--fc-step-motion-duration", motionState.stepDuration);
  previewShell.style.setProperty("--fc-step-head-duration", motionState.headDuration);
  previewShell.style.setProperty("--fc-step-chip-duration", motionState.chipDuration);
  previewShell.style.setProperty("--fc-step-progress-duration", motionState.progressDuration);

  if (previewWizardHead && motionState.head !== "none") {
    replayAnimationClass(previewWizardHead, "is-step-motion-head");
  } else if (previewWizardHead) {
    previewWizardHead.classList.remove("is-step-motion-head");
  }
}

function buildMotionSettingsMarkup(prefix = "inline-step-motion") {
  return `
    <div class="form-editor-grid">
      <label>
        Question transition
        <select id="${prefix}-style">
          ${STEP_MOTION_STYLE_OPTIONS.map(option => `<option value="${escapeHtml(option.id)}" ${option.id === (currentFormProfile.stepMotionStyle || DEFAULT_STEP_MOTION_STYLE) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
        </select>
      </label>
      <label>
        Motion speed
        <select id="${prefix}-speed">
          ${STEP_MOTION_SPEED_OPTIONS.map(option => `<option value="${escapeHtml(option.id)}" ${option.id === (currentFormProfile.stepMotionSpeed || DEFAULT_STEP_MOTION_SPEED) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
        </select>
      </label>
    </div>
    <div class="form-editor-grid">
      <label>
        Header animation
        <select id="${prefix}-head">
          ${STEP_HEAD_MOTION_OPTIONS.map(option => `<option value="${escapeHtml(option.id)}" ${option.id === (currentFormProfile.stepHeadMotion || DEFAULT_STEP_HEAD_MOTION) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
        </select>
      </label>
      <label>
        Active step chip
        <select id="${prefix}-chip">
          ${STEP_CHIP_MOTION_OPTIONS.map(option => `<option value="${escapeHtml(option.id)}" ${option.id === (currentFormProfile.stepChipMotion || DEFAULT_STEP_CHIP_MOTION) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
        </select>
      </label>
    </div>
    <div class="editor-inline-note">These play when moving between questions in both Form Creator and Send Reminder.</div>
  `;
}

function bindMotionSettings(root, prefix = "inline-step-motion") {
  if (!root) {
    return;
  }

  root.querySelector(`#${prefix}-style`)?.addEventListener("change", event => {
    currentFormProfile = {
      ...currentFormProfile,
      stepMotionStyle: event.target.value || DEFAULT_STEP_MOTION_STYLE
    };
    refreshPreviewOnly();
  });

  root.querySelector(`#${prefix}-speed`)?.addEventListener("change", event => {
    currentFormProfile = {
      ...currentFormProfile,
      stepMotionSpeed: event.target.value || DEFAULT_STEP_MOTION_SPEED
    };
    refreshPreviewOnly();
  });

  root.querySelector(`#${prefix}-head`)?.addEventListener("change", event => {
    currentFormProfile = {
      ...currentFormProfile,
      stepHeadMotion: event.target.value || DEFAULT_STEP_HEAD_MOTION
    };
    refreshPreviewOnly();
  });

  root.querySelector(`#${prefix}-chip`)?.addEventListener("change", event => {
    currentFormProfile = {
      ...currentFormProfile,
      stepChipMotion: event.target.value || DEFAULT_STEP_CHIP_MOTION
    };
    refreshPreviewOnly();
  });
}

function renderFormSettingsTab() {
  const isSurfaceSolid = (currentFormProfile.formSurfaceGradient || DEFAULT_FORM_SURFACE_GRADIENT) === "solid";

  if (formSurfaceControls) {
    formSurfaceControls.innerHTML = `
      <div class="form-editor-grid">
        <label>
          Form shape
          <select id="inline-surface-shape">
            ${FORM_SURFACE_SHAPE_OPTIONS.map(option => `<option value="${escapeHtml(option.id)}" ${option.id === (currentFormProfile.formSurfaceShape || DEFAULT_FORM_SURFACE_SHAPE) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
          </select>
        </label>
        <label>
          Form layout
          <select id="inline-surface-layout">
            ${FORM_SURFACE_LAYOUT_OPTIONS.map(option => `<option value="${escapeHtml(option.id)}" ${option.id === (currentFormProfile.formSurfaceLayout || DEFAULT_FORM_SURFACE_LAYOUT) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="form-editor-grid">
        <label>
          Form color
          <input id="inline-surface-base" type="color" value="${escapeHtml(currentFormProfile.formSurfaceColor || DEFAULT_FORM_SURFACE_COLOR)}">
        </label>
        ${isSurfaceSolid ? "" : `
          <label>
            Gradient color
            <input id="inline-surface-accent" type="color" value="${escapeHtml(currentFormProfile.formSurfaceAccentColor || DEFAULT_FORM_SURFACE_ACCENT_COLOR)}">
          </label>
        `}
      </div>
      <label>
        Form finish
        <select id="inline-surface-gradient">
          ${FORM_SURFACE_GRADIENT_OPTIONS.map(option => `<option value="${escapeHtml(option.id)}" ${option.id === (currentFormProfile.formSurfaceGradient || DEFAULT_FORM_SURFACE_GRADIENT) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
        </select>
      </label>
      <label class="toggle-row">
        <span>Top shine</span>
        <input id="inline-surface-shine-toggle" type="checkbox" ${currentFormProfile.formSurfaceShineEnabled !== false ? "checked" : ""}>
      </label>
      <div class="form-editor-grid">
        <label>
          Shine color
          <input id="inline-surface-shine-color" type="color" value="${escapeHtml(currentFormProfile.formSurfaceShineColor || DEFAULT_FORM_SURFACE_SHINE_COLOR)}">
        </label>
        <label>
          Text color
          <input id="inline-surface-text" type="color" value="${escapeHtml(currentFormProfile.formTextColor || DEFAULT_FORM_TEXT_COLOR)}">
        </label>
      </div>
      <label>
        Logo image URL
        <input id="inline-surface-logo-url" type="url" inputmode="url" placeholder="https://example.com/logo.png" value="${escapeHtml(currentFormProfile.formLogoUrl || "")}">
      </label>
      <div class="editor-inline-note">Use a direct image file URL for the logo. Leave it blank if you want no logo in the top-right corner.</div>
    `;

    document.getElementById("inline-surface-shape")?.addEventListener("change", event => {
      currentFormProfile = { ...currentFormProfile, formSurfaceShape: event.target.value };
      refreshPreviewOnly();
    });
    document.getElementById("inline-surface-layout")?.addEventListener("change", event => {
      currentFormProfile = { ...currentFormProfile, formSurfaceLayout: event.target.value };
      refreshPreviewOnly();
    });
    document.getElementById("inline-surface-base")?.addEventListener("input", event => {
      currentFormProfile = { ...currentFormProfile, formSurfaceColor: event.target.value };
      refreshPreviewOnly();
    });
    document.getElementById("inline-surface-accent")?.addEventListener("input", event => {
      currentFormProfile = { ...currentFormProfile, formSurfaceAccentColor: event.target.value };
      refreshPreviewOnly();
    });
    document.getElementById("inline-surface-gradient")?.addEventListener("change", event => {
      currentFormProfile = { ...currentFormProfile, formSurfaceGradient: event.target.value };
      renderBuilder();
    });
    document.getElementById("inline-surface-shine-toggle")?.addEventListener("change", event => {
      currentFormProfile = { ...currentFormProfile, formSurfaceShineEnabled: Boolean(event.target.checked) };
      refreshPreviewOnly();
    });
    document.getElementById("inline-surface-shine-color")?.addEventListener("input", event => {
      currentFormProfile = { ...currentFormProfile, formSurfaceShineColor: event.target.value };
      refreshPreviewOnly();
    });
    document.getElementById("inline-surface-text")?.addEventListener("input", event => {
      currentFormProfile = { ...currentFormProfile, formTextColor: event.target.value };
      refreshPreviewOnly();
    });
    document.getElementById("inline-surface-logo-url")?.addEventListener("input", event => {
      currentFormProfile = { ...currentFormProfile, formLogoUrl: event.target.value.slice(0, 500) };
      refreshPreviewOnly();
    });
  }

  if (questionSurfaceControls) {
    questionSurfaceControls.innerHTML = `
      <label class="toggle-row">
        <span>Show question card</span>
        <input id="inline-question-visible" type="checkbox" ${currentFormProfile.questionSurfaceVisible !== false ? "checked" : ""}>
      </label>
      <div class="form-editor-grid">
        <label>
          Card color
          <input id="inline-question-surface" type="color" value="${escapeHtml(currentFormProfile.questionSurfaceColor || DEFAULT_QUESTION_SURFACE_COLOR)}">
        </label>
        <label>
          Text color
          <input id="inline-question-text" type="color" value="${escapeHtml(currentFormProfile.questionTextColor || DEFAULT_QUESTION_TEXT_COLOR)}">
        </label>
      </div>
    `;

    document.getElementById("inline-question-visible")?.addEventListener("change", event => {
      currentFormProfile = { ...currentFormProfile, questionSurfaceVisible: Boolean(event.target.checked) };
      refreshPreviewOnly();
    });
    document.getElementById("inline-question-surface")?.addEventListener("input", event => {
      currentFormProfile = { ...currentFormProfile, questionSurfaceColor: event.target.value };
      refreshPreviewOnly();
    });
    document.getElementById("inline-question-text")?.addEventListener("input", event => {
      currentFormProfile = { ...currentFormProfile, questionTextColor: event.target.value };
      refreshPreviewOnly();
    });
  }

  if (stepNavigationControls) {
    stepNavigationControls.innerHTML = buildStepNavigationSettingsMarkup("inline-step-nav");
    bindStepNavigationSettings(stepNavigationControls, "inline-step-nav");
  }

  if (motionControls) {
    motionControls.innerHTML = buildMotionSettingsMarkup("inline-step-motion");
    bindMotionSettings(motionControls, "inline-step-motion");
  }

  if (welcomeScreenControls) {
    welcomeScreenControls.innerHTML = `
      <label class="toggle-row">
        <span>Show welcome screen first</span>
        <input id="inline-welcome-enabled" type="checkbox" ${currentFormProfile.welcomeScreenEnabled ? "checked" : ""}>
      </label>
      <div class="form-editor-grid">
        <label>
          Welcome title
          <input id="inline-welcome-title" type="text" maxlength="60" value="${escapeHtml(currentFormProfile.welcomeTitle || "")}">
        </label>
        <label>
          Button text
          <input id="inline-welcome-button" type="text" maxlength="32" value="${escapeHtml(currentFormProfile.welcomeButtonText || "")}">
        </label>
      </div>
      <label>
        Welcome copy
        <textarea id="inline-welcome-copy" maxlength="180">${escapeHtml(currentFormProfile.welcomeCopy || "")}</textarea>
      </label>
      <div class="editor-inline-note">This intro screen is text-only now, so it stays cleaner and more consistent across devices.</div>
    `;

    document.getElementById("inline-welcome-enabled")?.addEventListener("change", event => {
      currentFormProfile = {
        ...currentFormProfile,
        welcomeScreenEnabled: Boolean(event.target.checked)
      };
      renderBuilder();
    });
    document.getElementById("inline-welcome-title")?.addEventListener("input", event => {
      currentFormProfile = {
        ...currentFormProfile,
        welcomeTitle: event.target.value.slice(0, 60)
      };
      refreshPreviewOnly();
    });
    document.getElementById("inline-welcome-button")?.addEventListener("input", event => {
      currentFormProfile = {
        ...currentFormProfile,
        welcomeButtonText: event.target.value.slice(0, 32)
      };
      refreshPreviewOnly();
    });
    document.getElementById("inline-welcome-copy")?.addEventListener("input", event => {
      currentFormProfile = {
        ...currentFormProfile,
        welcomeCopy: event.target.value.slice(0, 180)
      };
      refreshPreviewOnly();
    });
  }

  if (thankYouScreenControls) {
    thankYouScreenControls.innerHTML = `
      <label class="toggle-row">
        <span>Show thank-you screen after send</span>
        <input id="inline-thankyou-enabled" type="checkbox" ${currentFormProfile.thankYouScreenEnabled ? "checked" : ""}>
      </label>
      <div class="form-editor-grid">
        <label>
          Thank-you title
          <input id="inline-thankyou-title" type="text" maxlength="60" value="${escapeHtml(currentFormProfile.thankYouTitle || "")}">
        </label>
        <label>
          Button text
          <input id="inline-thankyou-button" type="text" maxlength="32" value="${escapeHtml(currentFormProfile.thankYouButtonText || "")}">
        </label>
      </div>
      <label>
        Thank-you copy
        <textarea id="inline-thankyou-copy" maxlength="180">${escapeHtml(currentFormProfile.thankYouCopy || "")}</textarea>
      </label>
      <div class="editor-inline-note">This finish screen is text-only now, so it feels cleaner and more predictable on mobile.</div>
    `;

    document.getElementById("inline-thankyou-enabled")?.addEventListener("change", event => {
      currentFormProfile = {
        ...currentFormProfile,
        thankYouScreenEnabled: Boolean(event.target.checked)
      };
      renderBuilder();
    });
    document.getElementById("inline-thankyou-title")?.addEventListener("input", event => {
      currentFormProfile = {
        ...currentFormProfile,
        thankYouTitle: event.target.value.slice(0, 60)
      };
      refreshPreviewOnly();
    });
    document.getElementById("inline-thankyou-button")?.addEventListener("input", event => {
      currentFormProfile = {
        ...currentFormProfile,
        thankYouButtonText: event.target.value.slice(0, 32)
      };
      refreshPreviewOnly();
    });
    document.getElementById("inline-thankyou-copy")?.addEventListener("input", event => {
      currentFormProfile = {
        ...currentFormProfile,
        thankYouCopy: event.target.value.slice(0, 180)
      };
      refreshPreviewOnly();
    });
  }
}

function renderBuilder() {
  const steps = getPreviewSteps();

  if (!steps.some(step => step.id === selectedPreviewStepId)) {
    selectedPreviewStepId = steps[0]?.id || "review";
  }

  if (formEnabledToggle) {
    formEnabledToggle.checked = currentFormProfile.isEnabled !== false;
  }
  setActiveStudioTab(activeStudioTab);
  renderFormSettingsTab();
  renderGlobalSettingsTab();
  renderFieldRail();
  renderFormTemplates();
  renderPreview();
  updateStudioContextCard();
  applyMobileStudioScale();
  syncStudioEditorState();
  syncPreviewModeChrome();
}

function closeEditor() {
  if (!editorPopover) {
    return;
  }

  if (editorTransitionTimer) {
    window.clearTimeout(editorTransitionTimer);
    editorTransitionTimer = null;
  }

  editorPopover.classList.remove("is-transition-in");
  editorPopover.classList.add("is-transition-out");
  editorTransitionTimer = window.setTimeout(() => {
    editorPopover.hidden = true;
    editorPopover.classList.remove("is-transition-out");
    editorBody.innerHTML = "";
    restoreMobileStudioAfterEditor();
    syncStudioEditorState();
    updateStudioContextCard();
    triggerStudioViewAnimation("is-view-returning");
    setActiveStudioTab(activeStudioTab);
    editorTransitionTimer = null;
  }, STUDIO_VIEW_TRANSITION_MS);
}

function resetEditorPosition() {
  if (!editorPopover) {
    return;
  }

  editorHasCustomPosition = false;
  editorPopover.style.removeProperty("--fc-editor-left");
  editorPopover.style.removeProperty("--fc-editor-top");
  editorPopover.style.removeProperty("--fc-editor-right");
}

function setEditorPosition(left, top) {
  if (!editorPopover) {
    return;
  }

  const width = editorPopover.offsetWidth || 360;
  const height = editorPopover.offsetHeight || 420;
  const clampedLeft = Math.min(Math.max(12, left), Math.max(12, window.innerWidth - width - 12));
  const clampedTop = Math.min(Math.max(12, top), Math.max(12, window.innerHeight - height - 12));

  editorPopover.style.setProperty("--fc-editor-left", `${clampedLeft}px`);
  editorPopover.style.setProperty("--fc-editor-top", `${clampedTop}px`);
  editorPopover.style.setProperty("--fc-editor-right", "auto");
}

function resetStudioPanelFrame() {
  if (!studioPanel) {
    return;
  }

  studioPanelHasCustomFrame = false;
  studioPanel.style.removeProperty("--fc-studio-left");
  studioPanel.style.removeProperty("--fc-studio-top");
  studioPanel.style.removeProperty("--fc-studio-right");
  studioPanel.style.removeProperty("--fc-studio-width");
  studioPanel.style.removeProperty("--fc-studio-height");
}

function setStudioPanelPosition(left, top) {
  if (!studioPanel) {
    return;
  }

  const width = studioPanel.offsetWidth || 316;
  const height = studioPanel.offsetHeight || 620;
  const clampedLeft = Math.min(Math.max(12, left), Math.max(12, window.innerWidth - width - 12));
  const clampedTop = Math.min(Math.max(12, top), Math.max(12, window.innerHeight - height - 12));

  studioPanel.style.setProperty("--fc-studio-left", `${clampedLeft}px`);
  studioPanel.style.setProperty("--fc-studio-top", `${clampedTop}px`);
  studioPanel.style.setProperty("--fc-studio-right", "auto");
}

function setStudioPanelSize(width, height) {
  if (!studioPanel) {
    return;
  }

  const minWidth = 288;
  const maxWidth = Math.min(430, window.innerWidth - 24);
  const minHeight = 420;
  const maxHeight = Math.min(900, window.innerHeight - 112);
  const clampedWidth = Math.min(Math.max(minWidth, width), Math.max(minWidth, maxWidth));
  const clampedHeight = Math.min(Math.max(minHeight, height), Math.max(minHeight, maxHeight));

  studioPanel.style.setProperty("--fc-studio-width", `${clampedWidth}px`);
  studioPanel.style.setProperty("--fc-studio-height", `${clampedHeight}px`);
}

function applyMobileStudioScale() {
  if (!signedInShell || !formCreatorCanvas) {
    return;
  }

  if (window.innerWidth > MOBILE_STUDIO_BREAKPOINT) {
    signedInShell.style.removeProperty("--fc-mobile-canvas-scale");
    signedInShell.style.removeProperty("--fc-mobile-canvas-width");
    signedInShell.style.removeProperty("--fc-mobile-canvas-height");
    signedInShell.style.removeProperty("--fc-mobile-canvas-scaled-height");
    signedInShell.style.removeProperty("--fc-mobile-panel-height");
    studioPanel?.classList.remove("is-mobile-collapsed", "is-mobile-resizing");
    return;
  }

  const { isNarrowPhone, minPanelHeight, maxPanelHeight, presetHeightMap, collapseSnapThreshold } = getMobileStudioMetrics();
  const previewCanvasHeight = Math.max(
    MOBILE_CANVAS_HEIGHT,
    Math.ceil(previewShell?.scrollHeight || 0),
    Math.ceil(previewShell?.offsetHeight || 0)
  );
  const widthPadding = isNarrowPhone ? 10 : 18;
  const mobileCanvasWidth = isNarrowPhone ? 540 : MOBILE_CANVAS_WIDTH;
  const isEditorOpen = Boolean(editorPopover && !editorPopover.hidden);
  let panelHeight = mobileStudioHeightOverride != null
    ? clampMobileStudioHeight(mobileStudioHeightOverride, minPanelHeight, maxPanelHeight)
    : presetHeightMap[mobileStudioSize] || presetHeightMap.balanced;

  const chromeAllowance = isNarrowPhone ? 154 : 144;
  const heightAllowance = Math.max(232, window.innerHeight - panelHeight - chromeAllowance);
  const widthScale = (window.innerWidth - widthPadding) / mobileCanvasWidth;
  const heightScale = heightAllowance / previewCanvasHeight;
  const previewScaleBias = isNarrowPhone ? 0.89 : 0.92;
  const minimumScale = previewCanvasHeight > MOBILE_CANVAS_HEIGHT
    ? (isNarrowPhone ? 0.24 : 0.3)
    : 0.4;
  const nextScale = Math.max(minimumScale, Math.min(widthScale, heightScale, 1) * previewScaleBias);
  const isCollapsed = Boolean(studioPanel) && !isEditorOpen && panelHeight <= collapseSnapThreshold;

  signedInShell.style.setProperty("--fc-mobile-canvas-scale", nextScale.toFixed(3));
  signedInShell.style.setProperty("--fc-mobile-canvas-width", `${mobileCanvasWidth}px`);
  signedInShell.style.setProperty("--fc-mobile-canvas-height", `${previewCanvasHeight}px`);
  signedInShell.style.setProperty("--fc-mobile-canvas-scaled-height", `${Math.ceil(previewCanvasHeight * nextScale)}px`);
  signedInShell.style.setProperty("--fc-mobile-panel-height", `${panelHeight}px`);
  studioPanel?.classList.toggle("is-mobile-collapsed", isCollapsed);
  syncMobileStudioSizeButtons();
}

function openTypographyEditor(config) {
  if (!editorPopover || !editorBody) {
    return;
  }

  if (!showEditorView(config.title, config.copy, `
    <label>
      Text
      <textarea id="editor-typography-text" maxlength="${config.maxLength || 180}">${escapeHtml(config.text || "")}</textarea>
    </label>
    <div class="form-editor-grid">
      <label>
        Font size
        <input id="editor-typography-size" type="range" min="${config.minSize || 10}" max="${config.maxSize || 60}" value="${config.fontSize}">
      </label>
      <label>
        Size value
        <input id="editor-typography-size-number" type="number" min="${config.minSize || 10}" max="${config.maxSize || 60}" value="${config.fontSize}">
      </label>
    </div>
    <label class="toggle-row">
      <span>Bold text</span>
      <input id="editor-typography-bold" type="checkbox" ${config.bold ? "checked" : ""}>
    </label>
  `)) {
    return;
  }

  const textInput = document.getElementById("editor-typography-text");
  const sizeInput = document.getElementById("editor-typography-size");
  const sizeNumberInput = document.getElementById("editor-typography-size-number");
  const boldInput = document.getElementById("editor-typography-bold");

  const apply = patch => {
    config.apply(patch);
    renderBuilder();
  };

  textInput?.addEventListener("input", event => {
    apply({ text: event.target.value.slice(0, config.maxLength || 180) });
  });

  const syncSize = nextValue => {
    const numericValue = Math.min(config.maxSize || 60, Math.max(config.minSize || 10, Number(nextValue) || config.fontSize));
    if (sizeInput) sizeInput.value = String(numericValue);
    if (sizeNumberInput) sizeNumberInput.value = String(numericValue);
    apply({ fontSize: numericValue });
  };

  sizeInput?.addEventListener("input", event => {
    syncSize(event.target.value);
  });

  sizeNumberInput?.addEventListener("input", event => {
    syncSize(event.target.value);
  });

  boldInput?.addEventListener("change", event => {
    apply({ bold: Boolean(event.target.checked) });
  });
}

function openFieldEditor(fieldId) {
  setActiveStudioTab("add-fields");
  const step = getEditableStep(fieldId);
  const customField = getCustomFields().find(entry => entry.id === fieldId) || null;
  const isBuiltInStep = Boolean(step?.builtIn && step.id !== "review");
  const isCustomField = Boolean(customField);
  const isContentBlock = Boolean(customField && isContentBlockField(customField));
  const semanticFieldId = isBuiltInStep
    ? fieldId
    : String(customField?.semanticId || "").trim();
  const isMappedEssentialField = Boolean(isCustomField && semanticFieldId);
  const isAutoRememberedBuiltIn = isBuiltInStep && isDefaultRememberedClientField(fieldId);
  const canToggleBuiltInRemember = isBuiltInStep && canToggleBuiltInRememberField(fieldId);
  const usesSemanticMapping = isBuiltInStep || isMappedEssentialField;
  const shouldShowRememberToggle = isCustomField || isAutoRememberedBuiltIn || canToggleBuiltInRemember;
  const rememberToggleChecked = isCustomField || canToggleBuiltInRemember
    ? step?.rememberClientAnswer === true
    : isAutoRememberedBuiltIn;
  const rememberToggleDisabled = isAutoRememberedBuiltIn;

  if ((!isBuiltInStep && !isCustomField) || !step || !editorPopover || !editorBody) {
    return;
  }

  if (isContentBlock) {
    const blockType = String(step.type || "").trim();
    const title = blockType === "content-image"
      ? "Image block"
      : blockType === "content-divider"
        ? "Divider block"
        : "Text block";
    const copy = blockType === "content-image"
      ? "Use a direct image URL and optional caption so the form feels more editorial."
      : blockType === "content-divider"
        ? "Add a simple visual break or a short section label between questions."
        : "Use text blocks for short intros, directions, trust cues, or service notes.";
    const markup = blockType === "content-image"
      ? `
        <label>
          Caption
          <input id="editor-block-caption" type="text" value="${escapeHtml(step.label || "")}" maxlength="60">
        </label>
        <label>
          Image URL
          <input id="editor-block-image-url" type="url" inputmode="url" placeholder="https://example.com/image.jpg" value="${escapeHtml(step.imageUrl || "")}" maxlength="500">
        </label>
        <label>
          Supporting copy
          <textarea id="editor-block-copy" maxlength="160">${escapeHtml(step.helpText || "")}</textarea>
        </label>
        ${buildFieldAudienceSettingsMarkup(step, { isContentBlock: true })}
        <div class="editor-inline-note">Use a direct image file link for the best results. If the host blocks hotlinking, the block will fall back to a placeholder.</div>
        <button id="editor-delete-field" class="delete-field-button" type="button">Delete this block</button>
      `
      : blockType === "content-divider"
        ? `
          <label>
            Divider label
            <input id="editor-block-caption" type="text" value="${escapeHtml(step.label || "")}" maxlength="40" placeholder="Optional section label">
          </label>
          ${buildFieldAudienceSettingsMarkup(step, { isContentBlock: true })}
          <div class="editor-inline-note">Leave this blank if you want a clean divider line with no text.</div>
          <button id="editor-delete-field" class="delete-field-button" type="button">Delete this block</button>
        `
        : `
          <label>
            Heading
            <input id="editor-block-caption" type="text" value="${escapeHtml(step.label || "")}" maxlength="60">
          </label>
          <label>
            Body copy
            <textarea id="editor-block-copy" maxlength="240">${escapeHtml(step.helpText || step.copy || "")}</textarea>
          </label>
          ${buildFieldAudienceSettingsMarkup(step, { isContentBlock: true })}
          <button id="editor-delete-field" class="delete-field-button" type="button">Delete this block</button>
        `;

    if (!showEditorView(title, copy, markup)) {
      return;
    }

    const captionInput = document.getElementById("editor-block-caption");
    const imageUrlInput = document.getElementById("editor-block-image-url");
    const copyInput = document.getElementById("editor-block-copy");
    const deleteButton = document.getElementById("editor-delete-field");
    bindFieldAudienceSettings(fieldId, step, { isContentBlock: true });
    const patchBlock = updates => {
      patchStepConfig(fieldId, updates);
      renderBuilder();
    };

    captionInput?.addEventListener("input", event => {
      patchBlock({ label: event.target.value.slice(0, blockType === "content-divider" ? 40 : 60) });
    });

    imageUrlInput?.addEventListener("input", event => {
      patchBlock({ imageUrl: event.target.value.slice(0, 500) });
    });

    copyInput?.addEventListener("input", event => {
      patchBlock({
        helpText: event.target.value.slice(0, blockType === "content-text" ? 240 : 160),
        copy: event.target.value.slice(0, blockType === "content-text" ? 240 : 160)
      });
    });

    deleteButton?.addEventListener("click", () => {
      currentFormProfile = {
        ...currentFormProfile,
        fields: getCustomFields().filter(entry => entry.id !== fieldId && entry.pageId !== fieldId)
      };
      closeEditor();
      renderBuilder();
    });
    return;
  }

  if (!showEditorView("Question settings", usesSemanticMapping
    ? getBuiltInFieldSemanticNote(semanticFieldId || fieldId)
    : "Rename this question and control how it appears in Send Reminder.", `
    <label>
      Question title
      <input id="editor-field-label" type="text" value="${escapeHtml(step.label || "")}" maxlength="60">
    </label>
    ${isCustomField && !isMappedEssentialField ? `
      <label>
        Field type
        <select id="editor-field-type">
          ${getBuilderFieldTypeOptions(step.type).map(option => `<option value="${escapeHtml(option.id)}" ${option.id === step.type ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
        </select>
      </label>
    ` : `
      <label>
        Field type
        <input type="text" value="${escapeHtml(step.type === "textarea" ? "Long Answer" : step.type === "phone" ? "Phone" : step.type === "date" ? "Date" : step.type === "time" ? "Time" : step.type === "email" ? "Email" : "Short Answer")}" disabled>
      </label>
    `}
    <label>
      Placeholder
      <input id="editor-field-placeholder" type="text" value="${escapeHtml(step.placeholder || "")}" maxlength="120">
    </label>
    <label>
      Helper copy
      <textarea id="editor-field-help" maxlength="160">${escapeHtml(step.helpText || "")}</textarea>
    </label>
    ${step.type === "select" ? `
      <label>
        Dropdown options
        <textarea id="editor-field-options" maxlength="1200" placeholder="Option 1&#10;Option 2&#10;Option 3">${escapeHtml(normalizeSelectFieldOptions(step.options).join("\n"))}</textarea>
      </label>
      <div class="editor-inline-note">Add one option per line. Clients will pick from these choices in Send Reminder.</div>
    ` : ""}
    ${buildFieldAudienceSettingsMarkup(step, { isBuiltInStep, semanticFieldId })}
    ${shouldShowRememberToggle ? `
      <label class="toggle-row">
        <span>Remember this answer for future visits and show it in Client Details</span>
        <input id="editor-field-remember-answer" type="checkbox" ${rememberToggleChecked ? "checked" : ""} ${rememberToggleDisabled ? "disabled" : ""}>
      </label>
      <div class="editor-inline-note">${isAutoRememberedBuiltIn
        ? "This built-in client field is already remembered automatically."
        : canToggleBuiltInRemember
          ? "Turn this on only if this built-in answer should be saved to the client profile for future visits."
          : "Turn this on if this custom answer should be saved on the client profile for future appointments."}</div>
      ` : ""}
    ${(isCustomField || isBuiltInStep) ? `<button id="editor-delete-field" class="delete-field-button" type="button">${isBuiltInStep ? "Remove this field from the form" : "Delete this question"}</button>` : ""}
  `)) {
    return;
  }

  const labelInput = document.getElementById("editor-field-label");
  const typeSelect = document.getElementById("editor-field-type");
  const placeholderInput = document.getElementById("editor-field-placeholder");
  const helpInput = document.getElementById("editor-field-help");
  const optionsInput = document.getElementById("editor-field-options");
  const rememberInput = document.getElementById("editor-field-remember-answer");
  const deleteButton = document.getElementById("editor-delete-field");
  bindFieldAudienceSettings(fieldId, step, { isBuiltInStep, semanticFieldId });

  const patchField = updates => {
    patchStepConfig(fieldId, updates);

    if (isCustomField && updates.type) {
      currentFormProfile = {
        ...currentFormProfile,
        fields: getCustomFields().map(entry => {
          if (entry.id !== fieldId) {
            return entry;
          }

          const nextField = { ...entry };
          const nextMeta = getCustomFieldTypeMeta(updates.type);

          nextField.navLabel = safeShortLabel(nextField.navLabel || nextMeta.shortLabel);

          if (updates.type === "date" || updates.type === "time") {
            nextField.placeholder = "";
          } else if (updates.type === "select") {
            nextField.placeholder = nextField.placeholder || nextMeta.placeholder;
            nextField.options = normalizeSelectFieldOptions(nextField.options);
          } else if (!nextField.placeholder) {
            nextField.placeholder = nextMeta.placeholder;
          }

          if (updates.type !== "select") {
            nextField.options = [];
          }

          return nextField;
        })
      };
    }

    renderBuilder();
  };

  labelInput?.addEventListener("input", event => {
    patchField({ label: event.target.value.slice(0, 60) });
  });

  typeSelect?.addEventListener("change", event => {
    patchField({ type: event.target.value });
    openFieldEditor(fieldId);
  });

  placeholderInput?.addEventListener("input", event => {
    patchField({ placeholder: event.target.value.slice(0, 120) });
  });

  helpInput?.addEventListener("input", event => {
    patchField({ helpText: event.target.value.slice(0, 160) });
  });

  optionsInput?.addEventListener("input", event => {
    patchField({ options: normalizeSelectFieldOptions(event.target.value) });
  });

  rememberInput?.addEventListener("change", event => {
    if (!isCustomField && !canToggleBuiltInRemember) {
      return;
    }

    patchField({ rememberClientAnswer: Boolean(event.target.checked) });
  });

  deleteButton?.addEventListener("click", () => {
    removeBuilderField(fieldId);
  });
}

function safeShortLabel(value) {
  const trimmed = String(value || "").trim();
  return trimmed.slice(0, 12) || "Custom";
}

function openPageTitleEditor() {
  setActiveStudioTab("global-settings");
  openTypographyEditor({
    title: "Page title",
    copy: "Edit the page title text and how strongly it appears above the form.",
    text: currentFormProfile.formTitle || DEFAULT_FORM_TITLE,
    fontSize: currentFormProfile.formTitleFontSize || DEFAULT_FORM_TITLE_FONT_SIZE,
    bold: currentFormProfile.formTitleBold !== false,
    minSize: 10,
    maxSize: 28,
    maxLength: 60,
    apply({ text, fontSize, bold }) {
      currentFormProfile = {
        ...currentFormProfile,
        formTitle: typeof text === "string" ? (text || DEFAULT_FORM_TITLE) : currentFormProfile.formTitle,
        formTitleFontSize: fontSize ?? currentFormProfile.formTitleFontSize,
        formTitleBold: bold ?? currentFormProfile.formTitleBold
      };
    }
  });
}

function openStepNavigationEditor() {
  setActiveStudioTab("form-settings");
  if (!editorPopover || !editorBody) {
    return;
  }

  if (!getPreviewSteps().some(step => step.id !== "review")) {
    return;
  }

  if (!showEditorView(
    "Step labels",
    "Edit the whole step row here, including chip size, shape, colors, and labels.",
    buildStepNavigationSettingsMarkup("editor-step-nav")
  )) {
    return;
  }
  bindStepNavigationSettings(editorBody, "editor-step-nav");
}

function openCustomPageEditor(step) {
  setActiveStudioTab("add-fields");
  if (!step || !editorPopover || !editorBody) {
    return;
  }

  if (isSpecialPreviewScreen(step)) {
    const isThankYou = step.type === "thankyou";
    const screenLabel = isThankYou ? "Finish screen" : "Start screen";
    const prefix = isThankYou ? "thankYou" : "welcome";

    if (!showEditorView(
      "Page settings",
      `Edit the ${screenLabel.toLowerCase()} text, button label, or remove it from your form entirely.`,
      `
        <div class="page-editor-section" data-preview-hover="${escapeHtml(step.type)}">
          <strong class="page-editor-section-title">${escapeHtml(screenLabel)}</strong>
          <div class="page-editor-chip-preview">${escapeHtml(screenLabel)}</div>
          <div class="editor-inline-note">This screen does not hold question fields. It is an optional screen shown ${isThankYou ? "after" : "before"} the question pages.</div>
        </div>
        <label>
          Screen title
          <input id="editor-page-title" type="text" value="${escapeHtml(step.title || "")}" maxlength="60">
        </label>
        <label>
          Supporting copy
          <textarea id="editor-page-copy" maxlength="180">${escapeHtml(step.copy || "")}</textarea>
        </label>
        <label>
          Button text
          <input id="editor-page-button" type="text" value="${escapeHtml(step.buttonText || "")}" maxlength="32">
        </label>
        <div class="page-editor-danger-zone">
          <button id="editor-delete-page" class="delete-field-button" type="button">Delete this page</button>
          <div class="page-editor-danger-note">This hides the ${escapeHtml(screenLabel.toLowerCase())}. You can restore it later from Form Settings.</div>
        </div>
      `
    )) {
      return;
    }

    const titleInput = document.getElementById("editor-page-title");
    const copyInput = document.getElementById("editor-page-copy");
    const buttonInput = document.getElementById("editor-page-button");
    const deleteButton = document.getElementById("editor-delete-page");

    const patchScreen = updates => {
      currentFormProfile = {
        ...currentFormProfile,
        ...updates
      };
      renderBuilder();
    };

    titleInput?.addEventListener("input", event => {
      patchScreen({ [`${prefix}Title`]: event.target.value.slice(0, 60) });
    });

    copyInput?.addEventListener("input", event => {
      patchScreen({ [`${prefix}Copy`]: event.target.value.slice(0, 180) });
    });

    buttonInput?.addEventListener("input", event => {
      patchScreen({ [`${prefix}ButtonText`]: event.target.value.slice(0, 32) });
    });

    deleteButton?.addEventListener("click", () => {
      removeBuilderPage(step.id);
    });
    return;
  }

  const isCustomPage = getCustomPages().some(page => page.id === step.id);
  const mergedFields = [
    ...getPageFieldsForStep(step.id),
    ...(step.id === getCurrentPageId() ? getCurrentPageFields() : [])
  ];
  const pageFields = Array.from(new Map(mergedFields.map(field => [field.id, field])).values());
  const pageItemCount = pageFields.length;
  const pageItemsMarkup = pageFields.length
    ? `
      <div class="page-editor-item-list ${pageFields.length > 3 ? "is-scrollable" : ""}">
        ${pageFields.map(field => {
          const meta = getCustomFieldTypeMeta(field.type);
          const kindLabel = field.isBaseField
            ? "Page field"
            : field.semanticId
              ? "Essential field"
              : (isContentBlockField(field) ? "Content block" : "Question");
          const deleteLabel = field.isBaseField ? "Remove" : "Delete";
          const mappedLabel = field.semanticId ? ` • Maps to ${getBuiltInFieldSemanticName(field.semanticId)}` : "";
          return `
            <div class="page-editor-item-card ${field.isBaseField ? "is-base-field" : ""}">
              <div class="page-editor-item-copy">
                <span class="page-editor-item-kind">${escapeHtml(kindLabel)}</span>
                <strong class="page-editor-item-title">${escapeHtml(field.label || field.title || "Field")}</strong>
                <span class="page-editor-item-meta">${escapeHtml(meta.label)}${escapeHtml(mappedLabel)}${field.required ? " • Required" : ""}</span>
              </div>
              <div class="page-editor-item-actions">
                <button class="page-editor-item-button" type="button" data-page-item-edit="${escapeHtml(field.id)}">Edit field</button>
                <button class="page-editor-item-button is-danger" type="button" data-page-item-delete="${escapeHtml(field.id)}">${deleteLabel}</button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `
    : `<div class="editor-inline-note">There is nothing on this page yet. Add fields from the Builder tab and they will appear here.</div>`;

  if (!showEditorView(
    "Page settings",
    "Edit the page text, the step chip, every item on this page, or remove the whole page from your form.",
    `
      <div class="page-editor-section" data-preview-hover="steps">
        <strong class="page-editor-section-title">Step chip</strong>
        <div class="page-editor-chip-preview">${escapeHtml(step.navLabel || step.label || step.title || "Step")}</div>
        <label>
          Step chip label
          <input id="editor-page-nav-label" type="text" value="${escapeHtml(step.navLabel || "")}" maxlength="12">
        </label>
      </div>
      <div class="page-editor-section">
        <strong class="page-editor-section-title">Items on this page (${pageItemCount})</strong>
        ${pageItemsMarkup}
      </div>
      <label>
        Page title
        <input id="editor-page-title" type="text" value="${escapeHtml(step.title || "")}" maxlength="60">
      </label>
      <label>
        Supporting copy
        <textarea id="editor-page-copy" maxlength="180">${escapeHtml(step.copy || "")}</textarea>
      </label>
      <div class="page-editor-danger-zone">
        <button id="editor-delete-page" class="delete-field-button" type="button">Delete this page</button>
        <div class="page-editor-danger-note">${isCustomPage ? "This removes the whole custom page and everything on it." : "This removes the whole built-in page from the form. You can add it back later from Add The Essentials."}</div>
      </div>
    `
  )) {
    return;
  }

  const titleInput = document.getElementById("editor-page-title");
  const navLabelInput = document.getElementById("editor-page-nav-label");
  const copyInput = document.getElementById("editor-page-copy");
  const deleteButton = document.getElementById("editor-delete-page");
  const chipPreview = editorBody.querySelector(".page-editor-chip-preview");

  const patchPage = updates => {
    patchStepConfig(step.id, updates);
    renderBuilder();
  };

  titleInput?.addEventListener("input", event => {
    patchPage({ title: event.target.value.slice(0, 60) || "Custom Page" });
  });

  navLabelInput?.addEventListener("input", event => {
    const nextLabel = safeShortLabel(event.target.value);
    patchPage({ navLabel: nextLabel });
    if (chipPreview) {
      chipPreview.textContent = nextLabel || step.navLabel || step.label || step.title || "Step";
    }
  });

  copyInput?.addEventListener("input", event => {
    patchPage({ copy: event.target.value.slice(0, 180) });
  });

  editorBody.querySelectorAll("[data-page-item-edit]").forEach(button => {
    button.addEventListener("click", () => {
      openFieldEditor(button.dataset.pageItemEdit || "");
    });
  });

  editorBody.querySelectorAll("[data-page-item-delete]").forEach(button => {
    button.addEventListener("click", () => {
      const fieldId = button.dataset.pageItemDelete || "";
      removeBuilderField(fieldId);
      const refreshedStep = getEditableStep(step.id);
      if (refreshedStep) {
        openCustomPageEditor(refreshedStep);
      }
    });
  });

  deleteButton?.addEventListener("click", () => {
    removeBuilderPage(step.id);
  });
}

function openSelectedStepTextEditor(target, fieldIdOverride = "") {
  const step = fieldIdOverride ? getEditableStep(fieldIdOverride) : getSelectedPreviewStep();

  if (!step) {
    return;
  }

  if (target === "step-nav-label") {
    setActiveStudioTab("form-settings");
  } else if (isSpecialPreviewScreen(step)) {
    setActiveStudioTab("form-settings");
  } else {
    setActiveStudioTab("add-fields");
  }

  if (isSpecialPreviewScreen(step)) {
    const stepPrefix = step.type === "thankyou" ? "thankYou" : "welcome";

    if (target === "step-title") {
      openTypographyEditor({
        title: step.type === "thankyou" ? "Thank-you title" : "Welcome title",
        copy: step.type === "thankyou"
          ? "Edit the title that appears on the optional thank-you screen."
          : "Edit the title that appears on the optional welcome screen.",
        text: currentFormProfile[`${stepPrefix}Title`] || step.title,
        fontSize: currentFormProfile[`${stepPrefix}TitleFontSize`] || step.titleFontSize || DEFAULT_STEP_TITLE_FONT_SIZE,
        bold: currentFormProfile[`${stepPrefix}TitleBold`] !== false,
        minSize: 20,
        maxSize: 60,
        maxLength: 60,
        apply({ text, fontSize, bold }) {
          currentFormProfile = {
            ...currentFormProfile,
            [`${stepPrefix}Title`]: typeof text === "string" ? text : currentFormProfile[`${stepPrefix}Title`],
            [`${stepPrefix}TitleFontSize`]: fontSize ?? currentFormProfile[`${stepPrefix}TitleFontSize`],
            [`${stepPrefix}TitleBold`]: bold ?? currentFormProfile[`${stepPrefix}TitleBold`]
          };
        }
      });
      return;
    }

    if (target === "step-copy") {
      openTypographyEditor({
        title: step.type === "thankyou" ? "Thank-you copy" : "Welcome copy",
        copy: step.type === "thankyou"
          ? "Edit the supporting text on the optional thank-you screen."
          : "Edit the supporting text on the optional welcome screen.",
        text: currentFormProfile[`${stepPrefix}Copy`] || step.copy || "",
        fontSize: currentFormProfile[`${stepPrefix}CopyFontSize`] || step.copyFontSize || DEFAULT_STEP_COPY_FONT_SIZE,
        bold: Boolean(currentFormProfile[`${stepPrefix}CopyBold`]),
        minSize: 12,
        maxSize: 26,
        maxLength: 180,
        apply({ text, fontSize, bold }) {
          currentFormProfile = {
            ...currentFormProfile,
            [`${stepPrefix}Copy`]: typeof text === "string" ? text : currentFormProfile[`${stepPrefix}Copy`],
            [`${stepPrefix}CopyFontSize`]: fontSize ?? currentFormProfile[`${stepPrefix}CopyFontSize`],
            [`${stepPrefix}CopyBold`]: bold ?? currentFormProfile[`${stepPrefix}CopyBold`]
          };
        }
      });
      return;
    }
  }

  if (target === "step-nav-label") {
    openStepNavigationEditor();
    return;
  }

  if (getCustomPages().some(page => page.id === step.id) && (target === "step-title" || target === "step-copy")) {
    openCustomPageEditor(step);
    return;
  }

  if (target === "step-title") {
    openTypographyEditor({
      title: "Step title",
      copy: step.builtIn
        ? `Edit the large question title for this page. It still maps to ${getBuiltInFieldSemanticName(step.id)} in reminders.`
        : "Edit the large question title for this step.",
      text: step.title,
      fontSize: step.titleFontSize || DEFAULT_STEP_TITLE_FONT_SIZE,
      bold: step.titleBold !== false,
      minSize: 20,
      maxSize: 60,
      maxLength: 60,
      apply({ text, fontSize, bold }) {
        patchStepConfig(step.id, {
          title: typeof text === "string" ? text : step.title,
          titleFontSize: fontSize ?? step.titleFontSize,
          titleBold: bold ?? step.titleBold
        });
      }
    });
    return;
  }

  if (target === "step-copy") {
    openTypographyEditor({
      title: "Step copy",
      copy: step.builtIn
        ? `Edit the supporting sentence for this page. It still maps to ${getBuiltInFieldSemanticName(step.id)} in reminders.`
        : "Edit the supporting sentence below the question title.",
      text: step.copy || "",
      fontSize: step.copyFontSize || DEFAULT_STEP_COPY_FONT_SIZE,
      bold: Boolean(step.copyBold),
      minSize: 12,
      maxSize: 26,
      maxLength: 180,
      apply({ text, fontSize, bold }) {
        patchStepConfig(step.id, {
          copy: typeof text === "string" ? text : step.copy,
          copyFontSize: fontSize ?? step.copyFontSize,
          copyBold: bold ?? step.copyBold
        });
      }
    });
    return;
  }

  if (target === "field-label") {
    if (!editorPopover || !editorBody) {
      return;
    }

    const isBuiltInStep = Boolean(step?.builtIn && step.id !== "review");
    const isCustomField = getCustomFields().some(entry => entry.id === step.id);
    const isAutoRememberedBuiltIn = isBuiltInStep && isDefaultRememberedClientField(step.id);
    const canToggleBuiltInRemember = isBuiltInStep && canToggleBuiltInRememberField(step.id);
    const shouldShowRememberToggle = isCustomField || isAutoRememberedBuiltIn || canToggleBuiltInRemember;
    const rememberToggleChecked = isCustomField || canToggleBuiltInRemember
      ? step?.rememberClientAnswer === true
      : isAutoRememberedBuiltIn;
    const rememberToggleDisabled = isAutoRememberedBuiltIn;

    if (!showEditorView("Field label", "Edit the question label, whether it is required, and whether the answer should be remembered later.", `
      ${isBuiltInStep ? `<div class="editor-inline-note">${escapeHtml(getBuiltInFieldSemanticNote(step.id))}</div>` : ""}
      <label>
        Label text
        <textarea id="editor-label-text" maxlength="60">${escapeHtml(step.label || "")}</textarea>
      </label>
      <div class="form-editor-grid">
        <label>
          Font size
          <input id="editor-label-size" type="range" min="13" max="28" value="${step.labelFontSize || DEFAULT_FIELD_LABEL_FONT_SIZE}">
        </label>
        <label>
          Size value
          <input id="editor-label-size-number" type="number" min="13" max="28" value="${step.labelFontSize || DEFAULT_FIELD_LABEL_FONT_SIZE}">
        </label>
      </div>
      <label class="toggle-row">
        <span>Bold text</span>
        <input id="editor-label-bold" type="checkbox" ${step.labelBold !== false ? "checked" : ""}>
      </label>
      <label class="toggle-row">
        <span>Required field</span>
        <input id="editor-label-required" type="checkbox" ${step.required ? "checked" : ""}>
      </label>
      ${shouldShowRememberToggle ? `
        <label class="toggle-row">
          <span>Remember this answer for future visits and show it in Client Details</span>
          <input id="editor-label-remember" type="checkbox" ${rememberToggleChecked ? "checked" : ""} ${rememberToggleDisabled ? "disabled" : ""}>
        </label>
        <div class="editor-inline-note">${isAutoRememberedBuiltIn
          ? "This built-in client field is already remembered automatically."
          : canToggleBuiltInRemember
            ? "Turn this on only if this built-in answer should be saved to the client profile for future visits."
            : "Turn this on if this answer should be saved on the client profile for future appointments."}</div>
      ` : ""}
      ${(isCustomField || isBuiltInStep) ? `<button id="editor-label-delete-field" class="delete-field-button" type="button">${isBuiltInStep ? "Remove this field from the form" : "Delete this question"}</button>` : ""}
    `)) {
      return;
    }

    const labelTextInput = document.getElementById("editor-label-text");
    const labelSizeInput = document.getElementById("editor-label-size");
    const labelSizeNumberInput = document.getElementById("editor-label-size-number");
    const labelBoldInput = document.getElementById("editor-label-bold");
    const labelRequiredInput = document.getElementById("editor-label-required");
    const labelRememberInput = document.getElementById("editor-label-remember");
    const labelDeleteButton = document.getElementById("editor-label-delete-field");

    const applyLabelPatch = patch => {
      patchStepConfig(step.id, patch);
      renderBuilder();
    };

    labelTextInput?.addEventListener("input", event => {
      applyLabelPatch({ label: event.target.value.slice(0, 60) });
    });

    const syncLabelSize = nextValue => {
      const numericValue = Math.min(28, Math.max(13, Number(nextValue) || DEFAULT_FIELD_LABEL_FONT_SIZE));
      if (labelSizeInput) labelSizeInput.value = String(numericValue);
      if (labelSizeNumberInput) labelSizeNumberInput.value = String(numericValue);
      applyLabelPatch({ labelFontSize: numericValue });
    };

    labelSizeInput?.addEventListener("input", event => {
      syncLabelSize(event.target.value);
    });

    labelSizeNumberInput?.addEventListener("input", event => {
      syncLabelSize(event.target.value);
    });

    labelBoldInput?.addEventListener("change", event => {
      applyLabelPatch({ labelBold: Boolean(event.target.checked) });
    });

    labelRequiredInput?.addEventListener("change", event => {
      applyLabelPatch({ required: Boolean(event.target.checked) });
    });

    labelRememberInput?.addEventListener("change", event => {
      if (!isCustomField && !canToggleBuiltInRemember) {
        return;
      }

      applyLabelPatch({ rememberClientAnswer: Boolean(event.target.checked) });
    });
    labelDeleteButton?.addEventListener("click", () => {
      removeBuilderField(step.id);
    });
    return;
  }

  if (target === "field-help") {
    openTypographyEditor({
      title: "Helper copy",
      copy: "Edit the smaller helper note under this input.",
      text: step.helpText || "",
      fontSize: step.helpFontSize || DEFAULT_FIELD_HELP_FONT_SIZE,
      bold: Boolean(step.helpBold),
      minSize: 11,
      maxSize: 24,
      maxLength: 180,
      apply({ text, fontSize, bold }) {
        patchStepConfig(step.id, {
          helpText: typeof text === "string" ? text : step.helpText,
          helpFontSize: fontSize ?? step.helpFontSize,
          helpBold: bold ?? step.helpBold
        });
      }
    });
  }
}

function openFormShellEditor() {
  setActiveStudioTab("form-settings");
  if (!editorPopover || !editorBody) {
    return;
  }

  const isSurfaceSolid = (currentFormProfile.formSurfaceGradient || DEFAULT_FORM_SURFACE_GRADIENT) === "solid";

  if (!showEditorView("Form box style", "Change the form shape, layout, color, shine, logo, and text styling for Send Reminder.", `
    <div class="form-editor-grid">
      <label>
        Form shape
        <select id="editor-surface-shape">
          ${FORM_SURFACE_SHAPE_OPTIONS.map(option => `<option value="${escapeHtml(option.id)}" ${option.id === (currentFormProfile.formSurfaceShape || DEFAULT_FORM_SURFACE_SHAPE) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
        </select>
      </label>
      <label>
        Form layout
        <select id="editor-surface-layout">
          ${FORM_SURFACE_LAYOUT_OPTIONS.map(option => `<option value="${escapeHtml(option.id)}" ${option.id === (currentFormProfile.formSurfaceLayout || DEFAULT_FORM_SURFACE_LAYOUT) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
        </select>
      </label>
    </div>
    <div class="form-editor-grid">
      <label>
        Form color
        <input id="editor-surface-base" type="color" value="${escapeHtml(currentFormProfile.formSurfaceColor || DEFAULT_FORM_SURFACE_COLOR)}">
      </label>
      ${isSurfaceSolid ? "" : `
        <label>
          Gradient color
          <input id="editor-surface-accent" type="color" value="${escapeHtml(currentFormProfile.formSurfaceAccentColor || DEFAULT_FORM_SURFACE_ACCENT_COLOR)}">
        </label>
      `}
    </div>
    <label>
      Form finish
      <select id="editor-surface-gradient">
        ${FORM_SURFACE_GRADIENT_OPTIONS.map(option => `<option value="${escapeHtml(option.id)}" ${option.id === (currentFormProfile.formSurfaceGradient || DEFAULT_FORM_SURFACE_GRADIENT) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
      </select>
    </label>
    <label class="toggle-row">
      <span>Top shine</span>
      <input id="editor-surface-shine-toggle" type="checkbox" ${currentFormProfile.formSurfaceShineEnabled !== false ? "checked" : ""}>
    </label>
    <label>
      Shine color
      <input id="editor-surface-shine-color" type="color" value="${escapeHtml(currentFormProfile.formSurfaceShineColor || DEFAULT_FORM_SURFACE_SHINE_COLOR)}">
    </label>
    <label>
      Text color
      <input id="editor-surface-text" type="color" value="${escapeHtml(currentFormProfile.formTextColor || DEFAULT_FORM_TEXT_COLOR)}">
    </label>
    <label>
      Logo image URL
      <input id="editor-surface-logo-url" type="url" inputmode="url" placeholder="https://example.com/logo.png" value="${escapeHtml(currentFormProfile.formLogoUrl || "")}">
    </label>
    <div class="editor-inline-note">Use a direct image file URL for the logo. Leave it blank if you want the top-right corner to stay clean.</div>
  `)) {
    return;
  }

  document.getElementById("editor-surface-base")?.addEventListener("input", event => {
    currentFormProfile = {
      ...currentFormProfile,
      formSurfaceColor: event.target.value
    };
    refreshPreviewOnly();
  });

  document.getElementById("editor-surface-accent")?.addEventListener("input", event => {
    currentFormProfile = {
      ...currentFormProfile,
      formSurfaceAccentColor: event.target.value
    };
    refreshPreviewOnly();
  });

  document.getElementById("editor-surface-gradient")?.addEventListener("change", event => {
    currentFormProfile = {
      ...currentFormProfile,
      formSurfaceGradient: event.target.value
    };
    renderBuilder();
    openFormShellEditor();
  });

  document.getElementById("editor-surface-shape")?.addEventListener("change", event => {
    currentFormProfile = {
      ...currentFormProfile,
      formSurfaceShape: event.target.value
    };
    refreshPreviewOnly();
  });

  document.getElementById("editor-surface-layout")?.addEventListener("change", event => {
    currentFormProfile = {
      ...currentFormProfile,
      formSurfaceLayout: event.target.value
    };
    refreshPreviewOnly();
  });

  document.getElementById("editor-surface-shine-toggle")?.addEventListener("change", event => {
    currentFormProfile = {
      ...currentFormProfile,
      formSurfaceShineEnabled: Boolean(event.target.checked)
    };
    refreshPreviewOnly();
  });

  document.getElementById("editor-surface-shine-color")?.addEventListener("input", event => {
    currentFormProfile = {
      ...currentFormProfile,
      formSurfaceShineColor: event.target.value
    };
    refreshPreviewOnly();
  });

  document.getElementById("editor-surface-text")?.addEventListener("input", event => {
    currentFormProfile = {
      ...currentFormProfile,
      formTextColor: event.target.value
    };
    refreshPreviewOnly();
  });

  document.getElementById("editor-surface-logo-url")?.addEventListener("input", event => {
    currentFormProfile = {
      ...currentFormProfile,
      formLogoUrl: event.target.value.slice(0, 500)
    };
    refreshPreviewOnly();
  });
}

function openQuestionShellEditor() {
  setActiveStudioTab("form-settings");
  if (!editorPopover || !editorBody) {
    return;
  }

  if (!showEditorView("Question card style", "Change the inner white question card without affecting the whole form shell.", `
    <label class="toggle-row">
      <span>Show question card</span>
      <input id="editor-question-visible" type="checkbox" ${currentFormProfile.questionSurfaceVisible !== false ? "checked" : ""}>
    </label>
    <div class="form-editor-grid">
      <label>
        Card color
        <input id="editor-question-surface" type="color" value="${escapeHtml(currentFormProfile.questionSurfaceColor || DEFAULT_QUESTION_SURFACE_COLOR)}">
      </label>
      <label>
        Text color
        <input id="editor-question-text" type="color" value="${escapeHtml(currentFormProfile.questionTextColor || DEFAULT_QUESTION_TEXT_COLOR)}">
      </label>
    </div>
  `)) {
    return;
  }

  document.getElementById("editor-question-visible")?.addEventListener("change", event => {
    currentFormProfile = {
      ...currentFormProfile,
      questionSurfaceVisible: Boolean(event.target.checked)
    };
    refreshPreviewOnly();
  });

  document.getElementById("editor-question-surface")?.addEventListener("input", event => {
    currentFormProfile = {
      ...currentFormProfile,
      questionSurfaceColor: event.target.value
    };
    refreshPreviewOnly();
  });

  document.getElementById("editor-question-text")?.addEventListener("input", event => {
    currentFormProfile = {
      ...currentFormProfile,
      questionTextColor: event.target.value
    };
    refreshPreviewOnly();
  });
}

function openPageEditor() {
  setActiveStudioTab("global-settings");
  if (!editorPopover || !editorBody) {
    return;
  }

  const activePreset = getBackgroundPresetMatch(currentFormProfile)?.id || "";

  if (!showEditorView("Page settings", "Control the form name and the Send Reminder page background colors.", `
    <label>
      Page name
      <input id="editor-form-title" type="text" value="${escapeHtml(currentFormProfile.formTitle)}" maxlength="60">
    </label>
    <div class="preset-row">
      ${FORM_BACKGROUND_PRESETS.map(preset => `<button class="preset-chip ${preset.id === activePreset ? "is-active" : ""}" type="button" data-background-preset="${escapeHtml(preset.id)}">${escapeHtml(preset.label)}</button>`).join("")}
    </div>
    <div class="form-editor-grid">
      <label>
        Background top
        <input id="editor-bg-top" type="color" value="${escapeHtml(currentFormProfile.backgroundTop)}">
      </label>
      <label>
        Background bottom
        <input id="editor-bg-bottom" type="color" value="${escapeHtml(currentFormProfile.backgroundBottom)}">
      </label>
    </div>
  `)) {
    return;
  }

  document.getElementById("editor-form-title")?.addEventListener("input", event => {
    currentFormProfile = {
      ...currentFormProfile,
      formTitle: event.target.value.slice(0, 60) || DEFAULT_FORM_TITLE
    };
    refreshPreviewOnly();
  });

  document.getElementById("editor-bg-top")?.addEventListener("input", event => {
    currentFormProfile = {
      ...currentFormProfile,
      backgroundTop: event.target.value
    };
    refreshPreviewOnly();
  });

  document.getElementById("editor-bg-bottom")?.addEventListener("input", event => {
    currentFormProfile = {
      ...currentFormProfile,
      backgroundBottom: event.target.value
    };
    refreshPreviewOnly();
  });

  editorBody.querySelectorAll("[data-background-preset]").forEach(button => {
    button.addEventListener("click", () => {
      const preset = FORM_BACKGROUND_PRESETS.find(entry => entry.id === button.dataset.backgroundPreset);

      if (!preset) {
        return;
      }

      currentFormProfile = {
        ...currentFormProfile,
        backgroundTop: preset.top,
        backgroundBottom: preset.bottom
      };

      openPageEditor();
      renderBuilder();
    });
  });
}

function addCustomField(type) {
  insertFieldIntoCurrentPage(type);
}

async function saveFormProfile(options = {}) {
  const { silent = false, skipBusy = false } = options;

  if (!supabase || !currentUser) {
    if (!silent) {
      setStatus("Please sign in first.", "error");
    }
    return;
  }

  if (!skipBusy) {
    setButtonBusy(saveFormButton, true, "Saving form...");
  }

  if (!silent) {
    setStatus("");
  }
  let saved = false;

  try {
    const normalized = normalizeCustomFormProfile(currentFormProfile);
    const metadata = {
      ...(currentUser.user_metadata || {}),
      custom_form_profile: normalized
    };

    const { data, error } = await supabase.auth.updateUser({
      data: metadata
    });

    if (error) {
      throw error;
    }

    currentUser = data.user || currentUser;
    currentFormProfile = normalizeCustomFormProfile(currentUser?.user_metadata?.custom_form_profile || normalized);
    savedFormProfile = normalizeCustomFormProfile(currentFormProfile);
    renderBuilder();
    saved = true;
    if (!silent) {
      setStatus("Form saved. Send Reminder will use this custom questionnaire when you are signed in.", "success");
    }
  } catch (error) {
    setStatus(error.message || "Unable to save this form right now.", "error");
  } finally {
    if (!skipBusy) {
      setButtonBusy(saveFormButton, false);
      if (saved && !silent) {
        flashButtonConfirmation(saveFormButton, "Saved");
      }
    }
  }
}

function resetToSaved() {
  currentFormProfile = normalizeCustomFormProfile(savedFormProfile);
  selectedPreviewStepId = getPreviewSteps()[0]?.id || BASE_REMINDER_STEPS[0]?.id || "phone";
  closeEditor();
  renderBuilder();
  setStatus("Reverted to your saved form.", "info");
}

async function loadPublicConfig() {
  const response = await fetch("/api/public-config", { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Unable to load account configuration.");
  }

  return response.json();
}

function hydrateBuilderFromUser(user) {
  currentUser = user || null;
  setSignedInView(currentUser);

  if (!currentUser) {
    return;
  }

  const storedProfile = normalizeCustomFormProfile(currentUser.user_metadata?.custom_form_profile || {});
  currentFormProfile = storedProfile;
  savedFormProfile = normalizeCustomFormProfile(storedProfile);
  selectedPreviewStepId = getPreviewSteps()[0]?.id || BASE_REMINDER_STEPS[0]?.id || "phone";
  renderBuilder();
}

async function init() {
  try {
    appConfig = await loadPublicConfig();
  } catch (error) {
    setStatus(error.message || "Unable to load Form Creator.", "error");
    return;
  }

  const publicKey = appConfig.supabasePublishableKey || appConfig.supabaseAnonKey || "";

  if (!appConfig.accountsEnabled || !appConfig.supabaseUrl || !publicKey) {
    if (authSetupNotice) {
      authSetupNotice.hidden = false;
    }
    setSignedInView(null);
    return;
  }

  supabase = getSharedSupabaseClient(appConfig.supabaseUrl, publicKey, createClient);

  const {
    data: { session }
  } = await supabase.auth.getSession();

  hydrateBuilderFromUser(session?.user || null);
  if (session?.user) {
    await syncLatestUserProfile({ silent: true, preserveDirty: false });
  }
  startLatestUserSyncLoop();

  supabase.auth.onAuthStateChange((event, nextSession) => {
    if (event === "TOKEN_REFRESHED") {
      return;
    }

    hydrateBuilderFromUser(nextSession?.user || null);
  });
}

editorBackButton?.addEventListener("click", closeEditor);
editorCloseButton?.addEventListener("click", closeEditor);
statusBanner?.addEventListener("click", () => {
  setStatus("");
});
saveFormButton?.addEventListener("click", saveFormProfile);
resetFormButton?.addEventListener("click", resetToSaved);
previewPerspectiveButtons.forEach(button => {
  button.addEventListener("click", () => {
    setPreviewPerspective(button.dataset.previewPerspective || "staff");
  });
});
previewModeToggles.forEach(toggle => {
  toggle.addEventListener("change", event => {
    setPreviewOnlyMode(Boolean(event.target.checked));
  });
});
studioContextAction?.addEventListener("click", () => {
  const actionMode = studioContextAction.dataset.actionMode || "";

  if (actionMode === "close-editor") {
    closeEditor();
    return;
  }

  if (actionMode === "edit-selected") {
    openSelectedStudioInspector();
  }
});
formEnabledToggle?.addEventListener("change", async event => {
  currentFormProfile = {
    ...currentFormProfile,
    isEnabled: Boolean(event.target.checked)
  };
  renderBuilder();
  await saveFormProfile({ silent: true, skipBusy: true });
});
studioTabButtons.forEach(button => {
  button.addEventListener("click", () => {
    setActiveStudioTab(button.dataset.studioTab || "add-fields");
  });
});

window.addEventListener("focus", () => {
  syncLatestUserProfile({ silent: true, preserveDirty: true });
});

window.addEventListener("pageshow", () => {
  syncLatestUserProfile({ silent: true, preserveDirty: true });
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    syncLatestUserProfile({ silent: true, preserveDirty: true });
  }
});
globalBgTopInput?.addEventListener("input", event => {
  currentFormProfile = {
    ...currentFormProfile,
    backgroundTop: event.target.value || DEFAULT_BACKGROUND_TOP
  };
  refreshPreviewOnly();
});
globalBgBottomInput?.addEventListener("input", event => {
  currentFormProfile = {
    ...currentFormProfile,
    backgroundBottom: event.target.value || DEFAULT_BACKGROUND_BOTTOM
  };
  refreshPreviewOnly();
});
globalBgStyleSelect?.addEventListener("change", event => {
  currentFormProfile = {
    ...currentFormProfile,
    backgroundStyle: event.target.value === "solid" ? "solid" : DEFAULT_BACKGROUND_STYLE
  };
  renderBuilder();
});
globalBgSolidInput?.addEventListener("input", event => {
  currentFormProfile = {
    ...currentFormProfile,
    backgroundSolidColor: event.target.value || DEFAULT_BACKGROUND_SOLID_COLOR
  };
  refreshPreviewOnly();
});
previewBackButton?.addEventListener("click", () => {
  const steps = getPreviewSteps();
  const index = steps.findIndex(step => step.id === selectedPreviewStepId);

  if (index > 0) {
    previewStepDirection = "backward";
    selectedPreviewStepId = steps[index - 1].id;
    closeEditor();
    renderBuilder();
  }
});
previewSkipButton?.addEventListener("click", () => {
  const steps = getPreviewSteps();
  const index = steps.findIndex(step => step.id === selectedPreviewStepId);

  if (index >= 0 && index < steps.length - 1) {
    previewStepDirection = "forward";
    selectedPreviewStepId = steps[index + 1].id;
    closeEditor();
    renderBuilder();
  }
});
function movePreviewForward() {
  const steps = getPreviewSteps();
  const index = steps.findIndex(step => step.id === selectedPreviewStepId);

  if (index >= 0 && index < steps.length - 1) {
    previewStepDirection = "forward";
    selectedPreviewStepId = steps[index + 1].id;
    closeEditor();
    renderBuilder();
  }
}

previewNextButton?.addEventListener("click", movePreviewForward);

document.querySelectorAll("[data-add-type]").forEach(button => {
  button.addEventListener("click", () => addCustomField(button.dataset.addType || "text"));
  button.addEventListener("dragstart", event => {
    startDrag({
      kind: "field-template",
      fieldType: button.dataset.addType || "text"
    }, event, button);
  });
  button.addEventListener("dragend", () => {
    finishDrag(button);
  });
});

document.querySelectorAll("[data-add-step]").forEach(button => {
  button.addEventListener("click", () => {
    addEssentialFieldFromToolbar(button.dataset.addStep || "");
  });
  button.addEventListener("dragstart", event => {
    startDrag({
      kind: "essential-field-template",
      stepId: button.dataset.addStep || ""
    }, event, button);
  });
  button.addEventListener("dragend", () => {
    finishDrag(button);
  });
});

document.querySelectorAll("[data-add-page]").forEach(button => {
  button.addEventListener("click", () => addBlankPage());
  button.addEventListener("dragstart", event => {
    startDrag({
      kind: "page-template"
    }, event, button);
  });
  button.addEventListener("dragend", () => {
    finishDrag(button);
  });
});

previewStepper?.addEventListener("click", event => {
  if (suppressNextStepperClick) {
    suppressNextStepperClick = false;
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  const button = event.target.closest("[data-preview-step]");

  if (!button) {
    return;
  }

  const nextId = button.dataset.previewStep || "";
  const steps = getPreviewSteps();
  const currentIndex = steps.findIndex(step => step.id === selectedPreviewStepId);
  const nextIndex = steps.findIndex(step => step.id === nextId);
  previewStepDirection = nextIndex < currentIndex ? "backward" : "forward";
  selectedPreviewStepId = nextId;
  closeEditor();
  renderBuilder();
});

previewStepper?.addEventListener("dragover", event => {
  if (previewOnlyMode) {
    return;
  }

  if (!dragPayload || !["step", "page-template"].includes(dragPayload.kind)) {
    return;
  }

  const insertIndex = getStepInsertIndexFromTarget(event.target, event.clientX);

  if (insertIndex === null) {
    return;
  }

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  showStepDropIndicator(insertIndex);
  autoScrollPreviewStepper(event.clientX);
});

previewStepper?.addEventListener("dragleave", event => {
  if (!previewStepper.contains(event.relatedTarget)) {
    clearDragIndicators();
  }
});

previewStepper?.addEventListener("drop", event => {
  if (previewOnlyMode) {
    return;
  }

  if (!dragPayload) {
    return;
  }

  const insertIndex = getStepInsertIndexFromTarget(event.target, event.clientX);

  if (insertIndex === null) {
    return;
  }

  event.preventDefault();

  if (dragPayload.kind === "step" && dragPayload.stepId) {
    reorderStep(dragPayload.stepId, insertIndex);
  } else if (dragPayload.kind === "page-template") {
    addBlankPage(insertIndex);
  }

  finishDrag();
});

previewStepper?.addEventListener("dragstart", event => {
  if (previewOnlyMode) {
    event.preventDefault();
    return;
  }

  const button = event.target.closest?.("[data-preview-step]");
  const stepId = button?.dataset.previewStep || "";
  const step = getPreviewSteps().find(entry => entry.id === stepId);

  if (!button || !isReorderablePreviewStep(step)) {
    event.preventDefault();
    return;
  }

  startDrag({ kind: "step", stepId }, event, button);
});

previewStepper?.addEventListener("dragend", event => {
  const button = event.target.closest?.("[data-preview-step]");
  finishDrag(button);
});

previewStepper?.addEventListener("pointerdown", event => {
  maybeStartStepPointerDrag(event);
});
previewStepper?.addEventListener("mousedown", event => {
  maybeStartStepMouseDrag(event);
});

previewStepper?.addEventListener("contextmenu", event => {
  if (window.innerWidth <= MOBILE_STUDIO_BREAKPOINT) {
    event.preventDefault();
  }
});

fieldRailList?.addEventListener("pointerdown", event => {
  maybeStartFieldRailPointerDrag(event);
});

fieldRailList?.addEventListener("contextmenu", event => {
  if (window.innerWidth <= MOBILE_STUDIO_BREAKPOINT) {
    event.preventDefault();
  }
});

previewStepHost?.addEventListener("contextmenu", event => {
  if (window.innerWidth <= MOBILE_STUDIO_BREAKPOINT && event.target.closest?.("[data-sortable-field-id], .preview-stepper-button, .preview-field-dropzone")) {
    event.preventDefault();
  }
});

templateList?.addEventListener("contextmenu", event => {
  if (window.innerWidth <= MOBILE_STUDIO_BREAKPOINT) {
    event.preventDefault();
  }
});

document.querySelectorAll("[data-add-type], [data-add-step], [data-add-page]").forEach(button => {
  button.addEventListener("contextmenu", event => {
    if (window.innerWidth <= MOBILE_STUDIO_BREAKPOINT) {
      event.preventDefault();
    }
  });
});

window.addEventListener("pointermove", event => {
  handleStepPointerMove(event);
  handleFieldRailPointerMove(event);
});
window.addEventListener("mousemove", event => {
  handleStepMouseMove(event);
});

window.addEventListener("pointerup", event => {
  if (stepPointerDragState && event.pointerId === stepPointerDragState.pointerId) {
    finishStepPointerDrop();
  }

  if (fieldRailPointerDragState && event.pointerId === fieldRailPointerDragState.pointerId) {
    finishFieldRailPointerDrop();
  }
});
window.addEventListener("mouseup", () => {
  if (stepPointerDragState?.pointerId === "mouse") {
    finishStepPointerDrop();
  }
});

window.addEventListener("pointercancel", event => {
  if (stepPointerDragState && event.pointerId === stepPointerDragState.pointerId) {
    cancelStepPointerDrag();
  }

  if (fieldRailPointerDragState && event.pointerId === fieldRailPointerDragState.pointerId) {
    cancelFieldRailPointerDrag();
  }
});

previewStepHost?.addEventListener("click", event => {
  const startButton = event.target.closest("[data-preview-start-button]");

  if (startButton) {
    event.preventDefault();
    event.stopPropagation();
    movePreviewForward();
    return;
  }

  if (previewOnlyMode) {
    return;
  }

  const questionShellZone = event.target.closest("[data-question-shell-zone]");

  if (questionShellZone) {
    event.stopPropagation();
    openQuestionShellEditor();
    return;
  }

  const editTarget = event.target.closest("[data-edit-target]")?.dataset.editTarget || "";
  const editFieldId = event.target.closest("[data-edit-field-id]")?.dataset.editFieldId || "";

  if (editTarget) {
    if ((editTarget === "field-label" || editTarget === "field-help") && editFieldId) {
      openSelectedStepTextEditor(editTarget, editFieldId);
      return;
    }

    openSelectedStepTextEditor(editTarget);
    return;
  }

  const previewFieldControl = event.target.closest(".preview-field-control");

  if (previewFieldControl) {
    const fieldId = previewFieldControl.dataset.previewFieldId || "";

    if (fieldId && consumePreviewFieldDirectEdit(fieldId)) {
      return;
    }

    if (fieldId) {
      return;
    }
  }

  const clickedFieldId = event.target.closest("[data-preview-field-id]")?.dataset.previewFieldId
    || event.target.closest("[data-preview-field-group]")?.dataset.previewFieldGroup
    || "";

  if (clickedFieldId && clickedFieldId !== "review") {
    openFieldEditor(clickedFieldId);
    return;
  }

  const selectedStep = getSelectedPreviewStep();

  if (selectedStep && isSpecialPreviewScreen(selectedStep)) {
    return;
  }

  if (selectedPreviewStepId && selectedPreviewStepId !== "review") {
    openFieldEditor(selectedPreviewStepId);
  }
});
previewStepHost?.addEventListener("pointerdown", event => {
  if (previewOnlyMode) {
    return;
  }

  const previewFieldControl = event.target.closest(".preview-field-control");

  if (!previewFieldControl) {
    return;
  }

  const fieldId = previewFieldControl.dataset.previewFieldId || "";

  if (!fieldId) {
    return;
  }

  const now = Date.now();
  const isSecondTap = previewFieldTapIntent.fieldId === fieldId && now - previewFieldTapIntent.at <= PREVIEW_FIELD_DIRECT_EDIT_MS;

  if (isSecondTap) {
    previewFieldDirectEditIntent = { fieldId, expiresAt: now + PREVIEW_FIELD_DIRECT_EDIT_MS };
    previewFieldTapIntent = { fieldId: "", at: 0 };
    return;
  }

  previewFieldTapIntent = { fieldId, at: now };
  previewFieldDirectEditIntent = { fieldId: "", expiresAt: 0 };
  event.preventDefault();
  event.stopPropagation();
  openFieldEditor(fieldId);
}, true);
previewStepHost?.addEventListener("mouseover", event => {
  if (previewOnlyMode) {
    return;
  }

  const zone = event.target.closest("[data-question-shell-zone]");
  if (!zone) {
    return;
  }

  zone.closest(".question-wrap")?.classList.add("is-card-edit-hover");
});
previewStepHost?.addEventListener("mouseout", event => {
  const zone = event.target.closest("[data-question-shell-zone]");
  if (!zone) {
    return;
  }

  if (zone.contains(event.relatedTarget)) {
    return;
  }

  zone.closest(".question-wrap")?.classList.remove("is-card-edit-hover");
});

previewStepHost?.addEventListener("dragstart", event => {
  if (previewOnlyMode) {
    event.preventDefault();
    return;
  }

  const fieldCard = event.target.closest("[data-sortable-field-id]");

  if (!fieldCard) {
    return;
  }

  startDrag({
    kind: "existing-field",
    fieldId: fieldCard.dataset.sortableFieldId || ""
  }, event, fieldCard);
});

previewStepHost?.addEventListener("dragend", event => {
  const fieldCard = event.target.closest("[data-sortable-field-id]");
  finishDrag(fieldCard || null);
});

previewStepHost?.addEventListener("dragover", event => {
  if (previewOnlyMode) {
    return;
  }

  const dropzone = event.target.closest("[data-drop-field-index]");

  if (!dropzone || !dragPayload || !["existing-field", "field-template", "essential-field-template"].includes(dragPayload.kind)) {
    return;
  }

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
});

previewStepHost?.addEventListener("dragenter", event => {
  if (previewOnlyMode) {
    return;
  }

  const dropzone = event.target.closest("[data-drop-field-index]");

  if (!dropzone || !dragPayload || !["existing-field", "field-template", "essential-field-template"].includes(dragPayload.kind)) {
    return;
  }

  clearDragIndicators();
  dropzone.classList.add("is-over");
});

previewStepHost?.addEventListener("dragleave", event => {
  const dropzone = event.target.closest("[data-drop-field-index]");

  if (!dropzone || !dropzone.contains(event.relatedTarget)) {
    dropzone?.classList.remove("is-over");
  }
});

previewStepHost?.addEventListener("drop", event => {
  if (previewOnlyMode) {
    return;
  }

  const dropzone = event.target.closest("[data-drop-field-index]");

  if (!dropzone || !dragPayload) {
    return;
  }

  const insertIndex = Number(dropzone.dataset.dropFieldIndex || "0");
  event.preventDefault();

  if (dragPayload.kind === "existing-field" && dragPayload.fieldId) {
    reorderCurrentPageField(dragPayload.fieldId, insertIndex);
  } else if (dragPayload.kind === "field-template" && dragPayload.fieldType) {
    insertFieldIntoCurrentPage(dragPayload.fieldType, insertIndex);
  } else if (dragPayload.kind === "essential-field-template" && dragPayload.stepId) {
    insertEssentialFieldIntoCurrentPage(dragPayload.stepId, { insertIndex });
  }

  finishDrag();
});

previewShellZones.forEach(zone => {
  zone.addEventListener("mouseenter", () => {
    if (previewOnlyMode) {
      return;
    }

    previewShell?.classList.add("is-shell-edit-hover");
  });

  zone.addEventListener("mouseleave", () => {
    previewShell?.classList.remove("is-shell-edit-hover");
  });

  zone.addEventListener("click", event => {
    if (previewOnlyMode) {
      return;
    }

    event.stopPropagation();
    openFormShellEditor();
  });
});

previewTitle?.addEventListener("click", () => {
  if (previewOnlyMode) {
    return;
  }

  openPageTitleEditor();
});
previewStepTitle?.addEventListener("click", () => {
  if (previewOnlyMode) {
    return;
  }

  const selectedStep = getSelectedPreviewStep();

  if (selectedStep && !isSpecialPreviewScreen(selectedStep) && selectedStep.type !== "review") {
    openCustomPageEditor(selectedStep);
    return;
  }

  openSelectedStepTextEditor("step-title");
});
previewStepCopy?.addEventListener("click", () => {
  if (previewOnlyMode) {
    return;
  }

  const selectedStep = getSelectedPreviewStep();

  if (selectedStep && !isSpecialPreviewScreen(selectedStep) && selectedStep.type !== "review") {
    openCustomPageEditor(selectedStep);
    return;
  }

  openSelectedStepTextEditor("step-copy");
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeEditor();
  }
});

bindPreviewHoverTargets(document);

if (editorHead) {
  editorHead.addEventListener("pointerdown", event => {
    if (editorPopover?.closest("#form-studio-panel")) {
      return;
    }

    if (window.innerWidth <= 760) {
      return;
    }

    if (event.target instanceof HTMLElement && event.target.closest("button, input, select, textarea, label, a")) {
      return;
    }

    if (!editorPopover || editorPopover.hidden) {
      return;
    }

    const rect = editorPopover.getBoundingClientRect();
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

if (studioPanelHandle && studioPanel) {
  studioPanelHandle.addEventListener("pointerdown", event => {
    if (window.innerWidth <= MOBILE_STUDIO_BREAKPOINT) {
      return;
    }

    if (event.target instanceof HTMLElement && event.target.closest("button, input, select, textarea, label, a")) {
      return;
    }

    const rect = studioPanel.getBoundingClientRect();
    studioPanelDragState = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      pointerId: event.pointerId
    };

    studioPanelHasCustomFrame = true;
    studioPanelHandle.classList.add("is-dragging");
    studioPanelHandle.setPointerCapture?.(event.pointerId);
    setStudioPanelSize(rect.width, rect.height);
    setStudioPanelPosition(rect.left, rect.top);
    event.preventDefault();
  });

  studioPanelHandle.addEventListener("pointermove", event => {
    if (!studioPanelDragState || studioPanelDragState.pointerId !== event.pointerId) {
      return;
    }

    setStudioPanelPosition(
      event.clientX - studioPanelDragState.offsetX,
      event.clientY - studioPanelDragState.offsetY
    );
  });

  const stopStudioPanelDragging = event => {
    if (!studioPanelDragState || studioPanelDragState.pointerId !== event.pointerId) {
      return;
    }

    studioPanelHandle.releasePointerCapture?.(event.pointerId);
    studioPanelHandle.classList.remove("is-dragging");
    studioPanelDragState = null;
  };

  studioPanelHandle.addEventListener("pointerup", stopStudioPanelDragging);
  studioPanelHandle.addEventListener("pointercancel", stopStudioPanelDragging);
}

if (studioPanelResizeHandle && studioPanel) {
  studioPanelResizeHandle.addEventListener("pointerdown", event => {
    if (window.innerWidth <= MOBILE_STUDIO_BREAKPOINT) {
      return;
    }

    const rect = studioPanel.getBoundingClientRect();
    studioPanelResizeState = {
      startX: event.clientX,
      startY: event.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
      startLeft: rect.left,
      startTop: rect.top,
      pointerId: event.pointerId
    };

    studioPanelHasCustomFrame = true;
    setStudioPanelPosition(rect.left, rect.top);
    setStudioPanelSize(rect.width, rect.height);
    studioPanelResizeHandle.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  studioPanelResizeHandle.addEventListener("pointermove", event => {
    if (!studioPanelResizeState || studioPanelResizeState.pointerId !== event.pointerId) {
      return;
    }

    const nextWidth = studioPanelResizeState.startWidth + (event.clientX - studioPanelResizeState.startX);
    const nextHeight = studioPanelResizeState.startHeight + (event.clientY - studioPanelResizeState.startY);

    setStudioPanelSize(nextWidth, nextHeight);
    setStudioPanelPosition(studioPanelResizeState.startLeft, studioPanelResizeState.startTop);
  });

  const stopStudioPanelResizing = event => {
    if (!studioPanelResizeState || studioPanelResizeState.pointerId !== event.pointerId) {
      return;
    }

    studioPanelResizeHandle.releasePointerCapture?.(event.pointerId);
    studioPanelResizeState = null;
  };

  studioPanelResizeHandle.addEventListener("pointerup", stopStudioPanelResizing);
  studioPanelResizeHandle.addEventListener("pointercancel", stopStudioPanelResizing);
}

if (studioPanel) {
  studioPanel.addEventListener("scroll", () => {
    if (window.innerWidth <= MOBILE_STUDIO_BREAKPOINT && studioPanel.scrollTop > 18) {
      studioPanelScrollDiscovered = true;
    }

    updateStudioPanelOverflowState();
  }, { passive: true });
}

mobileStudioSize = normalizeMobileStudioSize(readStoredStudioValue(MOBILE_STUDIO_SIZE_STORAGE_KEY));
const storedMobileStudioHeight = Number(readStoredStudioValue(MOBILE_STUDIO_HEIGHT_STORAGE_KEY));
mobileStudioHeightOverride = Number.isFinite(storedMobileStudioHeight) && storedMobileStudioHeight > 0
  ? storedMobileStudioHeight
  : null;
syncMobileStudioSizeButtons();

mobileStudioSizeButtons.forEach(button => {
  button.addEventListener("click", () => {
    setMobileStudioSize(button.dataset.mobileStudioSize || "balanced");
  });
});

if (studioMobileResizeHandle && studioPanel) {
  studioMobileResizeHandle.addEventListener("pointerdown", event => {
    if (window.innerWidth > MOBILE_STUDIO_BREAKPOINT) {
      return;
    }

    const rect = studioPanel.getBoundingClientRect();
    studioPanelMobileResizeState = {
      startY: event.clientY,
      startHeight: rect.height,
      pointerId: event.pointerId,
      didDrag: false
    };
    studioPanel.classList.add("is-mobile-resizing");
    studioMobileResizeHandle.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  studioMobileResizeHandle.addEventListener("pointermove", event => {
    if (!studioPanelMobileResizeState || studioPanelMobileResizeState.pointerId !== event.pointerId) {
      return;
    }

    const { minPanelHeight, maxPanelHeight, collapseSnapThreshold } = getMobileStudioMetrics();
    const deltaY = event.clientY - studioPanelMobileResizeState.startY;
    if (Math.abs(deltaY) > 8) {
      studioPanelMobileResizeState.didDrag = true;
    }
    let nextHeight = clampMobileStudioHeight(
      studioPanelMobileResizeState.startHeight - deltaY,
      minPanelHeight,
      maxPanelHeight
    );

    if (nextHeight <= collapseSnapThreshold) {
      nextHeight = minPanelHeight;
    } else {
      rememberExpandedMobileStudioState({
        kind: "override",
        height: nextHeight
      });
    }

    mobileStudioHeightOverride = nextHeight;
    mobileStudioResumeState = null;
    writeStoredStudioValue(MOBILE_STUDIO_HEIGHT_STORAGE_KEY, nextHeight);
    applyMobileStudioScale();
    updateStudioPanelOverflowState();
  });

  const stopMobileStudioResizing = event => {
    if (!studioPanelMobileResizeState || studioPanelMobileResizeState.pointerId !== event.pointerId) {
      return;
    }

    const didDrag = Boolean(studioPanelMobileResizeState.didDrag);
    studioMobileResizeHandle.releasePointerCapture?.(event.pointerId);
    studioPanelMobileResizeState = null;
    studioPanel.classList.remove("is-mobile-resizing");
    suppressNextMobileStudioHandleClick = didDrag;

    const effectiveHeight = getEffectiveMobileStudioHeight();

    if (effectiveHeight != null) {
      const { collapseSnapThreshold } = getMobileStudioMetrics();

      if (effectiveHeight <= collapseSnapThreshold) {
        setMobileStudioSize("peek");
        updateStudioPanelOverflowState();
        return;
      }
    }

    applyMobileStudioScale();
    updateStudioPanelOverflowState();
  };

  studioMobileResizeHandle.addEventListener("pointerup", stopMobileStudioResizing);
  studioMobileResizeHandle.addEventListener("pointercancel", stopMobileStudioResizing);
  studioMobileResizeHandle.addEventListener("click", event => {
    if (window.innerWidth > MOBILE_STUDIO_BREAKPOINT) {
      return;
    }

    event.preventDefault();
    if (suppressNextMobileStudioHandleClick) {
      suppressNextMobileStudioHandleClick = false;
      return;
    }

    toggleMobileStudioCollapsed();
  });
  studioMobileResizeHandle.addEventListener("keydown", event => {
    if (window.innerWidth > MOBILE_STUDIO_BREAKPOINT) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    toggleMobileStudioCollapsed();
  });
}

window.addEventListener("resize", () => {
  applyMobileStudioScale();

  if (studioPanel) {
    if (window.innerWidth <= MOBILE_STUDIO_BREAKPOINT) {
      resetStudioPanelFrame();
    } else if (studioPanelHasCustomFrame) {
      const rect = studioPanel.getBoundingClientRect();
      setStudioPanelSize(rect.width, rect.height);
      setStudioPanelPosition(rect.left, rect.top);
    }
  }

  if (!editorPopover || editorPopover.hidden) {
    return;
  }

  if (window.innerWidth <= 760) {
    resetEditorPosition();
    return;
  }

  if (editorHasCustomPosition) {
    const rect = editorPopover.getBoundingClientRect();
    setEditorPosition(rect.left, rect.top);
  }

  updateStudioPanelOverflowState();
});

renderBuilder();
init();
