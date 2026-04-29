import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const statusBanner = document.getElementById("status-banner");
const authSetupNotice = document.getElementById("auth-setup-notice");
const signUpForm = document.getElementById("sign-up-form");
const signInForm = document.getElementById("sign-in-form");

let supabase = null;

function getSharedSupabaseClient(supabaseUrl, publicKey, createClientFn) {
  const clientKey = `${supabaseUrl}::${publicKey}`;
  window.__appointmentReminderSupabaseClients = window.__appointmentReminderSupabaseClients || new Map();

  if (!window.__appointmentReminderSupabaseClients.has(clientKey)) {
    window.__appointmentReminderSupabaseClients.set(clientKey, createClientFn(supabaseUrl, publicKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    }));
  }

  return window.__appointmentReminderSupabaseClients.get(clientKey);
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

function setFormsEnabled(enabled) {
  [signUpForm, signInForm].forEach(form => {
    if (!form) {
      return;
    }

    form.querySelectorAll("input, button").forEach(element => {
      element.disabled = !enabled;
    });
  });
}

async function getPublicConfig() {
  const response = await fetch("/api/public-config", { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Unable to load account configuration.");
  }

  return response.json();
}

function goToClientDetails() {
  window.location.replace(`${window.location.origin}/client-details.html`);
}

async function handleSignUp(event) {
  event.preventDefault();

  const form = event.currentTarget;

  if (!supabase) {
    setStatus("Accounts are not configured yet.", "error");
    return;
  }

  const formData = new FormData(form);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const button = form.querySelector("button[type='submit']");

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

    if (data.session?.user) {
      goToClientDetails();
      return;
    }

    setStatus("Account created. Check your email to confirm your account, then sign in.", "success");
    form.reset();
  } catch (error) {
    setStatus(error.message || "Unable to create your account.", "error");
  } finally {
    setButtonBusy(button, false);
  }
}

async function handleSignIn(event) {
  event.preventDefault();

  const form = event.currentTarget;

  if (!supabase) {
    setStatus("Accounts are not configured yet.", "error");
    return;
  }

  const formData = new FormData(form);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const button = form.querySelector("button[type='submit']");

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

    goToClientDetails();
  } catch (error) {
    setStatus(error.message || "Unable to sign in.", "error");
  } finally {
    setButtonBusy(button, false);
  }
}

async function initAuthPage() {
  try {
    const config = await getPublicConfig();

    if (!config.accountsEnabled || !config.supabaseUrl || !config.supabasePublishableKey) {
      if (authSetupNotice) {
        authSetupNotice.hidden = false;
      }
      setFormsEnabled(false);
      return;
    }

  supabase = getSharedSupabaseClient(config.supabaseUrl, config.supabasePublishableKey, createClient);

    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (session?.user) {
      goToClientDetails();
      return;
    }

    supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "TOKEN_REFRESHED") {
        return;
      }

      if (nextSession?.user) {
        goToClientDetails();
      }
    });
  } catch (error) {
    setStatus(error.message || "Unable to load this page.", "error");
    setFormsEnabled(false);
  }

  if (signUpForm) {
    signUpForm.addEventListener("submit", handleSignUp);
  }

  if (signInForm) {
    signInForm.addEventListener("submit", handleSignIn);
  }
}

initAuthPage();
