import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import {
  BASE_REMINDER_STEPS,
  CUSTOM_FIELD_TYPES,
  FORM_BACKGROUND_PRESETS,
  FORM_SURFACE_GRADIENT_OPTIONS,
  DEFAULT_FORM_TITLE,
  DEFAULT_FORM_SURFACE_COLOR,
  DEFAULT_FORM_SURFACE_ACCENT_COLOR,
  DEFAULT_FORM_SURFACE_GRADIENT,
  DEFAULT_FORM_TEXT_COLOR,
  DEFAULT_FORM_TITLE_FONT_SIZE,
  DEFAULT_STEP_TITLE_FONT_SIZE,
  DEFAULT_STEP_COPY_FONT_SIZE,
  DEFAULT_FIELD_LABEL_FONT_SIZE,
  DEFAULT_FIELD_HELP_FONT_SIZE,
  DEFAULT_STEP_NAV_BACKGROUND,
  DEFAULT_STEP_NAV_ACTIVE_BACKGROUND,
  DEFAULT_STEP_NAV_TEXT_COLOR,
  DEFAULT_STEP_NAV_ACTIVE_TEXT_COLOR,
  normalizeCustomFormProfile,
  createCustomField,
  createCustomPage,
  buildPreviewStepList,
  getInlineFieldsForPage,
  getCustomFieldTypeMeta,
  getBackgroundPresetMatch,
  isDefaultRememberedClientField
} from "./custom-form-profile.js?v=20260408a";

const statusBanner = document.getElementById("status-banner");
const authSetupNotice = document.getElementById("auth-setup-notice");
const signedOutShell = document.getElementById("signed-out-shell");
const signedInShell = document.getElementById("signed-in-shell");
const formCreatorCanvas = document.getElementById("form-creator-canvas");
const pricePill = document.getElementById("price-pill");
const saveFormButton = document.getElementById("save-form-button");
const resetFormButton = document.getElementById("reset-form-button");
const formEnabledToggle = document.getElementById("form-enabled-toggle");
const fieldRailList = document.getElementById("field-rail-list");
const templateList = document.getElementById("template-list");
const previewShell = document.getElementById("form-preview-shell");
const previewShellZones = Array.from(document.querySelectorAll("[data-form-shell-zone]"));
const previewTitle = document.getElementById("form-preview-title");
const previewStepCount = document.getElementById("preview-step-count");
const previewStepPill = document.getElementById("preview-step-pill");
const previewStepTitle = document.getElementById("preview-step-title");
const previewStepCopy = document.getElementById("preview-step-copy");
const previewProgressFill = document.getElementById("preview-progress-fill");
const previewStepper = document.getElementById("preview-stepper");
const previewStepHost = document.getElementById("preview-step-host");
const previewBackButton = document.getElementById("preview-back-button");
const previewSkipButton = document.getElementById("preview-skip-button");
const previewNextButton = document.getElementById("preview-next-button");
const pageSettingsButton = document.getElementById("page-settings-button");
const editorPopover = document.getElementById("form-editor-popover");
const editorHead = editorPopover?.querySelector(".form-editor-head") || null;
const editorTitle = document.getElementById("form-editor-title");
const editorCopy = document.getElementById("form-editor-copy");
const editorBody = document.getElementById("form-editor-body");
const editorCloseButton = document.getElementById("form-editor-close");

let supabase = null;
let appConfig = null;
let currentUser = null;
let currentFormProfile = normalizeCustomFormProfile({});
let savedFormProfile = normalizeCustomFormProfile({});
let selectedPreviewStepId = BASE_REMINDER_STEPS[0]?.id || "phone";
let dragFieldId = "";
let editorDragState = null;
let editorHasCustomPosition = false;
let dragPayload = null;

const MOBILE_STUDIO_BREAKPOINT = 1040;
const MOBILE_CANVAS_WIDTH = 1088;
const MOBILE_CANVAS_HEIGHT = 980;

function buildTemplateField(config) {
  const base = createCustomField(config.type || "text");

  return {
    ...base,
    id: config.id,
    type: config.type || base.type,
    title: config.title || config.label || base.title,
    copy: config.copy || config.helpText || "",
    label: config.label || base.label,
    navLabel: safeShortLabel(config.navLabel || config.label || base.navLabel),
    placeholder: typeof config.placeholder === "string" ? config.placeholder : base.placeholder,
    helpText: config.helpText || "",
    required: Boolean(config.required)
  };
}

const FORM_TEMPLATE_LIBRARY = [
  {
    id: "barbershop",
    name: "Barbershop",
    subtitle: "Cuts, beard trims, and stylist preferences",
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
          helpText: "Useful when shops route bookings by barber."
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
    subtitle: "Breed, temperament, and grooming care details",
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
          required: true
        }),
        buildTemplateField({
          id: "custom_pet_breed",
          type: "text",
          label: "Breed / Size",
          navLabel: "Breed",
          placeholder: "Breed, weight, or size",
          helpText: "Breed and size help groomers estimate timing and coat needs.",
          required: true
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
    subtitle: "Pressure, focus areas, and wellness intake",
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
          required: true
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
    subtitle: "Home size, access details, and cleaning scope",
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
          required: true
        }),
        buildTemplateField({
          id: "custom_pets_home",
          type: "text",
          label: "Pets in the Home",
          navLabel: "Pets",
          placeholder: "Dog, cat, none, or crate info",
          helpText: "Helpful for access and cleaning planning."
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
    subtitle: "Vehicle info, package selection, and service setup",
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
          required: true
        }),
        buildTemplateField({
          id: "custom_vehicle_year",
          type: "text",
          label: "Vehicle Year",
          navLabel: "Year",
          placeholder: "Example: 2021"
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
  const tier = getTierKey(user);

  if (tier === "bronze") {
    return "Bronze";
  }

  if (tier === "free") {
    return "FREE";
  }

  return tier ? `${tier.charAt(0).toUpperCase()}${tier.slice(1)}` : "FREE";
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

function getCustomPages() {
  return Array.isArray(currentFormProfile.customPages) ? currentFormProfile.customPages : [];
}

function getPreviewSteps() {
  return buildPreviewStepList(currentFormProfile);
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

  return getPreviewSteps().find(step => step.id === stepId)
    || getCustomFields().find(field => field.id === stepId)
    || getCustomPages().find(page => page.id === stepId)
    || null;
}

function getCurrentPageId() {
  return selectedPreviewStepId;
}

function getCurrentPageFields() {
  const page = getEditableStep(getCurrentPageId());

  if (!page || page.id === "review") {
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
  const orderedIds = Array.isArray(currentFormProfile.pageFieldOrder?.[page.id]) ? currentFormProfile.pageFieldOrder[page.id] : [];

  if (!orderedIds.length) {
    return allFields;
  }

  const fieldMap = new Map(allFields.map(field => [field.id, field]));
  const orderedFields = [];

  orderedIds.forEach(id => {
    const field = fieldMap.get(id);

    if (field) {
      orderedFields.push(field);
      fieldMap.delete(id);
    }
  });

  allFields.forEach(field => {
    if (fieldMap.has(field.id)) {
      orderedFields.push(field);
      fieldMap.delete(field.id);
    }
  });

  return orderedFields;
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
  return getPreviewSteps().filter(step => step.id !== "review").map(step => step.id);
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

  if (!currentPageId || currentPageId === "review") {
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

function clearDragIndicators() {
  document.querySelectorAll(".preview-field-dropzone.is-over, .preview-step-dropzone.is-over").forEach(zone => {
    zone.classList.remove("is-over");
  });
}

function startDrag(payload, event, draggedElement = null) {
  dragPayload = payload;

  if (payload?.kind === "existing-field") {
    dragFieldId = payload.fieldId || "";
  }

  if (previewStepper) {
    previewStepper.classList.toggle("is-dragging-steps", payload?.kind === "step" || payload?.kind === "page-template");
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

  previewStepper?.classList.remove("is-dragging-steps");

  if (draggedElement) {
    draggedElement.classList.remove("is-dragging");
  }
}

function reorderCurrentPageField(fieldId, insertIndex) {
  const currentPageId = getCurrentPageId();

  if (!currentPageId || currentPageId === "review") {
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

  if (pricePill) {
    pricePill.textContent = isSignedIn ? `${getTierLabel(user)} account` : "Signed in tool";
  }
}

function applyBackgroundToPreview() {
  if (!previewShell) {
    return;
  }

  previewShell.style.setProperty("--fc-bg-top", currentFormProfile.backgroundTop);
  previewShell.style.setProperty("--fc-bg-bottom", currentFormProfile.backgroundBottom);
  previewShell.style.setProperty("--fc-form-surface-background", buildFormSurfaceBackground(currentFormProfile));
  previewShell.style.setProperty("--fc-form-text-main", currentFormProfile.formTextColor || DEFAULT_FORM_TEXT_COLOR);
  previewShell.style.setProperty("--fc-form-text-soft", currentFormProfile.formTextColor || DEFAULT_FORM_TEXT_COLOR);
}

function applyStepNavigationStyles() {
  if (!previewStepper) {
    return;
  }

  previewStepper.style.setProperty("--fc-step-nav-bg", currentFormProfile.stepNavBackgroundColor || DEFAULT_STEP_NAV_BACKGROUND);
  previewStepper.style.setProperty("--fc-step-nav-active-bg", currentFormProfile.stepNavActiveBackgroundColor || DEFAULT_STEP_NAV_ACTIVE_BACKGROUND);
  previewStepper.style.setProperty("--fc-step-nav-text", currentFormProfile.stepNavTextColor || DEFAULT_STEP_NAV_TEXT_COLOR);
  previewStepper.style.setProperty("--fc-step-nav-active-text", currentFormProfile.stepNavActiveTextColor || DEFAULT_STEP_NAV_ACTIVE_TEXT_COLOR);
  previewStepper.classList.add("is-group-editable");
}

function buildPreviewFieldControlMarkup(field, options = {}) {
  const isRequired = field.required === true;
  const badge = isRequired
    ? `<span class="label-badge required">Required</span>`
    : `<span class="label-badge">Optional</span>`;
  const fieldLabel = field.label || field.title || "Custom Question";
  const fieldType = field.type || "text";
  const placeholder = escapeHtml(field.placeholder || (fieldType === "textarea" ? "Type your answer" : ""));

  const inputMarkup = fieldType === "textarea"
    ? `<textarea class="preview-field-control" data-preview-field-id="${escapeHtml(field.id)}" placeholder="${placeholder}"></textarea>`
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

function buildPreviewFieldMarkup(step) {
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

  const currentPageFields = getCurrentPageFields();
  const visibleFields = currentPageFields.length
    ? currentPageFields
    : (step.baseFieldHidden ? [] : [{ ...step, isBaseField: true }]);
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
      ${fieldMarkup}
    </div>
  `;
}

function renderPreview() {
  const steps = getPreviewSteps();
  const selectedStep = getSelectedPreviewStep();

  if (!selectedStep) {
    return;
  }

  const selectedIndex = Math.max(0, steps.findIndex(step => step.id === selectedStep.id));
  const isRequired = selectedStep.type === "review"
    ? true
    : getCurrentPageFields().some(field => field.required) || selectedStep.required === true;

  if (previewTitle) {
    previewTitle.textContent = currentFormProfile.formTitle || DEFAULT_FORM_TITLE;
    previewTitle.style.fontSize = `${currentFormProfile.formTitleFontSize || DEFAULT_FORM_TITLE_FONT_SIZE}px`;
    previewTitle.style.fontWeight = currentFormProfile.formTitleBold === false ? "500" : "800";
  }

  if (previewStepCount) {
    previewStepCount.textContent = `Step ${selectedIndex + 1} of ${steps.length}`;
  }

  if (previewStepPill) {
    previewStepPill.textContent = isRequired ? "Required" : "Optional";
    previewStepPill.classList.toggle("is-required", isRequired);
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
    previewStepper.innerHTML = steps.map((step, index) => `
      <div class="preview-step-dropzone" data-drop-step-index="${index}"></div>
      <button class="preview-stepper-button ${step.id === selectedStep.id ? "is-active" : ""}" type="button" data-preview-step="${escapeHtml(step.id)}" draggable="${step.id === "review" ? "false" : "true"}">
        <span class="preview-stepper-circle">${escapeHtml(step.icon || String(index + 1))}</span>
        <span class="preview-stepper-label" data-edit-target="step-nav-label">${escapeHtml(step.navLabel)}</span>
      </button>
    `).join("") + `<div class="preview-step-dropzone" data-drop-step-index="${steps.filter(step => step.id !== "review").length}"></div>`;
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
    previewNextButton.textContent = selectedIndex === steps.length - 2 ? "Review" : "Next";
    previewNextButton.disabled = selectedIndex >= steps.length - 1;
  }

  applyBackgroundToPreview();
  applyStepNavigationStyles();
}

function renderFieldRail() {
  if (!fieldRailList) {
    return;
  }

  const fields = getCurrentPageFields();
  const currentPage = getSelectedPreviewStep();

  if (!currentPage || currentPage.id === "review") {
    fieldRailList.innerHTML = `
      <div class="field-rail-card is-empty">
        <span class="field-rail-icon">+</span>
        <div class="field-rail-body">
          <span class="field-rail-title">Review step selected</span>
          <span class="field-rail-meta">Add fields from any question page, not from the review step.</span>
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
          <span class="field-rail-title">No fields on this page</span>
          <span class="field-rail-meta">Use the add buttons above to place new questions on the current page.</span>
        </div>
      </div>
    `;
    return;
  }

  fieldRailList.innerHTML = fields.map(field => {
    const meta = getCustomFieldTypeMeta(field.type);
    const fieldMeta = `${escapeHtml(meta.label)}${field.required ? " - required" : ""}`;
    return `
      <button
        class="field-rail-card ${field.isBaseField ? "is-built-in" : ""}"
        type="button"
        draggable="true"
        data-field-id="${escapeHtml(field.id)}"
      >
        <span class="field-rail-icon">${escapeHtml(meta.icon)}</span>
        <span class="field-rail-body">
          <span class="field-rail-title">${escapeHtml(field.label || field.title || "Field")}</span>
          <span class="field-rail-meta">${fieldMeta}</span>
        </span>
        ${field.required ? `<span class="field-rail-required">Req</span>` : ""}
      </button>
    `;
  }).join("");

  fieldRailList.querySelectorAll("[data-field-id]").forEach(card => {
    const fieldId = card.dataset.fieldId || "";

    card.addEventListener("click", () => {
      closeEditor();
      openFieldEditor(fieldId);
    });

    card.addEventListener("dragstart", event => {
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
    <button class="form-template-card ${currentFormProfile.templateId === template.id ? "is-active" : ""}" type="button" data-template-id="${escapeHtml(template.id)}">
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

function renderBuilder() {
  const steps = getPreviewSteps();

  if (!steps.some(step => step.id === selectedPreviewStepId)) {
    selectedPreviewStepId = steps[0]?.id || "review";
  }

  if (formEnabledToggle) {
    formEnabledToggle.checked = currentFormProfile.isEnabled !== false;
  }
  renderFieldRail();
  renderFormTemplates();
  renderPreview();
  applyMobileStudioScale();
}

function closeEditor() {
  if (!editorPopover) {
    return;
  }

  editorPopover.hidden = true;
  editorBody.innerHTML = "";
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
  const clampedTop = Math.min(Math.max(96, top), Math.max(96, window.innerHeight - height - 12));

  editorPopover.style.setProperty("--fc-editor-left", `${clampedLeft}px`);
  editorPopover.style.setProperty("--fc-editor-top", `${clampedTop}px`);
  editorPopover.style.setProperty("--fc-editor-right", "auto");
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
    return;
  }

  const widthPadding = window.innerWidth <= 720 ? 16 : 24;
  const heightAllowance = Math.max(360, window.innerHeight - 132);
  const widthScale = (window.innerWidth - widthPadding) / MOBILE_CANVAS_WIDTH;
  const heightScale = heightAllowance / MOBILE_CANVAS_HEIGHT;
  const nextScale = Math.max(0.34, Math.min(widthScale, heightScale, 1));

  signedInShell.style.setProperty("--fc-mobile-canvas-scale", nextScale.toFixed(3));
  signedInShell.style.setProperty("--fc-mobile-canvas-width", `${MOBILE_CANVAS_WIDTH}px`);
  signedInShell.style.setProperty("--fc-mobile-canvas-height", `${MOBILE_CANVAS_HEIGHT}px`);
  signedInShell.style.setProperty("--fc-mobile-canvas-scaled-height", `${Math.ceil(MOBILE_CANVAS_HEIGHT * nextScale)}px`);
}

function openTypographyEditor(config) {
  if (!editorPopover || !editorBody) {
    return;
  }

  editorPopover.hidden = false;
  editorTitle.textContent = config.title;
  editorCopy.textContent = config.copy;
  editorBody.innerHTML = `
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
  `;

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
  const step = getEditableStep(fieldId);
  const customField = getCustomFields().find(entry => entry.id === fieldId) || null;
  const isBuiltInStep = Boolean(step?.builtIn && step.id !== "review");
  const isCustomField = Boolean(customField);
  const isAutoRememberedBuiltIn = isBuiltInStep && isDefaultRememberedClientField(fieldId);
  const shouldShowRememberToggle = isCustomField || isAutoRememberedBuiltIn;
  const rememberToggleChecked = isCustomField
    ? step?.rememberClientAnswer === true
    : isAutoRememberedBuiltIn;
  const rememberToggleDisabled = isAutoRememberedBuiltIn;

  if ((!isBuiltInStep && !isCustomField) || !step || !editorPopover || !editorBody) {
    return;
  }

  editorPopover.hidden = false;
  editorTitle.textContent = "Question settings";
  editorCopy.textContent = "Rename this question and control how it appears in Send Reminder.";
  editorBody.innerHTML = `
    <label>
      Question title
      <input id="editor-field-label" type="text" value="${escapeHtml(step.label || "")}" maxlength="60">
    </label>
    ${isCustomField ? `
      <label>
        Field type
        <select id="editor-field-type">
          ${CUSTOM_FIELD_TYPES.map(option => `<option value="${escapeHtml(option.id)}" ${option.id === step.type ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
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
    ${shouldShowRememberToggle ? `
      <label class="toggle-row">
        <span>Remember this answer for future visits and show it in Client Details</span>
        <input id="editor-field-remember-answer" type="checkbox" ${rememberToggleChecked ? "checked" : ""} ${rememberToggleDisabled ? "disabled" : ""}>
      </label>
      <div class="editor-inline-note">${isAutoRememberedBuiltIn
        ? "This built-in client field is already remembered automatically."
        : "Turn this on if this custom answer should be saved on the client profile for future appointments."}</div>
    ` : ""}
    ${(isCustomField || isBuiltInStep) ? `<button id="editor-delete-field" class="delete-field-button" type="button">${isBuiltInStep ? "Remove this field from the form" : "Delete this question"}</button>` : ""}
  `;

  const labelInput = document.getElementById("editor-field-label");
  const typeSelect = document.getElementById("editor-field-type");
  const placeholderInput = document.getElementById("editor-field-placeholder");
  const helpInput = document.getElementById("editor-field-help");
  const rememberInput = document.getElementById("editor-field-remember-answer");
  const deleteButton = document.getElementById("editor-delete-field");

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
          } else if (!nextField.placeholder) {
            nextField.placeholder = nextMeta.placeholder;
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
  });

  placeholderInput?.addEventListener("input", event => {
    patchField({ placeholder: event.target.value.slice(0, 120) });
  });

  helpInput?.addEventListener("input", event => {
    patchField({ helpText: event.target.value.slice(0, 160) });
  });

  rememberInput?.addEventListener("change", event => {
    if (!isCustomField) {
      return;
    }

    patchField({ rememberClientAnswer: Boolean(event.target.checked) });
  });

  deleteButton?.addEventListener("click", () => {
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
  });
}

function safeShortLabel(value) {
  const trimmed = String(value || "").trim();
  return trimmed.slice(0, 12) || "Custom";
}

function openPageTitleEditor() {
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
  if (!editorPopover || !editorBody) {
    return;
  }

  const editableSteps = getPreviewSteps().filter(step => step.id !== "review");

  if (!editableSteps.length) {
    return;
  }

  editorPopover.hidden = false;
  editorTitle.textContent = "Step labels";
  editorCopy.textContent = "Edit every step chip here and set the shared colors for the whole step row.";
  editorBody.innerHTML = `
    <div class="form-editor-grid">
      <label>
        Default box color
        <input id="editor-step-nav-bg" type="color" value="${escapeHtml(currentFormProfile.stepNavBackgroundColor || DEFAULT_STEP_NAV_BACKGROUND)}">
      </label>
      <label>
        Default text color
        <input id="editor-step-nav-text-color" type="color" value="${escapeHtml(currentFormProfile.stepNavTextColor || DEFAULT_STEP_NAV_TEXT_COLOR)}">
      </label>
      <label>
        Active box color
        <input id="editor-step-nav-active-bg" type="color" value="${escapeHtml(currentFormProfile.stepNavActiveBackgroundColor || DEFAULT_STEP_NAV_ACTIVE_BACKGROUND)}">
      </label>
      <label>
        Active text color
        <input id="editor-step-nav-active-text" type="color" value="${escapeHtml(currentFormProfile.stepNavActiveTextColor || DEFAULT_STEP_NAV_ACTIVE_TEXT_COLOR)}">
      </label>
    </div>
    <div class="step-nav-editor-list">
      ${editableSteps.map(step => `
        <label class="step-nav-editor-item">
          <span
            class="step-nav-editor-chip"
            style="--chip-bg:${escapeHtml(currentFormProfile.stepNavBackgroundColor || DEFAULT_STEP_NAV_BACKGROUND)};--chip-text:${escapeHtml(currentFormProfile.stepNavTextColor || DEFAULT_STEP_NAV_TEXT_COLOR)};"
          >${escapeHtml(step.navLabel || step.title || step.label || "Step")}</span>
          <input data-step-nav-text-input type="text" data-step-id="${escapeHtml(step.id)}" value="${escapeHtml(step.navLabel || "")}" maxlength="12">
        </label>
      `).join("")}
    </div>
  `;

  const syncStepNavEditorChips = () => {
    editorBody.querySelectorAll(".step-nav-editor-chip").forEach(chip => {
      chip.style.setProperty("--chip-bg", currentFormProfile.stepNavBackgroundColor || DEFAULT_STEP_NAV_BACKGROUND);
      chip.style.setProperty("--chip-text", currentFormProfile.stepNavTextColor || DEFAULT_STEP_NAV_TEXT_COLOR);
    });
  };

  syncStepNavEditorChips();

  document.getElementById("editor-step-nav-bg")?.addEventListener("input", event => {
    currentFormProfile = {
      ...currentFormProfile,
      stepNavBackgroundColor: event.target.value
    };
    syncStepNavEditorChips();
    renderBuilder();
  });

  document.getElementById("editor-step-nav-text-color")?.addEventListener("input", event => {
    currentFormProfile = {
      ...currentFormProfile,
      stepNavTextColor: event.target.value
    };
    syncStepNavEditorChips();
    renderBuilder();
  });

  document.getElementById("editor-step-nav-active-bg")?.addEventListener("input", event => {
    currentFormProfile = {
      ...currentFormProfile,
      stepNavActiveBackgroundColor: event.target.value
    };
    renderBuilder();
  });

  document.getElementById("editor-step-nav-active-text")?.addEventListener("input", event => {
    currentFormProfile = {
      ...currentFormProfile,
      stepNavActiveTextColor: event.target.value
    };
    renderBuilder();
  });

  editorBody.querySelectorAll("[data-step-nav-text-input]").forEach(input => {
    input.addEventListener("input", event => {
      const stepId = event.target.dataset.stepId || "";

      if (!stepId) {
        return;
      }

      patchStepConfig(stepId, {
        navLabel: safeShortLabel(event.target.value)
      });
      const previewChip = event.target.closest(".step-nav-editor-item")?.querySelector(".step-nav-editor-chip");
      if (previewChip) {
        previewChip.textContent = safeShortLabel(event.target.value);
      }
      renderBuilder();
    });
  });
}

function openSelectedStepTextEditor(target, fieldIdOverride = "") {
  const step = fieldIdOverride ? getEditableStep(fieldIdOverride) : getSelectedPreviewStep();

  if (!step) {
    return;
  }

  if (target === "step-nav-label") {
    openStepNavigationEditor();
    return;
  }

  if (target === "step-title") {
    openTypographyEditor({
      title: "Step title",
      copy: "Edit the large question title for this step.",
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
      copy: "Edit the supporting sentence below the question title.",
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

    editorPopover.hidden = false;
    editorTitle.textContent = "Field label";
    editorCopy.textContent = "Edit the question label and whether this field is required.";
    editorBody.innerHTML = `
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
    `;

    const labelTextInput = document.getElementById("editor-label-text");
    const labelSizeInput = document.getElementById("editor-label-size");
    const labelSizeNumberInput = document.getElementById("editor-label-size-number");
    const labelBoldInput = document.getElementById("editor-label-bold");
    const labelRequiredInput = document.getElementById("editor-label-required");

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
  if (!editorPopover || !editorBody) {
    return;
  }

  editorPopover.hidden = false;
  editorTitle.textContent = "Form box style";
  editorCopy.textContent = "Change the full form card color, gradient, and overall text color for Send Reminder.";
  editorBody.innerHTML = `
    <div class="form-editor-grid">
      <label>
        Form color
        <input id="editor-surface-base" type="color" value="${escapeHtml(currentFormProfile.formSurfaceColor || DEFAULT_FORM_SURFACE_COLOR)}">
      </label>
      <label>
        Gradient color
        <input id="editor-surface-accent" type="color" value="${escapeHtml(currentFormProfile.formSurfaceAccentColor || DEFAULT_FORM_SURFACE_ACCENT_COLOR)}">
      </label>
    </div>
    <label>
      Gradient style
      <select id="editor-surface-gradient">
        ${FORM_SURFACE_GRADIENT_OPTIONS.map(option => `<option value="${escapeHtml(option.id)}" ${option.id === (currentFormProfile.formSurfaceGradient || DEFAULT_FORM_SURFACE_GRADIENT) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
      </select>
    </label>
    <label>
      Text color
      <input id="editor-surface-text" type="color" value="${escapeHtml(currentFormProfile.formTextColor || DEFAULT_FORM_TEXT_COLOR)}">
    </label>
  `;

  document.getElementById("editor-surface-base")?.addEventListener("input", event => {
    currentFormProfile = {
      ...currentFormProfile,
      formSurfaceColor: event.target.value
    };
    renderBuilder();
  });

  document.getElementById("editor-surface-accent")?.addEventListener("input", event => {
    currentFormProfile = {
      ...currentFormProfile,
      formSurfaceAccentColor: event.target.value
    };
    renderBuilder();
  });

  document.getElementById("editor-surface-gradient")?.addEventListener("change", event => {
    currentFormProfile = {
      ...currentFormProfile,
      formSurfaceGradient: event.target.value
    };
    renderBuilder();
  });

  document.getElementById("editor-surface-text")?.addEventListener("input", event => {
    currentFormProfile = {
      ...currentFormProfile,
      formTextColor: event.target.value
    };
    renderBuilder();
  });
}

function openPageEditor() {
  if (!editorPopover || !editorBody) {
    return;
  }

  const activePreset = getBackgroundPresetMatch(currentFormProfile)?.id || "";

  editorPopover.hidden = false;
  editorTitle.textContent = "Page settings";
  editorCopy.textContent = "Control the form name and the Send Reminder page background colors.";
  editorBody.innerHTML = `
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
  `;

  document.getElementById("editor-form-title")?.addEventListener("input", event => {
    currentFormProfile = {
      ...currentFormProfile,
      formTitle: event.target.value.slice(0, 60) || DEFAULT_FORM_TITLE
    };
    renderBuilder();
  });

  document.getElementById("editor-bg-top")?.addEventListener("input", event => {
    currentFormProfile = {
      ...currentFormProfile,
      backgroundTop: event.target.value
    };
    renderBuilder();
  });

  document.getElementById("editor-bg-bottom")?.addEventListener("input", event => {
    currentFormProfile = {
      ...currentFormProfile,
      backgroundBottom: event.target.value
    };
    renderBuilder();
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
    if (!silent) {
      setStatus("Form saved. Send Reminder will use this custom questionnaire when you are signed in.", "success");
    }
  } catch (error) {
    setStatus(error.message || "Unable to save this form right now.", "error");
  } finally {
    if (!skipBusy) {
      setButtonBusy(saveFormButton, false);
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

  supabase = createClient(appConfig.supabaseUrl, publicKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });

  const {
    data: { session }
  } = await supabase.auth.getSession();

  hydrateBuilderFromUser(session?.user || null);

  supabase.auth.onAuthStateChange((event, nextSession) => {
    if (event === "TOKEN_REFRESHED") {
      return;
    }

    hydrateBuilderFromUser(nextSession?.user || null);
  });
}

pageSettingsButton?.addEventListener("click", openPageEditor);
editorCloseButton?.addEventListener("click", closeEditor);
saveFormButton?.addEventListener("click", saveFormProfile);
resetFormButton?.addEventListener("click", resetToSaved);
formEnabledToggle?.addEventListener("change", async event => {
  currentFormProfile = {
    ...currentFormProfile,
    isEnabled: Boolean(event.target.checked)
  };
  renderBuilder();
  await saveFormProfile({ silent: true, skipBusy: true });
});
previewBackButton?.addEventListener("click", () => {
  const steps = getPreviewSteps();
  const index = steps.findIndex(step => step.id === selectedPreviewStepId);

  if (index > 0) {
    selectedPreviewStepId = steps[index - 1].id;
    closeEditor();
    renderBuilder();
  }
});
previewSkipButton?.addEventListener("click", () => {
  const steps = getPreviewSteps();
  const index = steps.findIndex(step => step.id === selectedPreviewStepId);

  if (index >= 0 && index < steps.length - 1) {
    selectedPreviewStepId = steps[index + 1].id;
    closeEditor();
    renderBuilder();
  }
});
previewNextButton?.addEventListener("click", () => {
  const steps = getPreviewSteps();
  const index = steps.findIndex(step => step.id === selectedPreviewStepId);

  if (index >= 0 && index < steps.length - 1) {
    selectedPreviewStepId = steps[index + 1].id;
    closeEditor();
    renderBuilder();
  }
});

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
  const labelTarget = event.target.closest('[data-edit-target="step-nav-label"]');

  if (labelTarget) {
    openStepNavigationEditor();
    return;
  }

  const button = event.target.closest("[data-preview-step]");

  if (!button) {
    return;
  }

  const nextId = button.dataset.previewStep || "";
  selectedPreviewStepId = nextId;
  closeEditor();
  renderBuilder();
});

previewStepper?.addEventListener("dragstart", event => {
  const button = event.target.closest("[data-preview-step]");

  if (!button || button.dataset.previewStep === "review") {
    return;
  }

  startDrag({
    kind: "step",
    stepId: button.dataset.previewStep || ""
  }, event, button);
});

previewStepper?.addEventListener("dragend", event => {
  const button = event.target.closest("[data-preview-step]");
  finishDrag(button || null);
});

previewStepper?.addEventListener("dragover", event => {
  const dropzone = event.target.closest("[data-drop-step-index]");

  if (!dropzone || !dragPayload || (dragPayload.kind !== "step" && dragPayload.kind !== "page-template")) {
    return;
  }

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
});

previewStepper?.addEventListener("dragenter", event => {
  const dropzone = event.target.closest("[data-drop-step-index]");

  if (!dropzone || !dragPayload || (dragPayload.kind !== "step" && dragPayload.kind !== "page-template")) {
    return;
  }

  clearDragIndicators();
  dropzone.classList.add("is-over");
});

previewStepper?.addEventListener("dragleave", event => {
  const dropzone = event.target.closest("[data-drop-step-index]");

  if (!dropzone || !dropzone.contains(event.relatedTarget)) {
    dropzone?.classList.remove("is-over");
  }
});

previewStepper?.addEventListener("drop", event => {
  const dropzone = event.target.closest("[data-drop-step-index]");

  if (!dropzone || !dragPayload) {
    return;
  }

  const insertIndex = Number(dropzone.dataset.dropStepIndex || "0");

  event.preventDefault();

  if (dragPayload.kind === "step" && dragPayload.stepId) {
    reorderStep(dragPayload.stepId, insertIndex);
  } else if (dragPayload.kind === "page-template") {
    addBlankPage(insertIndex);
  }

  finishDrag();
});

previewStepHost?.addEventListener("click", event => {
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

  const clickedFieldId = event.target.closest("[data-preview-field-id]")?.dataset.previewFieldId
    || event.target.closest("[data-preview-field-group]")?.dataset.previewFieldGroup
    || "";

  if (clickedFieldId && clickedFieldId !== "review") {
    openFieldEditor(clickedFieldId);
    return;
  }

  if (selectedPreviewStepId && selectedPreviewStepId !== "review") {
    openFieldEditor(selectedPreviewStepId);
  }
});

previewStepHost?.addEventListener("dragstart", event => {
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
  const dropzone = event.target.closest("[data-drop-field-index]");

  if (!dropzone || !dragPayload || (dragPayload.kind !== "existing-field" && dragPayload.kind !== "field-template")) {
    return;
  }

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
});

previewStepHost?.addEventListener("dragenter", event => {
  const dropzone = event.target.closest("[data-drop-field-index]");

  if (!dropzone || !dragPayload || (dragPayload.kind !== "existing-field" && dragPayload.kind !== "field-template")) {
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
  }

  finishDrag();
});

previewShellZones.forEach(zone => {
  zone.addEventListener("mouseenter", () => {
    previewShell?.classList.add("is-shell-edit-hover");
  });

  zone.addEventListener("mouseleave", () => {
    previewShell?.classList.remove("is-shell-edit-hover");
  });

  zone.addEventListener("click", event => {
    event.stopPropagation();
    openFormShellEditor();
  });
});

previewTitle?.addEventListener("click", openPageTitleEditor);
previewStepTitle?.addEventListener("click", () => openSelectedStepTextEditor("step-title"));
previewStepCopy?.addEventListener("click", () => openSelectedStepTextEditor("step-copy"));

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeEditor();
  }
});

if (editorHead) {
  editorHead.addEventListener("pointerdown", event => {
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

window.addEventListener("resize", () => {
  applyMobileStudioScale();

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
});

renderBuilder();
init();
