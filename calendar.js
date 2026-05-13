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
const importAppointmentsButton = document.getElementById("import-appointments-button");
const importAppointmentsInput = document.getElementById("import-appointments-input");
const importIcsButton = document.getElementById("import-ics-button");
const importIcsInput = document.getElementById("import-ics-input");
const syncGoogleCalendarButton = document.getElementById("sync-google-calendar-button");
const syncOutlookCalendarButton = document.getElementById("sync-outlook-calendar-button");
const calendarFeedUrlInput = document.getElementById("calendar-feed-url");
const syncCalendarLinkButton = document.getElementById("sync-calendar-link-button");
const forwardingEmailValue = document.getElementById("forwarding-email-value");
const copyForwardingEmailButton = document.getElementById("copy-forwarding-email-button");
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
let calendarLoadFailed = false;
let viewMonth = startOfMonth(new Date());
let selectedDateKey = getTodayKey();
let currentAuthUserId = "";
let currentAuthUser = null;
let initialSessionRecoveryTimer = 0;
const MOBILE_CALENDAR_QUERY = window.matchMedia("(max-width: 760px)");
let currentCalendarView = MOBILE_CALENDAR_QUERY.matches ? "month" : "week";
const DEFAULT_WEEK_START_HOUR = 7;
const DEFAULT_WEEK_END_HOUR = 19;
const SUPABASE_RETRY_ATTEMPTS = 2;
const SUPABASE_RETRY_DELAY_MS = 700;
const SUPABASE_QUERY_TIMEOUT_MS = 8500;
const SUPABASE_READ_TIMEOUT_MS = 6000;
const SUPABASE_MODULE_TIMEOUT_MS = 4500;
const SESSION_RECOVERY_DELAYS_MS = [600, 1600, 3600, 7000];
const CALENDAR_LOADING_STALE_MS = 4500;
const GOOGLE_IDENTITY_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const GOOGLE_CALENDAR_LOOKBACK_DAYS = 30;
const GOOGLE_CALENDAR_LOOKAHEAD_DAYS = 180;
const MICROSOFT_IDENTITY_SCRIPT_URL = "https://alcdn.msauth.net/browser/2.38.4/js/msal-browser.min.js";
const MICROSOFT_CALENDAR_SCOPES = ["Calendars.Read"];
const MICROSOFT_CALENDAR_LOOKBACK_DAYS = 30;
const MICROSOFT_CALENDAR_LOOKAHEAD_DAYS = 180;
const APPOINTMENT_IMPORT_ALIASES = {
  importId: ["id", "appointment_id", "event_id", "booking_id", "external_id", "confirmation_id"],
  clientName: ["client_name", "customer_name", "customer", "name", "full_name", "invitee_name", "guest_name", "patient_name"],
  clientEmail: ["client_email", "customer_email", "email", "email_address", "invitee_email", "guest_email"],
  clientPhone: ["client_phone", "customer_phone", "phone", "phone_number", "mobile", "mobile_phone"],
  serviceDate: ["service_date", "appointment_date", "date", "start_date", "event_date", "booking_date", "scheduled_date"],
  serviceTime: ["service_time", "appointment_time", "time", "start_time", "event_time", "booking_time", "scheduled_time"],
  startDateTime: ["start", "starts_at", "start_at", "start_datetime", "start_date_time", "appointment_start", "event_start", "booking_start", "scheduled_start"],
  serviceLocation: ["service_location", "location", "address", "service_address", "meeting_location", "event_location"],
  notes: ["notes", "note", "description", "details", "appointment_notes", "internal_notes"],
  appointmentType: ["appointment_type", "type", "service", "service_name", "event_type", "booking_type"]
};
const SUPABASE_MODULE_URLS = [
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm",
  "https://esm.sh/@supabase/supabase-js@2"
];
let loadedSupabaseCreateClient = null;
let calendarRecoveryTimers = [];
let calendarLoadStartedAt = 0;
let calendarLoadSequence = 0;
let googleCalendarTokenGranted = false;
let microsoftCalendarAuthClient = null;
const calendarDebugEnabled = new URLSearchParams(window.location.search).has("debugAccount");
const calendarDebugLog = [];

function createTimedSupabaseFetch() {
  return async (input, init = {}) => {
    if (typeof AbortController === "undefined") {
      return fetch(input, init);
    }

    const controller = new AbortController();
    const upstreamSignal = init?.signal;
    let timeoutId = 0;

    const abortFromUpstream = () => {
      controller.abort(upstreamSignal?.reason);
    };

    if (upstreamSignal) {
      if (upstreamSignal.aborted) {
        abortFromUpstream();
      } else {
        upstreamSignal.addEventListener("abort", abortFromUpstream, { once: true });
      }
    }

    timeoutId = window.setTimeout(() => {
      recordCalendarDebug("aborting supabase fetch", `${SUPABASE_QUERY_TIMEOUT_MS}ms`);
      controller.abort(new Error("Supabase request timed out."));
    }, SUPABASE_QUERY_TIMEOUT_MS);

    try {
      return await fetch(input, {
        ...init,
        signal: controller.signal
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error("Supabase request timed out.");
      }

      throw error;
    } finally {
      window.clearTimeout(timeoutId);

      if (upstreamSignal) {
        upstreamSignal.removeEventListener("abort", abortFromUpstream);
      }
    }
  };
}

function getSharedSupabaseClient(supabaseUrl, publicKey, createClientFn) {
  const clientKey = `${supabaseUrl}::${publicKey}::abortable-v1`;
  window.__appointmentReminderSupabaseClients = window.__appointmentReminderSupabaseClients || new Map();

  if (!window.__appointmentReminderSupabaseClients.has(clientKey)) {
    window.__appointmentReminderSupabaseClients.set(clientKey, createClientFn(supabaseUrl, publicKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      },
      global: {
        fetch: createTimedSupabaseFetch()
      }
    }));
  }

  return window.__appointmentReminderSupabaseClients.get(clientKey);
}

async function importWithTimeout(url, timeoutMs = SUPABASE_MODULE_TIMEOUT_MS) {
  let timeoutId = 0;

  try {
    return await Promise.race([
      import(url),
      new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error(`Timed out loading ${url}`));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }
}

async function loadSupabaseCreateClient() {
  if (loadedSupabaseCreateClient) {
    recordCalendarDebug("supabase sdk cached");
    return loadedSupabaseCreateClient;
  }

  let lastError = null;

  for (const url of SUPABASE_MODULE_URLS) {
    try {
      recordCalendarDebug("loading supabase sdk", url);
      const module = await importWithTimeout(url);

      if (typeof module?.createClient === "function") {
        loadedSupabaseCreateClient = module.createClient;
        recordCalendarDebug("supabase sdk loaded", url);
        return loadedSupabaseCreateClient;
      }

      lastError = new Error(`Supabase module at ${url} did not export createClient.`);
    } catch (error) {
      lastError = error;
      recordCalendarDebug("supabase sdk failed", `${url} | ${error?.message || error}`);
      console.warn("Unable to load Supabase SDK from", url, error);
    }
  }

  throw lastError || new Error("Unable to load Supabase SDK.");
}

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

function setButtonBusy(button, busy, busyText = "Working...") {
  if (!button) {
    return;
  }

  if (!button.dataset.defaultText) {
    button.dataset.defaultText = button.textContent || "";
  }

  button.disabled = busy;
  button.textContent = busy ? busyText : button.dataset.defaultText;
}

function recordCalendarDebug(step, detail = "") {
  if (!calendarDebugEnabled) {
    return;
  }

  const timestamp = new Date().toLocaleTimeString();
  const line = `[${timestamp}] ${step}${detail ? `: ${detail}` : ""}`;
  calendarDebugLog.push(line);
  updateCalendarDebugPanel();
}

function updateCalendarDebugPanel() {
  if (!calendarDebugEnabled) {
    return;
  }

  let shell = document.getElementById("account-debug-shell");
  let panel = document.getElementById("account-debug-panel");
  let copyButton = document.getElementById("account-debug-copy");

  if (!shell) {
    shell = document.createElement("div");
    shell.id = "account-debug-shell";
    shell.style.cssText = [
      "position:fixed",
      "left:10px",
      "right:10px",
      "bottom:10px",
      "z-index:3000",
      "max-height:46vh",
      "display:grid",
      "grid-template-rows:auto minmax(0,1fr)",
      "overflow:hidden",
      "border-radius:14px",
      "background:rgba(15,23,42,0.94)",
      "box-shadow:0 18px 46px rgba(15,23,42,0.34)"
    ].join(";");

    const toolbar = document.createElement("div");
    toolbar.style.cssText = [
      "display:flex",
      "align-items:center",
      "justify-content:space-between",
      "gap:10px",
      "padding:10px 10px 0",
      "color:#e5f0ff",
      "font:700 12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace"
    ].join(";");

    const title = document.createElement("span");
    title.textContent = "Account debug log";

    copyButton = document.createElement("button");
    copyButton.id = "account-debug-copy";
    copyButton.type = "button";
    copyButton.textContent = "Copy log";
    copyButton.style.cssText = [
      "appearance:none",
      "border:1px solid rgba(226,232,240,0.3)",
      "border-radius:999px",
      "background:rgba(226,232,240,0.12)",
      "color:#e5f0ff",
      "padding:8px 10px",
      "font:700 12px/1 ui-sans-serif,system-ui,sans-serif"
    ].join(";");
    copyButton.addEventListener("click", copyCalendarDebugLog);

    panel = document.createElement("pre");
    panel.id = "account-debug-panel";
    panel.style.cssText = [
      "overflow:auto",
      "margin:0",
      "padding:12px",
      "color:#e5f0ff",
      "font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace",
      "white-space:pre-wrap",
      "-webkit-user-select:text",
      "user-select:text"
    ].join(";");

    toolbar.append(title, copyButton);
    shell.append(toolbar, panel);
    document.body.appendChild(shell);
  }

  panel.textContent = calendarDebugLog.slice(-40).join("\n");
}

async function copyCalendarDebugLog() {
  const text = calendarDebugLog.join("\n");
  let copied = false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch (_error) {
    copied = false;
  }

  if (!copied) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-1000px";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    copied = document.execCommand("copy");
    textarea.remove();
  }

  const copyButton = document.getElementById("account-debug-copy");

  if (copyButton) {
    copyButton.textContent = copied ? "Copied" : "Select text";
    window.setTimeout(() => {
      copyButton.textContent = "Copy log";
    }, 1600);
  }
}

function delay(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function runWithTimeout(operation, timeoutMs = SUPABASE_QUERY_TIMEOUT_MS) {
  let timeoutId = 0;

  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error("Supabase request timed out."));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }
}

async function withSupabaseRetry(operation, options = {}) {
  const attempts = Number.isFinite(options.attempts) ? Math.max(1, options.attempts) : SUPABASE_RETRY_ATTEMPTS;
  const delayMs = Number.isFinite(options.delayMs) ? Math.max(0, options.delayMs) : SUPABASE_RETRY_DELAY_MS;
  const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(1000, options.timeoutMs) : SUPABASE_QUERY_TIMEOUT_MS;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await runWithTimeout(operation, timeoutMs);

      if (result?.error && isRetryableSupabaseError(result.error)) {
        throw result.error;
      }

      return result;
    } catch (error) {
      lastError = error;

      if (attempt < attempts) {
        await delay(delayMs * attempt);
      }
    }
  }

  throw lastError;
}

function isRetryableSupabaseError(error) {
  const status = Number(error?.status || error?.statusCode || 0);
  const code = String(error?.code || "").trim();
  const message = String(error?.message || "").toLowerCase();

  if (code === "42P01" || code === "42703") {
    return false;
  }

  return status >= 500
    || message.includes("failed to fetch")
    || message.includes("network")
    || message.includes("timeout")
    || message.includes("timed out")
    || message.includes("temporarily unavailable");
}

async function getCurrentSupabaseUser() {
  if (!supabase) {
    recordCalendarDebug("get user skipped", "no supabase client");
    return null;
  }

  const sessionResult = await withSupabaseRetry(() => supabase.auth.getSession());
  const sessionUser = sessionResult?.data?.session?.user || null;
  recordCalendarDebug("getSession", sessionUser?.id ? `user ${sessionUser.id}` : "no session user");

  if (sessionUser?.id) {
    return sessionUser;
  }

  const userResult = await withSupabaseRetry(() => supabase.auth.getUser());
  const user = userResult?.data?.user || null;
  recordCalendarDebug("getUser", user?.id ? `user ${user.id}` : userResult?.error?.message || "no auth user");
  return user;
}

async function getCurrentSupabaseAccessToken() {
  if (!supabase) {
    return "";
  }

  const sessionResult = await withSupabaseRetry(() => supabase.auth.getSession(), { attempts: 1, timeoutMs: 3000 });
  return String(sessionResult?.data?.session?.access_token || "").trim();
}

async function fetchAccountDataResource(resource, ownerId = "") {
  const token = await getCurrentSupabaseAccessToken();

  if (!token) {
    throw new Error("No account session token is available.");
  }

  const params = new URLSearchParams({ resource });

  if (ownerId) {
    params.set("ownerId", ownerId);
  }

  const response = await runWithTimeout(() => fetch(`/api/account-data?${params.toString()}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`
    }
  }), SUPABASE_READ_TIMEOUT_MS);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || "Unable to load account data.");
  }

  return Array.isArray(payload?.data) ? payload.data : [];
}

async function postAccountDataResource(resource, rows, ownerId = "") {
  const token = await getCurrentSupabaseAccessToken();

  if (!token) {
    throw new Error("No account session token is available.");
  }

  const params = new URLSearchParams({ resource });

  if (ownerId) {
    params.set("ownerId", ownerId);
  }

  const response = await runWithTimeout(() => fetch(`/api/account-data?${params.toString()}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ rows })
  }), SUPABASE_READ_TIMEOUT_MS);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || "Unable to save account data.");
  }

  return Array.isArray(payload?.data) ? payload.data : [];
}

async function refreshCalendarSessionAndData() {
  if (!supabase) {
    recordCalendarDebug("refresh skipped", "no supabase client");
    return;
  }

  try {
    recordCalendarDebug("refresh session");
    const user = await getCurrentSupabaseUser();
    const nextUserId = user?.id || "";

    currentAuthUser = user || null;
    currentAuthUserId = nextUserId;
    updateSignedInView(user || null);
    await loadAppointments(user || null);
  } catch (error) {
    recordCalendarDebug("refresh error", error?.message || String(error));
    setStatus(error.message || "Unable to refresh your calendar session.", "error");
  }
}

function scheduleCalendarSessionRecovery() {
  calendarRecoveryTimers.forEach(timerId => window.clearTimeout(timerId));
  calendarRecoveryTimers = SESSION_RECOVERY_DELAYS_MS.map(delayMs => window.setTimeout(() => {
    if (!currentAuthUserId || calendarLoadFailed || hasStaleCalendarLoad() || (!calendarLoading || calendarLoading.hidden) && !appointments.length) {
      recordCalendarDebug("scheduled recovery", `${delayMs}ms`);
      refreshCalendarSessionAndData();
    }
  }, delayMs));
}

function renderCalendarLoadError(message = "We could not reach your saved appointments right now.") {
  const retryMarkup = `
    <div class="empty-state retry-state">
      <p>${escapeHtml(message)}</p>
      <button class="secondary-button" type="button" data-calendar-retry>Try again</button>
    </div>
  `;

  if (calendarLayout) {
    calendarLayout.hidden = true;
  }

  clearCounts();
  renderAppointmentList(upcomingList, [], "Unable to load appointments right now.");
  renderAppointmentList(previousList, [], "Unable to load appointments right now.");

  if (allAppointmentsList) {
    allAppointmentsList.innerHTML = retryMarkup;
  }
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
  calendarLoadStartedAt = isLoading ? Date.now() : 0;

  if (calendarLoading) {
    calendarLoading.hidden = !isLoading;
  }

  if (calendarLayout) {
    calendarLayout.hidden = isLoading || calendarLoadFailed;
    calendarLayout.setAttribute("aria-busy", isLoading ? "true" : "false");
  }
}

function hasStaleCalendarLoad() {
  return calendarLoadStartedAt > 0
    && Date.now() - calendarLoadStartedAt > CALENDAR_LOADING_STALE_MS;
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

  document.querySelectorAll("[data-auth-only]").forEach(link => {
    link.hidden = !isSignedIn;
  });

  if (signedOutShell) {
    signedOutShell.hidden = isSignedIn;
  }

  if (freeShell) {
    freeShell.hidden = true;
  }

  if (bronzeShell) {
    bronzeShell.hidden = !isSignedIn;
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

  updateAppointmentSourceControls(user);
}

function getForwardingAddressForUser(user) {
  const rawAddress = String(appConfig?.inboundAppointmentEmail || "").trim();

  if (!rawAddress || !user?.id) {
    return "";
  }

  return rawAddress
    .split("{ownerId}").join(user.id)
    .split("{userId}").join(user.id);
}

function updateAppointmentSourceControls(user = currentAuthUser) {
  const hasUser = Boolean(user?.id);
  const hasGoogleClient = Boolean(String(appConfig?.googleCalendarClientId || "").trim());
  const hasOutlookClient = Boolean(String(appConfig?.outlookCalendarClientId || "").trim());
  const forwardingAddress = getForwardingAddressForUser(user);

  if (syncGoogleCalendarButton) {
    syncGoogleCalendarButton.disabled = !hasUser || !hasGoogleClient;
    syncGoogleCalendarButton.title = hasGoogleClient
      ? "Connect Google Calendar and import upcoming events"
      : "Add GOOGLE_CALENDAR_CLIENT_ID in Vercel to enable Google Calendar sync";
  }

  if (syncOutlookCalendarButton) {
    syncOutlookCalendarButton.disabled = !hasUser || !hasOutlookClient;
    syncOutlookCalendarButton.title = hasOutlookClient
      ? "Connect Outlook Calendar and import upcoming events"
      : "Add OUTLOOK_CALENDAR_CLIENT_ID in Vercel to enable Outlook Calendar sync";
  }

  if (syncCalendarLinkButton) {
    syncCalendarLinkButton.disabled = !hasUser;
  }

  if (forwardingEmailValue) {
    forwardingEmailValue.textContent = forwardingAddress || "Set INBOUND_APPOINTMENT_EMAIL in Vercel";
    forwardingEmailValue.classList.toggle("is-empty", !forwardingAddress);
  }

  if (copyForwardingEmailButton) {
    copyForwardingEmailButton.disabled = !forwardingAddress;
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

function parseCsvRecords(text) {
  const rows = [];
  let currentField = "";
  let currentRow = [];
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (insideQuotes) {
      if (char === "\"" && nextChar === "\"") {
        currentField += "\"";
        index += 1;
      } else if (char === "\"") {
        insideQuotes = false;
      } else {
        currentField += char;
      }
      continue;
    }

    if (char === "\"") {
      insideQuotes = true;
      continue;
    }

    if (char === ",") {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    if (char === "\n") {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
      continue;
    }

    currentField += char;
  }

  if (currentField.length || currentRow.length) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows.filter(row => row.some(cell => String(cell || "").trim()));
}

function normalizeImportHeader(header) {
  return String(header || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildNormalizedImportValueMap(rawRecord) {
  if (!rawRecord || typeof rawRecord !== "object") {
    return {};
  }

  return Object.entries(rawRecord).reduce((map, [rawKey, rawValue]) => {
    if (String(rawKey || "").startsWith("__")) {
      return map;
    }

    const normalizedKey = normalizeImportHeader(rawKey);

    if (!normalizedKey || Object.prototype.hasOwnProperty.call(map, normalizedKey)) {
      return map;
    }

    map[normalizedKey] = rawValue;
    return map;
  }, {});
}

function getImportedFieldValue(valueMap, aliases = []) {
  const match = aliases.find(alias => Object.prototype.hasOwnProperty.call(valueMap, alias));
  return match ? valueMap[match] : "";
}

function getImportedScalarFieldValue(valueMap, aliases = []) {
  const value = getImportedFieldValue(valueMap, aliases);
  return value === null || typeof value === "object" ? "" : value;
}

function parseImportedAppointmentJson(text) {
  const parsed = JSON.parse(text);
  const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.appointments) ? parsed.appointments : Array.isArray(parsed?.events) ? parsed.events : null;

  if (!records) {
    throw new Error("That JSON file does not look like an appointment export.");
  }

  return records;
}

function parseImportedAppointmentCsv(text) {
  const rows = parseCsvRecords(text);

  if (rows.length < 2) {
    throw new Error("That CSV file does not have any appointment rows yet.");
  }

  const rawHeaders = rows[0].map(header => String(header || "").trim());
  const headers = rawHeaders.map(normalizeImportHeader);

  return rows.slice(1).map(row => {
    const record = headers.reduce((accumulator, header, index) => {
      if (header) {
        accumulator[header] = row[index] ?? "";
      }
      return accumulator;
    }, {});

    return record;
  });
}

function unfoldIcsLines(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const unfolded = [];

  lines.forEach(line => {
    if (/^[ \t]/.test(line) && unfolded.length) {
      unfolded[unfolded.length - 1] += line.slice(1);
      return;
    }

    unfolded.push(line);
  });

  return unfolded;
}

function decodeIcsValue(value) {
  return String(value || "")
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function parseIcsPropertyLine(line) {
  const separatorIndex = String(line || "").indexOf(":");

  if (separatorIndex < 0) {
    return null;
  }

  const nameAndParams = line.slice(0, separatorIndex);
  const name = String(nameAndParams.split(";")[0] || "").trim().toUpperCase();
  const value = decodeIcsValue(line.slice(separatorIndex + 1));

  return name ? { name, value } : null;
}

function parseIcsEmail(value) {
  const mailtoMatch = String(value || "").match(/mailto:([^\s;]+)/i);

  if (mailtoMatch) {
    return mailtoMatch[1].trim();
  }

  const emailMatch = String(value || "").match(/[^\s<>"']+@[^\s<>"']+\.[^\s<>"']+/i);
  return emailMatch ? emailMatch[0].trim() : "";
}

function parseIcsAppointments(text) {
  const events = [];
  let currentEvent = null;

  unfoldIcsLines(text).forEach(line => {
    const normalizedLine = String(line || "").trim();

    if (normalizedLine.toUpperCase() === "BEGIN:VEVENT") {
      currentEvent = {};
      return;
    }

    if (normalizedLine.toUpperCase() === "END:VEVENT") {
      if (currentEvent) {
        events.push(currentEvent);
      }
      currentEvent = null;
      return;
    }

    if (!currentEvent) {
      return;
    }

    const property = parseIcsPropertyLine(normalizedLine);

    if (!property) {
      return;
    }

    if (property.name === "UID") {
      currentEvent.event_id = property.value;
    } else if (property.name === "SUMMARY") {
      currentEvent.summary = property.value;
    } else if (property.name === "DESCRIPTION") {
      currentEvent.description = property.value;
    } else if (property.name === "LOCATION") {
      currentEvent.location = property.value;
    } else if (property.name === "DTSTART") {
      currentEvent.start = property.value;
    } else if (property.name === "ATTENDEE" && !currentEvent.client_email) {
      currentEvent.client_email = parseIcsEmail(property.value);
    }
  });

  if (!events.length) {
    throw new Error("That calendar file did not include any events.");
  }

  return events;
}

function parseDateFromText(value) {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }

  const compactIcsMatch = text.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/i);

  if (compactIcsMatch) {
    const [, year, month, day, hour, minute, second = "00", zone] = compactIcsMatch;

    if (hour && zone) {
      const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
      return Number.isNaN(date.getTime()) ? "" : formatDateKey(date);
    }

    return `${year}-${month}-${day}`;
  }

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
  }

  const slashMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);

  if (slashMatch) {
    const year = slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3];
    return `${year}-${slashMatch[1].padStart(2, "0")}-${slashMatch[2].padStart(2, "0")}`;
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return formatDateKey(date);
}

function parseTimeFromText(value) {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }

  const compactIcsMatch = text.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/i);

  if (compactIcsMatch) {
    const [, year, month, day, hour, minute, second = "00", zone] = compactIcsMatch;

    if (zone) {
      const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);

      if (!Number.isNaN(date.getTime())) {
        return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
      }
    }

    return `${hour}:${minute}`;
  }

  if (/\d{4}-\d{1,2}-\d{1,2}[T\s]\d{1,2}:\d{2}/.test(text)) {
    const date = new Date(text);

    if (!Number.isNaN(date.getTime())) {
      return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    }
  }

  const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?/i);

  if (!timeMatch) {
    return "";
  }

  let hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2] || "0");
  const meridiem = String(timeMatch[3] || "").toLowerCase();

  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 24 || minutes > 59) {
    return "";
  }

  if (meridiem.startsWith("p") && hours < 12) {
    hours += 12;
  } else if (meridiem.startsWith("a") && hours === 12) {
    hours = 0;
  }

  if (hours === 24) {
    hours = 0;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getGoogleEventEmail(rawRecord) {
  const attendees = Array.isArray(rawRecord?.attendees) ? rawRecord.attendees : [];
  const attendee = attendees.find(entry => String(entry?.email || "").trim());
  return attendee?.email || "";
}

function getMicrosoftEventAttendee(rawRecord) {
  const attendees = Array.isArray(rawRecord?.attendees) ? rawRecord.attendees : [];

  return attendees
    .map(entry => ({
      name: String(entry?.emailAddress?.name || entry?.name || "").trim(),
      email: String(entry?.emailAddress?.address || entry?.email || "").trim()
    }))
    .find(entry => entry.email) || null;
}

function getMicrosoftEventEmail(rawRecord) {
  return getMicrosoftEventAttendee(rawRecord)?.email || "";
}

function getMicrosoftEventName(rawRecord) {
  return getMicrosoftEventAttendee(rawRecord)?.name || "";
}

function normalizeImportedAppointmentRecord(rawRecord, ownerId, source = "import") {
  if (!rawRecord || typeof rawRecord !== "object") {
    return null;
  }

  const valueMap = buildNormalizedImportValueMap(rawRecord);
  const nestedStart = rawRecord.start && typeof rawRecord.start === "object" ? rawRecord.start : null;
  const startDateTime = getImportedScalarFieldValue(valueMap, APPOINTMENT_IMPORT_ALIASES.startDateTime) || nestedStart?.dateTime || nestedStart?.date || "";
  const serviceDate = parseDateFromText(getImportedFieldValue(valueMap, APPOINTMENT_IMPORT_ALIASES.serviceDate) || startDateTime);
  const serviceTime = parseTimeFromText(getImportedFieldValue(valueMap, APPOINTMENT_IMPORT_ALIASES.serviceTime) || startDateTime);
  const clientName = String(getImportedFieldValue(valueMap, APPOINTMENT_IMPORT_ALIASES.clientName) || getMicrosoftEventName(rawRecord) || rawRecord.summary || rawRecord.subject || "").trim().slice(0, 80);
  const clientEmail = String(getImportedFieldValue(valueMap, APPOINTMENT_IMPORT_ALIASES.clientEmail) || getGoogleEventEmail(rawRecord) || getMicrosoftEventEmail(rawRecord)).trim();
  const clientPhone = normalizePhone(getImportedFieldValue(valueMap, APPOINTMENT_IMPORT_ALIASES.clientPhone));
  const rawLocation = typeof rawRecord.location === "string" ? rawRecord.location : rawRecord.location?.displayName || "";
  const serviceLocation = String(getImportedFieldValue(valueMap, APPOINTMENT_IMPORT_ALIASES.serviceLocation) || rawLocation || "").trim().slice(0, 240);
  const appointmentType = String(getImportedFieldValue(valueMap, APPOINTMENT_IMPORT_ALIASES.appointmentType) || "").trim();
  const notes = [
    String(getImportedFieldValue(valueMap, APPOINTMENT_IMPORT_ALIASES.notes) || rawRecord.description || rawRecord.bodyPreview || "").trim(),
    appointmentType ? `Type: ${appointmentType}` : ""
  ].filter(Boolean).join("\n").slice(0, 1200);
  const importId = String(getImportedFieldValue(valueMap, APPOINTMENT_IMPORT_ALIASES.importId) || rawRecord.id || rawRecord.iCalUID || "").trim();

  if (!serviceDate || (!clientName && !clientEmail && !clientPhone)) {
    return null;
  }

  if (clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(clientEmail)) {
    return null;
  }

  return {
    importId,
    payload: {
      owner_id: ownerId,
      client_name: clientName,
      client_email: clientEmail,
      client_phone: clientPhone,
      service_date: serviceDate,
      service_time: serviceTime || null,
      service_location: serviceLocation,
      notes,
      last_source: source,
      updated_at: new Date().toISOString()
    }
  };
}

function getAppointmentDuplicateKey(appointment) {
  return [
    String(appointment?.service_date || "").trim(),
    String(appointment?.service_time || "").trim(),
    String(appointment?.client_email || "").trim().toLowerCase(),
    normalizePhone(appointment?.client_phone || ""),
    String(appointment?.client_name || "").trim().toLowerCase()
  ].join("|");
}

async function persistImportedAppointments(rows) {
  if (!rows.length) {
    return [];
  }

  try {
    return await postAccountDataResource("appointments", rows, rows[0]?.owner_id || "");
  } catch (error) {
    recordCalendarDebug("appointment save api fallback", error?.message || String(error));
  }

  const { data, error } = await withSupabaseRetry(() => supabase
    .from("appointments")
    .insert(rows), {
      attempts: 1,
      timeoutMs: SUPABASE_QUERY_TIMEOUT_MS
    });

  if (error) {
    throw error;
  }

  return data || rows;
}

async function importAppointmentRecords(rawRecords, user, options = {}) {
  const {
    source = "import",
    emptyMessage = "No valid appointments were found. Include at least a client name/email/phone and appointment date.",
    successVerb = "Imported"
  } = options;
  const normalizedRecords = rawRecords
    .map(record => normalizeImportedAppointmentRecord(record, user.id, source))
    .filter(Boolean);

  if (!normalizedRecords.length) {
    throw new Error(emptyMessage);
  }

  const knownKeys = new Set((appointments || []).map(getAppointmentDuplicateKey));
  const pendingRows = [];
  let skippedDuplicates = 0;

  normalizedRecords.forEach(record => {
    const key = getAppointmentDuplicateKey(record.payload);

    if (knownKeys.has(key)) {
      skippedDuplicates += 1;
      return;
    }

    knownKeys.add(key);
    pendingRows.push(record.payload);
  });

  if (!pendingRows.length) {
    setStatus(`No new appointments saved. ${skippedDuplicates} duplicate${skippedDuplicates === 1 ? "" : "s"} skipped.`, "info");
    return { saved: 0, skippedDuplicates };
  }

  await persistImportedAppointments(pendingRows);
  await loadAppointments(user);

  const summary = [`${successVerb} ${pendingRows.length} appointment${pendingRows.length === 1 ? "" : "s"}`];

  if (skippedDuplicates) {
    summary.push(`skipped ${skippedDuplicates} duplicate${skippedDuplicates === 1 ? "" : "s"}`);
  }

  setStatus(`${summary.join("; ")}.`, "success");
  return { saved: pendingRows.length, skippedDuplicates };
}

async function handleImportAppointmentsFile(event) {
  const file = event.target.files?.[0] || null;
  event.target.value = "";

  if (!file) {
    return;
  }

  if (!supabase) {
    setStatus("Add your Supabase keys before importing appointments.", "error");
    return;
  }

  let user = currentAuthUser;

  if (!user?.id) {
    user = await getCurrentSupabaseUser();
  }

  if (!user?.id) {
    setStatus("Please sign in before importing appointments.", "error");
    return;
  }

  setButtonBusy(importAppointmentsButton, true, "Importing...");
  setStatus("Importing appointments...", "info");

  try {
    const text = await file.text();
    const extension = String(file.name || "").split(".").pop().toLowerCase();
    const rawRecords = extension === "json" || file.type === "application/json"
      ? parseImportedAppointmentJson(text)
      : parseImportedAppointmentCsv(text);
    await importAppointmentRecords(rawRecords, user, {
      source: "import",
      successVerb: "Imported"
    });
  } catch (error) {
    setStatus(error.message || "Unable to import appointments.", "error");
  } finally {
    setButtonBusy(importAppointmentsButton, false);
  }
}

async function handleImportIcsFile(event) {
  const file = event.target.files?.[0] || null;
  event.target.value = "";

  if (!file) {
    return;
  }

  if (!supabase) {
    setStatus("Add your Supabase keys before importing appointments.", "error");
    return;
  }

  let user = currentAuthUser;

  if (!user?.id) {
    user = await getCurrentSupabaseUser();
  }

  if (!user?.id) {
    setStatus("Please sign in before importing appointments.", "error");
    return;
  }

  setButtonBusy(importIcsButton, true, "Importing...");
  setStatus("Importing calendar events...", "info");

  try {
    const rawRecords = parseIcsAppointments(await file.text());
    await importAppointmentRecords(rawRecords, user, {
      source: "ics_import",
      successVerb: "Imported",
      emptyMessage: "No valid calendar events were found. Events need a date and at least a title, email, or phone number."
    });
  } catch (error) {
    setStatus(error.message || "Unable to import that calendar file.", "error");
  } finally {
    setButtonBusy(importIcsButton, false);
  }
}

function loadExternalScript(url, id, errorMessage = "Unable to load sign-in.") {
  const existingScript = id ? document.getElementById(id) : null;

  if (existingScript?.dataset.loaded === "true") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = existingScript || document.createElement("script");

    script.id = id || "";
    script.src = url;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(errorMessage));

    if (!existingScript) {
      document.head.appendChild(script);
    }
  });
}

async function requestGoogleCalendarAccessToken() {
  const clientId = String(appConfig?.googleCalendarClientId || "").trim();

  if (!clientId) {
    throw new Error("Google Calendar sync needs GOOGLE_CALENDAR_CLIENT_ID in Vercel.");
  }

  await loadExternalScript(GOOGLE_IDENTITY_SCRIPT_URL, "google-identity-services", "Unable to load Google Calendar sign-in.");

  if (!window.google?.accounts?.oauth2?.initTokenClient) {
    throw new Error("Google Calendar sign-in did not finish loading.");
  }

  return new Promise((resolve, reject) => {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_CALENDAR_SCOPE,
      callback: tokenResponse => {
        if (tokenResponse?.error) {
          reject(new Error(tokenResponse.error_description || tokenResponse.error));
          return;
        }

        const accessToken = String(tokenResponse?.access_token || "").trim();

        if (!accessToken) {
          reject(new Error("Google Calendar did not return an access token."));
          return;
        }

        googleCalendarTokenGranted = true;
        resolve(accessToken);
      },
      error_callback: error => {
        reject(new Error(error?.message || error?.type || "Google Calendar sign-in was cancelled."));
      }
    });

    tokenClient.requestAccessToken({
      prompt: googleCalendarTokenGranted ? "" : "consent"
    });
  });
}

async function fetchGoogleCalendarEvents(accessToken) {
  const timeMin = addDays(new Date(), -GOOGLE_CALENDAR_LOOKBACK_DAYS).toISOString();
  const timeMax = addDays(new Date(), GOOGLE_CALENDAR_LOOKAHEAD_DAYS).toISOString();
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    timeMin,
    timeMax,
    maxResults: "250"
  });
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error?.message || "Unable to read Google Calendar events.");
  }

  return Array.isArray(payload?.items)
    ? payload.items.filter(event => String(event?.status || "").toLowerCase() !== "cancelled")
    : [];
}

async function loadMicrosoftIdentity() {
  if (window.msal?.PublicClientApplication) {
    return window.msal;
  }

  await loadExternalScript(MICROSOFT_IDENTITY_SCRIPT_URL, "microsoft-identity-services", "Unable to load Outlook Calendar sign-in.");

  if (!window.msal?.PublicClientApplication) {
    throw new Error("Outlook Calendar sign-in did not finish loading.");
  }

  return window.msal;
}

async function requestOutlookCalendarAccessToken() {
  const clientId = String(appConfig?.outlookCalendarClientId || "").trim();

  if (!clientId) {
    throw new Error("Outlook Calendar sync needs OUTLOOK_CALENDAR_CLIENT_ID in Vercel.");
  }

  const msal = await loadMicrosoftIdentity();

  if (!microsoftCalendarAuthClient) {
    microsoftCalendarAuthClient = new msal.PublicClientApplication({
      auth: {
        clientId,
        authority: "https://login.microsoftonline.com/common",
        redirectUri: `${window.location.origin}/calendar.html`
      },
      cache: {
        cacheLocation: "sessionStorage",
        storeAuthStateInCookie: false
      }
    });
  }

  if (typeof microsoftCalendarAuthClient.initialize === "function") {
    await microsoftCalendarAuthClient.initialize();
  }

  const accounts = typeof microsoftCalendarAuthClient.getAllAccounts === "function"
    ? microsoftCalendarAuthClient.getAllAccounts()
    : [];
  const account = accounts[0] || null;
  const tokenRequest = {
    scopes: MICROSOFT_CALENDAR_SCOPES,
    account
  };
  let tokenResponse = null;

  if (account && typeof microsoftCalendarAuthClient.acquireTokenSilent === "function") {
    tokenResponse = await microsoftCalendarAuthClient.acquireTokenSilent(tokenRequest)
      .catch(() => null);
  }

  if (!tokenResponse) {
    tokenResponse = await microsoftCalendarAuthClient.acquireTokenPopup({
      scopes: MICROSOFT_CALENDAR_SCOPES,
      prompt: account ? undefined : "select_account"
    });
  }

  const accessToken = String(tokenResponse?.accessToken || tokenResponse?.access_token || "").trim();

  if (!accessToken) {
    throw new Error("Outlook Calendar did not return an access token.");
  }

  return accessToken;
}

function normalizeMicrosoftGraphEvent(event) {
  const attendee = getMicrosoftEventAttendee(event);
  const startDateTime = String(event?.start?.dateTime || event?.start?.date || "").trim();
  const location = String(event?.location?.displayName || event?.locations?.[0]?.displayName || "").trim();

  return {
    id: event?.id || event?.iCalUId || "",
    event_id: event?.iCalUId || event?.id || "",
    summary: String(event?.subject || attendee?.name || "").trim(),
    client_name: attendee?.name || "",
    client_email: attendee?.email || "",
    start: {
      dateTime: startDateTime
    },
    location,
    description: String(event?.bodyPreview || "").trim()
  };
}

async function fetchOutlookCalendarEvents(accessToken) {
  const startDateTime = addDays(new Date(), -MICROSOFT_CALENDAR_LOOKBACK_DAYS).toISOString();
  const endDateTime = addDays(new Date(), MICROSOFT_CALENDAR_LOOKAHEAD_DAYS).toISOString();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const params = new URLSearchParams({
    startDateTime,
    endDateTime,
    "$top": "250"
  });
  let requestUrl = `https://graph.microsoft.com/v1.0/me/calendarView?${params.toString()}`;
  const events = [];

  while (requestUrl && events.length < 500) {
    const response = await fetch(requestUrl, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: `outlook.timezone="${timeZone}"`
      }
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.error?.message || "Unable to read Outlook Calendar events.");
    }

    if (Array.isArray(payload?.value)) {
      events.push(...payload.value);
    }

    requestUrl = payload?.["@odata.nextLink"] || "";
  }

  return events
    .filter(event => !event?.isCancelled)
    .map(normalizeMicrosoftGraphEvent)
    .sort((left, right) => String(left?.start?.dateTime || "").localeCompare(String(right?.start?.dateTime || "")));
}

async function handleSyncOutlookCalendar() {
  if (!supabase) {
    setStatus("Add your Supabase keys before syncing appointments.", "error");
    return;
  }

  let user = currentAuthUser;

  if (!user?.id) {
    user = await getCurrentSupabaseUser();
  }

  if (!user?.id) {
    setStatus("Please sign in before syncing appointments.", "error");
    return;
  }

  setButtonBusy(syncOutlookCalendarButton, true, "Syncing...");
  setStatus("Connecting to Outlook Calendar...", "info");

  try {
    const accessToken = await requestOutlookCalendarAccessToken();
    setStatus("Reading Outlook Calendar events...", "info");
    const rawRecords = await fetchOutlookCalendarEvents(accessToken);

    if (!rawRecords.length) {
      setStatus("Outlook Calendar did not return any upcoming events.", "info");
      return;
    }

    await importAppointmentRecords(rawRecords, user, {
      source: "outlook_calendar",
      successVerb: "Synced",
      emptyMessage: "No usable Outlook Calendar events were found. Events need a date and at least a title, attendee email, or phone number."
    });
  } catch (error) {
    setStatus(error.message || "Unable to sync Outlook Calendar.", "error");
  } finally {
    setButtonBusy(syncOutlookCalendarButton, false);
    updateAppointmentSourceControls(user);
  }
}

async function handleSyncGoogleCalendar() {
  if (!supabase) {
    setStatus("Add your Supabase keys before syncing appointments.", "error");
    return;
  }

  let user = currentAuthUser;

  if (!user?.id) {
    user = await getCurrentSupabaseUser();
  }

  if (!user?.id) {
    setStatus("Please sign in before syncing appointments.", "error");
    return;
  }

  setButtonBusy(syncGoogleCalendarButton, true, "Syncing...");
  setStatus("Connecting to Google Calendar...", "info");

  try {
    const accessToken = await requestGoogleCalendarAccessToken();
    setStatus("Reading Google Calendar events...", "info");
    const rawRecords = await fetchGoogleCalendarEvents(accessToken);

    if (!rawRecords.length) {
      setStatus("Google Calendar did not return any upcoming events.", "info");
      return;
    }

    await importAppointmentRecords(rawRecords, user, {
      source: "google_calendar",
      successVerb: "Synced",
      emptyMessage: "No usable Google Calendar events were found. Events need a date and at least a title, attendee email, or phone number."
    });
  } catch (error) {
    setStatus(error.message || "Unable to sync Google Calendar.", "error");
  } finally {
    setButtonBusy(syncGoogleCalendarButton, false);
    updateAppointmentSourceControls(user);
  }
}

async function fetchCalendarFeedText(feedUrl) {
  const token = await getCurrentSupabaseAccessToken();

  if (!token) {
    throw new Error("No account session token is available.");
  }

  const response = await runWithTimeout(() => fetch("/api/calendar-feed", {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ url: feedUrl })
  }), SUPABASE_READ_TIMEOUT_MS);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || "Unable to read that calendar link.");
  }

  return String(payload?.text || "");
}

async function handleSyncCalendarLink() {
  if (!supabase) {
    setStatus("Add your Supabase keys before syncing appointments.", "error");
    return;
  }

  let user = currentAuthUser;

  if (!user?.id) {
    user = await getCurrentSupabaseUser();
  }

  if (!user?.id) {
    setStatus("Please sign in before syncing appointments.", "error");
    return;
  }

  const feedUrl = String(calendarFeedUrlInput?.value || "").trim();

  if (!feedUrl) {
    setStatus("Paste a webcal or .ics calendar link first.", "error");
    return;
  }

  setButtonBusy(syncCalendarLinkButton, true, "Syncing...");
  setStatus("Reading calendar link...", "info");

  try {
    const text = await fetchCalendarFeedText(feedUrl);
    const rawRecords = parseIcsAppointments(text);
    await importAppointmentRecords(rawRecords, user, {
      source: "calendar_link",
      successVerb: "Synced",
      emptyMessage: "No valid calendar events were found in that link."
    });
  } catch (error) {
    setStatus(error.message || "Unable to sync that calendar link.", "error");
  } finally {
    setButtonBusy(syncCalendarLinkButton, false);
    updateAppointmentSourceControls(user);
  }
}

async function copyForwardingEmailAddress() {
  const address = getForwardingAddressForUser(currentAuthUser);

  if (!address) {
    setStatus("Add INBOUND_APPOINTMENT_EMAIL in Vercel before copying a forwarding address.", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(address);
    setStatus("Forwarding address copied.", "success");
  } catch (_error) {
    const textArea = document.createElement("textarea");
    textArea.value = address;
    textArea.setAttribute("readonly", "true");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    textArea.remove();
    setStatus("Forwarding address copied.", "success");
  }
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
  const directPreview = String(entry?.message_preview || entry?.raw_message_preview || entry?.raw_message_fallback || "").trim();

  if (directPreview) {
    return directPreview;
  }

  return "";
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
  const appointmentEmailCount = clientEmail
    ? appointments.reduce((count, entry) => {
      return String(entry?.client_email || "").trim().toLowerCase() === clientEmail ? count + 1 : count;
    }, 0)
    : 0;
  const canUseEmailFallback = clientEmail && appointmentEmailCount === 1;

  return reminderHistory.filter(entry => {
    const entryClientId = String(entry?.client_id || "").trim();
    const entryEmail = String(entry?.recipient_email || "").trim().toLowerCase();
    const entryPhone = normalizePhone(entry?.client_phone || "");

    if (clientId && entryClientId && clientId === entryClientId) {
      return true;
    }

    if (canUseEmailFallback && entryEmail && clientEmail === entryEmail) {
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
              <div class="expanded-history-latest-card">
                <div class="expanded-history-entry">
                <div class="expanded-history-top">
                  ${renderStatusLabelWithHelp(statusLabel)}
                  <span class="expanded-history-time">${escapeHtml(latestUpdateLabel)}</span>
                </div>
                <div class="expanded-history-meta">${escapeHtml(metaParts.join(" | ") || "Reminder activity")}</div>
                ${group.messagePreview ? `<div class="expanded-message-preview">${escapeHtml(group.messagePreview).replace(/\n/g, "<br>")}</div>` : ""}
                </div>
              </div>
              ${timelineMarkup ? `<div class="expanded-history-followups"><div class="expanded-history-followups-label">Earlier status updates</div><div class="expanded-history-timeline">${timelineMarkup}</div></div>` : ""}
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
        <div class="expanded-client-block expanded-client-block-plain expanded-reminder-activity-shell">
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

function getWeekHours(weekAppointments) {
  let startHour = DEFAULT_WEEK_START_HOUR;
  let endHour = DEFAULT_WEEK_END_HOUR;

  weekAppointments.forEach(appointment => {
    const timeText = String(appointment?.service_time || "").trim();

    if (!timeText) {
      return;
    }

    const [hourText] = timeText.split(":");
    const hour = Number(hourText);

    if (!Number.isFinite(hour)) {
      return;
    }

    startHour = Math.min(startHour, Math.max(0, hour));
    endHour = Math.max(endHour, Math.min(23, hour));
  });

  return Array.from({ length: endHour - startHour + 1 }, (_value, index) => startHour + index);
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

  if (prevButton) {
    prevButton.textContent = isWeek ? "Prev Week" : "Prev Month";
  }

  if (nextButton) {
    nextButton.textContent = isWeek ? "Next Week" : "Next Month";
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

  const weekHours = getWeekHours(weekAppointments);

  const slotRows = weekHours.flatMap(hour => {
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
  const loadId = calendarLoadSequence + 1;
  calendarLoadSequence = loadId;

  if (!supabase || !user?.id) {
    recordCalendarDebug("load appointments skipped", !supabase ? "no supabase client" : "no user");
    appointments = [];
    reminderHistory = [];
    appointmentsReady = true;
    calendarLoadFailed = false;
    renderCalendar();
    return;
  }

  setLoadingState(true);
  setStatus("");
  calendarLoadFailed = false;
  recordCalendarDebug("load appointments start", `user ${user.id}`);

  try {
    let appointmentsResult = null;
    let historyResult = null;

    try {
      const [apiAppointments, apiHistory] = await Promise.all([
        fetchAccountDataResource("calendar-appointments", user.id),
        fetchAccountDataResource("history", user.id).catch(error => {
          recordCalendarDebug("history api failed", error?.message || String(error));
          return [];
        })
      ]);
      appointmentsResult = { data: apiAppointments, error: null };
      historyResult = { data: apiHistory, error: null };
      recordCalendarDebug("appointments api query", `${apiAppointments.length} row${apiAppointments.length === 1 ? "" : "s"}`);
    } catch (error) {
      recordCalendarDebug("appointments api fallback", error?.message || String(error));
    }

    if (!appointmentsResult) {
      appointmentsResult = await withSupabaseRetry(() => supabase
        .from("appointments")
        .select("id, client_id, client_name, client_email, client_phone, service_date, service_time, service_location, notes, last_channel, last_source, created_at, updated_at")
        .eq("owner_id", user.id)
        .order("service_date", { ascending: true })
        .order("service_time", { ascending: true }), { attempts: 1, timeoutMs: SUPABASE_READ_TIMEOUT_MS });
    }

    if (!historyResult) {
      historyResult = await withSupabaseRetry(() => supabase
        .from("client_reminder_history")
        .select("id, client_id, channel, source, message_id, recipient_email, event_type, status, occurred_at, sent_at, created_at, message_preview")
        .eq("owner_id", user.id)
        .order("sent_at", { ascending: false })
        .limit(500), { attempts: 1, timeoutMs: SUPABASE_READ_TIMEOUT_MS })
      .catch(error => ({ data: [], error }));
    }

    const { data, error } = appointmentsResult;
    const { data: historyData, error: historyError } = historyResult;
    recordCalendarDebug("appointments query", error ? error.message || String(error) : `${(data || []).length} row${(data || []).length === 1 ? "" : "s"}`);

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
      recordCalendarDebug("history query failed", historyError.message || String(historyError));
      console.warn("Unable to load reminder history for calendar.", historyError);
      setStatus("Appointments loaded, but reminder history is temporarily unavailable.", "info");
    }

    if (loadId !== calendarLoadSequence) {
      recordCalendarDebug("stale calendar result ignored", `load ${loadId}`);
      return;
    }

    appointmentsReady = true;
    calendarLoadFailed = false;
    appointments = data || [];
    reminderHistory = historyError ? [] : historyData || [];

    if (appointmentsSetupNotice) {
      appointmentsSetupNotice.hidden = true;
    }

    renderCalendar();
    recordCalendarDebug("calendar rendered", `${appointments.length} appointment${appointments.length === 1 ? "" : "s"}`);
  } catch (error) {
    if (loadId !== calendarLoadSequence) {
      recordCalendarDebug("stale calendar error ignored", error?.message || String(error));
      return;
    }
    appointments = [];
    reminderHistory = [];
    appointmentsReady = true;
    calendarLoadFailed = true;
    recordCalendarDebug("load appointments error", error?.message || String(error));
    renderCalendarLoadError("We could not reach your saved appointments right now. Nothing was changed.");
    setStatus(error.message || "Unable to load appointments.", "error");
  } finally {
    if (loadId === calendarLoadSequence) {
      setLoadingState(false);
    }
  }
}

function bindCalendarControls() {
  if (importAppointmentsButton && importAppointmentsInput) {
    importAppointmentsButton.addEventListener("click", () => {
      importAppointmentsInput.click();
    });
    importAppointmentsInput.addEventListener("change", handleImportAppointmentsFile);
  }

  if (importIcsButton && importIcsInput) {
    importIcsButton.addEventListener("click", () => {
      importIcsInput.click();
    });
    importIcsInput.addEventListener("change", handleImportIcsFile);
  }

  if (syncGoogleCalendarButton) {
    syncGoogleCalendarButton.addEventListener("click", handleSyncGoogleCalendar);
  }

  if (syncOutlookCalendarButton) {
    syncOutlookCalendarButton.addEventListener("click", handleSyncOutlookCalendar);
  }

  if (syncCalendarLinkButton) {
    syncCalendarLinkButton.addEventListener("click", handleSyncCalendarLink);
  }

  if (calendarFeedUrlInput) {
    calendarFeedUrlInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleSyncCalendarLink();
      }
    });
  }

  if (copyForwardingEmailButton) {
    copyForwardingEmailButton.addEventListener("click", copyForwardingEmailAddress);
  }

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
      const retryButton = event.target.closest("[data-calendar-retry]");

      if (retryButton) {
        event.preventDefault();
        refreshCalendarSessionAndData();
        return;
      }

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
  recordCalendarDebug("init start");
  bindCalendarControls();

  try {
    appConfig = await getPublicConfig();
    recordCalendarDebug("public config", appConfig.accountsEnabled ? "accounts enabled" : "accounts disabled");
  } catch (error) {
    recordCalendarDebug("public config error", error?.message || String(error));
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

  const createClient = await loadSupabaseCreateClient();
  supabase = getSharedSupabaseClient(appConfig.supabaseUrl, appConfig.supabasePublishableKey, createClient);
  recordCalendarDebug("supabase client ready");

  const initialUser = await getCurrentSupabaseUser();

  currentAuthUser = initialUser || null;
  currentAuthUserId = initialUser?.id || "";
  scheduleCalendarSessionRecovery();
  updateSignedInView(initialUser || null);
  await loadAppointments(initialUser || null);

  supabase.auth.onAuthStateChange(async (event, nextSession) => {
    recordCalendarDebug("auth event", `${event} ${nextSession?.user?.id || "no user"}`);
    if (event === "TOKEN_REFRESHED") {
      return;
    }

    const nextUserId = nextSession?.user?.id || "";

    if (nextUserId === currentAuthUserId && event !== "USER_UPDATED") {
      return;
    }

    currentAuthUserId = nextUserId;
    currentAuthUser = nextSession?.user || null;
    updateSignedInView(currentAuthUser);
    await loadAppointments(currentAuthUser);
  });

  window.addEventListener("pageshow", event => {
    if (event.persisted) {
      refreshCalendarSessionAndData();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && currentAuthUserId && !appointments.length && !calendarLoading?.hidden) {
      return;
    }

    if (document.visibilityState === "visible" && currentAuthUserId && (!appointments.length || calendarLoadFailed)) {
      refreshCalendarSessionAndData();
    }
  });

  MOBILE_CALENDAR_QUERY.addEventListener("change", event => {
    currentCalendarView = event.matches ? "month" : "week";
    renderCalendar();
  });
}

initPage().catch(error => {
  recordCalendarDebug("init error", error?.message || String(error));
  setStatus(error.message || "Unable to load this page.", "error");
});
