const statusBanner = document.getElementById("status-banner");
const authSetupNotice = document.getElementById("auth-setup-notice");
const signedOutShell = document.getElementById("signed-out-shell");
const freeShell = document.getElementById("free-shell");
const bronzeShell = document.getElementById("bronze-shell");
const pricePill = document.getElementById("price-pill");
const totalCount = document.getElementById("messages-total-count");
const reminderCount = document.getElementById("messages-reminder-count");
const importCount = document.getElementById("messages-import-count");
const messagesLoading = document.getElementById("messages-loading");
const messagesTimeline = document.getElementById("messages-timeline");
const messagesSearch = document.getElementById("messages-search");
const messagesFilter = document.getElementById("messages-filter");
const pastMessageForm = document.getElementById("past-message-form");
const pastMessageClient = document.getElementById("past-message-client");
const pastMessageChannel = document.getElementById("past-message-channel");
const pastMessageStatus = document.getElementById("past-message-status");
const pastMessageSentAt = document.getElementById("past-message-sent-at");
const pastMessageRecipient = document.getElementById("past-message-recipient");
const pastMessagePreview = document.getElementById("past-message-preview");
const savePastMessageButton = document.getElementById("save-past-message-button");

let supabase = null;
let appConfig = null;
let currentAuthUser = null;
let clients = [];
let appointments = [];
let historyRows = [];
let timelineEvents = [];
let searchQuery = "";
let filterMode = "all";
const SUPABASE_MODULE_TIMEOUT_MS = 4500;
const ACCOUNT_DATA_TIMEOUT_MS = 8500;
const REMINDER_PREFILL_KEY = "appointment-reminder-selected-client";
const SUPABASE_MODULE_URLS = [
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm",
  "https://esm.sh/@supabase/supabase-js@2"
];
let loadedSupabaseCreateClient = null;

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

async function importWithTimeout(url, timeoutMs = SUPABASE_MODULE_TIMEOUT_MS) {
  let timeoutId = 0;

  try {
    return await Promise.race([
      import(url),
      new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error(`Timed out loading ${url}`)), timeoutMs);
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
    return loadedSupabaseCreateClient;
  }

  let lastError = null;

  for (const url of SUPABASE_MODULE_URLS) {
    try {
      const module = await importWithTimeout(url);

      if (typeof module?.createClient === "function") {
        loadedSupabaseCreateClient = module.createClient;
        return loadedSupabaseCreateClient;
      }

      lastError = new Error(`Supabase module at ${url} did not export createClient.`);
    } catch (error) {
      lastError = error;
      console.warn("Unable to load Supabase SDK from", url, error);
    }
  }

  throw lastError || new Error("Unable to load Supabase SDK.");
}

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
      controller.abort(new Error("Supabase request timed out."));
    }, ACCOUNT_DATA_TIMEOUT_MS);

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

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = ACCOUNT_DATA_TIMEOUT_MS) {
  if (typeof AbortController === "undefined") {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    return { response, data };
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort(new Error("Request timed out."));
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Account data request timed out.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function getPublicConfig() {
  const { response, data } = await fetchJsonWithTimeout("/api/public-config", { cache: "no-store" });

  if (!response.ok) {
    throw new Error(data?.error || "Unable to load account configuration.");
  }

  return data;
}

async function getCurrentSupabaseAccessToken() {
  if (!supabase) {
    return "";
  }

  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || "";
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

  const { response, data } = await fetchJsonWithTimeout(`/api/account-data?${params.toString()}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(data?.error || "Unable to load account data.");
  }

  return Array.isArray(data?.data) ? data.data : [];
}

async function saveAccountDataResource(resource, body, ownerId = "") {
  const token = await getCurrentSupabaseAccessToken();

  if (!token) {
    throw new Error("No account session token is available.");
  }

  const params = new URLSearchParams({ resource });

  if (ownerId) {
    params.set("ownerId", ownerId);
  }

  const { response, data } = await fetchJsonWithTimeout(`/api/account-data?${params.toString()}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(data?.error || "Unable to save account data.");
  }

  return Array.isArray(data?.data) ? data.data : [];
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

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 20);
}

function formatPhone(value) {
  const digits = normalizePhone(value);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function formatAppointmentDate(appointment) {
  const dateText = String(appointment?.service_date || "").trim();

  if (!dateText) {
    return "Date not available";
  }

  const timeText = String(appointment?.service_time || "").trim();
  const date = new Date(`${dateText}T${timeText || "12:00"}`);

  if (Number.isNaN(date.getTime())) {
    return dateText;
  }

  return new Intl.DateTimeFormat("en-US", timeText
    ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" }
  ).format(date);
}

function getEventTimestamp(value) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getReminderEventTimestamp(entry) {
  return Math.max(
    getEventTimestamp(entry?.occurred_at),
    getEventTimestamp(entry?.sent_at),
    getEventTimestamp(entry?.created_at)
  );
}

function getReminderStatusLabel(entry) {
  const rawStatus = String(entry?.status || entry?.event_type || "").trim().toLowerCase();

  if (rawStatus.includes("deliver")) {
    return "Delivered";
  }

  if (rawStatus.includes("open")) {
    return "Likely opened";
  }

  if (rawStatus.includes("click")) {
    return "Clicked";
  }

  if (rawStatus.includes("reply")) {
    return "Replied";
  }

  if (rawStatus.includes("bounce") || rawStatus.includes("fail")) {
    return "Failed";
  }

  if (rawStatus.includes("unknown")) {
    return "Unknown";
  }

  return "Sent";
}

function getStatusClass(label) {
  const normalized = String(label || "").trim().toLowerCase();

  if (normalized.includes("deliver")) {
    return "delivered";
  }

  if (normalized.includes("open")) {
    return "opened";
  }

  if (normalized.includes("click")) {
    return "clicked";
  }

  if (normalized.includes("reply")) {
    return "replied";
  }

  if (normalized.includes("fail") || normalized.includes("bounce")) {
    return "failed";
  }

  return "sent";
}

function getReminderSourceLabel(entry) {
  const source = String(entry?.source || "").trim().toLowerCase();

  if (source === "automated_email") {
    return "App reminder";
  }

  if (source === "device_sms") {
    return "Text from device";
  }

  if (source === "external_import") {
    return "Logged past message";
  }

  if (source === "manual") {
    return "Manual send";
  }

  return source ? source.charAt(0).toUpperCase() + source.slice(1).replace(/_/g, " ") : "Reminder";
}

function getAppointmentSourceLabel(appointment) {
  const source = String(appointment?.last_source || "").trim().toLowerCase();

  if (source === "raw_email") {
    return "Pasted email import";
  }

  if (source === "forwarded_email") {
    return "Forwarded email import";
  }

  if (source === "ics_import") {
    return "ICS file import";
  }

  if (source === "calendar_link") {
    return "Calendar link import";
  }

  if (source === "google_calendar") {
    return "Google Calendar import";
  }

  if (source === "outlook_calendar") {
    return "Outlook Calendar import";
  }

  if (source === "import") {
    return "File import";
  }

  return "Appointment import";
}

function getClientDisplay(client) {
  if (!client) {
    return "";
  }

  return String(client.client_name || client.client_email || formatPhone(client.client_phone) || "").trim();
}

function buildClientLookup() {
  const lookup = {
    byId: new Map(),
    byEmail: new Map(),
    byPhone: new Map()
  };

  clients.forEach(client => {
    const id = String(client?.id || "").trim();
    const email = String(client?.client_email || "").trim().toLowerCase();
    const phone = normalizePhone(client?.client_phone || "");

    if (id) {
      lookup.byId.set(id, client);
    }

    if (email && !lookup.byEmail.has(email)) {
      lookup.byEmail.set(email, client);
    }

    if (phone && !lookup.byPhone.has(phone)) {
      lookup.byPhone.set(phone, client);
    }
  });

  return lookup;
}

function findClientForRecord(record, lookup = buildClientLookup()) {
  const clientId = String(record?.client_id || "").trim();
  const email = String(record?.client_email || record?.recipient_email || "").trim().toLowerCase();
  const phone = normalizePhone(record?.client_phone || record?.raw_event?.recipient_phone || "");

  if (clientId && lookup.byId.has(clientId)) {
    return lookup.byId.get(clientId);
  }

  if (email && lookup.byEmail.has(email)) {
    return lookup.byEmail.get(email);
  }

  if (phone && lookup.byPhone.has(phone)) {
    return lookup.byPhone.get(phone);
  }

  return null;
}

function normalizeReminderPreview(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function getGroupedReminderHistory(entries) {
  const sortedEntries = [...(entries || [])].sort((left, right) => getReminderEventTimestamp(right) - getReminderEventTimestamp(left));
  const groups = [];
  const reminderWindowMs = 15 * 60 * 1000;

  sortedEntries.forEach(entry => {
    const messageId = String(entry?.message_id || "").trim();
    const messagePreview = String(entry?.message_preview || "").trim();
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

  return groups.map(group => ({
    ...group,
    entries: [...group.entries].sort((left, right) => getReminderEventTimestamp(right) - getReminderEventTimestamp(left))
  }));
}

function buildReminderTimelineEvents(lookup) {
  return getGroupedReminderHistory(historyRows).map(group => {
    const latest = group.latestEntry || {};
    const client = findClientForRecord(latest, lookup);
    const recipient = String(latest.recipient_email || latest.raw_event?.recipient_phone || "").trim();
    const channel = String(latest.channel || "").trim().toLowerCase() === "sms" ? "sms" : "email";
    const statusLabel = getReminderStatusLabel(latest);
    const title = getClientDisplay(client) || recipient || "Unknown client";
    const timestamp = getReminderEventTimestamp(latest);

    return {
      id: `history:${latest.id || group.messageId || timestamp}`,
      kind: "reminder",
      channel,
      title,
      client,
      timestamp,
      timeLabel: formatDateTime(timestamp),
      statusLabel,
      statusClass: getStatusClass(statusLabel),
      sourceLabel: getReminderSourceLabel(latest),
      preview: group.messagePreview || "",
      recipient,
      entries: group.entries,
      searchText: [
        title,
        recipient,
        channel,
        statusLabel,
        getReminderSourceLabel(latest),
        group.messagePreview
      ].join(" ").toLowerCase()
    };
  });
}

function buildAppointmentTimelineEvents(lookup) {
  const importSources = new Set(["raw_email", "forwarded_email", "ics_import", "calendar_link", "google_calendar", "outlook_calendar", "import"]);

  return (appointments || [])
    .filter(appointment => importSources.has(String(appointment?.last_source || "").trim().toLowerCase()))
    .map(appointment => {
      const client = findClientForRecord(appointment, lookup);
      const title = getClientDisplay(client) || appointment.client_name || appointment.client_email || formatPhone(appointment.client_phone) || "Imported appointment";
      const sourceLabel = getAppointmentSourceLabel(appointment);
      const timestamp = getEventTimestamp(appointment.updated_at || appointment.created_at || appointment.service_date);
      const appointmentLabel = formatAppointmentDate(appointment);
      const preview = String(appointment.notes || "").trim();

      return {
        id: `appointment:${appointment.id || timestamp}`,
        kind: "import",
        channel: "import",
        title,
        client,
        appointment,
        timestamp,
        timeLabel: formatDateTime(timestamp),
        statusLabel: "Recovered",
        statusClass: "import",
        sourceLabel,
        preview,
        recipient: appointment.client_email || appointment.client_phone || "",
        appointmentLabel,
        searchText: [
          title,
          appointment.client_email,
          appointment.client_phone,
          appointment.service_location,
          sourceLabel,
          appointmentLabel,
          preview
        ].join(" ").toLowerCase()
      };
    });
}

function buildTimelineEvents() {
  const lookup = buildClientLookup();
  timelineEvents = [
    ...buildReminderTimelineEvents(lookup),
    ...buildAppointmentTimelineEvents(lookup)
  ].sort((left, right) => right.timestamp - left.timestamp);
}

function getFilteredEvents() {
  const query = searchQuery.trim().toLowerCase();

  return timelineEvents.filter(event => {
    const matchesQuery = !query || event.searchText.includes(query);
    const matchesFilter = filterMode === "all"
      || (filterMode === "reminders" && event.kind === "reminder")
      || (filterMode === "imports" && event.kind === "import")
      || (filterMode === "email" && event.channel === "email")
      || (filterMode === "sms" && event.channel === "sms");

    return matchesQuery && matchesFilter;
  });
}

function renderCounts() {
  if (totalCount) {
    totalCount.textContent = String(timelineEvents.length);
  }

  if (reminderCount) {
    reminderCount.textContent = String(timelineEvents.filter(event => event.kind === "reminder").length);
  }

  if (importCount) {
    importCount.textContent = String(timelineEvents.filter(event => event.kind === "import").length);
  }
}

function renderTimelineEvent(event) {
  const channelLabel = event.channel === "sms" ? "Text" : event.channel === "email" ? "Email" : "Import";
  const channelClass = event.channel === "sms" ? "sms" : event.channel === "email" ? "email" : "import";
  const previewMarkup = event.preview
    ? `<div class="message-event-preview">${escapeHtml(event.preview)}</div>`
    : "";
  const appointmentMarkup = event.appointmentLabel
    ? `<span>${escapeHtml(event.appointmentLabel)}</span>`
    : "";
  const locationMarkup = event.appointment?.service_location
    ? `<span>${escapeHtml(event.appointment.service_location)}</span>`
    : "";
  const historyMarkup = event.entries?.length > 1
    ? `<div class="message-event-history">${event.entries.slice(1).map(entry => `<span class="message-chip ${getStatusClass(getReminderStatusLabel(entry))}">${escapeHtml(getReminderStatusLabel(entry))}</span>`).join("")}</div>`
    : "";
  const actionMarkup = event.appointment
    ? `<button class="primary-button" type="button" data-action="use-appointment" data-event-id="${escapeHtml(event.id)}">Send reminder</button>`
    : event.client
      ? `<button class="primary-button" type="button" data-action="use-client" data-event-id="${escapeHtml(event.id)}">Send follow-up</button>`
      : "";

  return `
    <article class="message-event-card" data-message-event data-event-id="${escapeHtml(event.id)}">
      <div class="message-event-top">
        <div>
          <h3 class="message-event-title">${escapeHtml(event.title)}</h3>
          <div class="message-event-meta">
            <span class="message-chip ${channelClass}">${escapeHtml(channelLabel)}</span>
            <span class="message-chip ${event.statusClass}">${escapeHtml(event.statusLabel)}</span>
            <span>${escapeHtml(event.sourceLabel)}</span>
          </div>
        </div>
        <div class="message-event-time">${escapeHtml(event.timeLabel)}</div>
      </div>
      <div class="message-event-submeta">
        ${event.recipient ? `<span>${escapeHtml(event.recipient)}</span>` : ""}
        ${appointmentMarkup}
        ${locationMarkup}
      </div>
      ${previewMarkup}
      ${historyMarkup}
      ${actionMarkup ? `<div class="message-event-actions">${actionMarkup}</div>` : ""}
    </article>
  `;
}

function renderTimeline() {
  if (!messagesTimeline) {
    return;
  }

  renderCounts();
  const filteredEvents = getFilteredEvents();

  if (!timelineEvents.length) {
    messagesTimeline.innerHTML = `<div class="messages-empty">No message activity yet. Sent reminders, logged past messages, and imported appointments will appear here.</div>`;
    return;
  }

  if (!filteredEvents.length) {
    messagesTimeline.innerHTML = `<div class="messages-empty">No timeline items match that filter.</div>`;
    return;
  }

  messagesTimeline.innerHTML = filteredEvents.map(renderTimelineEvent).join("");
}

function setLoading(isLoading) {
  if (messagesLoading) {
    messagesLoading.hidden = !isLoading;
  }

  if (messagesTimeline) {
    messagesTimeline.hidden = isLoading;
  }
}

function updatePastMessageClientOptions() {
  if (!pastMessageClient) {
    return;
  }

  const currentValue = pastMessageClient.value;
  pastMessageClient.innerHTML = `
    <option value="">No client selected</option>
    ${clients.map(client => `<option value="${escapeHtml(client.id)}">${escapeHtml(getClientDisplay(client) || "Saved client")}</option>`).join("")}
  `;
  pastMessageClient.value = currentValue && clients.some(client => String(client.id) === currentValue) ? currentValue : "";
}

function setDefaultPastMessageDate() {
  if (!pastMessageSentAt || pastMessageSentAt.value) {
    return;
  }

  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  pastMessageSentAt.value = now.toISOString().slice(0, 16);
}

function syncRecipientFromSelectedClient() {
  if (!pastMessageClient || !pastMessageRecipient) {
    return;
  }

  const client = clients.find(entry => String(entry.id || "") === String(pastMessageClient.value || ""));

  if (!client) {
    return;
  }

  const channel = String(pastMessageChannel?.value || "email");
  const nextRecipient = channel === "sms"
    ? formatPhone(client.client_phone || "")
    : String(client.client_email || "").trim();

  if (nextRecipient) {
    pastMessageRecipient.value = nextRecipient;
  }
}

function buildReminderPrefill(event) {
  const client = event.client || {};
  const appointment = event.appointment || {};

  return {
    id: client.id || appointment.client_id || "",
    appointmentId: appointment.id || "",
    name: client.client_name || appointment.client_name || "",
    email: client.client_email || appointment.client_email || (event.channel === "email" ? event.recipient : ""),
    phone: client.client_phone ? formatPhone(client.client_phone) : appointment.client_phone ? formatPhone(appointment.client_phone) : event.channel === "sms" ? formatPhone(event.recipient) : "",
    address: client.service_address || appointment.service_location || "",
    date: appointment.service_date || "",
    time: appointment.service_time || "",
    notes: appointment.notes || ""
  };
}

function useEventInReminder(eventId) {
  const event = timelineEvents.find(entry => String(entry.id) === String(eventId));

  if (!event) {
    setStatus("Unable to find that timeline item.", "error");
    return;
  }

  const payload = JSON.stringify(buildReminderPrefill(event));

  try {
    window.sessionStorage.setItem(REMINDER_PREFILL_KEY, payload);
  } catch (error) {
    console.warn("Unable to save reminder prefill to session storage.", error);
  }

  try {
    window.localStorage.setItem(REMINDER_PREFILL_KEY, payload);
  } catch (error) {
    console.warn("Unable to save reminder prefill to local storage.", error);
  }

  window.location.href = new URL("index.html", window.location.href).toString();
}

async function loadMessages(user) {
  if (!user?.id) {
    return;
  }

  setLoading(true);
  setStatus("Loading message timeline...", "info");

  try {
    const [clientRows, appointmentRows, historyData] = await Promise.all([
      fetchAccountDataResource("clients", user.id),
      fetchAccountDataResource("calendar-appointments", user.id),
      fetchAccountDataResource("history", user.id)
    ]);

    clients = clientRows || [];
    appointments = appointmentRows || [];
    historyRows = historyData || [];
    buildTimelineEvents();
    updatePastMessageClientOptions();
    renderTimeline();
    setStatus("", "info");
  } catch (error) {
    console.warn("Unable to load messages.", error);
    setStatus(error.message || "Unable to load messages.", "error");
    if (messagesTimeline) {
      messagesTimeline.innerHTML = `<div class="messages-empty">Unable to load messages right now. Nothing was changed.</div>`;
      messagesTimeline.hidden = false;
    }
  } finally {
    setLoading(false);
  }
}

function updateSignedInState(user) {
  const signedIn = Boolean(user);
  const bronze = signedIn && isBronzeUser(user);

  document.querySelectorAll("[data-auth-only]").forEach(link => {
    link.hidden = !signedIn;
  });

  if (signedOutShell) {
    signedOutShell.hidden = signedIn;
  }

  if (freeShell) {
    freeShell.hidden = !signedIn || bronze;
  }

  if (bronzeShell) {
    bronzeShell.hidden = !bronze;
  }

  if (pricePill) {
    if (!signedIn) {
      pricePill.textContent = "Optional Bronze";
    } else if (bronze) {
      pricePill.textContent = "Bronze Active";
    } else {
      pricePill.textContent = "Free Account";
    }
  }
}

async function handleSavePastMessage(event) {
  event.preventDefault();

  if (!currentAuthUser?.id) {
    setStatus("Please sign in before saving a message.", "error");
    return;
  }

  const client = clients.find(entry => String(entry.id || "") === String(pastMessageClient?.value || ""));
  const channel = String(pastMessageChannel?.value || "email") === "sms" ? "sms" : "email";
  const recipient = String(pastMessageRecipient?.value || "").trim();
  const preview = String(pastMessagePreview?.value || "").trim();
  const occurredAtValue = String(pastMessageSentAt?.value || "").trim();
  const occurredAt = occurredAtValue ? new Date(occurredAtValue).toISOString() : new Date().toISOString();
  const recipientEmail = channel === "email"
    ? recipient || String(client?.client_email || "").trim()
    : "";
  const recipientPhone = channel === "sms"
    ? normalizePhone(recipient || client?.client_phone || "")
    : "";

  if (!client && !recipient) {
    setStatus("Choose a client or add a recipient.", "error");
    return;
  }

  if (channel === "email" && recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(recipientEmail)) {
    setStatus("Enter a valid recipient email.", "error");
    return;
  }

  if (channel === "sms" && !recipientPhone) {
    setStatus("Enter a valid phone number for the text message.", "error");
    return;
  }

  if (!preview) {
    setStatus("Add a short message preview before saving.", "error");
    return;
  }

  setButtonBusy(savePastMessageButton, true, "Saving...");
  setStatus("Saving past message...", "info");

  try {
    await saveAccountDataResource("history", {
      row: {
        client_id: client?.id || null,
        channel,
        source: "external_import",
        recipient_email: recipientEmail,
        recipient_phone: recipientPhone,
        status: String(pastMessageStatus?.value || "sent"),
        event_type: String(pastMessageStatus?.value || "sent"),
        occurred_at: occurredAt,
        sent_at: occurredAt,
        message_preview: preview,
        raw_event: {
          recipient_phone: recipientPhone,
          imported_from: "messages_page"
        }
      }
    }, currentAuthUser.id);

    pastMessageForm?.reset();
    setDefaultPastMessageDate();
    setStatus("Past message saved.", "success");
    await loadMessages(currentAuthUser);
  } catch (error) {
    console.warn("Unable to save past message.", error);
    setStatus(error.message || "Unable to save past message.", "error");
  } finally {
    setButtonBusy(savePastMessageButton, false);
  }
}

function bindControls() {
  if (messagesSearch) {
    messagesSearch.addEventListener("input", event => {
      searchQuery = String(event.target.value || "");
      renderTimeline();
    });
  }

  if (messagesFilter) {
    messagesFilter.addEventListener("change", event => {
      filterMode = String(event.target.value || "all");
      renderTimeline();
    });
  }

  if (pastMessageForm) {
    pastMessageForm.addEventListener("submit", handleSavePastMessage);
  }

  if (pastMessageClient) {
    pastMessageClient.addEventListener("change", syncRecipientFromSelectedClient);
  }

  if (pastMessageChannel) {
    pastMessageChannel.addEventListener("change", syncRecipientFromSelectedClient);
  }

  if (messagesTimeline) {
    messagesTimeline.addEventListener("click", event => {
      const button = event.target.closest("[data-action]");

      if (!button) {
        return;
      }

      const action = button.dataset.action || "";

      if (action === "use-appointment" || action === "use-client") {
        useEventInReminder(button.dataset.eventId || "");
      }
    });
  }

  setDefaultPastMessageDate();
}

async function initMessagesPage() {
  bindControls();

  try {
    appConfig = await getPublicConfig();

    if (!appConfig?.accountsEnabled) {
      if (authSetupNotice) {
        authSetupNotice.hidden = false;
      }
      updateSignedInState(null);
      return;
    }

    const createClient = await loadSupabaseCreateClient();
    const publicKey = appConfig.supabasePublishableKey || appConfig.supabaseAnonKey;
    supabase = getSharedSupabaseClient(appConfig.supabaseUrl, publicKey, createClient);
    const { data } = await supabase.auth.getSession();
    currentAuthUser = data?.session?.user || null;
    updateSignedInState(currentAuthUser);

    if (currentAuthUser && isBronzeUser(currentAuthUser)) {
      await loadMessages(currentAuthUser);
    }

    supabase.auth.onAuthStateChange((_event, session) => {
      currentAuthUser = session?.user || null;
      updateSignedInState(currentAuthUser);

      if (currentAuthUser && isBronzeUser(currentAuthUser)) {
        loadMessages(currentAuthUser);
      }
    });
  } catch (error) {
    console.error("Unable to initialize messages page.", error);
    setStatus(error.message || "Unable to initialize messages page.", "error");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMessagesPage);
} else {
  initMessagesPage();
}
