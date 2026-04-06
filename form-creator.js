import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import {
  BASE_REMINDER_STEPS,
  CUSTOM_FIELD_TYPES,
  FORM_BACKGROUND_PRESETS,
  DEFAULT_FORM_TITLE,
  DEFAULT_FORM_TITLE_FONT_SIZE,
  DEFAULT_STEP_TITLE_FONT_SIZE,
  DEFAULT_STEP_COPY_FONT_SIZE,
  DEFAULT_FIELD_LABEL_FONT_SIZE,
  DEFAULT_FIELD_HELP_FONT_SIZE,
  normalizeCustomFormProfile,
  createCustomField,
  buildPreviewStepList,
  getCustomFieldTypeMeta,
  getBackgroundPresetMatch
} from "./custom-form-profile.js?v=20260405b";

const statusBanner = document.getElementById("status-banner");
const authSetupNotice = document.getElementById("auth-setup-notice");
const signedOutShell = document.getElementById("signed-out-shell");
const signedInShell = document.getElementById("signed-in-shell");
const pricePill = document.getElementById("price-pill");
const saveFormButton = document.getElementById("save-form-button");
const resetFormButton = document.getElementById("reset-form-button");
const fieldRailList = document.getElementById("field-rail-list");
const previewShell = document.getElementById("form-preview-shell");
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

function getPreviewSteps() {
  return buildPreviewStepList(currentFormProfile);
}

function getSelectedPreviewStep() {
  const steps = getPreviewSteps();
  return steps.find(step => step.id === selectedPreviewStepId) || steps[0] || null;
}

function isCustomStep(stepId) {
  return getCustomFields().some(field => field.id === stepId);
}

function patchStepConfig(stepId, updates) {
  if (isCustomStep(stepId)) {
    currentFormProfile = {
      ...currentFormProfile,
      fields: getCustomFields().map(entry => entry.id === stepId ? { ...entry, ...updates } : entry)
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
  }

  if (signedInShell) {
    signedInShell.hidden = !isSignedIn;
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
}

function buildPreviewFieldMarkup(step) {
  const isRequired = step.required === true;
  const badge = isRequired
    ? `<span class="label-badge required">Required</span>`
    : `<span class="label-badge">Optional</span>`;

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

  const inputMarkup = step.type === "textarea"
    ? `<textarea placeholder="${escapeHtml(step.placeholder || "Type your answer")}"></textarea>`
    : `<input ${step.type === "email" ? 'type="email"' : ""} ${step.type === "date" ? 'type="date"' : ""} ${step.type === "time" ? 'type="time"' : ""} ${step.type === "phone" ? 'inputmode="tel"' : ""} placeholder="${escapeHtml(step.placeholder || "")}">`;

  return `
    <div class="question-wrap ${step.builtIn ? "" : "is-selected"}" data-preview-step-id="${escapeHtml(step.id)}">
      <label data-edit-target="field-label" style="${getTypographyInline(step.labelFontSize || DEFAULT_FIELD_LABEL_FONT_SIZE, step.labelBold !== false)}">${escapeHtml(step.label)} ${badge}</label>
      ${inputMarkup}
      ${step.helpText ? `<p class="preview-field-help" data-edit-target="field-help" style="${getTypographyInline(step.helpFontSize || DEFAULT_FIELD_HELP_FONT_SIZE, Boolean(step.helpBold))}">${escapeHtml(step.helpText)}</p>` : ""}
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
  const isRequired = selectedStep.required === true;

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
      <button class="preview-stepper-button ${step.id === selectedStep.id ? "is-active" : ""}" type="button" data-preview-step="${escapeHtml(step.id)}">
        <span class="preview-stepper-circle">${escapeHtml(step.icon || String(index + 1))}</span>
        <span class="preview-stepper-label">${escapeHtml(step.navLabel)}</span>
      </button>
    `).join("");
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
}

function renderFieldRail() {
  if (!fieldRailList) {
    return;
  }

  const fields = getCustomFields();

  if (!fields.length) {
    fieldRailList.innerHTML = `
      <div class="field-rail-card is-empty">
        <span class="field-rail-icon">+</span>
        <div class="field-rail-body">
          <span class="field-rail-title">No custom questions yet</span>
          <span class="field-rail-meta">Use the floating add buttons to start building your questionnaire.</span>
        </div>
      </div>
    `;
    return;
  }

  fieldRailList.innerHTML = fields.map(field => {
    const meta = getCustomFieldTypeMeta(field.type);
    return `
      <button
        class="field-rail-card ${selectedPreviewStepId === field.id ? "is-active" : ""}"
        type="button"
        draggable="true"
        data-field-id="${escapeHtml(field.id)}"
      >
        <span class="field-rail-icon">${escapeHtml(meta.icon)}</span>
        <span class="field-rail-body">
          <span class="field-rail-title">${escapeHtml(field.label)}</span>
          <span class="field-rail-meta">${escapeHtml(meta.label)}${field.required ? " - required" : ""}</span>
        </span>
        ${field.required ? `<span class="field-rail-required">Req</span>` : ""}
      </button>
    `;
  }).join("");

  fieldRailList.querySelectorAll("[data-field-id]").forEach(card => {
    const fieldId = card.dataset.fieldId || "";

    card.addEventListener("click", () => {
      selectedPreviewStepId = fieldId;
      openFieldEditor(fieldId);
      renderBuilder();
    });

    card.addEventListener("dragstart", event => {
      dragFieldId = fieldId;
      card.classList.add("is-dragging");
      event.dataTransfer?.setData("text/plain", fieldId);
      event.dataTransfer.effectAllowed = "move";
    });

    card.addEventListener("dragend", () => {
      dragFieldId = "";
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

      const fieldsList = [...getCustomFields()];
      const fromIndex = fieldsList.findIndex(entry => entry.id === dragFieldId);
      const toIndex = fieldsList.findIndex(entry => entry.id === targetId);

      if (fromIndex < 0 || toIndex < 0) {
        return;
      }

      const [movedField] = fieldsList.splice(fromIndex, 1);
      fieldsList.splice(toIndex, 0, movedField);
      currentFormProfile = {
        ...currentFormProfile,
        fields: fieldsList
      };
      renderBuilder();
    });
  });
}

function renderBuilder() {
  renderFieldRail();
  renderPreview();
}

function closeEditor() {
  if (!editorPopover) {
    return;
  }

  editorPopover.hidden = true;
  editorBody.innerHTML = "";
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
  const field = getCustomFields().find(entry => entry.id === fieldId);

  if (!field || !editorPopover || !editorBody) {
    return;
  }

  editorPopover.hidden = false;
  editorTitle.textContent = "Question settings";
  editorCopy.textContent = "Rename this question, mark it required, and control how it appears in Send Reminder.";
  editorBody.innerHTML = `
    <label>
      Question title
      <input id="editor-field-label" type="text" value="${escapeHtml(field.label)}" maxlength="60">
    </label>
    <div class="form-editor-grid">
      <label>
        Step label
        <input id="editor-field-nav" type="text" value="${escapeHtml(field.navLabel)}" maxlength="12">
      </label>
      <label>
        Field type
        <select id="editor-field-type">
          ${CUSTOM_FIELD_TYPES.map(option => `<option value="${escapeHtml(option.id)}" ${option.id === field.type ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
        </select>
      </label>
    </div>
    <label>
      Placeholder
      <input id="editor-field-placeholder" type="text" value="${escapeHtml(field.placeholder || "")}" maxlength="120">
    </label>
    <label>
      Helper copy
      <textarea id="editor-field-help" maxlength="160">${escapeHtml(field.helpText || "")}</textarea>
    </label>
    <label class="toggle-row">
      <span>Required field</span>
      <input id="editor-field-required" type="checkbox" ${field.required ? "checked" : ""}>
    </label>
    <button id="editor-delete-field" class="delete-field-button" type="button">Delete this question</button>
  `;

  const labelInput = document.getElementById("editor-field-label");
  const navInput = document.getElementById("editor-field-nav");
  const typeSelect = document.getElementById("editor-field-type");
  const placeholderInput = document.getElementById("editor-field-placeholder");
  const helpInput = document.getElementById("editor-field-help");
  const requiredInput = document.getElementById("editor-field-required");
  const deleteButton = document.getElementById("editor-delete-field");

  const patchField = updates => {
    currentFormProfile = {
      ...currentFormProfile,
      fields: getCustomFields().map(entry => {
        if (entry.id !== fieldId) {
          return entry;
        }

        const nextField = {
          ...entry,
          ...updates
        };

        if (updates.type) {
          const nextMeta = getCustomFieldTypeMeta(updates.type);

          nextField.navLabel = safeShortLabel(nextField.navLabel || nextMeta.shortLabel);

          if (updates.type === "date" || updates.type === "time") {
            nextField.placeholder = "";
          } else if (!nextField.placeholder) {
            nextField.placeholder = nextMeta.placeholder;
          }
        }

        return nextField;
      })
    };

    renderBuilder();
  };

  labelInput?.addEventListener("input", event => {
    patchField({ label: event.target.value.slice(0, 60) });
  });

  navInput?.addEventListener("input", event => {
    patchField({ navLabel: safeShortLabel(event.target.value) });
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

  requiredInput?.addEventListener("change", event => {
    patchField({ required: Boolean(event.target.checked) });
  });

  deleteButton?.addEventListener("click", () => {
    currentFormProfile = {
      ...currentFormProfile,
      fields: getCustomFields().filter(entry => entry.id !== fieldId)
    };
    selectedPreviewStepId = BASE_REMINDER_STEPS[0]?.id || "phone";
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

function openSelectedStepTextEditor(target) {
  const step = getSelectedPreviewStep();

  if (!step) {
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
    openTypographyEditor({
      title: "Field label",
      copy: "Edit the question label shown above the input.",
      text: step.label,
      fontSize: step.labelFontSize || DEFAULT_FIELD_LABEL_FONT_SIZE,
      bold: step.labelBold !== false,
      minSize: 13,
      maxSize: 28,
      maxLength: 60,
      apply({ text, fontSize, bold }) {
        patchStepConfig(step.id, {
          label: typeof text === "string" ? text : step.label,
          labelFontSize: fontSize ?? step.labelFontSize,
          labelBold: bold ?? step.labelBold
        });
      }
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
  const nextField = createCustomField(type);

  currentFormProfile = {
    ...currentFormProfile,
    fields: [...getCustomFields(), nextField]
  };

  selectedPreviewStepId = nextField.id;
  renderBuilder();
  openFieldEditor(nextField.id);
}

async function saveFormProfile() {
  if (!supabase || !currentUser) {
    setStatus("Please sign in first.", "error");
    return;
  }

  setButtonBusy(saveFormButton, true, "Saving form...");
  setStatus("");

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
    setStatus("Form saved. Send Reminder will use this custom questionnaire when you are signed in.", "success");
  } catch (error) {
    setStatus(error.message || "Unable to save this form right now.", "error");
  } finally {
    setButtonBusy(saveFormButton, false);
  }
}

function resetToSaved() {
  currentFormProfile = normalizeCustomFormProfile(savedFormProfile);
  selectedPreviewStepId = getCustomFields()[0]?.id || BASE_REMINDER_STEPS[0]?.id || "phone";
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
  selectedPreviewStepId = getCustomFields()[0]?.id || BASE_REMINDER_STEPS[0]?.id || "phone";
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
previewBackButton?.addEventListener("click", () => {
  const steps = getPreviewSteps();
  const index = steps.findIndex(step => step.id === selectedPreviewStepId);

  if (index > 0) {
    selectedPreviewStepId = steps[index - 1].id;
    renderPreview();
  }
});
previewSkipButton?.addEventListener("click", () => {
  const steps = getPreviewSteps();
  const index = steps.findIndex(step => step.id === selectedPreviewStepId);

  if (index >= 0 && index < steps.length - 1) {
    selectedPreviewStepId = steps[index + 1].id;
    renderPreview();
  }
});
previewNextButton?.addEventListener("click", () => {
  const steps = getPreviewSteps();
  const index = steps.findIndex(step => step.id === selectedPreviewStepId);

  if (index >= 0 && index < steps.length - 1) {
    selectedPreviewStepId = steps[index + 1].id;
    renderPreview();
  }
});

document.querySelectorAll("[data-add-type]").forEach(button => {
  button.addEventListener("click", () => addCustomField(button.dataset.addType || "text"));
});

previewStepper?.addEventListener("click", event => {
  const button = event.target.closest("[data-preview-step]");

  if (!button) {
    return;
  }

  const nextId = button.dataset.previewStep || "";
  selectedPreviewStepId = nextId;

  if (getCustomFields().some(field => field.id === nextId)) {
    openFieldEditor(nextId);
  } else {
    closeEditor();
  }

  renderPreview();
});

previewStepHost?.addEventListener("click", event => {
  const editTarget = event.target.closest("[data-edit-target]")?.dataset.editTarget || "";

  if (editTarget) {
    openSelectedStepTextEditor(editTarget);
    return;
  }

  if (getCustomFields().some(field => field.id === selectedPreviewStepId)) {
    openFieldEditor(selectedPreviewStepId);
  }
});

previewTitle?.addEventListener("click", openPageTitleEditor);
previewStepTitle?.addEventListener("click", () => openSelectedStepTextEditor("step-title"));
previewStepCopy?.addEventListener("click", () => openSelectedStepTextEditor("step-copy"));

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeEditor();
  }
});

renderBuilder();
init();
