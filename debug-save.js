(function () {
  const STORAGE_KEY = "appointment_reminder_debug_events_v1";
  const MAX_EVENTS = 30;
  let sequence = 0;

  function normalizeCodePart(value, fallback = "GEN", maxLength = 12) {
    const normalized = String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    return (normalized || fallback).slice(0, maxLength);
  }

  function uniqueSuffix() {
    sequence = (sequence + 1) % 1296;
    const timePart = Date.now().toString(36).toUpperCase().slice(-5);
    const sequencePart = sequence.toString(36).toUpperCase().padStart(2, "0");
    return `${timePart}${sequencePart}`;
  }

  function classifyError(error) {
    const message = String(error?.message || error || "").toLowerCase();
    const name = String(error?.name || "").toLowerCase();

    if (message.includes("timed out") || message.includes("timeout") || name.includes("timeout")) {
      return "TIMEOUT";
    }

    if (
      message.includes("failed to fetch")
      || message.includes("network")
      || message.includes("load failed")
      || message.includes("abort")
      || name.includes("abort")
    ) {
      return "NETWORK";
    }

    if (
      message.includes("jwt")
      || message.includes("session")
      || message.includes("auth")
      || message.includes("sign in")
      || message.includes("token")
    ) {
      return "AUTH";
    }

    if (
      message.includes("permission")
      || message.includes("policy")
      || message.includes("row-level")
      || message.includes("rls")
      || message.includes("forbidden")
    ) {
      return "PERMISSION";
    }

    if (
      message.includes("duplicate")
      || message.includes("unique")
      || message.includes("already exists")
    ) {
      return "DUPLICATE";
    }

    return "ERROR";
  }

  function describeError(error, fallback = "The save request did not finish.") {
    const message = String(error?.message || error || "").trim();
    return message || fallback;
  }

  function readEvents() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }

  function recordEvent(event) {
    const nextEvents = [
      {
        ...event,
        at: new Date().toISOString(),
        userAgent: navigator.userAgent
      },
      ...readEvents()
    ].slice(0, MAX_EVENTS);

    window.__appointmentReminderDebugEvents = nextEvents;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEvents));
    } catch (_error) {
      // Local storage can be unavailable in private browsing; the on-page code still matters.
    }

    if (event?.level === "error") {
      console.warn("[AppointmentReminderDebug]", event);
    } else {
      console.info("[AppointmentReminderDebug]", event);
    }
  }

  function createOperation(options = {}) {
    const scope = normalizeCodePart(options.scope, "APP", 8);
    const action = normalizeCodePart(options.action, "SAVE", 10);
    const operationId = `AR-${scope}-${action}-${uniqueSuffix()}`;
    const totalSteps = Math.max(1, Number(options.totalSteps) || 1);
    const label = String(options.label || "").trim();

    recordEvent({
      level: "info",
      type: "operation-start",
      operationId,
      scope,
      action,
      totalSteps,
      label
    });

    return {
      id: operationId,
      scope,
      action,
      totalSteps,
      label,
      progress(step, detail = "", optionsForProgress = {}) {
        const safeStep = Math.min(totalSteps, Math.max(1, Number(step) || 1));
        const percent = Number.isFinite(Number(optionsForProgress.percent))
          ? Math.max(0, Math.min(100, Number(optionsForProgress.percent)))
          : Math.round((safeStep / totalSteps) * 100);

        return {
          operationId,
          step: safeStep,
          totalSteps,
          detail,
          percent
        };
      },
      errorCode(step, error) {
        const stepPart = normalizeCodePart(step, "STEP", 10);
        const category = classifyError(error);
        const code = `${operationId}-${stepPart}-${category}`;
        recordEvent({
          level: "error",
          type: "operation-error",
          operationId,
          code,
          step: stepPart,
          category,
          message: describeError(error),
          stack: error?.stack || ""
        });
        return code;
      },
      success(detail = "") {
        recordEvent({
          level: "info",
          type: "operation-success",
          operationId,
          detail
        });
      }
    };
  }

  function formatError(operation, error, step, fallbackMessage = "Unable to save right now.") {
    const code = operation?.errorCode
      ? operation.errorCode(step, error)
      : `AR-APP-SAVE-${normalizeCodePart(step, "STEP", 10)}-${classifyError(error)}-${uniqueSuffix()}`;
    const detail = describeError(error);
    const message = `${fallbackMessage} Code: ${code}`;

    return { code, detail, message };
  }

  function attachError(error, operation, step, fallbackMessage = "Unable to save right now.") {
    const formatted = formatError(operation, error, step, fallbackMessage);
    const wrapped = error instanceof Error ? error : new Error(formatted.detail);
    wrapped.debugCode = formatted.code;
    wrapped.debugDetail = formatted.detail;
    wrapped.userMessage = formatted.message;
    return wrapped;
  }

  function getErrorMessage(error, fallbackMessage = "Unable to save right now.") {
    if (error?.userMessage) {
      return error.userMessage;
    }

    if (error?.debugCode) {
      return `${fallbackMessage} Code: ${error.debugCode}`;
    }

    return describeError(error, fallbackMessage);
  }

  function appendStatusDetails(container, options = {}) {
    if (!container) {
      return;
    }

    const progress = options.progress || null;
    const code = options.code || "";
    const detail = options.detail || "";

    if (progress) {
      const progressWrap = document.createElement("div");
      progressWrap.className = "status-progress";
      progressWrap.setAttribute("aria-hidden", "true");

      const progressFill = document.createElement("span");
      progressFill.style.width = `${Math.max(3, Math.min(100, Number(progress.percent) || 0))}%`;
      progressWrap.appendChild(progressFill);

      const progressMeta = document.createElement("div");
      progressMeta.className = "status-progress-meta";
      progressMeta.textContent = [
        progress.operationId,
        `Step ${progress.step}/${progress.totalSteps}`,
        progress.detail
      ].filter(Boolean).join(" - ");

      container.appendChild(progressWrap);
      container.appendChild(progressMeta);
    }

    if (code) {
      const codeNode = document.createElement("code");
      codeNode.className = "status-error-code";
      codeNode.textContent = `Code: ${code}`;
      container.appendChild(codeNode);
    }

    if (detail && code) {
      const detailNode = document.createElement("span");
      detailNode.className = "status-debug-detail";
      detailNode.textContent = detail;
      container.appendChild(detailNode);
    }
  }

  window.AppointmentReminderDebug = {
    ...(window.AppointmentReminderDebug || {}),
    attachError,
    appendStatusDetails,
    classifyError,
    createOperation,
    describeError,
    formatError,
    getErrorMessage,
    recordEvent
  };
})();
