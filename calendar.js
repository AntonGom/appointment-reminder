import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const statusBanner = document.getElementById("status-banner");
const authSetupNotice = document.getElementById("auth-setup-notice");
const signedOutShell = document.getElementById("signed-out-shell");
const freeShell = document.getElementById("free-shell");
const bronzeShell = document.getElementById("bronze-shell");
const pricePill = document.getElementById("price-pill");
const appointmentsSetupNotice = document.getElementById("appointments-setup-notice");
const calendarLoading = document.getElementById("calendar-loading");
const calendarLayout = document.getElementById("calendar-layout");
const calendarMonthLabel = document.getElementById("calendar-month-label");
const calendarMonthGrid = document.getElementById("calendar-month-grid");
const calendarMonthWeekdays = document.getElementById("calendar-month-weekdays");
const calendarMonthShell = document.getElementById("calendar-month-shell");
const calendarWeekShell = document.getElementById("calendar-week-shell");
const calendarWeekGrid = document.getElementById("calendar-week-grid");
const monthViewButton = document.getElementById("calendar-month-view");
const weekViewButton = document.getElementById("calendar-week-view");
const calendarMonthJump = document.getElementById("calendar-month-jump");
const upcomingList = document.getElementById("upcoming-list");
const previousList = document.getElementById("previous-list");
const upcomingCount = document.getElementById("upcoming-count");
const previousCount = document.getElementById("previous-count");
const monthCount = document.getElementById("month-count");
const monthSelect = document.getElementById("calendar-month-select");
const yearSelect = document.getElementById("calendar-year-select");
const prevButton = document.getElementById("calendar-prev");
const todayButton = document.getElementById("calendar-today");
const nextButton = document.getElementById("calendar-next");
const allAppointmentsList = document.getElementById("all-appointments-list");
const appointmentDetailModal = document.getElementById("appointment-detail-modal");
const appointmentDetailTitle = document.getElementById("appointment-detail-title");
const appointmentDetailCopy = document.getElementById("appointment-detail-copy");
const appointmentDetailBody = document.getElementById("appointment-detail-body");
const closeAppointmentDetailButton = document.getElementById("close-appointment-detail-button");
const statusHelpModal = document.getElementById("status-help-modal");
const statusHelpCopy = document.getElementById("status-help-copy");
const closeStatusHelpButton = document.getElementById("close-status-help-button");

let supabase = null;
let appConfig = null;
let appointments = [];
let reminderHistory = [];
let appointmentsReady = true;
let viewMonth = startOfMonth(new Date());
let selectedDateKey = getTodayKey();
let currentAuthUserId = "";
const MOBILE_CALENDAR_QUERY = window.matchMedia("(max-width: 760px)");
let currentCalendarView = MOBILE_CALENDAR_QUERY.matches ? "month" : "week";
const WEEK_HOURS = Array.from({ length: 13 }, (_value, index) => index + 7);

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

function isBronzeUser(user) {
  return getTierKey(user) === "bronze";
}

function setLoadingState(isLoading) {
  if (calendarLoading) {
    calendarLoading.hidden = !isLoading;
  }

  if (calendarLayout && isLoading) {
    calendarLayout.hidden = true;
  }
}

function clearCounts() {
  if (upcomingCount) {
    upcomingCount.textContent = "0";
  }

  if (previousCount) {
    previousCount.textContent = "0";
  }

  if (monthCount) {
    monthCount.textContent = "0";
  }
}

function updateSignedInView(user) {
  const isSignedIn = Boolean(user);
  const isBronze = isSignedIn && isBronzeUser(user);

  if (signedOutShell) {
    signedOutShell.hidden = isSignedIn;
  }

  if (freeShell) {
    freeShell.hidden = !(isSignedIn && !isBronze);
  }

  if (bronzeShell) {
    bronzeShell.hidden = !isBronze;
  }

  if (pricePill) {
    if (!isSignedIn) {
      pricePill.textContent = "Optional Bronze";
    } else if (isBronze) {
      pricePill.textContent = "Bronze Active";
    } else {
      pricePill.textContent = "Free Account";
    }
  }

  if (!isBronze) {
    clearCounts();
    if (calendarLayout) {
      calendarLayout.hidden = true;
    }
    if (appointmentsSetupNotice) {
      appointmentsSetupNotice.hidden = true;
    }
    if (upcomingList) {
      upcomingList.innerHTML = "";
    }
    if (previousList) {
      previousList.innerHTML = "";
    }
    if (allAppointmentsList) {
      allAppointmentsList.innerHTML = "";
    }
  }
}

async function getPublicConfig() {
  const response = await fetch("/api/public-config", { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Unable to load account configuration.");
  }

  return response.json();
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function addDays(date, amount) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

function startOfWeek(date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() - nextDate.getDay());
  return nextDate;
}

function addWeeks(date, amount) {
  return addDays(date, amount * 7);
}

function formatMonthLabel(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
  }).format(date);
}

function formatWeekLabel(startDate, endDate) {
  const sameMonth = startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear();

  if (sameMonth) {
    return `${new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(startDate)} | ${startDate.getDate()}-${endDate.getDate()}`;
  }

  return `${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(startDate)} - ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(endDate)}`;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseAppointmentDateTime(appointment) {
  const serviceDate = String(appointment?.service_date || "").trim();

  if (!serviceDate) {
    return null;
  }

  const [yearText, monthText, dayText] = serviceDate.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!year || !month || !day) {
    return null;
  }

  const timeText = String(appointment?.service_time || "").trim();
  const timeParts = timeText ? timeText.split(":") : [];
  const hours = timeParts.length >= 2 ? Number(timeParts[0]) : 23;
  const minutes = timeParts.length >= 2 ? Number(timeParts[1]) : 59;

  return new Date(year, month - 1, day, Number.isFinite(hours) ? hours : 23, Number.isFinite(minutes) ? minutes : 59);
}

function formatAppointmentDate(appointment) {
  const date = parseAppointmentDateTime(appointment);

  if (!date) {
    return "Date not available";
  }

  const hasTime = Boolean(String(appointment?.service_time || "").trim());

  return new Intl.DateTimeFormat("en-US", hasTime
    ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" }
  ).format(date);
}

function formatAppointmentChipMeta(appointment) {
  const timeText = String(appointment?.service_time || "").trim();

  if (!timeText) {
    return "No time set";
  }

  const parts = timeText.split(":");
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return timeText;
  }

  const date = new Date(2000, 0, 1, hours, minutes);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 10);
}

function formatPhone(value) {
  const digits = normalizePhone(value);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function getAppointmentTitle(appointment) {
  return appointment.client_name || appointment.client_email || appointment.client_phone || "Appointment";
}

function getAppointmentTags(appointment) {
  const tags = [];

  if (appointment?.last_channel === "email") {
    tags.push("Email");
  }

  if (appointment?.last_channel === "sms") {
    tags.push("Text");
  }

  if (appointment?.service_location) {
    tags.push("Location saved");
  }

  return tags;
}

function getReminderHistoryChannelLabel(entry) {
  if (entry?.channel === "email") {
    return "Email reminder";
  }

  if (entry?.channel === "sms") {
    return "Text reminder";
  }

  return "Reminder";
}

function getReminderStatusLabel(entry) {
  const rawStatus = String(
    entry?.status ||
    entry?.event_type ||
    entry?.event ||
    ""
  ).trim().toLowerCase();

  if (rawStatus.includes("delivered")) {
    return "Delivered";
  }

  if (rawStatus.includes("request") || rawStatus.includes("send")) {
    return "Sent";
  }

  if (rawStatus.includes("proxy") || rawStatus.includes("open")) {
    return "Likely opened";
  }

  if (rawStatus.includes("calendar")) {
    return "Calendar clicked";
  }

  if (rawStatus.includes("click")) {
    return "Clicked";
  }

  return "Sent";
}

function getReminderStatusClass(label) {
  const normalized = String(label || "").trim().toLowerCase();

  if (normalized.includes("delivered")) {
    return "delivered";
  }

  if (normalized.includes("opened")) {
    return "opened";
  }

  if (normalized.includes("clicked")) {
    return "clicked";
  }

  return "sent";
}

function getStatusHelpText(label) {
  const normalized = String(label || "").trim().toLowerCase();

  if (normalized === "likely opened") {
    return "We highly believe the client has opened this message from the return information we received, but we cannot 100% guarantee they opened this email.";
  }

  return "";
}

function renderStatusLabelWithHelp(label) {
  const helpText = getStatusHelpText(label);
  const iconMarkup = helpText
    ? `<button class="status-help-button" type="button" data-status-help="${escapeHtml(helpText)}" aria-label="What does ${escapeHtml(label)} mean?" title="${escapeHtml(helpText)}">?</button>`
    : "";

  return `
    <span class="status-pill ${getReminderStatusClass(label)}">
      <span>${escapeHtml(label)}</span>
      ${iconMarkup}
    </span>
  `;
}

function formatReminderHistoryDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function getReminderEventTimestamp(entry) {
  const candidates = [
    entry?.occurred_at,
    entry?.event_at,
    entry?.opened_at,
    entry?.delivered_at,
    entry?.clicked_at,
    entry?.sent_at,
    entry?.created_at
  ];

  for (const candidate of candidates) {
    const timestamp = new Date(candidate || 0).getTime();
    if (Number.isFinite(timestamp) && timestamp > 0) {
      return timestamp;
    }
  }

  return 0;
}

function getReminderEventTimeLabel(entry) {
  const candidates = [
    entry?.occurred_at,
    entry?.event_at,
    entry?.opened_at,
    entry?.delivered_at,
    entry?.clicked_at,
    entry?.sent_at,
    entry?.created_at
  ];

  for (const candidate of candidates) {
    const formatted = formatReminderHistoryDateTime(candidate);
    if (formatted) {
      return formatted;
    }
  }

  return "Not available";
}

function getReminderMessagePreview(entry) {
  const directPreview = String(entry?.message_preview || "").trim();

  if (directPreview) {
    return directPreview;
  }

  return String(entry?.raw_event?.message_preview || entry?.raw_event?.message || "").trim();
}

function normalizeReminderPreview(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function getDedupedReminderHistoryEntries(entries) {
  const sortedEntries = [...(entries || [])].sort((left, right) => getReminderEventTimestamp(right) - getReminderEventTimestamp(left));
  const seenKeys = new Set();

  return sortedEntries.filter(entry => {
    const dedupeKey = [
      String(entry?.channel || "").trim().toLowerCase(),
      getReminderStatusLabel(entry),
      getReminderEventTimeLabel(entry)
    ].join("|");

    if (seenKeys.has(dedupeKey)) {
      return false;
    }

    seenKeys.add(dedupeKey);
    return true;
  });
}

function getGroupedReminderHistory(entries) {
  const dedupedEntries = getDedupedReminderHistoryEntries(entries);
  const groups = [];
  const reminderWindowMs = 15 * 60 * 1000;

  dedupedEntries.forEach(entry => {
    const messageId = String(entry?.message_id || "").trim();
    const messagePreview = String(getReminderMessagePreview(entry) || "").trim();
    const normalizedPreview = normalizeReminderPreview(messagePreview);
    const entryChannel = String(entry?.channel || "").trim().toLowerCase();
    const entryTimestamp = getReminderEventTimestamp(entry);

    const matchingGroup = groups.find(group => {
      const groupMessageId = String(group.messageId || "").trim();
      if (messageId && groupMessageId && messageId === groupMessageId) {
        return true;
      }

      const sameChannel = entryChannel === group.channel;
      const samePreview = normalizedPreview && normalizedPreview === group.normalizedPreview;
      const closeToEarliest = Math.abs(entryTimestamp - group.earliestTimestamp) <= reminderWindowMs;
      const closeToLatest = Math.abs(entryTimestamp - group.latestTimestamp) <= reminderWindowMs;
      return sameChannel && samePreview && (closeToEarliest || closeToLatest);
    });

    if (!matchingGroup) {
      groups.push({
        entries: [entry],
        latestEntry: entry,
        earliestEntry: entry,
        messagePreview,
        messageId,
        channel: entryChannel,
        normalizedPreview,
        earliestTimestamp: entryTimestamp,
        latestTimestamp: entryTimestamp
      });
      return;
    }

    matchingGroup.entries.push(entry);
    if (messageId && !matchingGroup.messageId) {
      matchingGroup.messageId = messageId;
    }
    if (!matchingGroup.messagePreview && messagePreview) {
      matchingGroup.messagePreview = messagePreview;
    }
    if (entryTimestamp > getReminderEventTimestamp(matchingGroup.latestEntry)) {
      matchingGroup.latestEntry = entry;
      matchingGroup.latestTimestamp = entryTimestamp;
    }
    if (entryTimestamp < getReminderEventTimestamp(matchingGroup.earliestEntry)) {
      matchingGroup.earliestEntry = entry;
      matchingGroup.earliestTimestamp = entryTimestamp;
    }
  });

  return groups
    .map(group => ({
      ...group,
      entries: [...group.entries].sort((left, right) => getReminderEventTimestamp(right) - getReminderEventTimestamp(left))
    }))
    .sort((left, right) => getReminderEventTimestamp(right.latestEntry) - getReminderEventTimestamp(left.latestEntry));
}

function getReminderSourceLabel(entry) {
  const source = String(entry?.source || "").trim().toLowerCase();

  if (!source) {
    return "";
  }

  if (source === "automated_email") {
    return "Automated email";
  }

  if (source === "device_sms") {
    return "Text from device";
  }

  if (source === "manual") {
    return "Manual send";
  }

  return source.charAt(0).toUpperCase() + source.slice(1);
}

function getReminderHistoryForAppointment(appointment) {
  if (!appointment) {
    return [];
  }

  const clientId = String(appointment.client_id || "").trim();
  const clientEmail = String(appointment.client_email || "").trim().toLowerCase();
  const clientPhone = normalizePhone(appointment.client_phone || "");

  return reminderHistory.filter(entry => {
    const entryClientId = String(entry?.client_id || "").trim();
    const entryEmail = String(entry?.recipient_email || "").trim().toLowerCase();
    const entryPhone = normalizePhone(entry?.client_phone || "");

    if (clientId && entryClientId && clientId === entryClientId) {
      return true;
    }

    if (clientEmail && entryEmail && clientEmail === entryEmail) {
      return true;
    }

    return Boolean(clientPhone && entryPhone && clientPhone === entryPhone);
  });
}

function renderExpandedReminderHistory(entries) {
  const reminderGroups = getGroupedReminderHistory(entries);

  if (!reminderGroups.length) {
    return `<div class="expanded-empty">No reminder activity for this appointment yet.</div>`;
  }

  return `
    <div class="expanded-history-list">
      ${reminderGroups.map(group => {
        const statusLabel = getReminderStatusLabel(group.latestEntry);
        const channelLabel = getReminderHistoryChannelLabel(group.latestEntry);
        const sourceLabel = getReminderSourceLabel(group.latestEntry);
        const metaParts = [channelLabel, sourceLabel].filter(Boolean);
        const latestUpdateLabel = getReminderEventTimeLabel(group.latestEntry);
        const priorTimelineEntries = group.entries.slice(1);
        const timelineMarkup = priorTimelineEntries.map(entry => {
          const entryStatusLabel = getReminderStatusLabel(entry);
          return `
            <div class="expanded-history-timeline-entry">
              ${renderStatusLabelWithHelp(entryStatusLabel)}
              <span class="expanded-history-timeline-time">${escapeHtml(getReminderEventTimeLabel(entry))}</span>
            </div>
          `;
        }).join("");

        return `
          <div class="expanded-history-group">
            <div class="expanded-history-entry">
              <div class="expanded-history-top">
                ${renderStatusLabelWithHelp(statusLabel)}
                <span class="expanded-history-time">${escapeHtml(latestUpdateLabel)}</span>
              </div>
              <div class="expanded-history-meta">${escapeHtml(metaParts.join(" | ") || "Reminder activity")}</div>
              ${group.messagePreview ? `<div class="expanded-message-preview">${escapeHtml(group.messagePreview).replace(/\n/g, "<br>")}</div>` : ""}
            </div>
            ${timelineMarkup ? `<div class="expanded-history-timeline">${timelineMarkup}</div>` : ""}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function openStatusHelpModal(message) {
  if (!statusHelpModal || !statusHelpCopy) {
    return;
  }

  statusHelpCopy.textContent = message || "This status is estimated.";
  statusHelpModal.hidden = false;
  statusHelpModal.classList.add("visible");
}

function closeStatusHelpModal() {
  if (!statusHelpModal) {
    return;
  }

  statusHelpModal.classList.remove("visible");
  statusHelpModal.hidden = true;
}

function openAppointmentDetailModal(appointmentId) {
  const appointment = appointments.find(entry => String(entry.id || "") === String(appointmentId || ""));

  if (!appointment || !appointmentDetailModal || !appointmentDetailBody) {
    return;
  }

  if (appointmentDetailTitle) {
    appointmentDetailTitle.textContent = getAppointmentTitle(appointment);
  }

  if (appointmentDetailCopy) {
    const summaryParts = [
      appointment.client_email || "",
      appointment.client_phone ? formatPhone(appointment.client_phone) : ""
    ].filter(Boolean);
    appointmentDetailCopy.textContent = summaryParts.join(" | ") || "Saved appointment details and reminder activity.";
  }

  const reminderEntries = getReminderHistoryForAppointment(appointment);
  const appointmentDateLabel = formatAppointmentDate(appointment);

  appointmentDetailBody.innerHTML = `
    <div class="expanded-client-panel modal-client-panel">
      <div class="expanded-client-block">
        <div class="expanded-client-label">Appointment Details</div>
        <div class="expanded-history-dates">
          <div><strong>Scheduled for:</strong> ${escapeHtml(appointmentDateLabel)}</div>
          ${appointment.service_location ? `<div><strong>Location:</strong> ${escapeHtml(appointment.service_location)}</div>` : ""}
          ${appointment.notes ? `<div><strong>Notes:</strong> ${escapeHtml(appointment.notes)}</div>` : ""}
        </div>
      </div>
      <div class="expanded-client-block">
        <div class="expanded-client-label">Full Reminder Activity</div>
        ${renderExpandedReminderHistory(reminderEntries)}
      </div>
    </div>
  `;

  appointmentDetailModal.hidden = false;
  appointmentDetailModal.classList.add("visible");
}

function closeAppointmentDetailModal() {
  if (!appointmentDetailModal) {
    return;
  }

  appointmentDetailModal.classList.remove("visible");
  appointmentDetailModal.hidden = true;
}

function renderAppointmentRow(appointment) {
  const details = [];

  if (appointment.client_email) {
    details.push(appointment.client_email);
  }

  if (appointment.client_phone) {
    details.push(formatPhone(appointment.client_phone));
  }

  if (appointment.service_location) {
    details.push(appointment.service_location);
  }

  return `
    <div class="appointment-row" data-appointment-id="${escapeHtml(appointment.id)}">
      <div class="appointment-row-head">
        <h4 class="appointment-title">${escapeHtml(getAppointmentTitle(appointment))}</h4>
        <div class="appointment-date">${escapeHtml(formatAppointmentDate(appointment))}</div>
      </div>
      ${details.length ? `<div class="appointment-details">${escapeHtml(details.join(" | "))}</div>` : ""}
      ${appointment.notes ? `<div class="appointment-note">${escapeHtml(appointment.notes)}</div>` : ""}
      <div class="appointment-tags">
        ${getAppointmentTags(appointment).map(tag => `<span class="appointment-tag">${escapeHtml(tag)}</span>`).join("")}
      </div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getTodayKey() {
  return formatDateKey(new Date());
}

function getActiveDate() {
  if (selectedDateKey) {
    const date = new Date(`${selectedDateKey}T00:00:00`);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return new Date(viewMonth);
}

function getMonthAppointments(targetMonth) {
  return appointments.filter(appointment => {
    const date = parseAppointmentDateTime(appointment);
    return date && date.getFullYear() === targetMonth.getFullYear() && date.getMonth() === targetMonth.getMonth();
  });
}

function getAppointmentsByDateKey(dateKey) {
  return appointments.filter(appointment => String(appointment?.service_date || "").trim() === String(dateKey || "").trim());
}

function getSelectedDateForMonth(monthAppointments) {
  const selectedDate = selectedDateKey ? new Date(`${selectedDateKey}T00:00:00`) : null;

  if (selectedDate && !Number.isNaN(selectedDate.getTime())) {
    if (selectedDate.getFullYear() === viewMonth.getFullYear() && selectedDate.getMonth() === viewMonth.getMonth()) {
      return selectedDateKey;
    }
  }

  const today = new Date();
  if (today.getFullYear() === viewMonth.getFullYear() && today.getMonth() === viewMonth.getMonth()) {
    return formatDateKey(today);
  }

  if (monthAppointments.length) {
    return String(monthAppointments[0].service_date || "").trim();
  }

  return formatDateKey(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1));
}

function getSelectedDateKeyForCurrentView(monthAppointments) {
  if (currentCalendarView === "week") {
    return formatDateKey(getActiveDate());
  }

  return getSelectedDateForMonth(monthAppointments);
}

function getAppointmentsSortedNewestFirst() {
  return [...appointments].sort((left, right) => parseAppointmentDateTime(right) - parseAppointmentDateTime(left));
}

function isCompactMobileCalendar() {
  return MOBILE_CALENDAR_QUERY.matches;
}

function getWeekDates(anchorDate) {
  const weekStart = startOfWeek(anchorDate);
  return Array.from({ length: 7 }, (_value, index) => addDays(weekStart, index));
}

function getMonthStripDates(anchorDate) {
  const startDate = addDays(anchorDate, -2);
  return Array.from({ length: 35 }, (_value, index) => addDays(startDate, index));
}

function getWeekAppointments(weekDates) {
  const validKeys = new Set(weekDates.map(formatDateKey));
  return appointments.filter(appointment => validKeys.has(String(appointment?.service_date || "").trim()));
}

function setActiveDateMonthYear(nextYear, nextMonth) {
  const activeDate = getActiveDate();
  const nextDate = new Date(nextYear, nextMonth, activeDate.getDate());

  selectedDateKey = formatDateKey(nextDate);
  viewMonth = startOfMonth(nextDate);
}

function getUpcomingAppointments() {
  const now = Date.now();

  return appointments
    .filter(appointment => {
      const date = parseAppointmentDateTime(appointment);
      return date && date.getTime() >= now;
    })
    .sort((left, right) => parseAppointmentDateTime(left) - parseAppointmentDateTime(right));
}

function getPreviousAppointments() {
  const now = Date.now();

  return appointments
    .filter(appointment => {
      const date = parseAppointmentDateTime(appointment);
      return date && date.getTime() < now;
    })
    .sort((left, right) => parseAppointmentDateTime(right) - parseAppointmentDateTime(left));
}

function renderAppointmentList(target, list, emptyMessage) {
  if (!target) {
    return;
  }

  if (!list.length) {
    target.innerHTML = `<div class="empty-state">${escapeHtml(emptyMessage)}</div>`;
    return;
  }

  target.innerHTML = list.map(renderAppointmentRow).join("");
}

function renderAllAppointments() {
  if (!allAppointmentsList) {
    return;
  }

  const sortedAppointments = getAppointmentsSortedNewestFirst();

  if (!sortedAppointments.length) {
    allAppointmentsList.innerHTML = `<div class="empty-state">No appointments have been saved yet.</div>`;
    return;
  }

  const groups = new Map();

  sortedAppointments.forEach(appointment => {
    const date = parseAppointmentDateTime(appointment);
    const year = date ? String(date.getFullYear()) : "Unknown";

    if (!groups.has(year)) {
      groups.set(year, []);
    }

    groups.get(year).push(appointment);
  });

  allAppointmentsList.innerHTML = Array.from(groups.entries()).map(([year, list]) => `
    <div class="appointments-year-group">
      <h4 class="appointments-year-heading">${escapeHtml(year)}</h4>
      ${list.map(renderAppointmentRow).join("")}
    </div>
  `).join("");
}

function renderMonthSelectors() {
  if (!monthSelect || !yearSelect) {
    return;
  }

  const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long" });
  monthSelect.innerHTML = Array.from({ length: 12 }, (_, index) => {
    const label = monthFormatter.format(new Date(2026, index, 1));
    return `<option value="${index}">${escapeHtml(label)}</option>`;
  }).join("");
  monthSelect.value = String(viewMonth.getMonth());

  const appointmentYears = appointments
    .map(appointment => parseAppointmentDateTime(appointment)?.getFullYear())
    .filter(year => Number.isFinite(year));
  const currentYear = new Date().getFullYear();
  const minYear = appointmentYears.length ? Math.min(...appointmentYears, currentYear - 1) : currentYear - 2;
  const maxYear = appointmentYears.length ? Math.max(...appointmentYears, currentYear + 1) : currentYear + 2;
  const yearOptions = [];

  for (let year = minYear - 1; year <= maxYear + 1; year += 1) {
    yearOptions.push(`<option value="${year}">${year}</option>`);
  }

  yearSelect.innerHTML = yearOptions.join("");
  yearSelect.value = String(viewMonth.getFullYear());
}

function renderViewMode() {
  const isWeek = currentCalendarView === "week";

  if (monthViewButton) {
    monthViewButton.classList.toggle("is-active", !isWeek);
    monthViewButton.setAttribute("aria-pressed", String(!isWeek));
  }

  if (weekViewButton) {
    weekViewButton.classList.toggle("is-active", isWeek);
    weekViewButton.setAttribute("aria-pressed", String(isWeek));
  }

  if (calendarMonthShell) {
    calendarMonthShell.hidden = isWeek;
  }

  if (calendarWeekShell) {
    calendarWeekShell.hidden = !isWeek;
  }

  if (calendarMonthJump) {
    calendarMonthJump.hidden = isWeek;
  }

  if (calendarLayout) {
    calendarLayout.classList.toggle("is-week-view", isWeek);
    calendarLayout.classList.toggle("is-month-view", !isWeek);
  }
}

function renderCounts() {
  const upcoming = getUpcomingAppointments();
  const previous = getPreviousAppointments();
  const monthAppointments = getMonthAppointments(viewMonth);

  if (upcomingCount) {
    upcomingCount.textContent = String(upcoming.length);
  }

  if (previousCount) {
    previousCount.textContent = String(previous.length);
  }

  if (monthCount) {
    monthCount.textContent = String(monthAppointments.length);
  }

  renderAppointmentList(upcomingList, upcoming.slice(0, 8), "No upcoming appointments yet.");
  renderAppointmentList(previousList, previous.slice(0, 8), "No previous appointments yet.");
}

function renderMonthGrid() {
  if (!calendarMonthGrid) {
    return;
  }

  const activeDate = getActiveDate();
  const stripDates = getMonthStripDates(activeDate);
  selectedDateKey = formatDateKey(activeDate);
  const isMobile = isCompactMobileCalendar();
  const appointmentsByDay = new Map();

  stripDates.forEach(date => {
    appointmentsByDay.set(formatDateKey(date), []);
  });

  appointments.forEach(appointment => {
    const key = String(appointment.service_date || "").trim();

    if (!key || !appointmentsByDay.has(key)) {
      return;
    }

    appointmentsByDay.get(key).push(appointment);
  });

  const todayKey = getTodayKey();

  if (calendarMonthWeekdays) {
    calendarMonthWeekdays.innerHTML = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      .map(day => `<div class="calendar-weekday">${day}</div>`)
      .join("");
  }

  const cells = stripDates.map(cellDate => {
    const dateKey = formatDateKey(cellDate);
    const dayAppointments = appointmentsByDay.get(dateKey) || [];
    const visibleAppointments = dayAppointments.slice(0, 2);
    const isOtherMonth = cellDate.getMonth() !== activeDate.getMonth();
    const isToday = dateKey === todayKey;
    const isSelected = dateKey === selectedDateKey;
    const showMonthLabel = cellDate.getDate() === 1 || dateKey === selectedDateKey || cellDate.getMonth() !== activeDate.getMonth();
    const mobileDots = Math.min(dayAppointments.length, 3);

    return `
      <div class="calendar-day ${isOtherMonth ? "is-other-month" : ""} ${isToday ? "is-today" : ""} ${dayAppointments.length ? "has-appointments" : ""} ${isSelected ? "is-selected" : ""}" data-date-key="${dateKey}">
        ${showMonthLabel ? `<div class="calendar-day-month-label">${escapeHtml(new Intl.DateTimeFormat("en-US", { month: "short" }).format(cellDate))}</div>` : ""}
        <div class="calendar-day-head">
          <div class="calendar-day-number">${cellDate.getDate()}</div>
          ${dayAppointments.length && !isMobile ? `<div class="calendar-day-count">${dayAppointments.length}</div>` : ""}
        </div>
          <div class="calendar-day-items">
            ${visibleAppointments.map(appointment => `
            <div class="calendar-chip" data-appointment-id="${escapeHtml(appointment.id)}">
              <strong>${escapeHtml(getAppointmentTitle(appointment))}</strong>
              <span>${escapeHtml(formatAppointmentChipMeta(appointment))}</span>
            </div>
          `).join("")}
          ${dayAppointments.length > visibleAppointments.length ? `<div class="calendar-chip-more">+${dayAppointments.length - visibleAppointments.length} more</div>` : ""}
        </div>
        ${isMobile && dayAppointments.length ? `<div class="calendar-day-dots" aria-hidden="true">${Array.from({ length: mobileDots }, () => `<span class="calendar-day-dot"></span>`).join("")}</div>` : ""}
      </div>
    `;
  });

  calendarMonthGrid.innerHTML = cells.join("");
}

function renderMobileWeekGrid() {
  if (!calendarWeekGrid) {
    return;
  }

  const activeDate = getActiveDate();
  const weekDates = getWeekDates(activeDate);
  const todayKey = getTodayKey();
  const appointmentsByDateKey = new Map();

  weekDates.forEach(date => {
    appointmentsByDateKey.set(formatDateKey(date), []);
  });

  getWeekAppointments(weekDates).forEach(appointment => {
    const dateKey = String(appointment?.service_date || "").trim();

    if (!appointmentsByDateKey.has(dateKey)) {
      appointmentsByDateKey.set(dateKey, []);
    }

    appointmentsByDateKey.get(dateKey).push(appointment);
  });

  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  if (calendarMonthLabel) {
    calendarMonthLabel.textContent = formatWeekLabel(weekStart, weekEnd);
  }

  const selectedAppointments = [...(appointmentsByDateKey.get(selectedDateKey) || [])].sort((left, right) => {
    const leftTime = parseAppointmentDateTime(left)?.getTime() || 0;
    const rightTime = parseAppointmentDateTime(right)?.getTime() || 0;
    return leftTime - rightTime;
  });

  const dayButtons = weekDates.map(date => {
    const dateKey = formatDateKey(date);
    const isSelected = dateKey === selectedDateKey;
    const isToday = dateKey === todayKey;
    const count = (appointmentsByDateKey.get(dateKey) || []).length;

    return `
      <button class="calendar-week-mobile-day ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""}" type="button" data-date-key="${dateKey}">
        <span class="calendar-week-mobile-day-name">${new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date)}</span>
        <span class="calendar-week-mobile-day-number">${date.getDate()}</span>
        ${count ? `<span class="calendar-week-mobile-day-count">${count}</span>` : ""}
      </button>
    `;
  }).join("");

  const selectedDateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(new Date(`${selectedDateKey}T00:00:00`));

  const appointmentMarkup = selectedAppointments.length
    ? selectedAppointments.map(appointment => {
      const hasTime = Boolean(String(appointment?.service_time || "").trim());
      return `
        <div class="calendar-week-mobile-row">
          <div class="calendar-week-mobile-time">${escapeHtml(hasTime ? formatAppointmentChipMeta(appointment) : "Any time")}</div>
          <div class="calendar-week-mobile-entry" data-appointment-id="${escapeHtml(appointment.id)}">
            <div class="calendar-week-mobile-title">${escapeHtml(getAppointmentTitle(appointment))}</div>
            <div class="calendar-week-mobile-meta">${escapeHtml(appointment.service_location || appointment.client_email || appointment.client_phone || "Appointment saved")}</div>
            ${appointment.notes ? `<div class="calendar-week-mobile-note">${escapeHtml(appointment.notes)}</div>` : ""}
          </div>
        </div>
      `;
    }).join("")
    : `<div class="empty-state">No appointments are saved for ${escapeHtml(selectedDateLabel)}.</div>`;

  calendarWeekGrid.classList.add("is-mobile-week");
  calendarWeekGrid.innerHTML = `
    <div class="calendar-week-mobile-days">${dayButtons}</div>
    <div class="calendar-week-mobile-agenda">
      <div class="calendar-week-mobile-heading">${escapeHtml(selectedDateLabel)}</div>
      <div class="calendar-week-mobile-list">${appointmentMarkup}</div>
    </div>
  `;
}

function renderWeekGrid() {
  if (!calendarWeekGrid) {
    return;
  }

  if (isCompactMobileCalendar()) {
    renderMobileWeekGrid();
    return;
  }

  calendarWeekGrid.classList.remove("is-mobile-week");

  const activeDate = getActiveDate();
  const weekDates = getWeekDates(activeDate);
  const weekAppointments = getWeekAppointments(weekDates);
  const appointmentsByDateKey = new Map();
  const todayKey = getTodayKey();

  weekDates.forEach(date => {
    appointmentsByDateKey.set(formatDateKey(date), []);
  });

  weekAppointments.forEach(appointment => {
    const dateKey = String(appointment?.service_date || "").trim();

    if (!appointmentsByDateKey.has(dateKey)) {
      appointmentsByDateKey.set(dateKey, []);
    }

    appointmentsByDateKey.get(dateKey).push(appointment);
  });

  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  if (calendarMonthLabel) {
    calendarMonthLabel.textContent = formatWeekLabel(weekStart, weekEnd);
  }

  const headerMarkup = [
    `<div class="calendar-week-corner">Time</div>`,
    ...weekDates.map(date => {
      const dateKey = formatDateKey(date);
      const isSelected = dateKey === selectedDateKey;
      const isToday = dateKey === todayKey;

      return `
        <button class="calendar-week-header ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""}" type="button" data-date-key="${dateKey}">
          <span class="calendar-week-day">${new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date)}</span>
          <span class="calendar-week-date">${date.getDate()}</span>
        </button>
      `;
    })
  ];

  const anyTimeRow = [
    `<div class="calendar-week-time">Any time</div>`,
    ...weekDates.map(date => {
      const dateKey = formatDateKey(date);
      const isSelected = dateKey === selectedDateKey;
      const isToday = dateKey === todayKey;
      const dayAppointments = appointmentsByDateKey.get(dateKey) || [];
      const anyTimeAppointments = dayAppointments.filter(appointment => !String(appointment?.service_time || "").trim());

      return `
        <div class="calendar-week-slot is-anytime ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""}" data-date-key="${dateKey}">
          ${anyTimeAppointments.length ? anyTimeAppointments.map(appointment => `
            <div class="calendar-week-appointment" data-appointment-id="${escapeHtml(appointment.id)}">
              <div class="calendar-week-appointment-title">${escapeHtml(getAppointmentTitle(appointment))}</div>
              <div class="calendar-week-appointment-meta">${escapeHtml(appointment.service_location || "Appointment saved")}</div>
            </div>
          `).join("") : ``}
        </div>
      `;
    })
  ];

  const slotRows = WEEK_HOURS.flatMap(hour => {
    const timeLabel = new Intl.DateTimeFormat("en-US", {
      hour: "numeric"
    }).format(new Date(2000, 0, 1, hour, 0));

    const rowMarkup = [`<div class="calendar-week-time">${timeLabel}</div>`];

    weekDates.forEach(date => {
      const dateKey = formatDateKey(date);
      const isSelected = dateKey === selectedDateKey;
      const isToday = dateKey === todayKey;
      const dayAppointments = appointmentsByDateKey.get(dateKey) || [];
      const slotAppointments = dayAppointments.filter(appointment => {
        const timeText = String(appointment?.service_time || "").trim();

        if (!timeText) {
          return false;
        }

        return Number(timeText.split(":")[0]) === hour;
      });

      rowMarkup.push(`
        <div class="calendar-week-slot ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""} ${slotAppointments.length ? "" : "is-empty"}" data-date-key="${dateKey}">
          ${slotAppointments.map(appointment => `
            <div class="calendar-week-appointment" data-appointment-id="${escapeHtml(appointment.id)}">
              <div class="calendar-week-appointment-title">${escapeHtml(getAppointmentTitle(appointment))}</div>
              <div class="calendar-week-appointment-meta">${escapeHtml(formatAppointmentChipMeta(appointment))}</div>
            </div>
          `).join("")}
        </div>
      `);
    });

    return rowMarkup;
  });

  calendarWeekGrid.innerHTML = [...headerMarkup, ...anyTimeRow, ...slotRows].join("");
}

function renderCalendar() {
  const monthAppointments = getMonthAppointments(viewMonth);
  selectedDateKey = getSelectedDateKeyForCurrentView(monthAppointments);
  renderCounts();
  renderMonthSelectors();
  renderViewMode();
  if (currentCalendarView === "week") {
    renderWeekGrid();
  } else {
    if (calendarMonthLabel) {
      calendarMonthLabel.textContent = formatMonthLabel(viewMonth);
    }
    renderMonthGrid();
  }
  renderAllAppointments();

  if (calendarLayout && appointmentsReady) {
    calendarLayout.hidden = false;
  }
}

async function loadAppointments(user) {
  if (!supabase || !user?.id || !isBronzeUser(user)) {
    appointments = [];
    reminderHistory = [];
    appointmentsReady = true;
    renderCalendar();
    return;
  }

  setLoadingState(true);
  setStatus("");

  try {
    const [appointmentsResult, historyResult] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, client_id, client_name, client_email, client_phone, service_date, service_time, service_location, notes, last_channel, last_source, created_at, updated_at")
        .eq("owner_id", user.id)
        .order("service_date", { ascending: true })
        .order("service_time", { ascending: true }),
      supabase
        .from("client_reminder_history")
        .select("*")
        .eq("owner_id", user.id)
        .order("sent_at", { ascending: false })
        .limit(500)
    ]);

    const { data, error } = appointmentsResult;
    const { data: historyData, error: historyError } = historyResult;

    if (error) {
      if (error.code === "42P01") {
        appointmentsReady = false;
        appointments = [];
        reminderHistory = [];
        if (appointmentsSetupNotice) {
          appointmentsSetupNotice.hidden = false;
        }
        if (calendarLayout) {
          calendarLayout.hidden = true;
        }
        clearCounts();
        renderAppointmentList(upcomingList, [], "Appointments setup is still needed.");
        renderAppointmentList(previousList, [], "Appointments setup is still needed.");
        if (allAppointmentsList) {
          allAppointmentsList.innerHTML = `<div class="empty-state">Appointments setup is still needed.</div>`;
        }
        return;
      }

      throw error;
    }

    if (historyError && historyError.code !== "42P01") {
      throw historyError;
    }

    appointmentsReady = true;
    appointments = data || [];
    reminderHistory = historyData || [];

    if (appointmentsSetupNotice) {
      appointmentsSetupNotice.hidden = true;
    }

    renderCalendar();
  } catch (error) {
    appointments = [];
    reminderHistory = [];
    appointmentsReady = true;
    clearCounts();
    if (calendarLayout) {
      calendarLayout.hidden = true;
    }
    if (allAppointmentsList) {
      allAppointmentsList.innerHTML = `<div class="empty-state">Unable to load appointments right now.</div>`;
    }
    setStatus(error.message || "Unable to load appointments.", "error");
  } finally {
    setLoadingState(false);
  }
}

function bindCalendarControls() {
  if (monthSelect) {
    monthSelect.addEventListener("change", event => {
      const nextMonth = Number(event.target.value);

      if (!Number.isFinite(nextMonth)) {
        return;
      }

      setActiveDateMonthYear(viewMonth.getFullYear(), nextMonth);
      renderCalendar();
    });
  }

  if (yearSelect) {
    yearSelect.addEventListener("change", event => {
      const nextYear = Number(event.target.value);

      if (!Number.isFinite(nextYear)) {
        return;
      }

      setActiveDateMonthYear(nextYear, viewMonth.getMonth());
      renderCalendar();
    });
  }

  if (prevButton) {
    prevButton.addEventListener("click", () => {
      if (currentCalendarView === "week") {
        const nextDate = addWeeks(getActiveDate(), -1);
        selectedDateKey = formatDateKey(nextDate);
        viewMonth = startOfMonth(nextDate);
      } else {
        const nextDate = addMonths(getActiveDate(), -1);
        selectedDateKey = formatDateKey(nextDate);
        viewMonth = startOfMonth(nextDate);
      }
      renderCalendar();
    });
  }

  if (todayButton) {
    todayButton.addEventListener("click", () => {
      const today = new Date();
      selectedDateKey = formatDateKey(today);
      viewMonth = startOfMonth(today);
      renderCalendar();
    });
  }

  if (nextButton) {
    nextButton.addEventListener("click", () => {
      if (currentCalendarView === "week") {
        const nextDate = addWeeks(getActiveDate(), 1);
        selectedDateKey = formatDateKey(nextDate);
        viewMonth = startOfMonth(nextDate);
      } else {
        const nextDate = addMonths(getActiveDate(), 1);
        selectedDateKey = formatDateKey(nextDate);
        viewMonth = startOfMonth(nextDate);
      }
      renderCalendar();
    });
  }

  if (monthViewButton) {
    monthViewButton.addEventListener("click", () => {
      currentCalendarView = "month";
      renderCalendar();
    });
  }

  if (weekViewButton) {
    weekViewButton.addEventListener("click", () => {
      currentCalendarView = "week";
      renderCalendar();
    });
  }

  if (calendarMonthGrid) {
    calendarMonthGrid.addEventListener("click", event => {
      const appointmentElement = event.target.closest("[data-appointment-id]");

      if (appointmentElement) {
        event.preventDefault();
        event.stopPropagation();
        openAppointmentDetailModal(appointmentElement.dataset.appointmentId || "");
        return;
      }

      const dayElement = event.target.closest(".calendar-day[data-date-key]");

      if (!dayElement) {
        return;
      }

      const nextDateKey = String(dayElement.dataset.dateKey || "").trim();

      if (!nextDateKey) {
        return;
      }

      const nextDate = new Date(`${nextDateKey}T00:00:00`);

      if (Number.isNaN(nextDate.getTime())) {
        return;
      }

      selectedDateKey = nextDateKey;
      viewMonth = startOfMonth(nextDate);

      if (isCompactMobileCalendar() && currentCalendarView === "month") {
        currentCalendarView = "week";
      }

      renderCalendar();
    });
  }

  if (calendarWeekGrid) {
    calendarWeekGrid.addEventListener("click", event => {
      const helpButton = event.target.closest("[data-status-help]");

      if (helpButton) {
        event.preventDefault();
        event.stopPropagation();
        openStatusHelpModal(helpButton.dataset.statusHelp || "This status is estimated.");
        return;
      }

      const appointmentElement = event.target.closest("[data-appointment-id]");

      if (appointmentElement) {
        event.preventDefault();
        event.stopPropagation();
        openAppointmentDetailModal(appointmentElement.dataset.appointmentId || "");
        return;
      }

      const dayElement = event.target.closest("[data-date-key]");

      if (!dayElement) {
        return;
      }

      const nextDateKey = String(dayElement.dataset.dateKey || "").trim();

      if (!nextDateKey) {
        return;
      }

      const nextDate = new Date(`${nextDateKey}T00:00:00`);

      if (Number.isNaN(nextDate.getTime())) {
        return;
      }

      selectedDateKey = nextDateKey;
      viewMonth = startOfMonth(nextDate);
      renderCalendar();
    });
  }

  if (upcomingList) {
    upcomingList.addEventListener("click", event => {
      const appointmentElement = event.target.closest("[data-appointment-id]");

      if (appointmentElement) {
        openAppointmentDetailModal(appointmentElement.dataset.appointmentId || "");
      }
    });
  }

  if (previousList) {
    previousList.addEventListener("click", event => {
      const appointmentElement = event.target.closest("[data-appointment-id]");

      if (appointmentElement) {
        openAppointmentDetailModal(appointmentElement.dataset.appointmentId || "");
      }
    });
  }

  if (allAppointmentsList) {
    allAppointmentsList.addEventListener("click", event => {
      const appointmentElement = event.target.closest("[data-appointment-id]");

      if (appointmentElement) {
        openAppointmentDetailModal(appointmentElement.dataset.appointmentId || "");
      }
    });
  }

  if (appointmentDetailModal) {
    appointmentDetailModal.addEventListener("click", event => {
      const helpButton = event.target.closest("[data-status-help]");

      if (helpButton) {
        event.preventDefault();
        event.stopPropagation();
        openStatusHelpModal(helpButton.dataset.statusHelp || "This status is estimated.");
        return;
      }

      if (event.target === appointmentDetailModal) {
        closeAppointmentDetailModal();
      }
    });
  }

  if (statusHelpModal) {
    statusHelpModal.addEventListener("click", event => {
      if (event.target === statusHelpModal) {
        closeStatusHelpModal();
      }
    });
  }

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && appointmentDetailModal && !appointmentDetailModal.hidden) {
      closeAppointmentDetailModal();
    } else if (event.key === "Escape" && statusHelpModal && !statusHelpModal.hidden) {
      closeStatusHelpModal();
    }
  });

  if (closeAppointmentDetailButton) {
    closeAppointmentDetailButton.addEventListener("click", closeAppointmentDetailModal);
  }

  if (closeStatusHelpButton) {
    closeStatusHelpButton.addEventListener("click", closeStatusHelpModal);
  }
}

async function initPage() {
  bindCalendarControls();

  try {
    appConfig = await getPublicConfig();
  } catch (error) {
    setStatus(error.message || "Unable to load this page.", "error");
    return;
  }

  if (!appConfig.accountsEnabled) {
    if (authSetupNotice) {
      authSetupNotice.hidden = false;
    }
    updateSignedInView(null);
    return;
  }

  supabase = createClient(appConfig.supabaseUrl, appConfig.supabasePublishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });

  const {
    data: { session }
  } = await supabase.auth.getSession();

  currentAuthUserId = session?.user?.id || "";
  updateSignedInView(session?.user || null);
  await loadAppointments(session?.user || null);

  supabase.auth.onAuthStateChange(async (event, nextSession) => {
    if (event === "TOKEN_REFRESHED") {
      return;
    }

    const nextUserId = nextSession?.user?.id || "";

    if (nextUserId === currentAuthUserId && event !== "USER_UPDATED") {
      return;
    }

    currentAuthUserId = nextUserId;
    updateSignedInView(nextSession?.user || null);
    await loadAppointments(nextSession?.user || null);
  });

  MOBILE_CALENDAR_QUERY.addEventListener("change", event => {
    currentCalendarView = event.matches ? "month" : "week";
    renderCalendar();
  });
}

initPage();
