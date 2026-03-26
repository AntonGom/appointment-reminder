import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const statusBanner = document.getElementById("status-banner");
const signedOutPanel = document.getElementById("signed-out-panel");
const signedInPanel = document.getElementById("signed-in-panel");
const authSetupNotice = document.getElementById("auth-setup-notice");
const billingSetupNotice = document.getElementById("billing-setup-notice");
const accountEmail = document.getElementById("account-email");
const accountPlan = document.getElementById("account-plan");
const upgradeButton = document.getElementById("upgrade-button");
const signUpForm = document.getElementById("sign-up-form");
const signInForm = document.getElementById("sign-in-form");
const signOutButton = document.getElementById("sign-out-button");
const pricePill = document.getElementById("price-pill");
const clientForm = document.getElementById("client-form");
const saveClientButton = document.getElementById("save-client-button");
const clientsList = document.getElementById("clients-list");

let supabase = null;
let appConfig = null;
let savedClients = [];
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
  const candidates = [
    user?.user_metadata?.tier,
    user?.user_metadata?.plan,
    user?.app_metadata?.tier,
    user?.app_metadata?.plan,
    user?.app_metadata?.subscription_tier
  ];

  const rawValue = candidates.find(value => typeof value === "string" && value.trim());
  const normalized = String(rawValue || "free").trim().toLowerCase();

  if (normalized === "free") {
    return "FREE";
  }

  if (normalized === "bronze") {
    return "Bronze";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getClientDisplayLines(client) {
  const lines = [];

  if (client.client_email) {
    lines.push(client.client_email);
  }

  if (client.client_phone) {
    lines.push(formatPhone(client.client_phone));
  }

  if (client.service_address) {
    lines.push(client.service_address);
  }

  if (client.notes) {
    lines.push(`Notes: ${client.notes}`);
  }

  return lines;
}

function renderSavedClients() {
  if (!clientsList) {
    return;
  }

  if (!savedClients.length) {
    clientsList.innerHTML = `<div class="empty-state">No saved clients yet.</div>`;
    return;
  }

  clientsList.innerHTML = savedClients.map(client => {
    const displayName = client.client_name || "Saved client";
    const details = getClientDisplayLines(client)
      .map(line => escapeHtml(line))
      .join("\n");

    return `
      <div class="client-item">
        <div class="client-item-head">
          <div class="client-item-name">${escapeHtml(displayName)}</div>
        </div>
        <div class="client-item-meta">${details || "No extra details saved yet."}</div>
        <div class="client-item-actions">
          <button class="primary-button" type="button" data-action="use" data-client-id="${client.id}">Use in Reminder</button>
          <button class="secondary-button" type="button" data-action="delete" data-client-id="${client.id}">Delete</button>
        </div>
      </div>
    `;
  }).join("");
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
    .select("id, client_name, client_email, client_phone, service_address, notes, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    setStatus(error.message || "Unable to load saved clients.", "error");
    return;
  }

  savedClients = data || [];
  renderSavedClients();
}

function updateSignedInView(user) {
  const isSignedIn = Boolean(user);

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

  if (upgradeButton) {
    upgradeButton.disabled = !isSignedIn || !appConfig?.paymentsEnabled;
  }

  if (billingSetupNotice) {
    billingSetupNotice.hidden = !(isSignedIn && !appConfig?.paymentsEnabled);
  }
}

async function getPublicConfig() {
  const response = await fetch("/api/public-config", { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Unable to load account configuration.");
  }

  return response.json();
}

async function initSupabase() {
  appConfig = await getPublicConfig();

  if (pricePill) {
    pricePill.textContent = appConfig.stripePriceLabel || "$9/month";
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
    await loadSavedClients();
  } else {
    savedClients = [];
    renderSavedClients();
  }

  supabase.auth.onAuthStateChange(async (_event, nextSession) => {
    updateSignedInView(nextSession?.user || null);

    if (nextSession?.user) {
      await ensureProfile(nextSession.user);
      await loadSavedClients();
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

  if (!supabase) {
    setStatus("Add your Supabase keys in Vercel before using accounts.", "error");
    return;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.id) {
    setStatus("Please sign in before saving a client.", "error");
    return;
  }

  const formData = new FormData(event.currentTarget);
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
    return;
  }

  if (payload.client_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(payload.client_email)) {
    setStatus("Enter a valid client email address.", "error");
    return;
  }

  setButtonBusy(saveClientButton, true, "Saving client...");
  setStatus("");

  const { error } = await supabase.from("clients").insert(payload);

  setButtonBusy(saveClientButton, false);

  if (error) {
    setStatus(error.message || "Unable to save this client.", "error");
    return;
  }

  event.currentTarget.reset();
  setStatus("Client saved.", "success");
  await loadSavedClients();
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

  if (clientsList) {
    clientsList.addEventListener("click", handleClientsListClick);
  }
}

initAccountPage();
