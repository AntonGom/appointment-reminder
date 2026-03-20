function formatTime(time) {
  if (!time) return "";
  let [hour, minute] = time.split(":");
  hour = parseInt(hour);
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
  return document.getElementById(id).value.trim();
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

document.querySelectorAll("input, textarea").forEach(el => {
  if (el.id !== "preview") {
    el.addEventListener("input", () => {
      document.getElementById("preview").value = generateMessage();
    });
  }
});

document.getElementById("preview").value = generateMessage();

function getMessage() {
  return document.getElementById("preview").value.trim();
}

function getEmail() {
  return getFieldValue("email");
}

function getPhone() {
  return getFieldValue("phone");
}

function getReminderPayload() {
  return {
    clientEmail: getEmail(),
    message: getMessage(),
    clientName: getFieldValue("name"),
    clientPhone: getFieldValue("phone"),
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
  const fieldLengthLimit = 300;

  const linkPattern = /(https?:\/\/|www\.|[a-z0-9-]+\.(com|net|org|io|co|info|biz|me|us|ly|app|gg|tv|xyz))/i;
  const restrictedFields = [
    { label: "Client Name", value: name },
    { label: "Client Phone Number", value: phone },
    { label: "Service Address", value: address },
    { label: "Your Contact Info", value: businessContact },
    { label: "Additional Details", value: notes },
    { label: "Message Preview", value: message }
  ];

  for (const field of restrictedFields) {
    if (field.label !== "Message Preview" && field.value.length > fieldLengthLimit) {
      alert(`${field.label} cannot be longer than ${fieldLengthLimit} characters.`);
      return false;
    }

    if (linkPattern.test(field.value)) {
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

  let phone = getPhone();
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
