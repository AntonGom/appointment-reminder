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
const clientsSearchInput = document.getElementById("clients-search");
const clientsSortSelect = document.getElementById("clients-sort");
const clientsList = document.getElementById("clients-list");

let supabase = null;
let appConfig = null;
let runtimeConfig = null;
let savedClients = [];
let editingClientId = "";
let clientsSearchQuery = "";
let clientsSortMode = "az";
let reminderHistoryReady = true;
const REMINDER_PREFILL_KEY = "appointment-reminder-selected-client";

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
    .select("client_id, channel, source, sent_at")
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
  const historyEntries = Array.isArray(client?.reminder_history)
    ? client.reminder_history.slice(0, 4)
    : [];

  if (!historyEntries.length) {
    return `<span class="table-muted">${reminderHistoryReady ? "No reminders yet" : "History setup needed"}</span>`;
  }

  return `
    <div class="history-stack">
      ${historyEntries.map(entry => `
        <div class="history-entry">
          <div class="history-channel">${escapeHtml(getReminderHistoryChannelLabel(entry))}</div>
          <div class="history-time">${escapeHtml(formatReminderHistoryDateTime(entry.sent_at) || "Not available")}</div>
        </div>
      `).join("")}
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

function getVisibleClients() {
  const query = clientsSearchQuery.trim().toLowerCase();
  const filteredClients = query
    ? savedClients.filter(client => getClientSearchText(client).includes(query))
    : [...savedClients];

  return sortContacts(filteredClients, clientsSortMode);
}

function renderSavedClients() {
  if (!clientsList) {
    return;
  }

  const visibleClients = getVisibleClients();
  updateContactsCount(visibleClients.length);

  if (!savedClients.length) {
    clientsList.innerHTML = `<div class="empty-state">No contacts saved yet.</div>`;
    return;
  }

  if (!visibleClients.length) {
    clientsList.innerHTML = `<div class="empty-state">No contacts match that search.</div>`;
    return;
  }

  clientsList.innerHTML = `
    <div class="clients-table-shell">
      <table class="clients-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Address</th>
            <th>Details</th>
            <th>Reminder History</th>
            <th>Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${visibleClients.map(client => {
            const displayName = client.client_name || "Saved client";
            const updatedLabel = formatSavedDate(client.updated_at || client.created_at);
            const phoneLabel = client.client_phone ? formatPhone(client.client_phone) : "";

            return `
              <tr>
                <td><strong>${escapeHtml(displayName)}</strong></td>
                <td>${client.client_email ? escapeHtml(client.client_email) : `<span class="table-muted">Not added</span>`}</td>
                <td>${phoneLabel ? escapeHtml(phoneLabel) : `<span class="table-muted">Not added</span>`}</td>
                <td>${client.service_address ? escapeHtml(client.service_address) : `<span class="table-muted">Not added</span>`}</td>
                <td>${client.notes ? escapeHtml(client.notes) : `<span class="table-muted">No details</span>`}</td>
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
      ${visibleClients.map(client => {
        const displayName = client.client_name || "Saved client";
        const updatedLabel = formatSavedDate(client.updated_at || client.created_at);
        const phoneLabel = client.client_phone ? formatPhone(client.client_phone) : "";

        return `
          <div class="client-mobile-card">
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
                <div class="client-mobile-label">Address</div>
                <div class="client-mobile-value">${client.service_address ? escapeHtml(client.service_address) : `<span class="table-muted">Not added</span>`}</div>
              </div>
              <div class="client-mobile-row">
                <div class="client-mobile-label">Details</div>
                <div class="client-mobile-value">${client.notes ? escapeHtml(client.notes) : `<span class="table-muted">No details</span>`}</div>
              </div>
              <div class="client-mobile-row">
                <div class="client-mobile-label">Reminder History</div>
                <div class="client-mobile-value">${renderReminderHistory(client)}</div>
              </div>
              <div class="client-mobile-row">
                <div class="client-mobile-label">Updated</div>
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

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.id) {
    savedClients = [];
    renderSavedClients();
    return;
  }

  const { data, error } = await supabase
    .from("clients")
    .select("id, client_name, client_email, client_phone, service_address, notes, created_at, updated_at");

  if (error) {
    setStatus(error.message || "Unable to load saved clients.", "error");
    return;
  }

  const clientsData = data || [];
  const historyRows = await loadReminderHistory(user.id);
  savedClients = attachReminderHistory(clientsData, historyRows);
  renderSavedClients();
}

function updateSignedInView(user) {
  const isSignedIn = Boolean(user);
  const tierKey = isSignedIn ? getTierKey(user) : "free";
  const isBronze = isSignedIn && tierKey === "bronze";

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

async function initSupabase() {
  appConfig = await getPublicConfig();
  runtimeConfig = await getRuntimeConfig().catch(() => null);

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

  updateSignedInView(session?.user || null);

  if (session?.user) {
    await ensureProfile(session.user);
    if (isBronzeUser(session.user)) {
      await loadSavedClients();
    } else {
      savedClients = [];
      renderSavedClients();
    }
  } else {
    savedClients = [];
    renderSavedClients();
  }

  supabase.auth.onAuthStateChange(async (_event, nextSession) => {
    updateSignedInView(nextSession?.user || null);

    if (nextSession?.user) {
      await ensureProfile(nextSession.user);
      if (isBronzeUser(nextSession.user)) {
        await loadSavedClients();
      } else {
        savedClients = [];
        renderSavedClients();
      }
    } else {
      savedClients = [];
      renderSavedClients();
    }
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
        emailRedirectTo: `${window.location.origin}/account.html`
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
    service_address: String(formData.get("service_address") || "").trim().slice(0, 40),
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

function useClientInReminder(clientId) {
  const client = savedClients.find(entry => entry.id === clientId);

  if (!client) {
    return;
  }

  window.sessionStorage.setItem(
    REMINDER_PREFILL_KEY,
    JSON.stringify({
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
  const button = event.target.closest("button[data-action]");

  if (!button) {
    return;
  }

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
      body: JSON.stringify({ email: user.email })
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

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && clientModal && !clientModal.hidden) {
      resetClientForm();
    }
  });

  if (clientsList) {
    clientsList.addEventListener("click", handleClientsListClick);
  }

  if (clientsSearchInput) {
    clientsSearchInput.addEventListener("input", event => {
      clientsSearchQuery = String(event.target.value || "");
      renderSavedClients();
    });
  }

  if (clientsSortSelect) {
    clientsSortSelect.addEventListener("change", event => {
      clientsSortMode = String(event.target.value || "az");
      renderSavedClients();
    });
  }

  if (setFreeTierButton) {
    setFreeTierButton.addEventListener("click", () => handleTierPreview("free"));
  }

  if (setBronzeTierButton) {
    setBronzeTierButton.addEventListener("click", () => handleTierPreview("bronze"));
  }
}

initAccountPage();
