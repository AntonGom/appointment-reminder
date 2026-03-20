export default function handler(req, res) {
  const {
    title = "Appointment Reminder",
    description = "",
    location = "",
    date = "",
    time = ""
  } = req.query;

  if (!date) {
    return res.status(400).send("Missing date");
  }

  const safeTitle = sanitizeText(title);
  const safeDescription = sanitizeText(description);
  const safeLocation = sanitizeText(location);
  const fileName = "appointment-reminder.ics";

  const icsContent = buildIcs({
    title: safeTitle,
    description: safeDescription,
    location: safeLocation,
    date,
    time
  });

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  return res.status(200).send(icsContent);
}

function buildIcs({ title, description, location, date, time }) {
  const uid = `${Date.now()}@appointment-reminder`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

  if (!time) {
    const nextDate = addDays(date, 1).replace(/-/g, "");

    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Appointment Reminder//EN",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${date.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${nextDate}`,
      `SUMMARY:${escapeIcsText(title)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      `LOCATION:${escapeIcsText(location)}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");
  }

  const endTime = addOneHour(time);

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Appointment Reminder//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${formatDateTime(date, time)}`,
    `DTEND:${formatDateTime(date, endTime)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText(location)}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}

function sanitizeText(value) {
  return String(value || "").trim();
}

function escapeIcsText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatDateTime(dateString, timeString) {
  return `${dateString.replace(/-/g, "")}T${timeString.replace(":", "")}00`;
}

function addOneHour(time) {
  const [hours, minutes] = time.split(":").map(Number);
  const totalMinutes = ((hours * 60) + minutes + 60) % (24 * 60);
  const nextHours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const nextMinutes = String(totalMinutes % 60).padStart(2, "0");
  return `${nextHours}:${nextMinutes}`;
}

function addDays(dateString, daysToAdd) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + daysToAdd);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
