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
const REMINDER_PREFILL_KEY = "appointment-reminder-selected-client";
const CLIENTS_PER_PAGE = 10;

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

  if (!button.dataset.defaultText) {
    button.dataset.defaultText = button.textContent;
  }

  button.disabled = isBusy;
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

  (historyRows || []).forEach(entry => {
    const clientId = String(entry?.client_id || "").trim();

    if (!clientId) {
      return;
    }

    if (!historyByClientId.has(clientId)) {
      historyByClientId.set(clientId, []);
    }

    historyByClientId.get(clientId).push(entry);
  });

  return (clients || []).map(client => ({
    ...client,
    reminder_history: historyByClientId.get(client.id) || []
  }));
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
      <div class="expanded-client-block expanded-client-block-plain expanded-reminder-activity-shell">
        <div class="expanded-client-label">Full Reminder Activity</div>
        ${renderExpandedReminderHistory(client)}
      </div>
    </div>
  `;
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
      ? "Update the saved contact details below."
      : "Enter the client details you want saved to this account.";
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

    const [clientsResult, historyRows] = await Promise.all([
      supabase
        .from("clients")
        .select("id, client_name, client_email, client_phone, service_address, notes, created_at, updated_at")
        .order("created_at", { ascending: false }),
      loadReminderHistory(user.id)
    ]);

    if (clientsResult.error) {
      throw clientsResult.error;
    }

    const clientsData = clientsResult.data || [];

    if (clientsData.length > CLIENTS_PER_PAGE * 2) {
      await new Promise(resolve => window.requestAnimationFrame(resolve));
    }

    savedClients = attachReminderHistory(clientsData, historyRows);
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
      notes: client.notes || ""
    })
  );

  window.location.href = "index.html";
}

async function deleteClient(clientId) {
  if (!supabase) {
    return;
  }

  const confirmed = window.confirm("Delete this saved client?");

  if (!confirmed) {
    return;
  }

  const { error } = await supabase.from("clients").delete().eq("id", clientId);

  if (error) {
    setStatus(error.message || "Unable to delete this client.", "error");
    return;
  }

  if (editingClientId === clientId) {
    resetClientForm();
  }

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

  if (closeClientDetailButton) {
    closeClientDetailButton.addEventListener("click", closeClientDetailModal);
  }

  if (closeStatusHelpButton) {
    closeStatusHelpButton.addEventListener("click", closeStatusHelpModal);
  }
}

initAccountPage();
