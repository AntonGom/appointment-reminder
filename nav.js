document.addEventListener("DOMContentLoaded", () => {
  const currentPage = document.body.dataset.page || "";

  const toggle = document.createElement("button");
  toggle.className = "nav-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-label", "Open navigation");
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
      <a href="about.html"${currentPage === "about" ? ' class="active"' : ""}>About</a>
      <a href="terms.html"${currentPage === "terms" ? ' class="active"' : ""}>Terms</a>
      <a href="privacy.html"${currentPage === "privacy" ? ' class="active"' : ""}>Privacy</a>
    </nav>
  `;

  function closeNav() {
    nav.classList.remove("open");
    overlay.classList.remove("open");
  }

  function openNav() {
    nav.classList.add("open");
    overlay.classList.add("open");
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

  document.body.appendChild(toggle);
  document.body.appendChild(overlay);
  document.body.appendChild(nav);
});
