export const DEFAULT_FORM_TITLE = "Appointment Reminder";
export const DEFAULT_BACKGROUND_TOP = "#10141c";
export const DEFAULT_BACKGROUND_BOTTOM = "#1a2230";

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

function safeString(value) {
  return String(value || "").trim();
}

function getRandomSuffix() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function getCustomFieldTypeMeta(type) {
  return CUSTOM_FIELD_TYPES.find(option => option.id === type) || CUSTOM_FIELD_TYPES[0];
}

export function createCustomField(type = "text") {
  const meta = getCustomFieldTypeMeta(type);
  return {
    id: `custom_${getRandomSuffix()}`,
    type: meta.id,
    label: meta.label,
    navLabel: meta.shortLabel,
    placeholder: meta.placeholder,
    helpText: meta.helpText,
    required: false
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
    type: meta.id,
    label: label.slice(0, 60),
    navLabel: navLabel.slice(0, 12),
    placeholder: placeholder.slice(0, 120),
    helpText: safeString(rawField?.helpText).slice(0, 160),
    required: Boolean(rawField?.required),
    icon: meta.icon
  };
}

export function normalizeCustomFormProfile(rawProfile) {
  const profile = rawProfile && typeof rawProfile === "object" ? rawProfile : {};
  const normalizedFields = Array.isArray(profile.fields)
    ? profile.fields.map((field, index) => normalizeCustomField(field, index))
    : [];

  return {
    formTitle: safeString(profile.formTitle) || DEFAULT_FORM_TITLE,
    backgroundTop: safeString(profile.backgroundTop) || DEFAULT_BACKGROUND_TOP,
    backgroundBottom: safeString(profile.backgroundBottom) || DEFAULT_BACKGROUND_BOTTOM,
    fields: normalizedFields
  };
}

export function buildPreviewStepList(profile) {
  const normalized = normalizeCustomFormProfile(profile);

  return [
    ...BASE_REMINDER_STEPS,
    ...normalized.fields.map(field => ({
      id: field.id,
      title: field.label,
      navLabel: field.navLabel || field.label,
      copy: field.helpText || "Custom question added from Form Creator.",
      label: field.label,
      placeholder: field.placeholder,
      type: field.type,
      required: field.required,
      helpText: field.helpText,
      builtIn: false,
      icon: getCustomFieldTypeMeta(field.type).icon
    })),
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
  return FORM_BACKGROUND_PRESETS.find(preset => (
    preset.top.toLowerCase() === normalized.backgroundTop.toLowerCase()
      && preset.bottom.toLowerCase() === normalized.backgroundBottom.toLowerCase()
  )) || null;
}
