import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const statusBanner = document.getElementById("status-banner");
const authSetupNotice = document.getElementById("auth-setup-notice");
const signedOutShell = document.getElementById("signed-out-shell");
const signedInShell = document.getElementById("signed-in-shell");
const pricePill = document.getElementById("price-pill");
const billingSetupNotice = document.getElementById("billing-setup-notice");
const upgradeButton = document.getElementById("upgrade-button");
const signOutButton = document.getElementById("sign-out-button");
const tierPreviewShell = document.getElementById("tier-preview-shell");
const setFreeTierButton = document.getElementById("set-free-tier-button");
const setBronzeTierButton = document.getElementById("set-bronze-tier-button");

const emailTargets = [...document.querySelectorAll("[data-account-email]")];
const planTargets = [...document.querySelectorAll("[data-account-plan]")];
const planCopyTargets = [...document.querySelectorAll("[data-plan-copy]")];
const contactsCountTargets = [...document.querySelectorAll("[data-contacts-count]")];

let supabase = null;
let appConfig = null;
let runtimeConfig = null;

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

function updateText(targets, value) {
  targets.forEach(target => {
    target.textContent = value;
  });
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

async function loadContactCount(user) {
  if (!supabase || !user?.id || !contactsCountTargets.length) {
    return;
  }

  try {
    const { count, error } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id);

    if (error) {
      throw error;
    }

    updateText(contactsCountTargets, String(count || 0));
  } catch (_error) {
    updateText(contactsCountTargets, "0");
  }
}

function updateSignedInView(user) {
  const isSignedIn = Boolean(user);
  const isBronze = isSignedIn && isBronzeUser(user);
  const tierLabel = isSignedIn ? getTierLabel(user) : "FREE";

  if (signedOutShell) {
    signedOutShell.hidden = isSignedIn;
  }

  if (signedInShell) {
    signedInShell.hidden = !isSignedIn;
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

  updateText(emailTargets, isSignedIn ? user.email || "Signed in" : "");
  updateText(planTargets, tierLabel);

  if (!isSignedIn) {
    updateText(planCopyTargets, "Sign in to view your saved plan details.");
    updateText(contactsCountTargets, "0");
  } else if (isBronze) {
    updateText(planCopyTargets, "Bronze can save contacts and store reminder timing preferences.");
  } else {
    updateText(planCopyTargets, "Free works the same as using the reminder tool signed out.");
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

  if (setFreeTierButton) {
    setFreeTierButton.disabled = !isSignedIn || getTierKey(user) === "free";
  }

  if (setBronzeTierButton) {
    setBronzeTierButton.disabled = !isSignedIn || getTierKey(user) === "bronze";
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
      body: JSON.stringify({ email: user.email, returnPath: "/settings.html" })
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
    await loadContactCount(data.user || null);
    setStatus(nextValue === "bronze" ? "Bronze preview is now active on this account." : "Your account is back on FREE.", "success");
  } catch (error) {
    setStatus(error.message || "Unable to change the test tier.", "error");
  } finally {
    setButtonBusy(setFreeTierButton, false);
    setButtonBusy(setBronzeTierButton, false);
  }
}

async function handleSignOut() {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    setStatus(error.message || "Unable to sign out.", "error");
    return;
  }

  window.location.href = "account.html";
}

function handleQueryStatus() {
  const params = new URLSearchParams(window.location.search);
  const checkoutState = params.get("checkout");

  if (checkoutState === "success") {
    setStatus("Checkout completed. Next we can connect your paid access to saved features.", "success");
  } else if (checkoutState === "cancel") {
    setStatus("Checkout was canceled.", "info");
  }
}

async function initPage() {
  handleQueryStatus();

  try {
    appConfig = await getPublicConfig();
    runtimeConfig = await getRuntimeConfig().catch(() => null);
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
  await loadContactCount(session?.user || null);

  supabase.auth.onAuthStateChange(async (_event, nextSession) => {
    updateSignedInView(nextSession?.user || null);
    await loadContactCount(nextSession?.user || null);
  });

  if (signOutButton) {
    signOutButton.addEventListener("click", handleSignOut);
  }

  if (upgradeButton) {
    upgradeButton.addEventListener("click", handleUpgrade);
  }

  if (setFreeTierButton) {
    setFreeTierButton.addEventListener("click", () => handleTierPreview("free"));
  }

  if (setBronzeTierButton) {
    setBronzeTierButton.addEventListener("click", () => handleTierPreview("bronze"));
  }
}

initPage();
