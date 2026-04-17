document.addEventListener("DOMContentLoaded", () => {
  const currentPage = document.body.dataset.page || "";
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

  const accountDropdownSignOut = document.createElement("button");
  accountDropdownSignOut.className = "account-dropdown-action";
  accountDropdownSignOut.type = "button";
  accountDropdownSignOut.textContent = "Sign Out";

  accountChip.appendChild(accountChipLabel);
  accountChip.appendChild(accountChipEmail);
  accountChip.appendChild(accountChipTier);
  accountDropdown.appendChild(accountDropdownLink);
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
  nav.innerHTML = `
    <h2 class="site-nav-title">Appointment Reminder</h2>
    <p class="site-nav-copy">Simple reminders for small businesses that want fewer no-shows without a complicated scheduling system.</p>
    <nav class="site-nav-links">
      <a href="index.html"${currentPage === "home" ? ' class="active"' : ""}>Send Reminder</a>
      <a href="account.html"${currentPage === "account" ? ' class="active"' : ""}>Account</a>
      <a href="about.html"${currentPage === "about" ? ' class="active"' : ""}>About</a>
      <a href="terms.html"${currentPage === "terms" ? ' class="active"' : ""}>Terms</a>
      <a href="privacy.html"${currentPage === "privacy" ? ' class="active"' : ""}>Privacy</a>
    </nav>
  `;

  let supabaseClient = null;
  let isSignedIn = false;
  let currentAuthUserId = "";

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
        <span class="account-page-nav-hint-icon" aria-hidden="true">↔</span>
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
      supabaseClient = createClient(config.supabaseUrl, config.supabasePublishableKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        }
      });

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
      showBadge(data.label);
    } catch (error) {
      if (window.location.hostname.includes("git-codex-qa")) {
        showBadge("QA");
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
});
