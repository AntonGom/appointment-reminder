function formatTime(time) {
  if (!time) return "";
  let [hour, minute] = time.split(":");
  hour = parseInt(hour);
  let ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return hour + ":" + minute + " " + ampm;
}

function generateMessage() {
  let name = document.getElementById("name").value;
  let date = document.getElementById("date").value;
  let time = document.getElementById("time").value;
  let notes = document.getElementById("notes").value;

  let msg = "Reminder";

  if (name) msg += " for " + name;
  if (date || time) {
    msg += ":\n";
    if (date) msg += "Date: " + date + "\n";
    if (time) msg += "Time: " + formatTime(time) + "\n";
  }
  if (notes) msg += "Note: " + notes;

  return msg;
}

document.querySelectorAll("input, textarea").forEach(el => {
  if (el.id !== "preview") {
    el.addEventListener("input", () => {
      document.getElementById("preview").value = generateMessage();
    });
  }
});

async function sendReminder() {
  let email = document.getElementById("email").value;
  let message = document.getElementById("preview").value;

  if (!email) {
    alert("Email is required");
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

  if (data.success) {
    alert("Reminder sent!");
  } else {
    alert("Error sending email");
  }
}