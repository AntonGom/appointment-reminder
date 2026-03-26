document.addEventListener("DOMContentLoaded", () => {
  const currentPage = document.body.dataset.page || "";
  const statusCluster = document.createElement("div");
  statusCluster.className = "status-cluster";

  const envBadge = document.createElement("div");
  envBadge.className = "env-badge";
  envBadge.hidden = true;

  const accountChip = document.createElement("a");
  accountChip.className = "account-chip";
  accountChip.href = "account.html";
  accountChip.hidden = true;

  const accountChipLabel = document.createElement("span");
  accountChipLabel.className = "account-chip-label";

  const accountChipEmail = document.createElement("span");
  accountChipEmail.className = "account-chip-email";
  accountChipEmail.hidden = true;

  const accountChipTier = document.createElement("span");
  accountChipTier.className = "account-chip-tier";
  accountChipTier.hidden = true;

  accountChip.appendChild(accountChipLabel);
  accountChip.appendChild(accountChipEmail);
  accountChip.appendChild(accountChipTier);

  const toggle = document.createElement("button");
  toggle.className = "nav-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-label", "Open navigation");
  toggle.setAttribute("aria-expanded", "false");
  toggle.innerHTML = `
    <span>
      <span class="nav-toggle-bar"></span>
      <span class="nav-toggle-bar"></span>
      <span class="nav-toggle-bar"></span>
    </span>
  `;

  const overlay = document.createElement("div");
  overlay.className = "site-nav-overlay";

  const nav = document.createElement("aside");
  nav.className = "site-nav";
  nav.innerHTML = `
    <h2 class="site-nav-title">Appointment Reminder</h2>
    <p class="site-nav-copy">Simple reminders for small businesses that want fewer no-shows without a complicated scheduling system.</p>
    <nav class="site-nav-links">
      <a href="index.html"${currentPage === "home" ? ' class="active"' : ""}>Home</a>
      <a href="account.html"${currentPage === "account" ? ' class="active"' : ""}>Account</a>
      <a href="about.html"${currentPage === "about" ? ' class="active"' : ""}>About</a>
      <a href="terms.html"${currentPage === "terms" ? ' class="active"' : ""}>Terms</a>
      <a href="privacy.html"${currentPage === "privacy" ? ' class="active"' : ""}>Privacy</a>
    </nav>
  `;

  function closeNav() {
    nav.classList.remove("open");
    overlay.classList.remove("open");
    toggle.classList.remove("open");
    toggle.setAttribute("aria-label", "Open navigation");
    toggle.setAttribute("aria-expanded", "false");
  }

  function openNav() {
    nav.classList.add("open");
    overlay.classList.add("open");
    toggle.classList.add("open");
    toggle.setAttribute("aria-label", "Close navigation");
    toggle.setAttribute("aria-expanded", "true");
  }

  toggle.addEventListener("click", () => {
    if (nav.classList.contains("open")) {
      closeNav();
    } else {
      openNav();
    }
  });

  overlay.addEventListener("click", closeNav);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeNav();
    }
  });

  function showBadge(label) {
    const normalized = String(label || "").trim().toLowerCase();
    const isDev = normalized === "qa" || normalized === "dev";

    if (!normalized) {
      return;
    }

    envBadge.textContent = normalized === "production" ? "Production" : isDev ? "DEV" : "Local";
    envBadge.classList.remove("qa", "production", "local");
    envBadge.classList.add(normalized === "production" ? "production" : isDev ? "qa" : "local");
    envBadge.hidden = false;
  }

  function formatTierLabel(user) {
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

  function renderSignedOutChip() {
    accountChip.classList.remove("signed-in");
    accountChip.classList.add("signed-out");
    accountChip.href = "account.html";
    accountChipLabel.textContent = "Sign Up";
    accountChipLabel.hidden = false;
    accountChipEmail.hidden = true;
    accountChipTier.hidden = true;
    accountChip.hidden = false;
  }

  function renderSignedInChip(user) {
    accountChip.classList.remove("signed-out");
    accountChip.classList.add("signed-in");
    accountChip.href = "account.html";
    accountChipLabel.hidden = true;
    accountChipEmail.textContent = user?.email || "Account";
    accountChipEmail.title = user?.email || "";
    accountChipEmail.hidden = false;

    const tierLabel = formatTierLabel(user);
    accountChipTier.textContent = tierLabel;
    accountChipTier.classList.remove("free", "bronze");
    accountChipTier.classList.add(tierLabel === "Bronze" ? "bronze" : "free");
    accountChipTier.hidden = false;
    accountChip.hidden = false;
  }

  async function loadAccountChip() {
    renderSignedOutChip();

    try {
      const configResponse = await fetch("/api/public-config", { cache: "no-store" });

      if (!configResponse.ok) {
        throw new Error("Unable to load account configuration.");
      }

      const config = await configResponse.json();

      if (!config.accountsEnabled || !config.supabaseUrl || !config.supabasePublishableKey) {
        return;
      }

      const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
      const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        }
      });

      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (session?.user) {
        renderSignedInChip(session.user);
      }

      supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (nextSession?.user) {
          renderSignedInChip(nextSession.user);
        } else {
          renderSignedOutChip();
        }
      });
    } catch (error) {
      renderSignedOutChip();
    }
  }

  async function loadEnvironmentBadge() {
    try {
      const response = await fetch("/api/runtime-env", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Unable to load runtime environment.");
      }

      const data = await response.json();
      showBadge(data.label);
    } catch (error) {
      if (window.location.hostname.includes("git-codex-qa")) {
        showBadge("QA");
      }
    }
  }

  loadEnvironmentBadge();
  loadAccountChip();

  statusCluster.appendChild(accountChip);
  statusCluster.appendChild(envBadge);
  document.body.appendChild(statusCluster);
  document.body.appendChild(toggle);
  document.body.appendChild(overlay);
  document.body.appendChild(nav);
});
