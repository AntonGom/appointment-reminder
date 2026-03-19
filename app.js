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
  lines.push("Please reply if you have any questions or need to make a change.");
  lines.push("");
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

async function sendBrevoEmail() {
  let email = getEmail();
  let message = getMessage();

  if (!email) {
    alert("Email is required");
    return;
  }

  if (!message) {
    alert("Message is required");
    return;
  }

  const res = await fetch("/api/send-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      clientEmail: email,
      message: message
    })
  });

  const data = await res.json();

  if (res.ok && data.success) {
    alert("Reminder sent!");
  } else {
    alert(data.error || "Error sending email");
  }
}

function sendLocalEmail() {
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
