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

let supabase = null;
let appConfig = null;
let appointments = [];
let appointmentsReady = true;
let viewMonth = startOfMonth(new Date());

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

function formatMonthLabel(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
  }).format(date);
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
    <div class="appointment-row">
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

function getMonthAppointments(targetMonth) {
  return appointments.filter(appointment => {
    const date = parseAppointmentDateTime(appointment);
    return date && date.getFullYear() === targetMonth.getFullYear() && date.getMonth() === targetMonth.getMonth();
  });
}

function getAppointmentsSortedNewestFirst() {
  return [...appointments].sort((left, right) => parseAppointmentDateTime(right) - parseAppointmentDateTime(left));
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

  if (calendarMonthLabel) {
    calendarMonthLabel.textContent = formatMonthLabel(viewMonth);
  }

  const monthAppointments = getMonthAppointments(viewMonth);
  const appointmentsByDay = new Map();

  monthAppointments.forEach(appointment => {
    const key = String(appointment.service_date || "").trim();

    if (!key) {
      return;
    }

    if (!appointmentsByDay.has(key)) {
      appointmentsByDay.set(key, []);
    }

    appointmentsByDay.get(key).push(appointment);
  });

  const firstDay = startOfMonth(viewMonth);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());

  const todayKey = getTodayKey();
  const cells = [];

  for (let index = 0; index < 42; index += 1) {
    const cellDate = new Date(gridStart);
    cellDate.setDate(gridStart.getDate() + index);

    const dateKey = formatDateKey(cellDate);
    const dayAppointments = appointmentsByDay.get(dateKey) || [];
    const visibleAppointments = dayAppointments.slice(0, 2);
    const isOtherMonth = cellDate.getMonth() !== viewMonth.getMonth();
    const isToday = dateKey === todayKey;

    cells.push(`
      <div class="calendar-day ${isOtherMonth ? "is-other-month" : ""} ${isToday ? "is-today" : ""} ${dayAppointments.length ? "has-appointments" : ""}">
        <div class="calendar-day-head">
          <div class="calendar-day-number">${cellDate.getDate()}</div>
          ${dayAppointments.length ? `<div class="calendar-day-count">${dayAppointments.length}</div>` : ""}
        </div>
        <div class="calendar-day-items">
          ${visibleAppointments.map(appointment => `
            <div class="calendar-chip">
              <strong>${escapeHtml(getAppointmentTitle(appointment))}</strong>
              <span>${escapeHtml(formatAppointmentChipMeta(appointment))}</span>
            </div>
          `).join("")}
          ${dayAppointments.length > visibleAppointments.length ? `<div class="calendar-chip-more">+${dayAppointments.length - visibleAppointments.length} more</div>` : ""}
        </div>
      </div>
    `);
  }

  calendarMonthGrid.innerHTML = cells.join("");
}

function renderCalendar() {
  renderCounts();
  renderMonthSelectors();
  renderMonthGrid();
  renderAllAppointments();

  if (calendarLayout && appointmentsReady) {
    calendarLayout.hidden = false;
  }
}

async function loadAppointments(user) {
  if (!supabase || !user?.id || !isBronzeUser(user)) {
    appointments = [];
    appointmentsReady = true;
    renderCalendar();
    return;
  }

  setLoadingState(true);
  setStatus("");

  try {
    const { data, error } = await supabase
      .from("appointments")
      .select("id, client_id, client_name, client_email, client_phone, service_date, service_time, service_location, notes, last_channel, last_source, created_at, updated_at")
      .eq("owner_id", user.id)
      .order("service_date", { ascending: true })
      .order("service_time", { ascending: true });

    if (error) {
      if (error.code === "42P01") {
        appointmentsReady = false;
        appointments = [];
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

    appointmentsReady = true;
    appointments = data || [];

    if (appointmentsSetupNotice) {
      appointmentsSetupNotice.hidden = true;
    }

    renderCalendar();
  } catch (error) {
    appointments = [];
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

      viewMonth = new Date(viewMonth.getFullYear(), nextMonth, 1);
      renderCalendar();
    });
  }

  if (yearSelect) {
    yearSelect.addEventListener("change", event => {
      const nextYear = Number(event.target.value);

      if (!Number.isFinite(nextYear)) {
        return;
      }

      viewMonth = new Date(nextYear, viewMonth.getMonth(), 1);
      renderCalendar();
    });
  }

  if (prevButton) {
    prevButton.addEventListener("click", () => {
      viewMonth = addMonths(viewMonth, -1);
      renderCalendar();
    });
  }

  if (todayButton) {
    todayButton.addEventListener("click", () => {
      viewMonth = startOfMonth(new Date());
      renderCalendar();
    });
  }

  if (nextButton) {
    nextButton.addEventListener("click", () => {
      viewMonth = addMonths(viewMonth, 1);
      renderCalendar();
    });
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

  updateSignedInView(session?.user || null);
  await loadAppointments(session?.user || null);

  supabase.auth.onAuthStateChange(async (_event, nextSession) => {
    updateSignedInView(nextSession?.user || null);
    await loadAppointments(nextSession?.user || null);
  });
}

initPage();
