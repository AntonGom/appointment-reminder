// app.js - FULL COPY & PASTE

let userEdited = false;

// Detect mobile devices
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// Cache the preview textarea
const previewEl = document.getElementById("preview");
if (previewEl) {
  previewEl.addEventListener("input", () => {
    userEdited = true;
  });
}

// Update phone required styling
function updateRequiredField() {
  const phoneInput = document.getElementById("phone");
  if (!phoneInput) return;
  if (phoneInput.value.trim() === "") {
    phoneInput.classList.add("required");
  } else {
    phoneInput.classList.remove("required");
  }
}

const phoneInputEl = document.getElementById("phone");
if (phoneInputEl) phoneInputEl.addEventListener("input", updateRequiredField);

// Format time to AM/PM
function formatTime(time) {
  if (!time) return "";
  let [hour, minute] = time.split(":");
  hour = parseInt(hour);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return hour + ":" + minute + " " + ampm;
}

// Generate message preview text
function generateMessage() {
  const name = document.getElementById("name")?.value || "";
  const date = document.getElementById("date")?.value || "";
  const time = document.getElementById("time")?.value || "";
  const notes = document.getElementById("notes")?.value || "";
  const address = document.getElementById("address")?.value || "";

  let message = "Reminder";

  if (name) message += " for " + name;

  if (date || time) {
    message += ":\n";
    if (date) message += "Date: " + date + "\n";
    if (time) message += "Time: " + formatTime(time) + "\n";
  }

  if (address) message += "Location: " + address + "\n";
  if (notes) message += "Note: " + notes;

  if (message === "Reminder") message = "Your message will appear here...";

  return message;
}

// Update preview if user hasn't manually edited
function updatePreview() {
  if (!userEdited && previewEl) {
    previewEl.value = generateMessage();
  }
}

// Attach input listeners for automatic preview
document.querySelectorAll("input, textarea").forEach(el => {
  if (el.id !== "preview") {
    el.addEventListener("input", updatePreview);
  }
});

// Send reminder using Brevo backend
async function sendReminder() {
  const phone = document.getElementById("phone")?.value || "";
  const email = document.getElementById("email")?.value || "";
  const message = previewEl?.value || "";

  if (!phone.trim() && !email.trim()) {
    alert("Please provide at least a phone number or email.");
    return;
  }

  try {
    if (email.trim()) {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientEmail: email, message }),
      });

      let data;
      try {
        data = await response.json();
      } catch (err) {
        const text = await response.text();
        console.error("Backend response was not JSON:", text);
        alert("❌ Server error:\n" + text);
        return;
      }

      if (data.success) {
        alert("✅ Email sent successfully!");
      } else {
        alert("❌ Failed to send email:\n" + (data.details || 'Unknown error'));
      }
    } else {
      alert("No email provided, only phone number will be used for SMS.");
    }
  } catch (err) {
    console.error("Frontend fetch error:", err);
    alert("❌ Could not reach the server: " + err.message);
  }
}

// Manual SMS button
function manualSMS() {
  const phone = document.getElementById("phone")?.value || "";
  const message = encodeURIComponent(previewEl?.value || "");

  if (!phone.trim()) {
    alert("Phone number required.");
    return;
  }

  if (isMobile) {
    window.location.href = `sms:${phone}?body=${message}`;
  } else {
    alert("SMS can only be sent from a mobile device.");
  }
}

// Manual Email button
function manualEmail() {
  const email = document.getElementById("email")?.value || "";
  const message = encodeURIComponent(previewEl?.value || "");

  if (!email.trim()) {
    alert("Email required.");
    return;
  }

  window.location.href = `mailto:${email}?subject=Reminder&body=${message}`;
}

// Initialize required field styling
updateRequiredField();
