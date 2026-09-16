document.addEventListener("DOMContentLoaded", () => {
  const currentPage = document.body.dataset.page || "";
  const currentFile = window.location.pathname.split("/").pop() || "index.html";
  const coreWorkspaceFiles = new Set([
    "index.html",
    "client-details.html",
    "calendar.html",
    "form-creator.html",
    "branding.html"
  ]);
  const hasAppShell = coreWorkspaceFiles.has(currentFile);

  if (hasAppShell) {
    document.body.classList.add("has-app-shell");
  }

  const icons = {
    send: '<path d="m22 2-7 20-4-9-9-4Z"></path><path d="M22 2 11 13"></path>',
    calendar: '<path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path><path d="M8 14h.01"></path><path d="M12 14h.01"></path><path d="M16 14h.01"></path><path d="M8 18h.01"></path><path d="M12 18h.01"></path>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
    form: '<rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M8 8h8"></path><path d="M8 12h8"></path><path d="M8 16h5"></path>',
    palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle><path d="M12 22a10 10 0 1 0-10-10c0 4.42 2.87 8.17 6.84 9.5.9.3 1.9-.37 1.9-1.32v-.86c0-.78.63-1.41 1.41-1.41H14a2 2 0 0 0 0-4h-1.5a2.5 2.5 0 0 1 0-5H15"></path>',
    activity: '<path d="M3 3v18h18"></path><path d="m7 16 4-5 4 3 5-7"></path>',
    account: '<circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"></path><circle cx="12" cy="12" r="3"></circle>'
  };

  function iconMarkup(name) {
    return `<svg class="app-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.form}</svg>`;
  }

  function isCurrentFile(file) {
    return currentFile === file || (file === "index.html" && !currentFile);
  }

  function appNavLink(file, label, icon, className = "") {
    const active = isCurrentFile(file);
    return `<a href="${file}" class="app-nav-link${active ? " active" : ""}${className ? ` ${className}` : ""}"${active ? ' aria-current="page"' : ""}>${iconMarkup(icon)}<span>${label}</span></a>`;
  }
  const statusCluster = document.createElement("div");
  statusCluster.className = "status-cluster";
  const accountMenu = document.createElement("div");
  accountMenu.className = "account-menu";

  const envBadge = document.createElement("div");
  envBadge.className = "env-badge";
  envBadge.hidden = true;

  const accountChip = document.createElement("button");
  accountChip.className = "account-chip";
  accountChip.type = "button";
  accountChip.hidden = true;

  const accountChipLabel = document.createElement("span");
  accountChipLabel.className = "account-chip-label";

  const accountChipEmail = document.createElement("span");
  accountChipEmail.className = "account-chip-email";
  accountChipEmail.hidden = true;

  const accountChipTier = document.createElement("span");
  accountChipTier.className = "account-chip-tier";
  accountChipTier.hidden = true;

  const accountDropdown = document.createElement("div");
  accountDropdown.className = "account-dropdown";
  accountDropdown.hidden = true;

  const accountDropdownLink = document.createElement("a");
  accountDropdownLink.className = "account-dropdown-link";
  accountDropdownLink.href = "client-details.html";
  accountDropdownLink.textContent = "Client Details";

  const accountDropdownMessagesLink = document.createElement("a");
  accountDropdownMessagesLink.className = "account-dropdown-link";
  accountDropdownMessagesLink.href = "messages.html";
  accountDropdownMessagesLink.textContent = "Activity";

  const accountDropdownSignOut = document.createElement("button");
  accountDropdownSignOut.className = "account-dropdown-action";
  accountDropdownSignOut.type = "button";
  accountDropdownSignOut.textContent = "Sign Out";

  accountChip.appendChild(accountChipLabel);
  accountChip.appendChild(accountChipEmail);
  accountChip.appendChild(accountChipTier);
  accountDropdown.appendChild(accountDropdownLink);
  accountDropdown.appendChild(accountDropdownMessagesLink);
  accountDropdown.appendChild(accountDropdownSignOut);

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
  nav.innerHTML = hasAppShell ? `
    <div class="site-nav-brand">
      <span class="site-nav-mark" aria-hidden="true">AR</span>
      <span>
        <strong class="site-nav-title">Appointment Reminder</strong>
        <small>Business workspace</small>
      </span>
    </div>
    <nav class="site-nav-links" aria-label="Primary navigation">
      <span class="site-nav-group-label">Workspace</span>
      ${appNavLink("index.html", "Send reminder", "send")}
      ${appNavLink("calendar.html", "Calendar", "calendar")}
      ${appNavLink("client-details.html", "Clients", "users")}
      ${appNavLink("form-creator.html", "Form creator", "form")}
      ${appNavLink("branding.html", "Branding", "palette")}
      <span class="site-nav-group-label">Manage</span>
      ${appNavLink("messages.html", "Activity", "activity")}
      ${appNavLink("account-info.html", "Account", "account")}
      ${appNavLink("settings.html", "Settings", "settings")}
    </nav>
    <nav class="site-nav-footer-links" aria-label="Information pages">
      <a href="about.html"${currentPage === "about" ? ' class="active"' : ""}>About</a>
      <a href="terms.html"${currentPage === "terms" ? ' class="active"' : ""}>Terms</a>
      <a href="privacy.html"${currentPage === "privacy" ? ' class="active"' : ""}>Privacy</a>
    </nav>
  ` : `
    <h2 class="site-nav-title">Appointment Reminder</h2>
    <p class="site-nav-copy">Simple reminders for small businesses that want fewer no-shows without a complicated scheduling system.</p>
    <nav class="site-nav-links" aria-label="Primary navigation">
      <a href="index.html"${currentPage === "home" ? ' class="active"' : ""}>Send Reminder</a>
      <a href="messages.html"${currentPage === "activity" ? ' class="active"' : ""}>Activity</a>
      <a href="account.html"${currentPage === "account" ? ' class="active"' : ""}>Account</a>
      <a href="about.html"${currentPage === "about" ? ' class="active"' : ""}>About</a>
      <a href="terms.html"${currentPage === "terms" ? ' class="active"' : ""}>Terms</a>
      <a href="privacy.html"${currentPage === "privacy" ? ' class="active"' : ""}>Privacy</a>
    </nav>
  `;

  const mobileTabBar = document.createElement("nav");
  mobileTabBar.className = "mobile-tab-bar";
  mobileTabBar.setAttribute("aria-label", "Primary mobile navigation");
  mobileTabBar.innerHTML = `
    ${appNavLink("index.html", "Reminder", "send", "mobile-tab-link")}
    ${appNavLink("calendar.html", "Calendar", "calendar", "mobile-tab-link")}
    ${appNavLink("client-details.html", "Clients", "users", "mobile-tab-link")}
    ${appNavLink("form-creator.html", "Form", "form", "mobile-tab-link")}
    ${appNavLink("branding.html", "Branding", "palette", "mobile-tab-link")}
  `;

  let supabaseClient = null;
  let isSignedIn = false;
  let currentAuthUserId = "";
  const SUPABASE_FETCH_TIMEOUT_MS = 8500;

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
      }, SUPABASE_FETCH_TIMEOUT_MS);

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

  function getSharedSupabaseClient(supabaseUrl, publicKey, createClient) {
    const clientKey = `${supabaseUrl}::${publicKey}`;
    window.__appointmentReminderSupabaseClients = window.__appointmentReminderSupabaseClients || new Map();

    if (!window.__appointmentReminderSupabaseClients.has(clientKey)) {
      window.__appointmentReminderSupabaseClients.set(clientKey, createClient(supabaseUrl, publicKey, {
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

  function closeAccountMenu() {
    accountMenu.classList.remove("open");
    accountDropdown.hidden = true;
    accountChip.setAttribute("aria-expanded", "false");
  }

  function initScrollableAccountPageNavs() {
    const navs = [...document.querySelectorAll(".account-page-nav")];

    if (!navs.length) {
      return;
    }

    navs.forEach(navElement => {
      if (!(navElement instanceof HTMLElement) || navElement.dataset.scrollHintReady === "true") {
        return;
      }

      navElement.dataset.scrollHintReady = "true";

      let shell = navElement.parentElement?.classList.contains("account-page-nav-shell")
        ? navElement.parentElement
        : null;

      if (!shell) {
        shell = document.createElement("div");
        shell.className = "account-page-nav-shell";
        navElement.parentNode?.insertBefore(shell, navElement);
        shell.appendChild(navElement);
      }

      const hint = document.createElement("p");
      hint.className = "account-page-nav-hint";
      hint.innerHTML = `
        <span class="account-page-nav-hint-icon" aria-hidden="true">&harr;</span>
        <span>Swipe to see more pages</span>
      `;
      shell.appendChild(hint);

      const updateScrollState = () => {
        const maxScrollLeft = Math.max(0, navElement.scrollWidth - navElement.clientWidth);
        const canScroll = maxScrollLeft > 14;
        const isAtStart = navElement.scrollLeft <= 10;
        const isAtEnd = navElement.scrollLeft >= maxScrollLeft - 10;

        shell.classList.toggle("is-scrollable", canScroll);
        shell.classList.toggle("can-scroll-left", canScroll && !isAtStart);
        shell.classList.toggle("can-scroll-right", canScroll && !isAtEnd);

        if (!canScroll) {
          shell.classList.remove("is-discovered");
        }

        hint.hidden = !canScroll;
      };

      const markDiscovered = () => {
        if (shell.classList.contains("is-scrollable")) {
          shell.classList.add("is-discovered");
        }
      };

      navElement.addEventListener("scroll", () => {
        markDiscovered();
        updateScrollState();
      }, { passive: true });

      navElement.addEventListener("pointerdown", markDiscovered, { passive: true });
      navElement.addEventListener("touchstart", markDiscovered, { passive: true });
      navElement.addEventListener("wheel", markDiscovered, { passive: true });

      if (typeof ResizeObserver === "function") {
        const resizeObserver = new ResizeObserver(() => {
          updateScrollState();
        });
        resizeObserver.observe(navElement);
      }

      if (typeof MutationObserver === "function") {
        const mutationObserver = new MutationObserver(() => {
          window.requestAnimationFrame(updateScrollState);
        });
        mutationObserver.observe(navElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["hidden", "class", "style"]
        });
      }

      window.addEventListener("resize", updateScrollState);
      window.requestAnimationFrame(() => {
        updateScrollState();
        window.setTimeout(updateScrollState, 220);
      });
    });
  }

  function openAccountMenu() {
    accountMenu.classList.add("open");
    accountDropdown.hidden = false;
    accountChip.setAttribute("aria-expanded", "true");
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
      closeAccountMenu();
    }
  });

  document.addEventListener("click", event => {
    if (!accountMenu.contains(event.target)) {
      closeAccountMenu();
    }
  });

  accountChip.addEventListener("click", event => {
    if (!isSignedIn) {
      window.location.href = "signin.html";
      return;
    }

    event.preventDefault();

    if (accountMenu.classList.contains("open")) {
      closeAccountMenu();
    } else {
      openAccountMenu();
    }
  });

  accountDropdownLink.addEventListener("click", () => {
    closeAccountMenu();
  });

  accountDropdownSignOut.addEventListener("click", async () => {
    if (!supabaseClient) {
      window.location.href = "signin.html";
      return;
    }

    accountDropdownSignOut.disabled = true;

    try {
      const { error } = await supabaseClient.auth.signOut();

      if (error) {
        throw error;
      }

      closeAccountMenu();
    } catch (error) {
      window.alert("We could not sign you out right now. Please try again.");
    } finally {
      accountDropdownSignOut.disabled = false;
    }
  });

  function showBadge(payload) {
    const badgeData = typeof payload === "object" && payload ? payload : { label: payload };
    const normalized = String(badgeData.label || "").trim().toLowerCase();
    const isDev = normalized === "qa" || normalized === "dev";
    const displayLabel = normalized === "production" ? "Production" : isDev ? "DEV" : "Local";
    const version = String(badgeData.version || "").trim();
    const commitSha = String(badgeData.commitSha || badgeData.commit || "").trim().slice(0, 7);

    if (!normalized) {
      return;
    }

    envBadge.innerHTML = "";
    const labelNode = document.createElement("span");
    labelNode.className = "env-badge-label";
    labelNode.textContent = displayLabel;
    envBadge.appendChild(labelNode);

    if (version) {
      const versionNode = document.createElement("span");
      versionNode.className = "env-badge-version";
      versionNode.textContent = `v${version}`;
      envBadge.appendChild(versionNode);
    }

    envBadge.title = [displayLabel, version ? `v${version}` : "", commitSha ? `commit ${commitSha}` : ""]
      .filter(Boolean)
      .join(" • ");
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
    isSignedIn = false;
    accountMenu.classList.remove("signed-in");
    accountMenu.classList.add("signed-out");
    accountChip.classList.remove("signed-in");
    accountChip.classList.add("signed-out");
    accountChip.removeAttribute("aria-haspopup");
    accountChipLabel.textContent = "Sign In";
    accountChipLabel.hidden = false;
    accountChipEmail.hidden = true;
    accountChipTier.hidden = true;
    accountChip.hidden = false;
    closeAccountMenu();
  }

  function renderSignedInChip(user) {
    isSignedIn = true;
    accountMenu.classList.remove("signed-out");
    accountMenu.classList.add("signed-in");
    accountChip.classList.remove("signed-out");
    accountChip.classList.add("signed-in");
    accountChip.setAttribute("aria-haspopup", "menu");
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
    closeAccountMenu();
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
      supabaseClient = getSharedSupabaseClient(config.supabaseUrl, config.supabasePublishableKey, createClient);

      const {
        data: { session }
      } = await supabaseClient.auth.getSession();

      if (session?.user) {
        currentAuthUserId = session.user.id || "";
        renderSignedInChip(session.user);
      } else {
        currentAuthUserId = "";
      }

      supabaseClient.auth.onAuthStateChange((event, nextSession) => {
        if (event === "TOKEN_REFRESHED") {
          return;
        }

        const nextUserId = nextSession?.user?.id || "";

        if (nextUserId === currentAuthUserId && event !== "USER_UPDATED") {
          return;
        }

        currentAuthUserId = nextUserId;
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
      showBadge(data);
    } catch (error) {
      if (window.location.hostname.includes("git-codex-qa")) {
        showBadge({ label: "QA", version: "unknown" });
      }
    }
  }

  loadEnvironmentBadge();
  loadAccountChip();
  closeAccountMenu();
  initScrollableAccountPageNavs();

  document.body.appendChild(statusCluster);
  accountMenu.appendChild(accountChip);
  accountMenu.appendChild(accountDropdown);
  statusCluster.appendChild(accountMenu);
  statusCluster.appendChild(envBadge);
  document.body.appendChild(toggle);
  document.body.appendChild(overlay);
  document.body.appendChild(nav);
  if (hasAppShell) {
    document.body.appendChild(mobileTabBar);
  }
});
