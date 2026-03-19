// app.js

let userEdited = false;

// Detect mobile devices
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// Track if user manually edits the preview
document.getElementById("preview").addEventListener("input", () => {
  userEdited = true;
});

// Update required field styling for phone
function updateRequiredField() {
  let phoneInput = document.getElementById("phone");
  if (phoneInput.value.trim() === "") {
    phoneInput.classList.add("required");
  } else {
    phoneInput.classList.remove("required");
  }
}

document.getElementById("phone").addEventListener("input", updateRequiredField);

// Format time from 24h to AM/PM
function formatTime(time) {
  if (!time) return "";
  let [hour, minute] = time.split(":");
  hour = parseInt(hour);
  let ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return hour + ":" + minute + " " + ampm;
}

// Generate message preview
function generateMessage() {
  let name = document.getElementById("name").value;
  let date = document.getElementById("date").value;
  let time = document.getElementById("time").value;
  let notes = document.getElementById("notes").value;
  let address = document.getElementById("address").value;

  let message = "Reminder";

  if (name) message += " for " + name;

  if (date || time) {
    message += ":\n";
    if (date) message += "Date: " + date + "\n";
    if (time) message += "Time: " + formatTime(time) + "\n";
  }

  if (address) message += "Location: " + address + "\n";
  if (notes) message += "Note: " + notes;

  if (message === "Reminder") {
    message = "Your message will appear here...";
  }

  return message;
}

// Update message preview automatically unless user edited it
function updatePreview() {
  if (!userEdited) {
    document.getElementById("preview").value = generateMessage();
  }
}

document.querySelectorAll("input, textarea").forEach(el => {
  if (el.id !== "preview") {
    el.addEventListener("input", updatePreview);
  }
});

// Send reminder via Brevo backend
async function sendReminder() {
  const phone = document.getElementById("phone").value;
  const email = document.getElementById("email").value;
  const message = document.getElementById("preview").value;

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

      const data = await response.json(); // safe because backend always returns JSON

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

// 📱 SMS behavior
function manualSMS() {
  let phone = document.getElementById("phone").value;
  let message = encodeURIComponent(document.getElementById("preview").value);

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

// 📧 Email behavior (manual)
function manualEmail() {
  let email = document.getElementById("email").value;
  let message = encodeURIComponent(document.getElementById("preview").value);

  if (!email.trim()) {
    alert("Email required.");
    return;
  }

  // Works on both mobile + desktop
  window.location.href = `mailto:${email}?subject=Reminder&body=${message}`;
}

// Initialize required field styling
updateRequiredField();
