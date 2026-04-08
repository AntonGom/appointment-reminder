export const DEFAULT_FORM_TITLE = "Appointment Reminder";
export const DEFAULT_BACKGROUND_TOP = "#10141c";
export const DEFAULT_BACKGROUND_BOTTOM = "#1a2230";
export const DEFAULT_BACKGROUND_STYLE = "gradient";
export const DEFAULT_BACKGROUND_SOLID_COLOR = "#182131";
export const DEFAULT_FORM_SURFACE_COLOR = "#f6f8fc";
export const DEFAULT_FORM_SURFACE_ACCENT_COLOR = "#ffffff";
export const DEFAULT_FORM_SURFACE_GRADIENT = "solid";
export const DEFAULT_FORM_SURFACE_SHINE_ENABLED = true;
export const DEFAULT_FORM_SURFACE_SHINE_COLOR = "#ffffff";
export const DEFAULT_FORM_SURFACE_SHAPE = "rounded";
export const DEFAULT_FORM_SURFACE_LAYOUT = "compact";
export const DEFAULT_FORM_TEXT_COLOR = "#111827";
export const DEFAULT_QUESTION_SURFACE_COLOR = "#f8fafc";
export const DEFAULT_QUESTION_TEXT_COLOR = "#111827";
export const DEFAULT_QUESTION_SURFACE_VISIBLE = true;
export const DEFAULT_FORM_TITLE_FONT_SIZE = 12;
export const DEFAULT_STEP_TITLE_FONT_SIZE = 36;
export const DEFAULT_STEP_COPY_FONT_SIZE = 15;
export const DEFAULT_FIELD_LABEL_FONT_SIZE = 16;
export const DEFAULT_FIELD_HELP_FONT_SIZE = 13;
export const DEFAULT_STEP_NAV_BACKGROUND = "#f8fafc";
export const DEFAULT_STEP_NAV_ACTIVE_BACKGROUND = "#dbeafe";
export const DEFAULT_STEP_NAV_TEXT_COLOR = "#0f172a";
export const DEFAULT_STEP_NAV_ACTIVE_TEXT_COLOR = "#1d4ed8";
export const DEFAULT_STEP_NAV_SHAPE = "rounded";
export const DEFAULT_STEP_NAV_SIZE = "medium";
export const DEFAULT_STEP_NAV_PLACEMENT = "below-title";
export const DEFAULT_STEP_NAV_CLICKABLE = true;
export const DEFAULT_REMEMBERED_CLIENT_FIELD_IDS = ["phone", "email", "name", "address", "notes"];

export const BASE_REMINDER_STEPS = [
  {
    id: "phone",
    title: "Client Phone Number",
    navLabel: "Phone",
    copy: "Add a phone number if you may want to text this client later.",
    label: "Client Phone Number",
    placeholder: "Enter client's phone number",
    type: "phone",
    required: false,
    helpText: "You can skip this and use email instead.",
    builtIn: true
  },
  {
    id: "email",
    title: "Client Email",
    navLabel: "Email",
    copy: "Add an email address if you may want to email this client later.",
    label: "Client Email",
    placeholder: "Enter client's email",
    type: "email",
    required: false,
    helpText: "You can skip this and use a phone number instead.",
    builtIn: true
  },
  {
    id: "name",
    title: "Client Name",
    navLabel: "Name",
    copy: "Add the client's name if you want the reminder to feel more personal.",
    label: "Client Name",
    placeholder: "Enter client's name",
    type: "text",
    required: false,
    helpText: "",
    builtIn: true
  },
  {
    id: "date",
    title: "Date of Service",
    navLabel: "Date",
    copy: "Add the appointment date if you want it included in the reminder.",
    label: "Date of Service",
    placeholder: "",
    type: "date",
    required: false,
    helpText: "",
    builtIn: true
  },
  {
    id: "time",
    title: "Time of Service",
    navLabel: "Time",
    copy: "Add the appointment time if you want it included in the reminder.",
    label: "Time of Service",
    placeholder: "",
    type: "time",
    required: false,
    helpText: "",
    builtIn: true
  },
  {
    id: "address",
    title: "Service Location",
    navLabel: "Location",
    copy: "Add the service location if you want it included in the reminder.",
    label: "Service Location",
    placeholder: "Enter service location",
    type: "text",
    required: false,
    helpText: "",
    builtIn: true
  },
  {
    id: "businessContact",
    title: "Bussiness Contact Infoformation",
    navLabel: "Contact",
    copy: "This is the contact information your client will see in the reminder.",
    label: "Bussiness Contact Infoformation",
    placeholder: "Business phone or email",
    type: "text",
    required: false,
    helpText: "Use the phone number or email the client should use if they need to reschedule or reach you.",
    builtIn: true
  },
  {
    id: "notes",
    title: "Additional Details",
    navLabel: "Details",
    copy: "Add any extra details you want the client to see.",
    label: "Additional Details",
    placeholder: "Parking instructions, gate code, or anything else the client should know",
    type: "textarea",
    required: false,
    helpText: "",
    builtIn: true
  }
];

export const CUSTOM_FIELD_TYPES = [
  {
    id: "text",
    label: "Short Answer",
    shortLabel: "Text",
    icon: "Aa",
    placeholder: "Type your answer",
    helpText: "Use this for a short custom answer."
  },
  {
    id: "textarea",
    label: "Long Answer",
    shortLabel: "Long",
    icon: "Tx",
    placeholder: "Type your answer",
    helpText: "Use this when the business needs more detailed information."
  },
  {
    id: "email",
    label: "Email",
    shortLabel: "Email",
    icon: "@",
    placeholder: "name@example.com",
    helpText: "Use this for a custom email question."
  },
  {
    id: "phone",
    label: "Phone",
    shortLabel: "Phone",
    icon: "Ph",
    placeholder: "(555) 555-5555",
    helpText: "Use this for a phone-specific question."
  },
  {
    id: "date",
    label: "Date",
    shortLabel: "Date",
    icon: "D",
    placeholder: "",
    helpText: "Use this for a calendar-style date question."
  },
  {
    id: "time",
    label: "Time",
    shortLabel: "Time",
    icon: "T",
    placeholder: "",
    helpText: "Use this for a time-of-day question."
  }
];

export const FORM_BACKGROUND_PRESETS = [
  { id: "classic", label: "Classic", top: "#10141c", bottom: "#1a2230" },
  { id: "ocean", label: "Ocean", top: "#0f172a", bottom: "#1d4ed8" },
  { id: "forest", label: "Forest", top: "#0f2418", bottom: "#1f6f50" },
  { id: "sunset", label: "Sunset", top: "#28121f", bottom: "#7c2d12" },
  { id: "plum", label: "Plum", top: "#1b1530", bottom: "#7c3aed" }
];

export const FORM_SURFACE_GRADIENT_OPTIONS = [
  { id: "solid", label: "Solid" },
  { id: "soft-blend", label: "Soft Blend" },
  { id: "top-glow", label: "Top Glow" },
  { id: "diagonal", label: "Diagonal Sweep" }
];

export const FORM_SURFACE_SHAPE_OPTIONS = [
  { id: "rounded", label: "Rounded" },
  { id: "rectangular", label: "Rectangular" },
  { id: "invisible", label: "Invisible" }
];

export const FORM_SURFACE_LAYOUT_OPTIONS = [
  { id: "compact", label: "Compact" },
  { id: "medium", label: "Medium" },
  { id: "extended", label: "Extended" }
];

export const STEP_NAV_SHAPE_OPTIONS = [
  { id: "rounded", label: "Rounded" },
  { id: "rectangular", label: "Rectangular" },
  { id: "pill", label: "Pill" }
];

export const STEP_NAV_SIZE_OPTIONS = [
  { id: "compact", label: "Compact" },
  { id: "medium", label: "Medium" },
  { id: "large", label: "Large" }
];

export const STEP_NAV_PLACEMENT_OPTIONS = [
  { id: "below-title", label: "Below title" },
  { id: "above-title", label: "Above title" },
  { id: "hidden", label: "Hidden" }
];

function safeString(value) {
  return String(value || "").trim();
}

function clampNumber(value, fallback, min, max) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numeric));
}

function pickOption(value, fallback, options) {
  const normalized = safeString(value);
  return options.some(option => option.id === normalized) ? normalized : fallback;
}

function normalizeTypography(rawTypography = {}) {
  return {
    titleFontSize: clampNumber(rawTypography.titleFontSize, DEFAULT_STEP_TITLE_FONT_SIZE, 20, 60),
    titleBold: rawTypography.titleBold !== false,
    copyFontSize: clampNumber(rawTypography.copyFontSize, DEFAULT_STEP_COPY_FONT_SIZE, 12, 26),
    copyBold: Boolean(rawTypography.copyBold),
    labelFontSize: clampNumber(rawTypography.labelFontSize, DEFAULT_FIELD_LABEL_FONT_SIZE, 13, 28),
    labelBold: rawTypography.labelBold !== false,
    navLabelColor: safeString(rawTypography.navLabelColor).slice(0, 24),
    helpFontSize: clampNumber(rawTypography.helpFontSize, DEFAULT_FIELD_HELP_FONT_SIZE, 11, 24),
    helpBold: Boolean(rawTypography.helpBold)
  };
}

function getRandomSuffix() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function createCustomPage() {
  return {
    id: `page_${getRandomSuffix()}`,
    title: "Custom Page",
    navLabel: "Custom",
    copy: "Add the question or details you want on this page.",
    required: false,
    ...normalizeTypography()
  };
}

export function getCustomFieldTypeMeta(type) {
  return CUSTOM_FIELD_TYPES.find(option => option.id === type) || CUSTOM_FIELD_TYPES[0];
}

export function createCustomField(type = "text") {
  const meta = getCustomFieldTypeMeta(type);
  return {
    id: `custom_${getRandomSuffix()}`,
    pageId: "",
    type: meta.id,
    title: meta.label,
    copy: meta.helpText,
    label: meta.label,
    navLabel: meta.shortLabel,
    navLabelColor: "",
    placeholder: meta.placeholder,
    helpText: meta.helpText,
    required: false,
    rememberClientAnswer: false,
    ...normalizeTypography()
  };
}

export function isDefaultRememberedClientField(fieldId) {
  return DEFAULT_REMEMBERED_CLIENT_FIELD_IDS.includes(String(fieldId || "").trim());
}

function normalizeCustomPage(rawPage, index) {
  const fallback = createCustomPage();
  const title = safeString(rawPage?.title).slice(0, 60) || `Custom Page ${index + 1}`;
  const navLabel = safeString(rawPage?.navLabel).slice(0, 12) || title.slice(0, 12) || "Custom";

  return {
    id: safeString(rawPage?.id) || `page_${index}_${getRandomSuffix()}`,
    title,
    navLabel,
    copy: safeString(rawPage?.copy).slice(0, 180),
    required: rawPage?.required === true,
    ...normalizeTypography(rawPage || fallback)
  };
}

function normalizeCustomField(rawField, index) {
  const meta = getCustomFieldTypeMeta(rawField?.type || "text");
  const fallbackField = createCustomField(meta.id);
  const label = safeString(rawField?.label) || meta.label;
  const navLabel = safeString(rawField?.navLabel) || label.slice(0, 12) || meta.shortLabel;
  const placeholder = meta.id === "date" || meta.id === "time"
    ? ""
    : safeString(rawField?.placeholder) || meta.placeholder;

  return {
    id: safeString(rawField?.id) || `custom_${index}_${getRandomSuffix()}`,
    pageId: safeString(rawField?.pageId).slice(0, 60),
    type: meta.id,
    title: (safeString(rawField?.title) || label).slice(0, 60),
    copy: safeString(rawField?.copy).slice(0, 180),
    label: label.slice(0, 60),
    navLabel: navLabel.slice(0, 12),
    placeholder: placeholder.slice(0, 120),
    helpText: safeString(rawField?.helpText).slice(0, 160),
    required: Boolean(rawField?.required),
    rememberClientAnswer: rawField?.rememberClientAnswer === true,
    icon: meta.icon,
    ...normalizeTypography(rawField)
  };
}

function normalizeStepOverride(rawOverride = {}, fallbackStep = {}) {
  return {
    title: safeString(rawOverride.title).slice(0, 60) || fallbackStep.title || "",
    navLabel: safeString(rawOverride.navLabel).slice(0, 12) || fallbackStep.navLabel || "",
    copy: safeString(rawOverride.copy).slice(0, 180) || fallbackStep.copy || "",
    label: safeString(rawOverride.label).slice(0, 60) || fallbackStep.label || "",
    helpText: safeString(rawOverride.helpText).slice(0, 180) || fallbackStep.helpText || "",
    placeholder: safeString(rawOverride.placeholder).slice(0, 120) || fallbackStep.placeholder || "",
    required: rawOverride.required === true,
    rememberClientAnswer: rawOverride.rememberClientAnswer === true
      || (rawOverride.rememberClientAnswer == null && isDefaultRememberedClientField(fallbackStep.id)),
    hidden: rawOverride.hidden === true,
    ...normalizeTypography(rawOverride)
  };
}

export function normalizeCustomFormProfile(rawProfile) {
  const profile = rawProfile && typeof rawProfile === "object" ? rawProfile : {};
  const normalizedFields = Array.isArray(profile.fields)
    ? profile.fields.map((field, index) => normalizeCustomField(field, index))
    : [];
  const normalizedCustomPages = Array.isArray(profile.customPages)
    ? profile.customPages.map((page, index) => normalizeCustomPage(page, index))
    : [];
  const rawStepOverrides = profile.stepOverrides && typeof profile.stepOverrides === "object"
    ? profile.stepOverrides
    : {};
  const stepOverrides = Object.fromEntries(
    BASE_REMINDER_STEPS.map(step => [step.id, normalizeStepOverride(rawStepOverrides[step.id], step)])
  );
  const stepOrder = Array.isArray(profile.stepOrder)
    ? [...new Set(profile.stepOrder.map(value => safeString(value)).filter(Boolean))]
    : [];
  const rawPageFieldOrder = profile.pageFieldOrder && typeof profile.pageFieldOrder === "object"
    ? profile.pageFieldOrder
    : {};
  const pageFieldOrder = Object.fromEntries(
    Object.entries(rawPageFieldOrder).map(([pageId, ids]) => [
      safeString(pageId),
      Array.isArray(ids) ? [...new Set(ids.map(value => safeString(value)).filter(Boolean))] : []
    ]).filter(([pageId]) => Boolean(pageId))
  );

  return {
    templateId: safeString(profile.templateId).slice(0, 40),
    formTitle: safeString(profile.formTitle) || DEFAULT_FORM_TITLE,
    isEnabled: profile.isEnabled !== false,
    backgroundStyle: safeString(profile.backgroundStyle) === "solid" ? "solid" : DEFAULT_BACKGROUND_STYLE,
    backgroundTop: safeString(profile.backgroundTop) || DEFAULT_BACKGROUND_TOP,
    backgroundBottom: safeString(profile.backgroundBottom) || DEFAULT_BACKGROUND_BOTTOM,
    backgroundSolidColor: safeString(profile.backgroundSolidColor) || DEFAULT_BACKGROUND_SOLID_COLOR,
    formSurfaceColor: safeString(profile.formSurfaceColor) || DEFAULT_FORM_SURFACE_COLOR,
    formSurfaceAccentColor: safeString(profile.formSurfaceAccentColor) || DEFAULT_FORM_SURFACE_ACCENT_COLOR,
    formSurfaceGradient: pickOption(profile.formSurfaceGradient, DEFAULT_FORM_SURFACE_GRADIENT, FORM_SURFACE_GRADIENT_OPTIONS),
    formSurfaceShineEnabled: profile.formSurfaceShineEnabled !== false,
    formSurfaceShineColor: safeString(profile.formSurfaceShineColor) || DEFAULT_FORM_SURFACE_SHINE_COLOR,
    formSurfaceShape: pickOption(profile.formSurfaceShape, DEFAULT_FORM_SURFACE_SHAPE, FORM_SURFACE_SHAPE_OPTIONS),
    formSurfaceLayout: pickOption(profile.formSurfaceLayout, DEFAULT_FORM_SURFACE_LAYOUT, FORM_SURFACE_LAYOUT_OPTIONS),
    formTextColor: safeString(profile.formTextColor) || DEFAULT_FORM_TEXT_COLOR,
    questionSurfaceColor: safeString(profile.questionSurfaceColor) || DEFAULT_QUESTION_SURFACE_COLOR,
    questionTextColor: safeString(profile.questionTextColor) || DEFAULT_QUESTION_TEXT_COLOR,
    questionSurfaceVisible: profile.questionSurfaceVisible !== false,
    stepNavBackgroundColor: safeString(profile.stepNavBackgroundColor) || DEFAULT_STEP_NAV_BACKGROUND,
    stepNavActiveBackgroundColor: safeString(profile.stepNavActiveBackgroundColor) || DEFAULT_STEP_NAV_ACTIVE_BACKGROUND,
    stepNavTextColor: safeString(profile.stepNavTextColor) || DEFAULT_STEP_NAV_TEXT_COLOR,
    stepNavActiveTextColor: safeString(profile.stepNavActiveTextColor) || DEFAULT_STEP_NAV_ACTIVE_TEXT_COLOR,
    stepNavShape: pickOption(profile.stepNavShape, DEFAULT_STEP_NAV_SHAPE, STEP_NAV_SHAPE_OPTIONS),
    stepNavSize: pickOption(profile.stepNavSize, DEFAULT_STEP_NAV_SIZE, STEP_NAV_SIZE_OPTIONS),
    stepNavPlacement: pickOption(profile.stepNavPlacement, DEFAULT_STEP_NAV_PLACEMENT, STEP_NAV_PLACEMENT_OPTIONS),
    stepNavClickable: profile.stepNavClickable !== false,
    formTitleFontSize: clampNumber(profile.formTitleFontSize, DEFAULT_FORM_TITLE_FONT_SIZE, 10, 28),
    formTitleBold: profile.formTitleBold !== false,
    stepOverrides,
    customPages: normalizedCustomPages,
    stepOrder,
    pageFieldOrder,
    fields: normalizedFields
  };
}

function applySavedStepOrder(profile, steps) {
  const orderedIds = Array.isArray(profile?.stepOrder) ? profile.stepOrder : [];

  if (!orderedIds.length) {
    return steps;
  }

  const stepMap = new Map(steps.map(step => [step.id, step]));
  const ordered = [];

  orderedIds.forEach(id => {
    const step = stepMap.get(id);

    if (step) {
      ordered.push(step);
      stepMap.delete(id);
    }
  });

  steps.forEach(step => {
    if (stepMap.has(step.id)) {
      ordered.push(step);
      stepMap.delete(step.id);
    }
  });

  return ordered;
}

export function buildPreviewStepList(profile) {
  const normalized = normalizeCustomFormProfile(profile);
  const topLevelCustomFields = normalized.fields.filter(field => !field.pageId);
  const inlinePageCounts = normalized.fields.reduce((counts, field) => {
    if (field.pageId) {
      counts[field.pageId] = (counts[field.pageId] || 0) + 1;
    }

    return counts;
  }, {});
  const builtInSteps = BASE_REMINDER_STEPS.map(step => ({
      ...step,
      ...normalized.stepOverrides[step.id],
      baseFieldHidden: normalized.stepOverrides[step.id]?.hidden === true
    })).filter(step => !step.baseFieldHidden || inlinePageCounts[step.id] > 0);
  const customPages = normalized.customPages.map(page => ({
    ...page,
    builtIn: false,
    type: "page",
    label: page.title,
    placeholder: "",
    helpText: "",
    icon: "#"
  }));
  const legacyFieldPages = topLevelCustomFields.map(field => ({
      id: field.id,
      title: field.title || field.label,
      navLabel: field.navLabel || field.label,
      copy: field.copy || field.helpText || "Custom question added from Form Creator.",
      label: field.label,
      placeholder: field.placeholder,
      type: field.type,
      required: field.required,
      helpText: field.helpText,
      builtIn: false,
      icon: getCustomFieldTypeMeta(field.type).icon,
      titleFontSize: field.titleFontSize,
      titleBold: field.titleBold,
      copyFontSize: field.copyFontSize,
      copyBold: field.copyBold,
      labelFontSize: field.labelFontSize,
      labelBold: field.labelBold,
      helpFontSize: field.helpFontSize,
      helpBold: field.helpBold
    }));
  const orderedSteps = applySavedStepOrder(normalized, [
    ...builtInSteps,
    ...customPages,
    ...legacyFieldPages
  ]);

  return [
    ...orderedSteps,
    {
      id: "review",
      title: "Review and Send",
      navLabel: "Review",
      copy: "Check the message, confirm consent, and choose how you want to send it.",
      label: "Review and Send",
      type: "review",
      required: true,
      builtIn: true
    }
  ];
}

export function getBackgroundPresetMatch(profile) {
  const normalized = normalizeCustomFormProfile(profile);
  if (normalized.backgroundStyle === "solid") {
    return null;
  }
  return FORM_BACKGROUND_PRESETS.find(preset => (
    preset.top.toLowerCase() === normalized.backgroundTop.toLowerCase()
      && preset.bottom.toLowerCase() === normalized.backgroundBottom.toLowerCase()
  )) || null;
}

export function getInlineFieldsForPage(profile, pageId) {
  const normalized = normalizeCustomFormProfile(profile);
  const fields = normalized.fields.filter(field => field.pageId === pageId);
  const orderedIds = Array.isArray(normalized.pageFieldOrder?.[pageId]) ? normalized.pageFieldOrder[pageId] : [];

  if (!orderedIds.length) {
    return fields;
  }

  const fieldMap = new Map(fields.map(field => [field.id, field]));
  const orderedFields = [];

  orderedIds.forEach(id => {
    const field = fieldMap.get(id);

    if (field) {
      orderedFields.push(field);
      fieldMap.delete(id);
    }
  });

  fields.forEach(field => {
    if (fieldMap.has(field.id)) {
      orderedFields.push(field);
      fieldMap.delete(field.id);
    }
  });

  return orderedFields;
}
