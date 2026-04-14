import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const statusBanner = document.getElementById("status-banner");
const signedOutPanel = document.getElementById("signed-out-panel");
const signedInPanel = document.getElementById("signed-in-panel");
const authSetupNotice = document.getElementById("auth-setup-notice");
const billingSetupNotice = document.getElementById("billing-setup-notice");
const accountEmail = document.getElementById("account-email");
const accountPlan = document.getElementById("account-plan");
const planSummaryCopy = document.getElementById("plan-summary-copy");
const contactsCount = document.getElementById("contacts-count");
const contactsCountBadge = document.getElementById("contacts-count-badge");
const upgradeButton = document.getElementById("upgrade-button");
const signUpForm = document.getElementById("sign-up-form");
const signInForm = document.getElementById("sign-in-form");
const signOutButton = document.getElementById("sign-out-button");
const pricePill = document.getElementById("price-pill");
const tierPreviewShell = document.getElementById("tier-preview-shell");
const setFreeTierButton = document.getElementById("set-free-tier-button");
const setBronzeTierButton = document.getElementById("set-bronze-tier-button");
const freeContactsShell = document.getElementById("free-contacts-shell");
const bronzeContactsShell = document.getElementById("bronze-contacts-shell");
const clientForm = document.getElementById("client-form");
const saveClientButton = document.getElementById("save-client-button");
const openAddClientButton = document.getElementById("open-add-client-button");
const cancelEditClientButton = document.getElementById("cancel-edit-client-button");
const clientFormStatus = document.getElementById("client-form-status");
const clientFormMode = document.getElementById("client-form-mode");
const clientModal = document.getElementById("client-modal");
const clientModalTitle = document.getElementById("client-modal-title");
const clientModalCopy = document.getElementById("client-modal-copy");
const clientDetailModal = document.getElementById("client-detail-modal");
const clientDetailTitle = document.getElementById("client-detail-title");
const clientDetailCopy = document.getElementById("client-detail-copy");
const clientDetailBody = document.getElementById("client-detail-body");
const closeClientDetailButton = document.getElementById("close-client-detail-button");
const statusHelpModal = document.getElementById("status-help-modal");
const statusHelpCopy = document.getElementById("status-help-copy");
const closeStatusHelpButton = document.getElementById("close-status-help-button");
const clientsSearchInput = document.getElementById("clients-search");
const clientsSortSelect = document.getElementById("clients-sort");
const clientsList = document.getElementById("clients-list");
const seedClientsButton = document.getElementById("seed-clients-button");
const contactsCard = document.getElementById("contacts-card");
const exportClientsJsonButton = document.getElementById("export-clients-json-button");
const exportClientsCsvButton = document.getElementById("export-clients-csv-button");
const importClientsButton = document.getElementById("import-clients-button");
const importClientsInput = document.getElementById("import-clients-input");
const clientsMoreActionsMenu = document.getElementById("clients-more-actions-menu");

let supabase = null;
let appConfig = null;
let runtimeConfig = null;
let runtimeConfigPromise = null;
let savedClients = [];
let editingClientId = "";
let clientsSearchQuery = "";
let clientsSortMode = "newest";
let clientsPage = 1;
let reminderHistoryReady = true;
let isLoadingClients = false;
let currentAuthUserId = "";
let statusBannerTimer = 0;
const REMINDER_PREFILL_KEY = "appointment-reminder-selected-client";
const CLIENTS_PER_PAGE = 10;
const CLIENT_EXPORT_COLUMNS = [
  "id",
  "client_name",
  "client_email",
  "client_phone",
  "service_address",
  "notes",
  "profile_custom_answers",
  "created_at",
  "updated_at"
];

function setAuthFormsEnabled(enabled) {
  [signUpForm, signInForm].forEach(form => {
    if (!form) {
      return;
    }

    form.querySelectorAll("input, button").forEach(element => {
      element.disabled = !enabled;
    });
  });
}

function setStatus(message, type = "info", options = {}) {
  if (!statusBanner) {
    return;
  }

  if (statusBannerTimer) {
    window.clearTimeout(statusBannerTimer);
    statusBannerTimer = 0;
  }

  if (!message) {
    statusBanner.hidden = true;
    statusBanner.textContent = "";
    statusBanner.className = "status-banner";
    return;
  }

  statusBanner.hidden = false;
  statusBanner.textContent = message;
  statusBanner.className = `status-banner ${type}${options.loading ? " loading" : ""}`;

  if (type === "success" || type === "error") {
    statusBannerTimer = window.setTimeout(() => {
      statusBanner.hidden = true;
      statusBanner.textContent = "";
      statusBanner.className = "status-banner";
      statusBannerTimer = 0;
    }, type === "error" ? 4600 : 3200);
  }
}

function setClientFormStatus(message, type = "info") {
  if (!clientFormStatus) {
    return;
  }

  if (!message) {
    clientFormStatus.hidden = true;
    clientFormStatus.textContent = "";
    clientFormStatus.className = "inline-status";
    return;
  }

  clientFormStatus.hidden = false;
  clientFormStatus.textContent = message;
  clientFormStatus.className = `inline-status ${type}`;
  clientFormStatus.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closeClientsMoreActionsMenu() {
  if (clientsMoreActionsMenu?.open) {
    clientsMoreActionsMenu.open = false;
  }
}

function openClientModal() {
  if (!clientModal) {
    return;
  }

  clientModal.hidden = false;
  clientModal.classList.add("visible");

  window.setTimeout(() => {
    const firstField = document.getElementById("client-name");
    if (firstField) {
      firstField.focus({ preventScroll: true });
    }
  }, 40);
}

function closeClientModal() {
  if (!clientModal) {
    return;
  }

  clientModal.classList.remove("visible");
  clientModal.hidden = true;
}

function openClientDetailModal(clientId) {
  const client = savedClients.find(entry => entry.id === clientId);

  if (!client || !clientDetailModal || !clientDetailBody) {
    return;
  }

  if (clientDetailTitle) {
    clientDetailTitle.textContent = client.client_name || "Saved client";
  }

  if (clientDetailCopy) {
    const summaryParts = [
      client.client_email || "",
      client.client_phone ? formatPhone(client.client_phone) : ""
    ].filter(Boolean);
    clientDetailCopy.textContent = summaryParts.join(" | ") || "Saved client details and reminder activity.";
  }

  clientDetailBody.innerHTML = `
    <div class="expanded-client-panel modal-client-panel">
      ${renderExpandedClientDetails(client)}
    </div>
  `;

  clientDetailModal.hidden = false;
  clientDetailModal.classList.add("visible");
}

function closeClientDetailModal() {
  if (!clientDetailModal) {
    return;
  }

  clientDetailModal.classList.remove("visible");
  clientDetailModal.hidden = true;
}

function setButtonBusy(button, isBusy, busyText) {
  if (!button) {
    return;
  }

  const labelNode = button.querySelector("[data-button-label]");

  if (!button.dataset.defaultText) {
    button.dataset.defaultText = labelNode ? labelNode.textContent : button.textContent;
  }

  button.disabled = isBusy;
  button.classList.toggle("is-busy", Boolean(isBusy));
  button.setAttribute("aria-busy", isBusy ? "true" : "false");

  if (labelNode) {
    labelNode.textContent = isBusy ? busyText : button.dataset.defaultText;
    return;
  }

  button.textContent = isBusy ? busyText : button.dataset.defaultText;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 10);
}

function isMissingColumnError(error, columnName) {
  const normalizedColumn = String(columnName || "").trim().toLowerCase();
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return Boolean(normalizedColumn && message.includes(normalizedColumn));
}

function normalizeCustomAnswerEntry(rawAnswer, fallbackFieldId = "") {
  const fieldId = String(rawAnswer?.field_id || fallbackFieldId || "").trim();
  const label = String(rawAnswer?.label || rawAnswer?.title || fieldId || "Saved answer").trim();
  const rawValue = String(rawAnswer?.raw_value ?? rawAnswer?.value ?? "").trim();
  const displayValue = String(rawAnswer?.display_value ?? rawValue).trim();

  if (!fieldId || !displayValue) {
    return null;
  }

  return {
    field_id: fieldId,
    label,
    type: String(rawAnswer?.type || "text").trim(),
    page_id: String(rawAnswer?.page_id || "").trim(),
    page_title: String(rawAnswer?.page_title || "").trim(),
    raw_value: rawValue,
    display_value: displayValue,
    source_appointment_id: String(rawAnswer?.source_appointment_id || "").trim(),
    source_service_date: String(rawAnswer?.source_service_date || "").trim(),
    updated_at: String(rawAnswer?.updated_at || rawAnswer?.captured_at || "").trim()
  };
}

function normalizeCustomAnswerList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(entry => normalizeCustomAnswerEntry(entry))
    .filter(Boolean);
}

function normalizeProfileCustomAnswers(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce((accumulator, [fieldId, rawAnswer]) => {
    const normalized = normalizeCustomAnswerEntry(rawAnswer, fieldId);

    if (normalized) {
      accumulator[normalized.field_id] = normalized;
    }

    return accumulator;
  }, {});
}

function buildClientExportRecords() {
  return (savedClients || []).map(client => ({
    id: String(client?.id || "").trim(),
    client_name: String(client?.client_name || "").trim(),
    client_email: String(client?.client_email || "").trim(),
    client_phone: String(client?.client_phone || "").trim(),
    service_address: String(client?.service_address || "").trim(),
    notes: String(client?.notes || "").trim(),
    profile_custom_answers: normalizeProfileCustomAnswers(client?.profile_custom_answers),
    created_at: String(client?.created_at || "").trim(),
    updated_at: String(client?.updated_at || "").trim()
  }));
}

function downloadTextFile(filename, text, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 500);
}

function buildExportFilename(extension) {
  const dateStamp = new Date().toISOString().slice(0, 10);
  return `client-data-${dateStamp}.${extension}`;
}

function toCsvCell(value) {
  const stringValue = String(value ?? "");
  if (!/[",\r\n]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replace(/"/g, "\"\"")}"`;
}

function serializeClientsToCsv(records) {
  const header = CLIENT_EXPORT_COLUMNS.join(",");
  const rows = (records || []).map(record => {
    return CLIENT_EXPORT_COLUMNS.map(column => {
      const rawValue = column === "profile_custom_answers"
        ? JSON.stringify(record?.[column] || {})
        : record?.[column] ?? "";
      return toCsvCell(rawValue);
    }).join(",");
  });

  return [header, ...rows].join("\n");
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
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function parseImportedClientJson(text) {
  const parsed = JSON.parse(text);
  const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.clients) ? parsed.clients : null;

  if (!records) {
    throw new Error("That JSON file does not look like a client export.");
  }

  return records;
}

function parseImportedClientCsv(text) {
  const rows = parseCsvRecords(text);

  if (rows.length < 2) {
    throw new Error("That CSV file does not have any client rows yet.");
  }

  const headers = rows[0].map(normalizeImportHeader);

  return rows.slice(1).map(row => {
    return headers.reduce((record, header, index) => {
      if (!header) {
        return record;
      }

      record[header] = row[index] ?? "";
      return record;
    }, {});
  });
}

function parseImportedProfileAnswers(value) {
  if (!value) {
    return {};
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return normalizeProfileCustomAnswers(value);
  }

  try {
    return normalizeProfileCustomAnswers(JSON.parse(String(value || "").trim()));
  } catch (_error) {
    return {};
  }
}

function normalizeImportedClientRecord(rawRecord, ownerId) {
  if (!rawRecord || typeof rawRecord !== "object") {
    return null;
  }

  const importId = String(rawRecord.id || rawRecord.client_id || "").trim();
  const clientName = String(rawRecord.client_name || rawRecord.name || "").trim().slice(0, 30);
  const clientEmail = String(rawRecord.client_email || rawRecord.email || "").trim();
  const clientPhone = normalizePhone(rawRecord.client_phone || rawRecord.phone || "");
  const serviceAddress = String(rawRecord.service_address || rawRecord.address || "").trim().slice(0, 160);
  const notes = String(rawRecord.notes || rawRecord.additional_details || "").trim().slice(0, 1200);

  if (!clientName && !clientEmail && !clientPhone) {
    return null;
  }

  if (clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(clientEmail)) {
    return null;
  }

  const profileCustomAnswers = parseImportedProfileAnswers(rawRecord.profile_custom_answers);
  const payload = {
    owner_id: ownerId,
    client_name: clientName,
    client_email: clientEmail,
    client_phone: clientPhone,
    service_address: serviceAddress,
    notes,
    updated_at: new Date().toISOString()
  };

  if (Object.keys(profileCustomAnswers).length) {
    payload.profile_custom_answers = profileCustomAnswers;
  }

  return {
    importId,
    payload
  };
}

async function persistImportedClientUpdate(clientId, ownerId, payload) {
  let { error } = await supabase
    .from("clients")
    .update(payload)
    .eq("id", clientId)
    .eq("owner_id", ownerId);

  if (error && isMissingColumnError(error, "profile_custom_answers")) {
    const { profile_custom_answers, ...fallbackPayload } = payload;
    ({ error } = await supabase
      .from("clients")
      .update(fallbackPayload)
      .eq("id", clientId)
      .eq("owner_id", ownerId));
  }

  if (error) {
    throw error;
  }
}

async function persistImportedClientInserts(rows) {
  if (!rows.length) {
    return;
  }

  let { error } = await supabase
    .from("clients")
    .insert(rows);

  if (error && isMissingColumnError(error, "profile_custom_answers")) {
    const fallbackRows = rows.map(({ profile_custom_answers, ...row }) => row);
    ({ error } = await supabase
      .from("clients")
      .insert(fallbackRows));
  }

  if (error) {
    throw error;
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

function getTierLabel(user) {
  const normalized = getTierKey(user);

  if (normalized === "free") {
    return "FREE";
  }

  if (normalized === "bronze") {
    return "Bronze";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function isBronzeUser(user) {
  return getTierKey(user) === "bronze";
}

function formatCountLabel(count) {
  const safeCount = Number.isFinite(count) ? count : 0;
  return safeCount === 1 ? "1 contact" : `${safeCount} contacts`;
}

function updateContactsCount(visibleCount = savedClients.length) {
  const count = savedClients.length;

  if (contactsCount) {
    contactsCount.textContent = String(count);
  }

  if (contactsCountBadge) {
    contactsCountBadge.textContent = visibleCount === count
      ? formatCountLabel(count)
      : `${visibleCount} of ${count} contacts`;
  }
}

function renderContactsLoadingState() {
  if (!clientsList) {
    return;
  }

  clientsList.innerHTML = `
    <div class="loading-state" role="status" aria-live="polite">
      <div class="loading-spinner" aria-hidden="true"></div>
      <p class="loading-title">Loading contacts...</p>
      <p class="loading-copy">Pulling your saved clients and reminder history.</p>
    </div>
  `;
}

function setClientsLoadingState(isLoading) {
  isLoadingClients = isLoading;

  if (contactsCard) {
    contactsCard.classList.toggle("is-loading", isLoading);
  }

  if (isLoading) {
    if (contactsCountBadge) {
      contactsCountBadge.textContent = "Loading contacts...";
    }
    renderContactsLoadingState();
    return;
  }

  updateContactsCount();
}

function formatSavedDate(value) {
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
    year: "numeric"
  }).format(date);
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

  if (rawStatus.includes("request")) {
    return "Sent";
  }

  if (rawStatus.includes("open") && rawStatus.includes("likely")) {
    return "Likely opened";
  }

  if (rawStatus.includes("proxy")) {
    return "Likely opened";
  }

  if (rawStatus.includes("open")) {
    return "Likely opened";
  }

  if (rawStatus.includes("calendar")) {
    return "Calendar clicked";
  }

  if (rawStatus.includes("click")) {
    return "Clicked";
  }

  if (rawStatus.includes("send")) {
    return "Sent";
  }

  if (entry?.delivered_at) {
    return "Delivered";
  }

  if (entry?.opened_at || entry?.open_at) {
    return "Likely opened";
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

function renderStatusLabelWithHelp(label, statusClass = "") {
  const helpText = getStatusHelpText(label);
  const iconMarkup = helpText
    ? `<button class="status-help-button" type="button" data-status-help="${escapeHtml(helpText)}" aria-label="What does ${escapeHtml(label)} mean?" title="${escapeHtml(helpText)}">?</button>`
    : "";

  if (statusClass) {
    return `
      <span class="status-pill ${statusClass}">
        <span>${escapeHtml(label)}</span>
        ${iconMarkup}
      </span>
    `;
  }

  return `
    <span class="status-label-with-help">
      <span>${escapeHtml(label)}</span>
      ${iconMarkup}
    </span>
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

function getDedupedReminderHistoryEntries(client) {
  const historyEntries = Array.isArray(client?.reminder_history) ? client.reminder_history : [];
  const sortedEntries = [...historyEntries].sort((left, right) => getReminderEventTimestamp(right) - getReminderEventTimestamp(left));
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

function getGroupedReminderHistory(client) {
  const dedupedEntries = getDedupedReminderHistoryEntries(client);
  const groups = [];
  const reminderWindowMs = 15 * 60 * 1000;

  dedupedEntries.forEach(entry => {
    const messageId = String(entry?.message_id || "").trim();
    const messagePreview = String(getReminderMessagePreview(entry) || "").trim();
    const normalizedPreview = normalizeReminderPreview(messagePreview);
    const entryChannel = String(entry?.channel || "").trim().toLowerCase();
    const entrySource = String(entry?.source || "").trim().toLowerCase();
    const entryTimestamp = getReminderEventTimestamp(entry);

    const matchingGroup = groups.find(group => {
      const groupMessageId = String(group.messageId || "").trim();
      const sameMessageId = messageId && groupMessageId && messageId === groupMessageId;

      if (sameMessageId) {
        return true;
      }

      const sameChannel = entryChannel === group.channel;
      const samePreview = normalizedPreview && normalizedPreview === group.normalizedPreview;
      const closeToEarliest = Math.abs(entryTimestamp - group.earliestTimestamp) <= reminderWindowMs;
      const closeToLatest = Math.abs(entryTimestamp - group.latestTimestamp) <= reminderWindowMs;
      const closeInTime = closeToEarliest || closeToLatest;

      return sameChannel && samePreview && closeInTime;
    });

    if (!matchingGroup) {
      groups.push({
        key: messageId || `${entryChannel}|${entrySource}|${messagePreview}|${entryTimestamp}`,
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
      matchingGroup.key = messageId;
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

  if (source === "manual") {
    return "Manual send";
  }

  if (source === "automatic") {
    return "Automatic send";
  }

  if (source === "automated_email") {
    return "Automated email";
  }

  if (source === "device_sms") {
    return "Text from device";
  }

  return source.charAt(0).toUpperCase() + source.slice(1);
}

function attachReminderHistory(clients, historyRows) {
  const historyByClientId = new Map();
  const historyByRecipientEmail = new Map();
  const clientsByEmail = new Map();

  (clients || []).forEach(client => {
    const clientEmail = String(client?.client_email || "").trim().toLowerCase();

    if (!clientEmail) {
      return;
    }

    if (!clientsByEmail.has(clientEmail)) {
      clientsByEmail.set(clientEmail, []);
    }

    clientsByEmail.get(clientEmail).push(client);
  });

  (historyRows || []).forEach(entry => {
    const clientId = String(entry?.client_id || "").trim();
    const recipientEmail = String(entry?.recipient_email || "").trim().toLowerCase();

    if (clientId) {
      if (!historyByClientId.has(clientId)) {
        historyByClientId.set(clientId, []);
      }

      historyByClientId.get(clientId).push(entry);
    }

    if (recipientEmail) {
      if (!historyByRecipientEmail.has(recipientEmail)) {
        historyByRecipientEmail.set(recipientEmail, []);
      }

      historyByRecipientEmail.get(recipientEmail).push(entry);
    }
  });

  return (clients || []).map(client => ({
    ...client,
    reminder_history: (() => {
      const mergedEntries = new Map();
      const directEntries = historyByClientId.get(client.id) || [];
      const clientEmail = String(client?.client_email || "").trim().toLowerCase();
      const clientPhone = normalizePhone(client?.client_phone || "");
      const clientName = normalizeClientName(client?.client_name || "");
      const canUseEmailFallback = clientEmail
        && (clientsByEmail.get(clientEmail)?.length || 0) === 1
        && Boolean(clientPhone || clientName);
      const emailEntries = canUseEmailFallback
        ? historyByRecipientEmail.get(clientEmail) || []
        : [];

      [...directEntries, ...emailEntries].forEach(entry => {
        const key = String(entry?.id || "").trim() || [
          String(entry?.message_id || "").trim(),
          String(entry?.status || "").trim(),
          String(entry?.occurred_at || entry?.sent_at || entry?.created_at || "").trim()
        ].join("|");

        if (key) {
          mergedEntries.set(key, entry);
        }
      });

      return Array.from(mergedEntries.values());
    })()
  }));
}

function normalizeClientName(value) {
  return String(value || "").trim().toLowerCase();
}

function buildClientLookup(clients) {
  const lookup = {
    ids: new Map(),
    emails: new Map(),
    phones: new Map(),
    names: new Map()
  };

  (clients || []).forEach(client => {
    const clientId = String(client?.id || "").trim();
    const clientEmail = String(client?.client_email || "").trim().toLowerCase();
    const clientPhone = normalizePhone(client?.client_phone || "");
    const clientName = normalizeClientName(client?.client_name || "");

    if (clientId) {
      lookup.ids.set(clientId, client);
    }

    if (clientEmail) {
      if (!lookup.emails.has(clientEmail)) {
        lookup.emails.set(clientEmail, []);
      }

      lookup.emails.get(clientEmail).push(client);
    }

    if (clientPhone) {
      if (!lookup.phones.has(clientPhone)) {
        lookup.phones.set(clientPhone, []);
      }

      lookup.phones.get(clientPhone).push(client);
    }

    if (clientName) {
      if (!lookup.names.has(clientName)) {
        lookup.names.set(clientName, []);
      }

      lookup.names.get(clientName).push(client);
    }
  });

  return lookup;
}

function findMatchingClientRecord(target, lookup) {
  if (!target || !lookup) {
    return null;
  }

  const targetId = String(target?.id || target?.client_id || "").trim();
  const targetEmail = String(target?.client_email || target?.email || "").trim().toLowerCase();
  const targetPhone = normalizePhone(target?.client_phone || target?.phone || "");
  const targetName = normalizeClientName(target?.client_name || target?.name || "");

  if (targetId && lookup.ids.has(targetId)) {
    return lookup.ids.get(targetId) || null;
  }

  if (targetPhone) {
    const phoneMatches = lookup.phones.get(targetPhone) || [];

    if (phoneMatches.length === 1) {
      const [onlyMatch] = phoneMatches;

      if (!targetName || !onlyMatch?.client_name || normalizeClientName(onlyMatch.client_name) === targetName) {
        return onlyMatch;
      }
    }

    if (phoneMatches.length > 1 && targetName) {
      const namedPhoneMatches = phoneMatches.filter(client => normalizeClientName(client?.client_name || "") === targetName);

      if (namedPhoneMatches.length === 1) {
        return namedPhoneMatches[0];
      }
    }
  }

  if (targetEmail) {
    const emailMatches = lookup.emails.get(targetEmail) || [];

    if (emailMatches.length === 1) {
      const [onlyMatch] = emailMatches;

      if (!targetName || !onlyMatch?.client_name || normalizeClientName(onlyMatch.client_name) === targetName) {
        return onlyMatch;
      }
    }

    if (emailMatches.length > 1 && targetName) {
      const namedEmailMatches = emailMatches.filter(client => normalizeClientName(client?.client_name || "") === targetName);

      if (namedEmailMatches.length === 1) {
        return namedEmailMatches[0];
      }
    }
  }

  if (targetName) {
    const nameMatches = lookup.names.get(targetName) || [];

    if (nameMatches.length === 1 && !targetEmail && !targetPhone) {
      return nameMatches[0];
    }
  }

  return null;
}

function buildMissingClientFromAppointment(ownerId, appointment) {
  const appointmentClientId = String(appointment?.client_id || "").trim();
  const clientName = String(appointment?.client_name || "").trim().slice(0, 30);
  const clientEmail = String(appointment?.client_email || "").trim().toLowerCase();
  const clientPhone = normalizePhone(appointment?.client_phone || "");

  if (!clientName && !clientPhone && !appointmentClientId) {
    return null;
  }

  return {
    owner_id: ownerId,
    client_name: clientName,
    client_email: clientEmail,
    client_phone: clientPhone,
    service_address: String(appointment?.service_location || "").trim().slice(0, 160),
    notes: String(appointment?.notes || "").trim().slice(0, 1200),
    updated_at: appointment?.updated_at || new Date().toISOString()
  };
}

async function backfillClientsFromAppointments(ownerId, clients, appointments) {
  if (!supabase || !ownerId || !Array.isArray(appointments) || !appointments.length) {
    return clients || [];
  }

  const knownClients = Array.isArray(clients) ? [...clients] : [];
  let lookup = buildClientLookup(knownClients);
  const pendingInserts = [];

  appointments.forEach(appointment => {
    const clientPayload = buildMissingClientFromAppointment(ownerId, appointment);

    if (!clientPayload) {
      return;
    }

    if (findMatchingClientRecord(appointment, lookup) || findMatchingClientRecord(clientPayload, lookup)) {
      return;
    }

    pendingInserts.push(clientPayload);
    knownClients.unshift(clientPayload);
    lookup = buildClientLookup(knownClients);
  });

  if (!pendingInserts.length) {
    return knownClients;
  }

  const { data, error } = await supabase
    .from("clients")
    .insert(pendingInserts)
    .select("id, client_name, client_email, client_phone, service_address, notes, created_at, updated_at");

  if (error) {
    console.warn("Unable to backfill clients from appointments.", error);
    return Array.isArray(clients) ? [...clients] : [];
  }

  return [...(data || []), ...(Array.isArray(clients) ? [...clients] : [])];
}

async function loadSavedClientRows(ownerId) {
  if (!supabase || !ownerId) {
    return [];
  }

  const fallbackSelect = "id, client_name, client_email, client_phone, service_address, notes, created_at, updated_at";
  const primarySelect = `${fallbackSelect}, profile_custom_answers`;
  let { data, error } = await supabase
    .from("clients")
    .select(primarySelect)
    .order("created_at", { ascending: false });

  if (error && isMissingColumnError(error, "profile_custom_answers")) {
    ({ data, error } = await supabase
      .from("clients")
      .select(fallbackSelect)
      .order("created_at", { ascending: false }));
  }

  if (error) {
    throw error;
  }

  return (data || []).map(client => ({
    ...client,
    profile_custom_answers: normalizeProfileCustomAnswers(client?.profile_custom_answers)
  }));
}

async function loadSavedAppointmentsForClients(ownerId) {
  if (!supabase || !ownerId) {
    return [];
  }

  const fallbackSelect = "id, client_id, client_name, client_email, client_phone, service_date, service_time, service_location, notes, updated_at";
  const primarySelect = `${fallbackSelect}, custom_answers`;
  let { data, error } = await supabase
    .from("appointments")
    .select(primarySelect)
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error && isMissingColumnError(error, "custom_answers")) {
    ({ data, error } = await supabase
      .from("appointments")
      .select(fallbackSelect)
      .eq("owner_id", ownerId)
      .order("updated_at", { ascending: false })
      .limit(500));
  }

  if (error) {
    if (error.code === "42P01") {
      return [];
    }

    throw error;
  }

  return (data || []).map(appointment => ({
    ...appointment,
    custom_answers: normalizeCustomAnswerList(appointment?.custom_answers)
  }));
}

async function loadReminderHistoryForDelete(ownerId) {
  if (!supabase || !ownerId) {
    return [];
  }

  const { data, error } = await supabase
    .from("client_reminder_history")
    .select("id, client_id, recipient_email")
    .eq("owner_id", ownerId)
    .limit(1000);

  if (error) {
    if (error.code === "42P01") {
      return [];
    }

    throw error;
  }

  return data || [];
}

function attachAppointmentsToClients(clients, appointments) {
  const clientsWithAppointments = (clients || []).map(client => ({
    ...client,
    profile_custom_answers: normalizeProfileCustomAnswers(client?.profile_custom_answers),
    appointments: []
  }));
  const lookup = buildClientLookup(clientsWithAppointments);

  (appointments || []).forEach(appointment => {
    const match = findMatchingClientRecord(appointment, lookup);

    if (!match) {
      return;
    }

    if (!Array.isArray(match.appointments)) {
      match.appointments = [];
    }

    match.appointments.push({
      ...appointment,
      custom_answers: normalizeCustomAnswerList(appointment?.custom_answers)
    });
  });

  return clientsWithAppointments.map(client => ({
    ...client,
    appointments: (client.appointments || []).sort((left, right) => {
      const rightKey = `${right?.service_date || ""} ${right?.service_time || ""} ${right?.updated_at || ""}`;
      const leftKey = `${left?.service_date || ""} ${left?.service_time || ""} ${left?.updated_at || ""}`;
      return rightKey.localeCompare(leftKey);
    })
  }));
}

function isUniqueClientEmail(client, clients) {
  const clientEmail = String(client?.client_email || "").trim().toLowerCase();

  if (!clientEmail) {
    return false;
  }

  const matches = (clients || []).filter(entry => String(entry?.client_email || "").trim().toLowerCase() === clientEmail);
  return matches.length <= 1;
}

function recordMatchesDeletedClient(record, client, { uniqueEmail = false } = {}) {
  if (!record || !client) {
    return false;
  }

  const targetClientId = String(client?.id || "").trim();
  const targetName = normalizeClientName(client?.client_name || "");
  const targetEmail = String(client?.client_email || "").trim().toLowerCase();
  const targetPhone = normalizePhone(client?.client_phone || "");

  const recordClientId = String(record?.client_id || "").trim();
  const recordName = normalizeClientName(record?.client_name || "");
  const recordEmail = String(record?.client_email || record?.recipient_email || "").trim().toLowerCase();
  const recordPhone = normalizePhone(record?.client_phone || "");

  if (targetClientId && recordClientId && targetClientId === recordClientId) {
    return true;
  }

  if (targetPhone) {
    if (!recordPhone || recordPhone !== targetPhone) {
      return false;
    }

    if (targetName && recordName && targetName !== recordName) {
      return false;
    }

    if (targetEmail && recordEmail && targetEmail !== recordEmail) {
      return false;
    }

    return true;
  }

  if (targetEmail) {
    if (!recordEmail || recordEmail !== targetEmail) {
      return false;
    }

    if (targetName) {
      return !recordName || recordName === targetName;
    }

    if (!uniqueEmail) {
      return false;
    }

    return !recordName && !recordPhone;
  }

  if (targetName) {
    return recordName === targetName && !recordEmail && !recordPhone;
  }

  return false;
}

async function deleteClientRelatedData(client, ownerId) {
  if (!supabase || !client?.id || !ownerId) {
    return;
  }

  const clientId = String(client.id || "").trim();
  const clientEmail = String(client.client_email || "").trim().toLowerCase();
  const clientPhone = normalizePhone(client.client_phone || "");
  const clientName = normalizeClientName(client.client_name || "");
  const uniqueEmail = isUniqueClientEmail(client, savedClients);
  const emailDeleteSafe = Boolean(clientEmail) && uniqueEmail && Boolean(clientPhone || clientName);
  const [appointmentsRows, historyRows] = await Promise.all([
    loadSavedAppointmentsForClients(ownerId),
    loadReminderHistoryForDelete(ownerId)
  ]);

  const { error: directAppointmentsError } = await supabase
    .from("appointments")
    .delete()
    .eq("owner_id", ownerId)
    .eq("client_id", clientId);

  if (directAppointmentsError && directAppointmentsError.code !== "42P01") {
    throw directAppointmentsError;
  }

  const orphanAppointmentIds = (appointmentsRows || [])
    .filter(entry => !String(entry?.client_id || "").trim())
    .filter(entry => recordMatchesDeletedClient(entry, client, { uniqueEmail: emailDeleteSafe }))
    .map(entry => String(entry?.id || "").trim())
    .filter(Boolean);

  if (orphanAppointmentIds.length) {
    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("owner_id", ownerId)
      .in("id", orphanAppointmentIds);

    if (error && error.code !== "42P01") {
      throw error;
    }
  }

  if (emailDeleteSafe) {
    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("owner_id", ownerId)
      .eq("client_email", clientEmail);

    if (error && error.code !== "42P01") {
      throw error;
    }
  }

  if (clientPhone) {
    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("owner_id", ownerId)
      .eq("client_phone", clientPhone);

    if (error && error.code !== "42P01") {
      throw error;
    }
  }

  const { error: directHistoryError } = await supabase
    .from("client_reminder_history")
    .delete()
    .eq("owner_id", ownerId)
    .eq("client_id", clientId);

  if (directHistoryError && directHistoryError.code !== "42P01") {
    throw directHistoryError;
  }

  const orphanHistoryIds = (historyRows || [])
    .filter(entry => !String(entry?.client_id || "").trim())
    .filter(entry => recordMatchesDeletedClient(entry, client, { uniqueEmail: emailDeleteSafe }))
    .map(entry => String(entry?.id || "").trim())
    .filter(Boolean);

  if (orphanHistoryIds.length) {
    const { error: orphanHistoryError } = await supabase
      .from("client_reminder_history")
      .delete()
      .eq("owner_id", ownerId)
      .in("id", orphanHistoryIds);

    if (orphanHistoryError && orphanHistoryError.code !== "42P01") {
      throw orphanHistoryError;
    }
  }

  if (emailDeleteSafe) {
    const { error } = await supabase
      .from("client_reminder_history")
      .delete()
      .eq("owner_id", ownerId)
      .eq("recipient_email", clientEmail);

    if (error && error.code !== "42P01") {
      throw error;
    }
  }
}

async function loadReminderHistory(ownerId) {
  if (!supabase || !ownerId) {
    return [];
  }

  const { data, error } = await supabase
    .from("client_reminder_history")
    .select("id, client_id, channel, source, message_id, recipient_email, event_type, status, occurred_at, sent_at, created_at, message_preview")
    .eq("owner_id", ownerId)
    .order("sent_at", { ascending: false })
    .limit(500);

  if (error) {
    if (error.code === "42P01") {
      reminderHistoryReady = false;
      return [];
    }

    console.warn("Unable to load reminder history.", error);
    return [];
  }

  reminderHistoryReady = true;
  return data || [];
}

function renderReminderHistory(client) {
  const historyEntries = getDedupedReminderHistoryEntries(client).slice(0, 1);

  if (!historyEntries.length) {
    return `<span class="table-muted">${reminderHistoryReady ? "No reminders yet" : "History setup needed"}</span>`;
  }

  return `
    <div class="history-stack">
      ${historyEntries.map(entry => `
        <div class="history-entry">
          <div class="history-channel">${renderStatusLabelWithHelp(getReminderStatusLabel(entry), getReminderStatusClass(getReminderStatusLabel(entry)))}</div>
          <div class="history-time">${escapeHtml(getReminderEventTimeLabel(entry))}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderExpandedReminderHistory(client) {
  const reminderGroups = getGroupedReminderHistory(client);

  if (!reminderGroups.length) {
    return `<div class="expanded-empty">${reminderHistoryReady ? "No reminder activity for this client yet." : "Reminder history setup is still needed."}</div>`;
  }

  return `
    <div class="expanded-history-list">
      ${reminderGroups.map(group => {
        const statusLabel = getReminderStatusLabel(group.latestEntry);
        const channelLabel = getReminderHistoryChannelLabel(group.latestEntry);
        const sourceLabel = getReminderSourceLabel(group.latestEntry);
        const messagePreview = group.messagePreview;
        const metaParts = [channelLabel, sourceLabel].filter(Boolean);
        const latestUpdateLabel = getReminderEventTimeLabel(group.latestEntry);
        const priorTimelineEntries = group.entries.slice(1);
        const timelineMarkup = priorTimelineEntries.map(entry => {
          const entryStatusLabel = getReminderStatusLabel(entry);

          return `
            <div class="expanded-history-timeline-entry">
              ${renderStatusLabelWithHelp(entryStatusLabel, getReminderStatusClass(entryStatusLabel))}
              <span class="expanded-history-timeline-time">${escapeHtml(getReminderEventTimeLabel(entry))}</span>
            </div>
          `;
        }).join("");

        return `
          <div class="expanded-history-group">
            <div class="expanded-history-latest-card">
              <div class="expanded-history-entry">
              <div class="expanded-history-top">
                ${renderStatusLabelWithHelp(statusLabel, getReminderStatusClass(statusLabel))}
                <span class="expanded-history-time">${escapeHtml(latestUpdateLabel)}</span>
              </div>
              <div class="expanded-history-meta">${escapeHtml(metaParts.join(" | ") || "Reminder activity")}</div>
              ${messagePreview ? `<div class="expanded-message-preview">${escapeHtml(messagePreview).replace(/\n/g, "<br>")}</div>` : ""}
              </div>
            </div>
            ${timelineMarkup ? `<div class="expanded-history-followups"><div class="expanded-history-followups-label">Earlier status updates</div><div class="expanded-history-timeline">${timelineMarkup}</div></div>` : ""}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function formatAppointmentDate(value) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return "";
  }

  const parsed = new Date(`${normalized}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return normalized;
  }

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatAppointmentTime(value) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return "";
  }

  const [hoursRaw = "0", minutesRaw = "00"] = normalized.split(":");
  let hours = Number.parseInt(hoursRaw, 10);
  const minutes = String(minutesRaw).padStart(2, "0");

  if (!Number.isFinite(hours)) {
    return normalized;
  }

  const meridiem = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${meridiem}`;
}

function getRememberedClientAnswers(client) {
  return Object.values(normalizeProfileCustomAnswers(client?.profile_custom_answers)).sort((left, right) => {
    const rightUpdated = String(right?.updated_at || "").trim();
    const leftUpdated = String(left?.updated_at || "").trim();
    return rightUpdated.localeCompare(leftUpdated) || String(left?.label || "").localeCompare(String(right?.label || ""));
  });
}

function getAppointmentsWithCustomAnswers(client) {
  return (Array.isArray(client?.appointments) ? client.appointments : [])
    .map(appointment => ({
      ...appointment,
      custom_answers: normalizeCustomAnswerList(appointment?.custom_answers)
    }))
    .filter(appointment => appointment.custom_answers.length > 0);
}

function isRememberedClientAnswer(client, answer) {
  const rememberedAnswer = normalizeProfileCustomAnswers(client?.profile_custom_answers)?.[String(answer?.field_id || "").trim()];

  if (!rememberedAnswer) {
    return false;
  }

  return String(rememberedAnswer?.display_value || "").trim() === String(answer?.display_value || "").trim();
}

function renderRememberedClientAnswers(client) {
  const rememberedAnswers = getRememberedClientAnswers(client);

  if (!rememberedAnswers.length) {
    return "";
  }

  return `
    <div class="expanded-client-block expanded-client-block-plain">
      <div class="expanded-client-label">Remembered For This Client</div>
      <div class="client-memory-list">
        ${rememberedAnswers.map(answer => {
          const sourceParts = [formatAppointmentDate(answer.source_service_date)].filter(Boolean);

          return `
            <div class="client-memory-item">
              <div class="client-memory-label">${escapeHtml(answer.label)}</div>
              <div class="client-memory-value">${escapeHtml(answer.display_value)}</div>
              ${sourceParts.length ? `<div class="client-memory-meta">Saved from ${escapeHtml(sourceParts.join(" "))}</div>` : ""}
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderSavedClientProfile(client) {
  const serviceLocation = String(client?.service_address || "").trim();
  const clientNotes = String(client?.notes || "").trim();
  const notesMarkup = clientNotes
    ? escapeHtml(clientNotes).replace(/\n/g, "<br>")
    : "No internal client notes saved yet.";

  return `
    <div class="expanded-client-block expanded-client-block-plain">
      <div class="expanded-client-label">Saved Client Profile</div>
      <div class="client-profile-list">
        <div class="client-profile-item">
          <div class="client-memory-label">Service Location</div>
          <div class="client-profile-value${serviceLocation ? "" : " is-empty"}">
            ${escapeHtml(serviceLocation || "Not saved yet.")}
          </div>
        </div>
        <div class="client-profile-item">
          <div class="client-memory-label">Client Notes</div>
          <div class="client-profile-value${clientNotes ? "" : " is-empty"}">
            ${notesMarkup}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderAppointmentAnswerHistory(client) {
  const appointmentGroups = getAppointmentsWithCustomAnswers(client);

  if (!appointmentGroups.length) {
    return "";
  }

  return `
    <div class="expanded-client-block expanded-client-block-plain">
      <div class="expanded-client-label">Appointment Answers</div>
      <div class="client-answer-group-list">
        ${appointmentGroups.map(appointment => {
          const dateLabel = formatAppointmentDate(appointment.service_date);
          const timeLabel = formatAppointmentTime(appointment.service_time);
          const headerLabel = [dateLabel, timeLabel].filter(Boolean).join(" at ") || "Saved appointment";
          const detailParts = [];

          if (String(appointment.service_location || "").trim()) {
            detailParts.push(`Location: ${String(appointment.service_location || "").trim()}`);
          }

          if (String(appointment.notes || "").trim()) {
            detailParts.push(`Reminder note: ${String(appointment.notes || "").trim()}`);
          }

          const subLabel = detailParts.join(" | ");

          return `
            <div class="client-answer-group">
              <div class="client-answer-group-top">
                <div class="client-answer-group-title">${escapeHtml(headerLabel)}</div>
                ${subLabel ? `<div class="client-answer-group-copy">${escapeHtml(subLabel)}</div>` : ""}
              </div>
              <div class="client-answer-list">
                ${appointment.custom_answers.map(answer => `
                  <div class="client-answer-item">
                    <div class="client-answer-copy">
                      <div class="client-answer-label">${escapeHtml(answer.label)}</div>
                      <div class="client-answer-value">${escapeHtml(answer.display_value)}</div>
                    </div>
                    ${isRememberedClientAnswer(client, answer)
                      ? `<span class="remembered-answer-pill">Remembered</span>`
                      : `<button
                          type="button"
                          class="remember-answer-button"
                          data-remember-answer
                          data-client-id="${escapeHtml(client.id)}"
                          data-appointment-id="${escapeHtml(appointment.id || "")}"
                          data-field-id="${escapeHtml(answer.field_id)}"
                        >Remember this</button>`}
                  </div>
                `).join("")}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function getClientSearchText(client) {
  return [
    client.client_name,
    client.client_email,
    client.client_phone,
    client.service_address,
    client.notes
  ]
    .map(value => String(value || "").trim().toLowerCase())
    .join(" ");
}

function getLatestReminderSentAt(client) {
  const historyEntries = Array.isArray(client?.reminder_history) ? client.reminder_history : [];
  const latestTimestamp = historyEntries.reduce((latest, entry) => {
    const timestamp = getReminderEventTimestamp(entry);
    return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest;
  }, 0);

  return latestTimestamp;
}

function getLatestReminderStatusAt(client, targetStatus) {
  const normalizedTarget = String(targetStatus || "").trim().toLowerCase();
  const historyEntries = Array.isArray(client?.reminder_history) ? client.reminder_history : [];

  return historyEntries.reduce((latest, entry) => {
    const statusLabel = getReminderStatusLabel(entry).trim().toLowerCase();

    if (statusLabel !== normalizedTarget) {
      return latest;
    }

    const timestamp = getReminderEventTimestamp(entry);
    return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest;
  }, 0);
}

function renderExpandedClientDetails(client) {
  return `
    <div class="expanded-client-panel">
      ${renderSavedClientProfile(client)}
      ${renderRememberedClientAnswers(client)}
      ${renderAppointmentAnswerHistory(client)}
      <div class="expanded-client-block expanded-client-block-plain expanded-reminder-activity-shell">
        <div class="expanded-client-label">Full Reminder Activity</div>
        ${renderExpandedReminderHistory(client)}
      </div>
    </div>
  `;
}

async function rememberClientAnswer(clientId, appointmentId, fieldId) {
  if (!supabase) {
    return;
  }

  const normalizedClientId = String(clientId || "").trim();
  const normalizedAppointmentId = String(appointmentId || "").trim();
  const normalizedFieldId = String(fieldId || "").trim();
  const client = savedClients.find(entry => String(entry?.id || "").trim() === normalizedClientId);

  if (!client || !normalizedAppointmentId || !normalizedFieldId) {
    setStatus("Unable to find that saved answer.", "error");
    return;
  }

  const appointment = (client.appointments || []).find(entry => String(entry?.id || "").trim() === normalizedAppointmentId);
  const answer = appointment?.custom_answers?.find(entry => String(entry?.field_id || "").trim() === normalizedFieldId);

  if (!appointment || !answer) {
    setStatus("Unable to find that appointment answer.", "error");
    return;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.id) {
    setStatus("Please sign in again before saving that client detail.", "error");
    return;
  }

  const nextProfileAnswers = normalizeProfileCustomAnswers(client.profile_custom_answers);
  nextProfileAnswers[normalizedFieldId] = {
    ...answer,
    field_id: normalizedFieldId,
    source_appointment_id: normalizedAppointmentId,
    source_service_date: String(appointment?.service_date || "").trim(),
    updated_at: new Date().toISOString()
  };

  let { error } = await supabase
    .from("clients")
    .update({
      profile_custom_answers: nextProfileAnswers,
      updated_at: new Date().toISOString()
    })
    .eq("id", normalizedClientId)
    .eq("owner_id", user.id);

  if (error && isMissingColumnError(error, "profile_custom_answers")) {
    setStatus("Run the new custom-answer SQL update before using Remember this.", "error");
    return;
  }

  if (error) {
    setStatus(error.message || "Unable to save that client detail.", "error");
    return;
  }

  savedClients = savedClients.map(entry => (
    String(entry?.id || "").trim() === normalizedClientId
      ? {
          ...entry,
          profile_custom_answers: nextProfileAnswers,
          updated_at: new Date().toISOString()
        }
      : entry
  ));

  if (clientDetailModal && !clientDetailModal.hidden) {
    openClientDetailModal(normalizedClientId);
  }

  setStatus(`Saved "${answer.label}" to this client profile.`, "success");
}

function sortContacts(contacts, mode = clientsSortMode) {
  const normalizedMode = String(mode || "az").trim().toLowerCase();
  const list = [...(contacts || [])];

  if (normalizedMode === "newest") {
    return list.sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0));
  }

  if (normalizedMode === "oldest") {
    return list.sort((left, right) => new Date(left.created_at || 0) - new Date(right.created_at || 0));
  }

  if (normalizedMode === "updated") {
    return list.sort((left, right) => new Date(right.updated_at || right.created_at || 0) - new Date(left.updated_at || left.created_at || 0));
  }

  if (normalizedMode === "reminded") {
    return list.sort((left, right) => {
      const rightLatest = getLatestReminderSentAt(right);
      const leftLatest = getLatestReminderSentAt(left);

      if (rightLatest !== leftLatest) {
        return rightLatest - leftLatest;
      }

      return new Date(right.created_at || 0) - new Date(left.created_at || 0);
    });
  }

  if (normalizedMode === "delivered") {
    return list.sort((left, right) => {
      const rightLatest = getLatestReminderStatusAt(right, "delivered");
      const leftLatest = getLatestReminderStatusAt(left, "delivered");

      if (rightLatest !== leftLatest) {
        return rightLatest - leftLatest;
      }

      return new Date(right.created_at || 0) - new Date(left.created_at || 0);
    });
  }

  if (normalizedMode === "opened") {
    return list.sort((left, right) => {
      const rightLatest = getLatestReminderStatusAt(right, "likely opened");
      const leftLatest = getLatestReminderStatusAt(left, "likely opened");

      if (rightLatest !== leftLatest) {
        return rightLatest - leftLatest;
      }

      return new Date(right.created_at || 0) - new Date(left.created_at || 0);
    });
  }

  return list.sort((left, right) => {
    const leftName = String(left.client_name || "").trim().toLowerCase();
    const rightName = String(right.client_name || "").trim().toLowerCase();
    const leftEmail = String(left.client_email || "").trim().toLowerCase();
    const rightEmail = String(right.client_email || "").trim().toLowerCase();
    const leftPhone = String(left.client_phone || "").trim().toLowerCase();
    const rightPhone = String(right.client_phone || "").trim().toLowerCase();

    return (
      leftName.localeCompare(rightName) ||
      leftEmail.localeCompare(rightEmail) ||
      leftPhone.localeCompare(rightPhone)
    );
  });
}

function getFilteredClients() {
  const query = clientsSearchQuery.trim().toLowerCase();
  let filteredClients = query
    ? savedClients.filter(client => getClientSearchText(client).includes(query))
    : [...savedClients];

  if (clientsSortMode === "delivered") {
    filteredClients = filteredClients.filter(client => getLatestReminderStatusAt(client, "delivered") > 0);
  } else if (clientsSortMode === "opened") {
    filteredClients = filteredClients.filter(client => getLatestReminderStatusAt(client, "likely opened") > 0);
  }

  return sortContacts(filteredClients, clientsSortMode);
}

function getClientsPageCount(totalCount) {
  return Math.max(1, Math.ceil((Number(totalCount) || 0) / CLIENTS_PER_PAGE));
}

function clampClientsPage(totalCount) {
  const totalPages = getClientsPageCount(totalCount);
  clientsPage = Math.min(Math.max(clientsPage, 1), totalPages);
  return totalPages;
}

function renderPagination(totalCount, pageCount, pageStart, pageEnd) {
  if (pageCount <= 1) {
    return "";
  }

  const pageButtons = Array.from({ length: pageCount }, (_, index) => {
    const pageNumber = index + 1;
    return `
      <button
        class="pagination-button ${pageNumber === clientsPage ? "active" : ""}"
        type="button"
        data-pagination="page"
        data-page="${pageNumber}"
        aria-label="Go to page ${pageNumber}"
        aria-current="${pageNumber === clientsPage ? "page" : "false"}"
      >${pageNumber}</button>
    `;
  }).join("");

  return `
    <div class="pagination-bar">
      <div class="pagination-summary">Showing ${pageStart}-${pageEnd} of ${totalCount} contacts</div>
      <div class="pagination-actions">
        <button class="pagination-button" type="button" data-pagination="prev" ${clientsPage === 1 ? "disabled" : ""}>Prev</button>
        ${pageButtons}
        <button class="pagination-button" type="button" data-pagination="next" ${clientsPage === pageCount ? "disabled" : ""}>Next</button>
      </div>
    </div>
  `;
}

function renderSavedClients() {
  if (!clientsList) {
    return;
  }

  if (isLoadingClients) {
    renderContactsLoadingState();
    return;
  }

  const filteredClients = getFilteredClients();
  const totalFiltered = filteredClients.length;
  const pageCount = clampClientsPage(totalFiltered);
  const pageStartIndex = (clientsPage - 1) * CLIENTS_PER_PAGE;
  const pagedClients = filteredClients.slice(pageStartIndex, pageStartIndex + CLIENTS_PER_PAGE);
  const pageStart = totalFiltered ? pageStartIndex + 1 : 0;
  const pageEnd = pageStartIndex + pagedClients.length;
  updateContactsCount(totalFiltered);

  if (!savedClients.length) {
    clientsList.innerHTML = `<div class="empty-state">No contacts saved yet.</div>`;
    return;
  }

  if (!totalFiltered) {
    clientsList.innerHTML = `<div class="empty-state">No contacts match that search.</div>`;
    return;
  }

  const paginationMarkup = renderPagination(totalFiltered, pageCount, pageStart, pageEnd);

  clientsList.innerHTML = `
    <div class="clients-table-shell">
      <table class="clients-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Reminder History</th>
            <th>Last Edited</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${pagedClients.map(client => {
            const displayName = client.client_name || "Saved client";
            const updatedLabel = formatSavedDate(client.updated_at || client.created_at);
            const phoneLabel = client.client_phone ? formatPhone(client.client_phone) : "";

            return `
              <tr class="client-summary-row" data-client-row data-client-id="${client.id}">
                <td>
                  <strong>${escapeHtml(displayName)}</strong>
                </td>
                <td>${client.client_email ? escapeHtml(client.client_email) : `<span class="table-muted">Not added</span>`}</td>
                <td>${phoneLabel ? escapeHtml(phoneLabel) : `<span class="table-muted">Not added</span>`}</td>
                <td>${renderReminderHistory(client)}</td>
                <td>${updatedLabel ? escapeHtml(updatedLabel) : `<span class="table-muted">Not available</span>`}</td>
                <td>
                  <div class="table-actions">
                    <button class="secondary-button" type="button" data-action="edit" data-client-id="${client.id}">Edit</button>
                    <button class="primary-button" type="button" data-action="use" data-client-id="${client.id}">Use</button>
                    <button class="secondary-button" type="button" data-action="delete" data-client-id="${client.id}">Delete</button>
                  </div>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
    <div class="clients-mobile-list">
      ${pagedClients.map(client => {
        const displayName = client.client_name || "Saved client";
        const updatedLabel = formatSavedDate(client.updated_at || client.created_at);
        const phoneLabel = client.client_phone ? formatPhone(client.client_phone) : "";

        return `
          <div class="client-mobile-card" data-client-row data-client-id="${client.id}">
            <h4 class="client-mobile-title">${escapeHtml(displayName)}</h4>
            <div class="client-mobile-grid">
              <div class="client-mobile-row">
                <div class="client-mobile-label">Email</div>
                <div class="client-mobile-value">${client.client_email ? escapeHtml(client.client_email) : `<span class="table-muted">Not added</span>`}</div>
              </div>
              <div class="client-mobile-row">
                <div class="client-mobile-label">Phone</div>
                <div class="client-mobile-value">${phoneLabel ? escapeHtml(phoneLabel) : `<span class="table-muted">Not added</span>`}</div>
              </div>
              <div class="client-mobile-row">
                <div class="client-mobile-label">Reminder History</div>
                <div class="client-mobile-value">${renderReminderHistory(client)}</div>
              </div>
              <div class="client-mobile-row">
                <div class="client-mobile-label">Last Edited</div>
                <div class="client-mobile-value">${updatedLabel ? escapeHtml(updatedLabel) : `<span class="table-muted">Not available</span>`}</div>
              </div>
            </div>
            <div class="client-mobile-actions">
              <button class="secondary-button" type="button" data-action="edit" data-client-id="${client.id}">Edit</button>
              <button class="primary-button" type="button" data-action="use" data-client-id="${client.id}">Use</button>
              <button class="secondary-button" type="button" data-action="delete" data-client-id="${client.id}">Delete</button>
            </div>
          </div>
        `;
      }).join("")}
    </div>
    ${paginationMarkup}
  `;
}

function setClientEditMode(client = null) {
  editingClientId = client?.id || "";

  if (clientFormMode) {
    clientFormMode.hidden = !editingClientId;
    clientFormMode.textContent = editingClientId ? `Editing ${client.client_name || "contact"}` : "Editing contact";
  }

  if (clientModalTitle) {
    clientModalTitle.textContent = editingClientId ? "Edit contact" : "Add contact";
  }

  if (clientModalCopy) {
    clientModalCopy.textContent = editingClientId
      ? "Update the saved contact details and private client notes below."
      : "Enter the client details and any private notes you want saved to this account.";
  }

  if (saveClientButton) {
    saveClientButton.textContent = editingClientId ? "Update Contact" : "Save Contact";
    saveClientButton.dataset.defaultText = saveClientButton.textContent;
  }

  if (cancelEditClientButton) {
    cancelEditClientButton.hidden = !editingClientId;
  }
}

function populateClientForm(clientId) {
  const client = savedClients.find(entry => entry.id === clientId);

  if (!client || !clientForm) {
    return;
  }

  document.getElementById("client-name").value = client.client_name || "";
  document.getElementById("client-email").value = client.client_email || "";
  document.getElementById("client-phone").value = client.client_phone ? formatPhone(client.client_phone) : "";
  document.getElementById("client-address").value = client.service_address || "";
  document.getElementById("client-notes").value = client.notes || "";

  setClientEditMode(client);
  setClientFormStatus("");
  openClientModal();
}

function resetClientForm() {
  if (clientForm) {
    clientForm.reset();
  }

  setClientEditMode(null);
  setClientFormStatus("");
  closeClientModal();
}

function openBlankClientForm() {
  if (clientForm) {
    clientForm.reset();
  }

  setClientEditMode(null);
  setClientFormStatus("");
  openClientModal();
}

async function ensureProfile(user) {
  if (!supabase || !user?.id) {
    return;
  }

  await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email || ""
    },
    {
      onConflict: "id"
    }
  );
}

async function loadSavedClients() {
  if (!supabase) {
    return;
  }

  setClientsLoadingState(true);

  try {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    const user = session?.user || null;

    if (!user?.id) {
      savedClients = [];
      return;
    }

    const [clientsRows, historyRows, appointmentsRows] = await Promise.all([
      loadSavedClientRows(user.id),
      loadReminderHistory(user.id),
      loadSavedAppointmentsForClients(user.id)
    ]);

    let clientsData = clientsRows || [];
    clientsData = await backfillClientsFromAppointments(user.id, clientsData, appointmentsRows);

    if (clientsData.length > CLIENTS_PER_PAGE * 2) {
      await new Promise(resolve => window.requestAnimationFrame(resolve));
    }

    savedClients = attachAppointmentsToClients(attachReminderHistory(clientsData, historyRows), appointmentsRows);
  } catch (error) {
    savedClients = [];
    setStatus(error.message || "Unable to load saved clients.", "error");
  } finally {
    setClientsLoadingState(false);
    renderSavedClients();
  }
}

async function hydrateRuntimeConfigForUser(user) {
  if (!user) {
    runtimeConfig = null;
    runtimeConfigPromise = null;
    updateSignedInView(user);
    return;
  }

  const config = await ensureRuntimeConfig();

  if (config) {
    runtimeConfig = config;
    updateSignedInView(user);
  }
}

async function syncSignedInState(user) {
  updateSignedInView(user);

  if (!user) {
    savedClients = [];
    renderSavedClients();
    return;
  }

  await ensureProfile(user);

  if (isBronzeUser(user)) {
    await Promise.all([
      loadSavedClients(),
      hydrateRuntimeConfigForUser(user)
    ]);
    return;
  }

  savedClients = [];
  renderSavedClients();
  await hydrateRuntimeConfigForUser(user);
}

function updateSignedInView(user) {
  const isSignedIn = Boolean(user);
  const tierKey = isSignedIn ? getTierKey(user) : "free";
  const isBronze = isSignedIn && tierKey === "bronze";

  document.querySelectorAll("[data-auth-only]").forEach(link => {
    link.hidden = !isSignedIn;
  });

  if (signedOutPanel) {
    signedOutPanel.hidden = isSignedIn;
  }

  if (signedInPanel) {
    signedInPanel.hidden = !isSignedIn;
  }

  if (accountEmail) {
    accountEmail.textContent = isSignedIn ? user.email || "Signed in" : "";
  }

  if (accountPlan) {
    accountPlan.textContent = isSignedIn ? getTierLabel(user) : "FREE";
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

  if (planSummaryCopy) {
    if (!isSignedIn || tierKey === "free") {
      planSummaryCopy.textContent = "Free works the same as using the reminder tool signed out.";
    } else if (tierKey === "bronze") {
      planSummaryCopy.textContent = "Bronze can save contacts and store reminder timing preferences.";
    } else {
      planSummaryCopy.textContent = "This account has access to saved features tied to the active plan.";
    }
  }

  if (upgradeButton) {
    if (!isSignedIn) {
      upgradeButton.textContent = "Upgrade to Bronze";
      upgradeButton.disabled = true;
    } else if (isBronze) {
      upgradeButton.textContent = "Bronze Active";
      upgradeButton.disabled = true;
    } else {
      upgradeButton.textContent = "Upgrade to Bronze";
      upgradeButton.disabled = !appConfig?.paymentsEnabled;
    }
  }

  if (billingSetupNotice) {
    billingSetupNotice.hidden = !(isSignedIn && !isBronze && !appConfig?.paymentsEnabled);
  }

  if (tierPreviewShell) {
    tierPreviewShell.hidden = !(isSignedIn && runtimeConfig?.label === "DEV");
  }

  if (freeContactsShell) {
    freeContactsShell.hidden = !(isSignedIn && !isBronze);
  }

  if (bronzeContactsShell) {
    bronzeContactsShell.hidden = !isBronze;
  }

  if (seedClientsButton) {
    seedClientsButton.hidden = !(isBronze && runtimeConfig?.label === "DEV");
  }

  if (setFreeTierButton) {
    setFreeTierButton.disabled = !isSignedIn || tierKey === "free";
  }

  if (setBronzeTierButton) {
    setBronzeTierButton.disabled = !isSignedIn || tierKey === "bronze";
  }
}

async function getPublicConfig() {
  const response = await fetch("/api/public-config", { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Unable to load account configuration.");
  }

  return response.json();
}

async function getRuntimeConfig() {
  const response = await fetch("/api/runtime-env", { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Unable to load runtime environment.");
  }

  return response.json();
}

async function ensureRuntimeConfig() {
  if (runtimeConfig) {
    return runtimeConfig;
  }

  if (!runtimeConfigPromise) {
    runtimeConfigPromise = getRuntimeConfig()
      .then(config => {
        runtimeConfig = config;
        return config;
      })
      .catch(() => null);
  }

  return runtimeConfigPromise;
}

async function initSupabase() {
  appConfig = await getPublicConfig();

  if (pricePill) {
    pricePill.textContent = "Optional Bronze";
  }

  if (!appConfig.accountsEnabled) {
    if (authSetupNotice) {
      authSetupNotice.hidden = false;
    }
    setAuthFormsEnabled(false);
    updateSignedInView(null);
    return;
  }

  setAuthFormsEnabled(true);

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
  await syncSignedInState(session?.user || null);

  supabase.auth.onAuthStateChange(async (event, nextSession) => {
    if (event === "TOKEN_REFRESHED") {
      return;
    }

    const nextUserId = nextSession?.user?.id || "";

    if (nextUserId === currentAuthUserId && event !== "USER_UPDATED") {
      return;
    }

    currentAuthUserId = nextUserId;
    await syncSignedInState(nextSession?.user || null);
  });
}

async function handleSignUp(event) {
  event.preventDefault();

  if (!supabase) {
    setStatus("Add your Supabase keys in Vercel before using accounts.", "error");
    setClientFormStatus("Accounts are not configured yet.", "error");
    return;
  }

  const formData = new FormData(event.currentTarget);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const button = event.currentTarget.querySelector("button[type='submit']");

  setButtonBusy(button, true, "Creating account...");
  setStatus("");

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/client-details.html`
      }
    });

    if (error) {
      throw error;
    }

    const emailAlreadyRegistered =
      !data.session &&
      data.user &&
      Array.isArray(data.user.identities) &&
      data.user.identities.length === 0;

    if (emailAlreadyRegistered) {
      setStatus("That email already has an account. Use Sign In instead.", "error");
      return;
    }

    if (!data.session) {
      setStatus("Account created. Check your email to confirm your account, then sign in.", "success");
    } else {
      setStatus("Account created and signed in.", "success");
    }
  } catch (error) {
    setStatus(error.message || "Unable to create your account.", "error");
  } finally {
    setButtonBusy(button, false);
  }
}

async function handleSignIn(event) {
  event.preventDefault();

  if (!supabase) {
    setStatus("Add your Supabase keys in Vercel before using accounts.", "error");
    return;
  }

  const formData = new FormData(event.currentTarget);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const button = event.currentTarget.querySelector("button[type='submit']");

  setButtonBusy(button, true, "Signing in...");
  setStatus("");

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    setStatus("Signed in successfully.", "success");
    event.currentTarget.reset();
  } catch (error) {
    setStatus(error.message || "Unable to sign in.", "error");
  } finally {
    setButtonBusy(button, false);
  }
}

async function handleSignOut() {
  if (!supabase) {
    return;
  }

  setStatus("");

  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    setStatus("Signed out.", "success");
  } catch (error) {
    setStatus(error.message || "Unable to sign out.", "error");
  }
}

async function handleSaveClient(event) {
  event.preventDefault();
  const form = event.currentTarget;

  if (!supabase) {
    setStatus("Add your Supabase keys in Vercel before using accounts.", "error");
    setClientFormStatus("Accounts are not configured yet.", "error");
    return;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.id) {
    setStatus("Please sign in before saving a client.", "error");
    setClientFormStatus("Please sign in before saving a contact.", "error");
    return;
  }

  if (!isBronzeUser(user)) {
    setStatus("Bronze is required to save contacts.", "error");
    setClientFormStatus("Bronze is required before contacts can be saved here.", "error");
    return;
  }

  if (!(form instanceof HTMLFormElement)) {
    setStatus("Unable to read the contact form.", "error");
    setClientFormStatus("Unable to read the contact form. Please refresh and try again.", "error");
    return;
  }

  const formData = new FormData(form);
  const payload = {
    owner_id: user.id,
    client_name: String(formData.get("client_name") || "").trim().slice(0, 30),
    client_email: String(formData.get("client_email") || "").trim(),
    client_phone: normalizePhone(formData.get("client_phone") || ""),
    service_address: String(formData.get("service_address") || "").trim().slice(0, 160),
    notes: String(formData.get("notes") || "").trim().slice(0, 1200),
    updated_at: new Date().toISOString()
  };

  if (!payload.client_name && !payload.client_email && !payload.client_phone) {
    setStatus("Add at least a client name, email, or phone number before saving.", "error");
    setClientFormStatus("Add at least a name, email, or phone number before saving.", "error");
    return;
  }

  if (payload.client_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(payload.client_email)) {
    setStatus("Enter a valid client email address.", "error");
    setClientFormStatus("Enter a valid client email address.", "error");
    return;
  }

  setButtonBusy(saveClientButton, true, "Saving client...");
  setStatus("");
  setClientFormStatus("Saving contact...", "info");

  try {
    const isEditing = Boolean(editingClientId);
    const activeEditingId = editingClientId;
    const query = isEditing
      ? supabase.from("clients").update(payload).eq("id", activeEditingId).eq("owner_id", user.id)
      : supabase.from("clients").insert(payload);

    const { error } = await query;

    if (error) {
      throw error;
    }

    await loadSavedClients();
    resetClientForm();
    setStatus(isEditing ? "Contact updated." : "Contact saved to your account.", "success");
  } catch (error) {
    setStatus(error.message || "Unable to save this client.", "error");
    setClientFormStatus(error.message || "Unable to save this contact.", "error");
  } finally {
    setButtonBusy(saveClientButton, false);
  }
}

async function handleTierPreview(nextTier) {
  if (!supabase) {
    setStatus("Add your Supabase keys in Vercel before using accounts.", "error");
    return;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    setStatus("Please sign in first.", "error");
    return;
  }

  const nextValue = String(nextTier || "free").trim().toLowerCase();
  const metadata = {
    ...(user.user_metadata || {}),
    tier: nextValue
  };

  const activeButton = nextValue === "bronze" ? setBronzeTierButton : setFreeTierButton;
  setButtonBusy(activeButton, true, nextValue === "bronze" ? "Switching..." : "Updating...");
  setStatus("");

  try {
    const { data, error } = await supabase.auth.updateUser({
      data: metadata
    });

    if (error) {
      throw error;
    }

    updateSignedInView(data.user || null);

    if (isBronzeUser(data.user)) {
      await ensureProfile(data.user);
      await loadSavedClients();
    } else {
      savedClients = [];
      renderSavedClients();
    }

    setStatus(nextValue === "bronze" ? "Bronze preview is now active on this account." : "Your account is back on FREE.", "success");
  } catch (error) {
    setStatus(error.message || "Unable to change the test tier.", "error");
  } finally {
    setButtonBusy(setFreeTierButton, false);
    setButtonBusy(setBronzeTierButton, false);
  }
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomDigits(length) {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
}

function generateTestClient(index, seed) {
  const firstNames = ["Mia", "Olivia", "Ava", "Liam", "Noah", "Lucas", "Sofia", "Emma", "Mateo", "Elena"];
  const lastNames = ["Rivera", "Martinez", "Lopez", "Gomez", "Perez", "Diaz", "Torres", "Alvarez", "Santos", "Reed"];
  const streets = ["Ocean Dr", "Biscayne Blvd", "Coral Way", "Bird Rd", "Flagler St", "Sunset Dr", "Pine Tree Dr", "Alton Rd"];
  const notes = [
    "Gate code needed before arrival.",
    "Please call when you're on the way.",
    "Customer requested a morning appointment.",
    "Parking is easiest in the side driveway.",
    "Please bring the standard service checklist."
  ];
  const first = pickRandom(firstNames);
  const last = pickRandom(lastNames);
  const name = `${first} ${last}`;
  const email = `${first}.${last}.${seed}${index}@example.com`.toLowerCase();
  const areaCode = pickRandom(["305", "786", "954"]);
  const phone = `${areaCode}${randomDigits(7)}`;
  const address = `${100 + Math.floor(Math.random() * 8900)} ${pickRandom(streets)}`.slice(0, 40);
  const createdAt = new Date(Date.now() - index * 86400000).toISOString();

  return {
    client_name: name.slice(0, 30),
    client_email: email,
    client_phone: phone,
    service_address: address,
    notes: pickRandom(notes),
    created_at: createdAt,
    updated_at: createdAt
  };
}

async function handleSeedClients() {
  if (!supabase || !seedClientsButton) {
    return;
  }

  if (runtimeConfig?.label !== "DEV") {
    setStatus("This quick-fill tool is only available in QA.", "error");
    return;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.id) {
    setStatus("Please sign in first.", "error");
    return;
  }

  if (!isBronzeUser(user)) {
    setStatus("Switch to Bronze first so test contacts can be saved.", "error");
    return;
  }

  const confirmed = window.confirm("Add 10 random QA contacts to this account?");

  if (!confirmed) {
    return;
  }

  const seed = Date.now();
  const payload = Array.from({ length: 10 }, (_, index) => ({
    owner_id: user.id,
    ...generateTestClient(index, seed)
  }));

  setButtonBusy(seedClientsButton, true, "Adding test contacts...");
  setStatus("");

  try {
    const { error } = await supabase.from("clients").insert(payload);

    if (error) {
      throw error;
    }

    await loadSavedClients();
    setStatus("10 QA test contacts added.", "success");
  } catch (error) {
    setStatus(error.message || "Unable to add test contacts.", "error");
  } finally {
    setButtonBusy(seedClientsButton, false);
  }
}

function handleExportClientsJson() {
  closeClientsMoreActionsMenu();
  const records = buildClientExportRecords();

  if (!records.length) {
    setStatus("Save at least one client before exporting client data.", "info");
    return;
  }

  downloadTextFile(
    buildExportFilename("json"),
    JSON.stringify(
      {
        format: "appointment-reminder-clients-v1",
        exported_at: new Date().toISOString(),
        clients: records
      },
      null,
      2
    ),
    "application/json;charset=utf-8"
  );

  setStatus(`Exported ${records.length} client${records.length === 1 ? "" : "s"} as JSON.`, "success");
}

function handleExportClientsCsv() {
  closeClientsMoreActionsMenu();
  const records = buildClientExportRecords();

  if (!records.length) {
    setStatus("Save at least one client before exporting client data.", "info");
    return;
  }

  downloadTextFile(
    buildExportFilename("csv"),
    serializeClientsToCsv(records),
    "text/csv;charset=utf-8"
  );

  setStatus(`Exported ${records.length} client${records.length === 1 ? "" : "s"} as CSV.`, "success");
}

async function handleImportClientsFile(event) {
  const fileInput = event.currentTarget;
  const file = fileInput?.files?.[0] || null;

  if (!file) {
    return;
  }

  closeClientsMoreActionsMenu();

  if (!supabase) {
    setStatus("Add your Supabase keys in Vercel before importing clients.", "error");
    fileInput.value = "";
    return;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.id) {
    setStatus("Please sign in before importing client data.", "error");
    fileInput.value = "";
    return;
  }

  if (!isBronzeUser(user)) {
    setStatus("Bronze is required to import client data.", "error");
    fileInput.value = "";
    return;
  }

  setButtonBusy(importClientsButton, true, "Importing...");
  setStatus("Importing client data...", "info", { loading: true });

  try {
    const fileText = await file.text();
    const extension = String(file.name.split(".").pop() || "").trim().toLowerCase();
    const rawRecords = extension === "csv"
      ? parseImportedClientCsv(fileText)
      : parseImportedClientJson(fileText);

    const normalizedRecords = rawRecords
      .map(record => normalizeImportedClientRecord(record, user.id))
      .filter(Boolean);

    if (!normalizedRecords.length) {
      throw new Error("No valid clients were found in that file.");
    }

    const existingClientIds = new Set((savedClients || []).map(client => String(client?.id || "").trim()).filter(Boolean));
    const updateRecords = normalizedRecords.filter(record => record.importId && existingClientIds.has(record.importId));
    const insertRecords = normalizedRecords
      .filter(record => !record.importId || !existingClientIds.has(record.importId))
      .map(record => record.payload);

    for (const record of updateRecords) {
      await persistImportedClientUpdate(record.importId, user.id, record.payload);
    }

    await persistImportedClientInserts(insertRecords);
    await loadSavedClients();

    const importedCount = updateRecords.length + insertRecords.length;
    const skippedCount = rawRecords.length - importedCount;
    const summary = [
      `Imported ${importedCount} client${importedCount === 1 ? "" : "s"}`
    ];

    if (updateRecords.length) {
      summary.push(`${updateRecords.length} updated`);
    }

    if (insertRecords.length) {
      summary.push(`${insertRecords.length} added`);
    }

    if (skippedCount > 0) {
      summary.push(`${skippedCount} skipped`);
    }

    setStatus(`${summary.join(" - ")}.`, "success");
  } catch (error) {
    setStatus(error.message || "Unable to import client data.", "error");
  } finally {
    setButtonBusy(importClientsButton, false);
    fileInput.value = "";
  }
}

function useClientInReminder(clientId) {
  const client = savedClients.find(entry => entry.id === clientId);

  if (!client) {
    return;
  }

  window.sessionStorage.setItem(
    REMINDER_PREFILL_KEY,
    JSON.stringify({
      id: client.id || "",
      name: client.client_name || "",
      email: client.client_email || "",
      phone: client.client_phone ? formatPhone(client.client_phone) : "",
      address: client.service_address || "",
      profileCustomAnswers: normalizeProfileCustomAnswers(client.profile_custom_answers)
    })
  );

  window.location.href = "index.html";
}

async function deleteClient(clientId) {
  if (!supabase) {
    return;
  }

  const client = savedClients.find(entry => String(entry?.id || "") === String(clientId || ""));

  if (!client) {
    setStatus("Unable to find that client.", "error");
    return;
  }

  const confirmed = window.confirm("Delete this saved client?");

  if (!confirmed) {
    return;
  }

  setStatus("Deleting client...", "info");

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.id) {
    setStatus("Please sign in again before deleting this client.", "error");
    return;
  }

  try {
    await deleteClientRelatedData(client, user.id);

    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", clientId)
      .eq("owner_id", user.id);

    if (error) {
      throw error;
    }
  } catch (error) {
    setStatus(error.message || "Unable to delete this client.", "error");
    return;
  }

  const storedPrefill = window.sessionStorage.getItem(REMINDER_PREFILL_KEY);

  if (storedPrefill) {
    try {
      const parsedPrefill = JSON.parse(storedPrefill);

      if (String(parsedPrefill?.id || "") === String(clientId || "")) {
        window.sessionStorage.removeItem(REMINDER_PREFILL_KEY);
      }
    } catch (_error) {
      window.sessionStorage.removeItem(REMINDER_PREFILL_KEY);
    }
  }

  if (editingClientId === clientId) {
    resetClientForm();
  }

  savedClients = savedClients.filter(entry => String(entry?.id || "") !== String(clientId || ""));
  renderSavedClients();
  setStatus("Client deleted.", "success");
  await loadSavedClients();
}

function handleClientsListClick(event) {
  const helpButton = event.target.closest("[data-status-help]");

  if (helpButton) {
    event.preventDefault();
    event.stopPropagation();
    openStatusHelpModal(helpButton.dataset.statusHelp || "This status is estimated.");
    return;
  }

  const paginationButton = event.target.closest("button[data-pagination]");

  if (paginationButton) {
    const paginationAction = paginationButton.dataset.pagination || "";

    if (paginationAction === "prev" && clientsPage > 1) {
      clientsPage -= 1;
      renderSavedClients();
    } else if (paginationAction === "next") {
      clientsPage += 1;
      renderSavedClients();
    } else if (paginationAction === "page") {
      const requestedPage = Number.parseInt(paginationButton.dataset.page || "1", 10);

      if (Number.isFinite(requestedPage) && requestedPage > 0) {
        clientsPage = requestedPage;
        renderSavedClients();
      }
    }

    return;
  }

  const button = event.target.closest("button[data-action]");

  if (button) {
    const clientId = button.dataset.clientId || "";
    const action = button.dataset.action || "";

    if (!clientId) {
      return;
    }

    if (action === "use") {
      useClientInReminder(clientId);
    } else if (action === "edit") {
      populateClientForm(clientId);
    } else if (action === "delete") {
      deleteClient(clientId);
    }

    return;
  }

  const clientRow = event.target.closest("[data-client-row]");

  if (clientRow) {
    const rowClientId = String(clientRow.dataset.clientId || "").trim();

    if (rowClientId) {
      openClientDetailModal(rowClientId);
    }
  }
}

function handleClientDetailBodyClick(event) {
  const rememberButton = event.target.closest("[data-remember-answer]");

  if (!rememberButton) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  rememberClientAnswer(
    rememberButton.dataset.clientId,
    rememberButton.dataset.appointmentId,
    rememberButton.dataset.fieldId
  );
}

async function handleUpgrade() {
  if (!supabase) {
    setStatus("Add your Supabase keys in Vercel before using accounts.", "error");
    return;
  }

  if (!appConfig?.paymentsEnabled) {
    if (billingSetupNotice) {
      billingSetupNotice.hidden = false;
    }
    setStatus("Stripe is not configured yet.", "error");
    return;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.email) {
    setStatus("Please sign in before upgrading.", "error");
    return;
  }

  setButtonBusy(upgradeButton, true, "Opening checkout...");
  setStatus("");

  try {
    const response = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email: user.email, returnPath: "/client-details.html" })
    });

    const data = await response.json();

    if (!response.ok || !data.url) {
      throw new Error(data.error || "Unable to start checkout.");
    }

    window.location.href = data.url;
  } catch (error) {
    setStatus(error.message || "Unable to open checkout.", "error");
    setButtonBusy(upgradeButton, false);
  }
}

function handleQueryStatus() {
  const params = new URLSearchParams(window.location.search);
  const checkoutState = params.get("checkout");

  if (checkoutState === "success") {
    setStatus("Checkout completed. Next we can connect your Pro access to saved features.", "success");
  } else if (checkoutState === "cancel") {
    setStatus("Checkout was canceled.", "info");
  }
}

async function initAccountPage() {
  handleQueryStatus();

  try {
    await initSupabase();
  } catch (error) {
    setStatus(error.message || "Unable to load the account page.", "error");
  }

  if (signUpForm) {
    signUpForm.addEventListener("submit", handleSignUp);
  }

  if (signInForm) {
    signInForm.addEventListener("submit", handleSignIn);
  }

  if (signOutButton) {
    signOutButton.addEventListener("click", handleSignOut);
  }

  if (upgradeButton) {
    upgradeButton.addEventListener("click", handleUpgrade);
  }

  if (clientForm) {
    clientForm.addEventListener("submit", handleSaveClient);
  }

  if (openAddClientButton) {
    openAddClientButton.addEventListener("click", openBlankClientForm);
  }

  if (cancelEditClientButton) {
    cancelEditClientButton.addEventListener("click", resetClientForm);
  }

  if (clientModal) {
    clientModal.addEventListener("click", event => {
      if (event.target === clientModal) {
        resetClientForm();
      }
    });
  }

  if (clientDetailModal) {
    clientDetailModal.addEventListener("click", event => {
      const helpButton = event.target.closest("[data-status-help]");

      if (helpButton) {
        event.preventDefault();
        event.stopPropagation();
        openStatusHelpModal(helpButton.dataset.statusHelp || "This status is estimated.");
        return;
      }

      if (event.target === clientDetailModal) {
        closeClientDetailModal();
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
    if (event.key === "Escape" && clientModal && !clientModal.hidden) {
      resetClientForm();
    } else if (event.key === "Escape" && clientDetailModal && !clientDetailModal.hidden) {
      closeClientDetailModal();
    } else if (event.key === "Escape" && statusHelpModal && !statusHelpModal.hidden) {
      closeStatusHelpModal();
    } else if (event.key === "Escape" && clientsMoreActionsMenu?.open) {
      closeClientsMoreActionsMenu();
    }
  });

  document.addEventListener("click", event => {
    if (clientsMoreActionsMenu?.open && !clientsMoreActionsMenu.contains(event.target)) {
      closeClientsMoreActionsMenu();
    }
  });

  if (clientsList) {
    clientsList.addEventListener("click", handleClientsListClick);
  }

  if (clientsSearchInput) {
    clientsSearchInput.addEventListener("input", event => {
      clientsSearchQuery = String(event.target.value || "");
      clientsPage = 1;
      renderSavedClients();
    });
  }

  if (clientsSortSelect) {
    clientsSortSelect.value = clientsSortMode;
    clientsSortSelect.addEventListener("change", event => {
      clientsSortMode = String(event.target.value || "newest");
      clientsPage = 1;
      renderSavedClients();
    });
  }

  if (setFreeTierButton) {
    setFreeTierButton.addEventListener("click", () => handleTierPreview("free"));
  }

  if (setBronzeTierButton) {
    setBronzeTierButton.addEventListener("click", () => handleTierPreview("bronze"));
  }

  if (seedClientsButton) {
    seedClientsButton.addEventListener("click", handleSeedClients);
  }

  if (exportClientsJsonButton) {
    exportClientsJsonButton.addEventListener("click", handleExportClientsJson);
  }

  if (exportClientsCsvButton) {
    exportClientsCsvButton.addEventListener("click", handleExportClientsCsv);
  }

  if (importClientsButton && importClientsInput) {
    importClientsButton.addEventListener("click", () => {
      importClientsInput.click();
    });
  }

  if (importClientsInput) {
    importClientsInput.addEventListener("change", handleImportClientsFile);
  }

  if (closeClientDetailButton) {
    closeClientDetailButton.addEventListener("click", closeClientDetailModal);
  }

  if (clientDetailBody) {
    clientDetailBody.addEventListener("click", handleClientDetailBodyClick);
  }

  if (closeStatusHelpButton) {
    closeStatusHelpButton.addEventListener("click", closeStatusHelpModal);
  }
}

initAccountPage();
