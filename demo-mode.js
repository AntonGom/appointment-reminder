(() => {
  const params = new URLSearchParams(window.location.search);

  if (params.get("demo") !== "1") {
    return;
  }

  const STORAGE_KEY = "appointment-reminder:ui-demo-state";
  const DEMO_VERSION = 2;
  const now = new Date();
  const pad = value => String(value).padStart(2, "0");
  const dateKey = offset => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };
  const timestamp = offset => new Date(now.getTime() + offset * 86400000).toISOString();

  function createSeed() {
    const customFormProfile = {
      isEnabled: true,
      formTitle: "Juniper & Co. Appointments",
      backgroundStyle: "solid",
      backgroundSolidColor: "#eef4f2",
      formSurfaceColor: "#ffffff",
      formSurfaceAccentColor: "#f7faf9",
      formTextColor: "#17211e",
      stepNavActiveBackgroundColor: "#dcebe6",
      stepNavActiveTextColor: "#17624a",
      fields: [
        {
          id: "custom_service_type",
          type: "select",
          title: "Service Type",
          clientTitle: "What can we help with?",
          label: "Service Type",
          clientLabel: "Choose a service",
          navLabel: "Service",
          options: ["Initial consultation", "Follow-up", "On-site visit"],
          required: true,
          visibleTo: "both",
          saveTarget: "appointment_details",
          includeInReminder: true
        },
        {
          id: "custom_preparation",
          type: "textarea",
          title: "Preparation Notes",
          clientTitle: "Anything we should prepare for?",
          label: "Preparation Notes",
          clientLabel: "Share anything helpful",
          navLabel: "Prep",
          placeholder: "Access instructions or special requests",
          visibleTo: "both",
          saveTarget: "appointment_notes",
          includeInReminder: true
        }
      ]
    };

    const brandingProfile = {
      brandingEnabled: true,
      businessName: "Juniper & Co.",
      templateStyle: "signature",
      headerLabel: "Appointment Reminder",
      headerColor: "#17624a",
      accentColor: "#17624a",
      buttonColor: "#17624a",
      secondaryColor: "#dcebe6",
      heroGradientColor: "#5f9d88",
      heroGradientStyle: "solid",
      heroTextColor: "#ffffff",
      panelColor: "#f2f8f5",
      detailsColor: "#f2f8f5",
      calendarColor: "#f2f8f5",
      bodyColor: "#ffffff",
      footerColor: "#18332a",
      footerTextColor: "#ffffff",
      contactEmail: "hello@juniper-demo.example",
      contactPhone: "(305) 555-0148",
      greetingTemplate: "Hello {clientName},",
      introTemplate: "A quick reminder that your appointment with Juniper & Co. is coming up.",
      closingTemplate: "Need to make a change? Reply to this email and our team will help.",
      previewFieldSelections: {
        custom_service_type: true,
        custom_preparation: true
      }
    };

    const user = {
      id: "demo_user_juniper",
      email: "owner@juniper-demo.example",
      user_metadata: {
        tier: "bronze",
        branding_profile: brandingProfile,
        custom_form_profile: customFormProfile,
        reminder_preferences: {
          email: ["24-hours", "2-hours"],
          sms: ["2-hours"]
        }
      },
      app_metadata: {}
    };

    const clients = [
      {
        id: "demo_client_ava",
        owner_id: user.id,
        client_name: "Ava Johnson",
        client_email: "ava.johnson@example.com",
        client_phone: "3055550112",
        service_address: "1840 Coral Way, Miami, FL",
        notes: "Prefers email. Parking entrance is on the east side.",
        profile_custom_answers: { custom_service_type: "Follow-up" },
        created_at: timestamp(-42),
        updated_at: timestamp(-2)
      },
      {
        id: "demo_client_marcus",
        owner_id: user.id,
        client_name: "Marcus Lee",
        client_email: "marcus.lee@example.com",
        client_phone: "7865550184",
        service_address: "72 Bayshore Drive, Miami, FL",
        notes: "Call on arrival.",
        profile_custom_answers: { custom_service_type: "On-site visit" },
        created_at: timestamp(-31),
        updated_at: timestamp(-5)
      },
      {
        id: "demo_client_sofia",
        owner_id: user.id,
        client_name: "Sofia Rivera",
        client_email: "sofia.rivera@example.com",
        client_phone: "9545550167",
        service_address: "901 Palm Avenue, Fort Lauderdale, FL",
        notes: "New client from website form.",
        profile_custom_answers: { custom_service_type: "Initial consultation" },
        created_at: timestamp(-12),
        updated_at: timestamp(-1)
      },
      {
        id: "demo_client_noah",
        owner_id: user.id,
        client_name: "Noah Williams",
        client_email: "noah.williams@example.com",
        client_phone: "3055550193",
        service_address: "420 Brickell Avenue, Miami, FL",
        notes: "Imported from Google Calendar.",
        profile_custom_answers: {},
        created_at: timestamp(-8),
        updated_at: timestamp(-3)
      }
    ];

    const appointments = [
      {
        id: "demo_appt_ava",
        owner_id: user.id,
        client_id: "demo_client_ava",
        client_name: "Ava Johnson",
        client_email: "ava.johnson@example.com",
        client_phone: "3055550112",
        service_date: dateKey(1),
        service_time: "10:30",
        service_location: "1840 Coral Way, Miami, FL",
        notes: "Please bring the signed intake form.",
        custom_answers: [
          { id: "custom_service_type", label: "Service Type", value: "Follow-up" },
          { id: "custom_preparation", label: "Preparation Notes", value: "Review the previous service notes." }
        ],
        last_source: "manual",
        created_at: timestamp(-10),
        updated_at: timestamp(-1)
      },
      {
        id: "demo_appt_marcus",
        owner_id: user.id,
        client_id: "demo_client_marcus",
        client_name: "Marcus Lee",
        client_email: "marcus.lee@example.com",
        client_phone: "7865550184",
        service_date: dateKey(4),
        service_time: "14:00",
        service_location: "72 Bayshore Drive, Miami, FL",
        notes: "Call when you arrive at the gate.",
        custom_answers: [{ id: "custom_service_type", label: "Service Type", value: "On-site visit" }],
        last_source: "google_calendar",
        created_at: timestamp(-9),
        updated_at: timestamp(-2)
      },
      {
        id: "demo_appt_sofia",
        owner_id: user.id,
        client_id: "demo_client_sofia",
        client_name: "Sofia Rivera",
        client_email: "sofia.rivera@example.com",
        client_phone: "9545550167",
        service_date: dateKey(9),
        service_time: "09:15",
        service_location: "Juniper Studio, 55 Grove Street",
        notes: "First appointment. Allow an extra 15 minutes.",
        custom_answers: [{ id: "custom_service_type", label: "Service Type", value: "Initial consultation" }],
        last_source: "scheduler_webhook",
        created_at: timestamp(-6),
        updated_at: timestamp(-1)
      },
      {
        id: "demo_appt_noah",
        owner_id: user.id,
        client_id: "demo_client_noah",
        client_name: "Noah Williams",
        client_email: "noah.williams@example.com",
        client_phone: "3055550193",
        service_date: dateKey(-6),
        service_time: "16:30",
        service_location: "420 Brickell Avenue, Miami, FL",
        notes: "Completed appointment imported from Outlook.",
        custom_answers: [{ id: "custom_service_type", label: "Service Type", value: "Follow-up" }],
        last_source: "outlook_calendar",
        created_at: timestamp(-18),
        updated_at: timestamp(-6)
      }
    ];

    const history = [
      {
        id: "demo_history_1",
        owner_id: user.id,
        client_id: "demo_client_ava",
        channel: "email",
        source: "automation",
        status: "delivered",
        event_type: "delivered",
        recipient_email: "ava.johnson@example.com",
        message_preview: "Reminder for your appointment tomorrow at 10:30 AM.",
        sent_at: timestamp(-1),
        occurred_at: timestamp(-1),
        created_at: timestamp(-1)
      },
      {
        id: "demo_history_2",
        owner_id: user.id,
        client_id: "demo_client_marcus",
        channel: "email",
        source: "manual",
        status: "opened",
        event_type: "opened",
        recipient_email: "marcus.lee@example.com",
        message_preview: "Your on-site visit is scheduled for this week.",
        sent_at: timestamp(-3),
        occurred_at: timestamp(-2),
        created_at: timestamp(-3)
      },
      {
        id: "demo_history_3",
        owner_id: user.id,
        client_id: "demo_client_noah",
        channel: "sms",
        source: "automation",
        status: "delivered",
        event_type: "delivered",
        recipient_email: "",
        message_preview: "Juniper & Co.: your appointment starts in 2 hours.",
        sent_at: timestamp(-6),
        occurred_at: timestamp(-6),
        created_at: timestamp(-6)
      }
    ];

    return {
      version: DEMO_VERSION,
      user,
      tables: {
        profiles: [{
          id: user.id,
          email: user.email,
          branding_profile: brandingProfile,
          custom_form_profile: customFormProfile,
          use_custom_form_enabled: true,
          integration_profile: {
            scheduler_name: "Google Calendar",
            sync_enabled: true
          }
        }],
        clients,
        appointments,
        client_reminder_history: history
      }
    };
  }

  function readState() {
    try {
      const state = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
      if (state?.version === DEMO_VERSION) {
        return state;
      }
    } catch (_error) {
      // Reset malformed preview data below.
    }

    const state = createSeed();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  }

  function writeState(state) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }

  window.__APPOINTMENT_REMINDER_DEMO__ = true;
  window.AppointmentReminderDemo = {
    storageKey: STORAGE_KEY,
    readState,
    writeState,
    reset() {
      writeState(createSeed());
    }
  };

  readState();
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const requestUrl = new URL(typeof input === "string" ? input : input.url, window.location.href);
    const method = String(init.method || (typeof input !== "string" && input.method) || "GET").toUpperCase();

    if (requestUrl.origin === window.location.origin && requestUrl.pathname === "/api/public-config") {
      return jsonResponse({
        accountsEnabled: true,
        supabaseUrl: "https://demo.supabase.local",
        supabasePublishableKey: "demo-publishable-key",
        supabaseAnonKey: "demo-anon-key",
        googleCalendarClientId: "",
        googleCalendarEnabled: false,
        outlookCalendarClientId: "",
        outlookCalendarEnabled: false,
        inboundAppointmentEmail: "appointments@demo.example"
      });
    }

    if (requestUrl.origin === window.location.origin && requestUrl.pathname === "/api/runtime-env") {
      return jsonResponse({ environment: "preview", demo: true });
    }

    if (requestUrl.origin === window.location.origin && requestUrl.pathname === "/api/account-data") {
      const state = readState();
      const resource = requestUrl.searchParams.get("resource") || "";
      const tableMap = {
        profile: "profiles",
        clients: "clients",
        appointments: "appointments",
        "calendar-appointments": "appointments",
        history: "client_reminder_history"
      };
      const tableName = tableMap[resource];

      if (!tableName) {
        return jsonResponse({ error: "Unknown demo resource." }, 400);
      }

      if (method === "GET") {
        return jsonResponse({ data: state.tables[tableName] || [] });
      }

      const bodyText = String(init.body || "");
      const body = bodyText ? JSON.parse(bodyText) : {};

      if (resource === "profile") {
        const profile = state.tables.profiles[0] || { id: state.user.id, email: state.user.email };
        Object.assign(profile, body, { id: state.user.id });
        state.tables.profiles = [profile];
        state.user.user_metadata = state.user.user_metadata || {};
        if (body.branding_profile) state.user.user_metadata.branding_profile = body.branding_profile;
        if (body.custom_form_profile) state.user.user_metadata.custom_form_profile = body.custom_form_profile;
        if (body.integration_profile) state.user.user_metadata.integration_profile = body.integration_profile;
        if (typeof body.use_custom_form_enabled === "boolean") {
          state.user.user_metadata.custom_form_profile = {
            ...(state.user.user_metadata.custom_form_profile || {}),
            isEnabled: body.use_custom_form_enabled
          };
          profile.use_custom_form_enabled = body.use_custom_form_enabled;
        }
        writeState(state);
        return jsonResponse({ data: [profile] });
      }

      if (resource === "clients" && body.row) {
        const row = { ...body.row };
        const id = body.id || `demo_client_${Date.now()}`;
        const existingIndex = state.tables.clients.findIndex(entry => entry.id === id);
        const saved = { id, ...row };
        if (existingIndex >= 0) state.tables.clients.splice(existingIndex, 1, saved);
        else state.tables.clients.unshift(saved);
        writeState(state);
        return jsonResponse({ data: [saved] });
      }

      const incomingRows = Array.isArray(body.rows) ? body.rows : [];
      const savedRows = incomingRows.map((row, index) => ({
        id: row.id || `demo_${tableName}_${Date.now()}_${index}`,
        ...row
      }));
      state.tables[tableName] = [...savedRows, ...(state.tables[tableName] || [])];
      writeState(state);
      return jsonResponse({ data: savedRows });
    }

    if (requestUrl.origin === window.location.origin && requestUrl.pathname === "/api/send-email") {
      const body = init.body ? JSON.parse(String(init.body)) : {};
      return jsonResponse({
        success: true,
        messageId: `demo-message-${Date.now()}`,
        demo: true,
        qaEmailDebug: {
          subject: "Demo appointment reminder",
          html: body.html || `<html><body>${body.message || "Demo reminder"}</body></html>`,
          recipient: body.clientEmail || "demo@example.com",
          messageId: `demo-message-${Date.now()}`,
          sentAt: new Date().toISOString()
        }
      });
    }

    return nativeFetch(input, init);
  };

  function preserveDemoNavigation() {
    document.querySelectorAll("a[href]").forEach(anchor => {
      const href = anchor.getAttribute("href") || "";
      if (anchor.hasAttribute("data-demo-exit") || !href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      try {
        const url = new URL(href, window.location.href);
        if (url.origin === window.location.origin && /\.html$/i.test(url.pathname)) {
          url.searchParams.set("demo", "1");
          anchor.href = `${url.pathname}${url.search}${url.hash}`;
        }
      } catch (_error) {
        // Leave malformed or external links untouched.
      }
    });
  }

  function renderDemoBanner() {
    const style = document.createElement("style");
    style.textContent = `
      .ar-demo-banner{position:fixed;right:18px;bottom:18px;z-index:5000;display:flex;align-items:center;gap:10px;max-width:calc(100vw - 36px);padding:9px 10px 9px 13px;border:1px solid rgba(23,98,74,.24);border-radius:8px;background:rgba(244,251,248,.94);color:#173b30;box-shadow:0 12px 32px rgba(15,23,42,.16);backdrop-filter:blur(16px);font:600 12px/1.25 var(--font-sans,"Segoe UI",sans-serif)}
      .ar-demo-banner strong{font-size:12px}.ar-demo-banner span{color:#4b635b;font-weight:500}.ar-demo-banner button,.ar-demo-banner a{min-height:32px;padding:7px 9px;border:1px solid #c8d9d3;border-radius:6px;background:#fff;color:#17624a;font:700 11px/1 var(--font-sans,"Segoe UI",sans-serif);text-decoration:none;cursor:pointer;white-space:nowrap}.ar-demo-banner button:hover,.ar-demo-banner a:hover{background:#e8f3ef}.ar-demo-banner a{display:inline-flex;align-items:center}
      @media(max-width:700px){.ar-demo-banner{left:10px;right:10px;bottom:76px;justify-content:space-between;padding:8px 9px}.ar-demo-banner span{display:none}}
    `;
    document.head.appendChild(style);

    const banner = document.createElement("aside");
    banner.className = "ar-demo-banner";
    banner.setAttribute("aria-label", "Demo preview controls");
    banner.innerHTML = `
      <strong>Demo data</strong>
      <span>Changes stay in this browser</span>
      <button type="button" data-demo-reset>Reset</button>
      <a href="index.html" data-demo-exit>Exit</a>
    `;
    banner.querySelector("[data-demo-reset]")?.addEventListener("click", () => {
      window.AppointmentReminderDemo.reset();
      window.location.reload();
    });
    document.body.appendChild(banner);
  }

  document.addEventListener("DOMContentLoaded", () => {
    preserveDemoNavigation();
    renderDemoBanner();
    const observer = new MutationObserver(preserveDemoNavigation);
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
