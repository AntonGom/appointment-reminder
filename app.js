const FIELD_LIMITS = {
  name: { label: "Client Name", maxLength: 30 },
  phone: { label: "Client Phone Number", maxLength: 30 },
  address: { label: "Service Address", maxLength: 40 },
  businessContact: { label: "Your Contact Info", maxLength: 30 }
};

const PHONE_DIGIT_LIMIT = 10;
const FORM_FIELD_IDS = ["phone", "email", "name", "address", "businessContact", "date", "time", "notes"];

let currentStepIndex = 0;
let wizardSteps = [];

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

function getFieldValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : "";
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
}

function generateMessage() {
  let name = getFieldValue("name");
  let phone = getFieldValue("phone");
  let address = getFieldValue("address");
  let businessContact = getFieldValue("businessContact");
  let date = getFieldValue("date");
  let time = getFieldValue("time");
  let notes = getFieldValue("notes");

  let lines = [];
  let greeting = name ? "Hello " + name + "," : "Hello,";

  lines.push(greeting);
  lines.push("");
  lines.push("This is a friendly reminder about your upcoming appointment.");

  if (date) lines.push("Date: " + formatDate(date));
  if (time) lines.push("Time: " + formatTime(time));
  if (address) lines.push("Location: " + address);
  if (phone) lines.push("Contact Number: " + phone);

  if (notes) {
    lines.push("");
    lines.push("Additional Details:");
    lines.push(notes);
  }

  lines.push("");
  if (businessContact) {
    lines.push("If you need to reach us before your appointment, please contact us at " + businessContact + ".");
    lines.push("");
  }
  lines.push("Thank you,");
  lines.push("Appointment Reminder");

  return lines.join("\n");
}

function refreshFormState() {
  const preview = document.getElementById("preview");

  if (preview) {
    preview.value = generateMessage();
    updatePreviewLayout();
  }

  syncFieldLimitErrors();
}

function syncFieldLimitErrors() {
  for (const [fieldId, config] of Object.entries(FIELD_LIMITS)) {
    const value = getFieldValue(fieldId);
    const errorElement = document.getElementById(`${fieldId}-error`);

    if (!errorElement) {
      continue;
    }

    if (value.length > config.maxLength) {
      errorElement.textContent = `${config.label} cannot be longer than ${config.maxLength} characters.`;
      errorElement.classList.add("visible");
    } else {
      errorElement.textContent = "";
      errorElement.classList.remove("visible");
    }
  }
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

function getReminderPayload() {
  return {
    clientEmail: getEmail(),
    message: getMessage(),
    clientName: getFieldValue("name"),
    clientPhone: getPhoneDigits(),
    serviceAddress: getFieldValue("address"),
    businessContact: getFieldValue("businessContact"),
    serviceDate: getFieldValue("date"),
    serviceTime: getFieldValue("time")
  };
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

function validateMessageSafety() {
  const name = getFieldValue("name");
  const notes = getFieldValue("notes");
  const phone = getFieldValue("phone");
  const address = getFieldValue("address");
  const businessContact = getFieldValue("businessContact");
  const message = getMessage();
  const combined = `${notes}\n${message}`.toLowerCase();
  const messageLengthLimit = 1200;

  const strictLinkPattern = /(https?:\/\/|www\.)/i;
  const domainPattern = /(^|\s)[a-z0-9-]+\.(com|net|org|io|co|info|biz|me|us|ly|app|gg|tv|xyz)(\/|\s|$)/i;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
  const restrictedFields = [
    { label: "Client Name", value: name, maxLength: FIELD_LIMITS.name.maxLength },
    { label: "Client Phone Number", value: phone, maxLength: FIELD_LIMITS.phone.maxLength },
    { label: "Service Address", value: address, maxLength: FIELD_LIMITS.address.maxLength },
    { label: "Your Contact Info", value: businessContact, maxLength: FIELD_LIMITS.businessContact.maxLength, allowEmail: true },
    { label: "Additional Details", value: notes },
    { label: "Message Preview", value: message }
  ];

  for (const field of restrictedFields) {
    if (field.maxLength && field.value.length > field.maxLength) {
      alert(`${field.label} cannot be longer than ${field.maxLength} characters.`);
      return false;
    }

    const hasLink = strictLinkPattern.test(field.value) || domainPattern.test(field.value);
    const hasEmail = field.allowEmail && emailPattern.test(field.value);
    if (hasLink && !hasEmail) {
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

function focusStepField(step) {
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
  const stepCount = document.getElementById("step-count");
  const stepTitle = document.getElementById("step-title");
  const stepCopy = document.getElementById("step-copy");
  const stepPill = document.getElementById("step-pill");
  const progressStatus = document.getElementById("progress-status");
  const progressFill = document.getElementById("progress-fill");
  const backButton = document.getElementById("back-button");
  const skipButton = document.getElementById("skip-button");
  const nextButton = document.getElementById("next-button");
  const wizardControls = document.querySelector(".wizard-controls");
  const isFinalStep = currentStepIndex === totalSteps - 1;
  const isOptional = currentStep.dataset.optional === "true";

  wizardSteps.forEach((step, index) => {
    step.classList.toggle("active", index === currentStepIndex);
  });

  stepCount.textContent = `Step ${currentStepIndex + 1} of ${totalSteps}`;
  stepTitle.textContent = currentStep.dataset.title || "";
  stepCopy.textContent = currentStep.dataset.copy || "";
  progressStatus.textContent = getProgressStatus(currentStepIndex, totalSteps);
  progressFill.style.width = `${((currentStepIndex + 1) / totalSteps) * 100}%`;

  if (isFinalStep) {
    stepPill.textContent = "Final Step";
    stepPill.className = "step-pill final";
  } else {
    stepPill.textContent = isOptional ? "Optional" : "Required";
    stepPill.className = "step-pill";
  }

  backButton.hidden = currentStepIndex === 0;
  skipButton.hidden = isFinalStep || !isOptional;
  nextButton.hidden = isFinalStep;
  nextButton.textContent = currentStepIndex === totalSteps - 2 ? "Review" : "Next";

  if (wizardControls) {
    const visibleButtons = [backButton, skipButton, nextButton].filter(button => !button.hidden).length;
    wizardControls.classList.remove("one-button", "two-buttons");

    if (visibleButtons === 1) {
      wizardControls.classList.add("one-button");
    } else if (visibleButtons === 2) {
      wizardControls.classList.add("two-buttons");
    }
  }

  focusStepField(currentStep);
}

function setStep(index) {
  if (index < 0 || index >= wizardSteps.length) {
    return;
  }

  currentStepIndex = index;
  updateWizardUI();
}

function moveToNextStep() {
  setStep(currentStepIndex + 1);
}

function initWizard() {
  wizardSteps = Array.from(document.querySelectorAll(".wizard-step"));

  if (!wizardSteps.length) {
    return;
  }

  const backButton = document.getElementById("back-button");
  const skipButton = document.getElementById("skip-button");
  const nextButton = document.getElementById("next-button");

  backButton.addEventListener("click", () => setStep(currentStepIndex - 1));
  skipButton.addEventListener("click", moveToNextStep);
  nextButton.addEventListener("click", moveToNextStep);

  wizardSteps.forEach((step, index) => {
    step.querySelectorAll("input").forEach(input => {
      if (input.type === "date" || input.type === "time" || input.type === "checkbox") {
        return;
      }

      input.addEventListener("keydown", event => {
        if (event.key === "Enter" && index === currentStepIndex) {
          event.preventDefault();

          if (currentStepIndex < wizardSteps.length - 1) {
            moveToNextStep();
          }
        }
      });
    });
  });

  updateWizardUI();
}

FORM_FIELD_IDS.forEach(fieldId => {
  const element = document.getElementById(fieldId);

  if (!element) {
    return;
  }

  element.addEventListener("input", () => {
    if (fieldId === "phone") {
      syncPhoneFieldFormatting();
    }

    refreshFormState();
  });
});

syncPhoneFieldFormatting();
refreshFormState();
initWizard();

async function sendBrevoEmail() {
  if (!requireConsent()) {
    return;
  }

  if (!validateMessageSafety()) {
    return;
  }

  let payload = getReminderPayload();
  let email = payload.clientEmail;
  let message = payload.message;

  if (!email) {
    alert("Email is required");
    return;
  }

  if (!message) {
    alert("Message is required");
    return;
  }

  const confirmed = window.confirm("Are you sure you want to send this automated email?");
  if (!confirmed) {
    return;
  }

  const res = await fetch("/api/send-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (res.ok && data.success) {
    alert("Reminder sent!");
  } else {
    alert(data.error || "Error sending email");
  }
}

function sendLocalEmail() {
  if (!requireConsent()) {
    return;
  }

  if (!validateMessageSafety()) {
    return;
  }

  let email = getEmail();
  let message = getMessage();

  if (!email) {
    alert("Client email is required");
    return;
  }

  if (!message) {
    alert("Message is required");
    return;
  }

  const subject = encodeURIComponent("Appointment Reminder");
  const body = encodeURIComponent(message);
  window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
}

async function sendLocalText() {
  if (!requireConsent()) {
    return;
  }

  if (!validateMessageSafety()) {
    return;
  }

  let phone = getPhoneDigits();
  let message = getMessage();

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

  const smsBody = encodeURIComponent(message);
  const separator = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "&" : "?";
  window.location.href = `sms:${encodeURIComponent(phone)}${separator}body=${smsBody}`;
}

function sendTwilioText() {
  alert("Twilio text sending will be added later.");
}
