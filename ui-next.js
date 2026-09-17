(() => {
  const page = document.body?.dataset?.page || "";

  function setupReminderDesk() {
    const container = document.querySelector("body[data-page='home'] .container");
    const wizardShell = document.querySelector("body[data-page='home'] .wizard-shell");
    const reviewStep = document.querySelector(".wizard-step[data-field='consent']");

    if (!container || !wizardShell || !reviewStep || container.dataset.nextUiReady === "true") return;
    container.dataset.nextUiReady = "true";

    const header = document.createElement("header");
    header.className = "quick-reminder-header";
    header.innerHTML = `
      <div>
        <span class="quick-reminder-kicker">New reminder</span>
        <h1>Set the appointment. We’ll handle the message.</h1>
        <p>Everything your client will receive, in one place.</p>
      </div>
      <span class="quick-reminder-draft-state">Draft stays on this device</span>
    `;
    container.insertBefore(header, wizardShell);

    const form = document.createElement("section");
    form.className = "quick-entry-form";
    form.setAttribute("aria-label", "Appointment details");
    wizardShell.insertBefore(form, reviewStep);

    const rail = document.createElement("aside");
    rail.className = "quick-reminder-rail";
    rail.innerHTML = `
      <div>
        <h2>Ready when you are</h2>
        <p>Review the exact email, timing, and recipient before anything is sent.</p>
      </div>
      <div class="quick-reminder-summary" aria-live="polite">
        <div class="quick-reminder-summary-row"><span>Client</span><strong data-quick-summary="client">Not added</strong></div>
        <div class="quick-reminder-summary-row"><span>When</span><strong data-quick-summary="when">Not scheduled</strong></div>
        <div class="quick-reminder-summary-row"><span>Send to</span><strong data-quick-summary="recipient">No email yet</strong></div>
      </div>
      <button class="quick-review-button" type="button">Review reminder</button>
      <span class="quick-reminder-shortcut">Nothing sends until you confirm</span>
    `;
    wizardShell.appendChild(rail);

    const back = document.createElement("button");
    back.className = "quick-review-back";
    back.type = "button";
    back.textContent = "Back to appointment";
    reviewStep.querySelector(".review-stack")?.prepend(back);

    const mobileReview = document.createElement("button");
    mobileReview.className = "quick-mobile-review";
    mobileReview.type = "button";
    mobileReview.textContent = "Review reminder";
    document.body.appendChild(mobileReview);

    const regroupSteps = () => {
      document.querySelectorAll(".wizard-step").forEach(step => {
        if (step === reviewStep || step.dataset.stepKind === "welcome" || step.dataset.stepKind === "thank-you") return;
        if (step.parentElement !== form) form.appendChild(step);
      });
    };

    const updateSummary = () => {
      const name = document.getElementById("name")?.value.trim() || "Not added";
      const email = document.getElementById("email")?.value.trim() || "No email yet";
      const date = document.getElementById("date")?.value || "";
      const time = document.getElementById("time")?.value || "";
      let when = "Not scheduled";

      if (date) {
        const parsed = new Date(`${date}T12:00:00`);
        when = Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        if (time) {
          const [hours, minutes] = time.split(":").map(Number);
          const timeDate = new Date(2000, 0, 1, hours, minutes);
          when += ` at ${timeDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
        }
      }

      const values = { client: name, recipient: email, when };
      Object.entries(values).forEach(([key, value]) => {
        const node = rail.querySelector(`[data-quick-summary='${key}']`);
        if (node) node.textContent = value;
      });
    };

    const goToReview = () => {
      const steps = Array.from(document.querySelectorAll(".wizard-step")).filter(step => !step.hidden);
      const reviewIndex = steps.indexOf(reviewStep);

      if (reviewIndex < 0) return;

      if (typeof window.moveToNextStep === "function") {
        for (let attempt = 0; attempt < steps.length; attempt += 1) {
          const activeBefore = steps.findIndex(step => step.classList.contains("active"));
          if (activeBefore === reviewIndex) break;
          window.moveToNextStep();
          const activeAfter = steps.findIndex(step => step.classList.contains("active"));
          if (activeAfter === activeBefore) {
            steps[activeAfter]?.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
          }
        }
      } else if (typeof window.setStep === "function") {
        window.setStep(reviewIndex, "forward");
      }

      if (reviewStep.classList.contains("active")) window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const goToAppointment = () => {
      const steps = Array.from(document.querySelectorAll(".wizard-step")).filter(step => !step.hidden);
      const firstInputStep = steps.findIndex(step => step.dataset.stepKind !== "welcome" && step !== reviewStep);
      if (firstInputStep >= 0 && typeof window.setStep === "function") window.setStep(firstInputStep, "backward");
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    rail.querySelector(".quick-review-button")?.addEventListener("click", goToReview);
    mobileReview.addEventListener("click", goToReview);
    back.addEventListener("click", goToAppointment);
    wizardShell.addEventListener("input", updateSummary);
    wizardShell.addEventListener("change", updateSummary);
    regroupSteps();
    updateSummary();

    const observer = new MutationObserver(() => {
      regroupSteps();
      updateSummary();
    });
    observer.observe(wizardShell, { childList: true, subtree: false });
  }

  function setupFormEditor() {
    const shell = document.getElementById("signed-in-shell");
    const canvas = document.getElementById("form-creator-canvas");
    const toolbar = document.getElementById("form-preview-mode-toolbar");
    const panel = document.getElementById("form-studio-panel");
    const enabledCard = panel?.querySelector(":scope > .form-enabled-card");
    const actionGroup = panel?.querySelector(":scope > .form-creator-toolbar-actions");

    if (!shell || !canvas || !toolbar || !panel || !enabledCard || !actionGroup || shell.dataset.nextUiReady === "true") return;
    shell.dataset.nextUiReady = "true";

    toolbar.classList.add("fc-next-topbar");
    shell.insertBefore(toolbar, canvas);

    const title = document.createElement("div");
    title.className = "fc-next-title";
    title.innerHTML = `<strong>Form Creator</strong><span>Shape what your team and clients see</span>`;
    toolbar.prepend(title);

    const actions = document.createElement("div");
    actions.className = "fc-next-actions";
    toolbar.appendChild(actions);
    actions.appendChild(enabledCard);

    const resetStack = actionGroup.querySelector(".reset-action-stack");
    const saveButton = actionGroup.querySelector("#save-form-button");
    if (saveButton) {
      saveButton.textContent = "Save changes";
      actions.appendChild(actionGroup);
    }

    if (resetStack) {
      const more = document.createElement("details");
      more.className = "fc-next-more";
      more.innerHTML = `<summary aria-label="More form actions">•••</summary>`;
      more.appendChild(resetStack);
      actions.appendChild(more);
    }

    const panelTitle = panel.querySelector(".floating-panel-title");
    if (panelTitle) panelTitle.textContent = "Pages & fields";

    const toolsButton = document.createElement("button");
    toolsButton.className = "fc-mobile-tools-button";
    toolsButton.type = "button";
    toolsButton.textContent = "Edit form";
    toolsButton.addEventListener("click", () => document.body.classList.add("fc-tools-open"));
    document.body.appendChild(toolsButton);

    panel.querySelector(".floating-panel-head")?.addEventListener("click", event => {
      if (window.matchMedia("(max-width: 900px)").matches && event.target.closest(".floating-panel-head")) {
        document.body.classList.remove("fc-tools-open");
      }
    });

    panel.addEventListener("click", event => event.stopPropagation());
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") document.body.classList.remove("fc-tools-open");
    });

    panel.querySelectorAll(".settings-accordion[open]").forEach((details, index) => {
      if (index > 0) details.removeAttribute("open");
    });
  }

  const init = () => {
    if (page === "home") setupReminderDesk();
    if (page === "form-creator") setupFormEditor();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  window.addEventListener("load", init, { once: true });
})();
