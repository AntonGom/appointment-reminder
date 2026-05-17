const REQUEST_TIMEOUT_MS = 9000;

function sendJson(res, statusCode, payload) {
  res.setHeader("Cache-Control", "no-store");
  res.status(statusCode).json(payload);
}

function getBearerToken(req) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function isMissingColumnError(payload, columnName) {
  const text = [
    payload?.code,
    payload?.message,
    payload?.details,
    payload?.hint
  ].filter(Boolean).join(" ").toLowerCase();

  return text.includes("42703") || text.includes(String(columnName || "").toLowerCase());
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Account data request timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchRestRows({ supabaseUrl, publicKey, token, table, select, searchParams }) {
  const url = new URL(`/rest/v1/${table}`, supabaseUrl);
  url.searchParams.set("select", select);

  Object.entries(searchParams || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetchWithTimeout(url, {
    headers: {
      apikey: publicKey,
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });

  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch (_error) {
    payload = text;
  }

  if (!response.ok) {
    const error = new Error(typeof payload?.message === "string" ? payload.message : `Unable to load ${table}.`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return Array.isArray(payload) ? payload : [];
}

async function insertRestRows({ supabaseUrl, publicKey, token, table, rows }) {
  const url = new URL(`/rest/v1/${table}`, supabaseUrl);
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      apikey: publicKey,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(Array.isArray(rows) ? rows : [rows])
  });
  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch (_error) {
    payload = text;
  }

  if (!response.ok) {
    const error = new Error(typeof payload?.message === "string" ? payload.message : `Unable to save ${table}.`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return Array.isArray(payload) ? payload : [];
}

async function updateRestRows({ supabaseUrl, publicKey, token, table, row, searchParams }) {
  const url = new URL(`/rest/v1/${table}`, supabaseUrl);

  Object.entries(searchParams || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetchWithTimeout(url, {
    method: "PATCH",
    headers: {
      apikey: publicKey,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(row)
  });
  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch (_error) {
    payload = text;
  }

  if (!response.ok) {
    const error = new Error(typeof payload?.message === "string" ? payload.message : `Unable to update ${table}.`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return Array.isArray(payload) ? payload : [];
}

async function upsertRestRows({ supabaseUrl, publicKey, token, table, rows, onConflict = "id" }) {
  const url = new URL(`/rest/v1/${table}`, supabaseUrl);
  if (onConflict) {
    url.searchParams.set("on_conflict", onConflict);
  }

  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      apikey: publicKey,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(Array.isArray(rows) ? rows : [rows])
  });
  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch (_error) {
    payload = text;
  }

  if (!response.ok) {
    const error = new Error(typeof payload?.message === "string" ? payload.message : `Unable to save ${table}.`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return Array.isArray(payload) ? payload : [];
}

async function loadProfile(config, ownerId) {
  if (!ownerId) {
    return [];
  }

  const searchParams = {
    id: `eq.${ownerId}`,
    limit: "1"
  };

  try {
    return await fetchRestRows({
      ...config,
      table: "profiles",
      select: "id,email,tier,custom_form_profile,branding_profile,use_custom_form_enabled,updated_at",
      searchParams
    });
  } catch (error) {
    if (error.payload?.code === "42P01") {
      return [];
    }

    if (isMissingColumnError(error.payload, "use_custom_form_enabled")) {
      return fetchRestRows({
        ...config,
        table: "profiles",
        select: "id,email,tier,custom_form_profile,branding_profile,updated_at",
        searchParams
      }).catch(fallbackError => {
        if (fallbackError.payload?.code === "42P01"
          || isMissingColumnError(fallbackError.payload, "custom_form_profile")
          || isMissingColumnError(fallbackError.payload, "branding_profile")) {
          return [];
        }

        throw fallbackError;
      });
    }

    if (isMissingColumnError(error.payload, "custom_form_profile")
      || isMissingColumnError(error.payload, "branding_profile")) {
      return [];
    }

    throw error;
  }
}

function normalizeProfilePayload(body, ownerId) {
  const source = body && typeof body === "object" ? body : {};
  const row = {
    id: ownerId,
    updated_at: new Date().toISOString()
  };

  if (typeof source.email === "string") {
    row.email = source.email.slice(0, 320);
  }

  if (source.custom_form_profile && typeof source.custom_form_profile === "object") {
    row.custom_form_profile = source.custom_form_profile;
  }

  if (source.branding_profile && typeof source.branding_profile === "object") {
    row.branding_profile = source.branding_profile;
  }

  if (typeof source.use_custom_form_enabled === "boolean") {
    row.use_custom_form_enabled = source.use_custom_form_enabled;
  }

  return row;
}

async function saveProfile(config, ownerId, body) {
  if (!ownerId) {
    const error = new Error("Missing account owner.");
    error.status = 400;
    throw error;
  }

  const row = normalizeProfilePayload(body, ownerId);

  if (!row.custom_form_profile && !row.branding_profile && typeof row.use_custom_form_enabled !== "boolean" && !row.email) {
    const error = new Error("No profile settings were provided.");
    error.status = 400;
    throw error;
  }

  return upsertRestRows({
    ...config,
    table: "profiles",
    rows: row,
    onConflict: "id"
  });
}

async function loadClients(config) {
  const fallbackSelect = "id,client_name,client_email,client_phone,service_address,notes,created_at,updated_at";
  const primarySelect = `${fallbackSelect},profile_custom_answers`;
  const searchParams = {
    order: "created_at.desc"
  };

  try {
    return await fetchRestRows({
      ...config,
      table: "clients",
      select: primarySelect,
      searchParams
    });
  } catch (error) {
    if (!isMissingColumnError(error.payload, "profile_custom_answers")) {
      throw error;
    }

    return fetchRestRows({
      ...config,
      table: "clients",
      select: fallbackSelect,
      searchParams
    });
  }
}

function normalizeClientPayload(body, ownerId) {
  const source = body && typeof body === "object" ? body : {};
  const row = {
    owner_id: ownerId,
    updated_at: new Date().toISOString()
  };

  if (typeof source.client_name === "string") {
    row.client_name = source.client_name.trim().slice(0, 30);
  }

  if (typeof source.client_email === "string") {
    row.client_email = source.client_email.trim().slice(0, 320);
  }

  if (typeof source.client_phone === "string") {
    row.client_phone = source.client_phone.trim().slice(0, 30);
  }

  if (typeof source.service_address === "string") {
    row.service_address = source.service_address.trim().slice(0, 160);
  }

  if (typeof source.notes === "string") {
    row.notes = source.notes.trim().slice(0, 1200);
  }

  if (source.profile_custom_answers && typeof source.profile_custom_answers === "object") {
    row.profile_custom_answers = source.profile_custom_answers;
  }

  return row;
}

async function saveClient(config, ownerId, body) {
  if (!ownerId) {
    const error = new Error("Missing account owner.");
    error.status = 400;
    throw error;
  }

  const source = body && typeof body === "object" ? body : {};
  const row = normalizeClientPayload(source.row || source, ownerId);
  const clientId = String(source.id || source.clientId || "").trim();

  if (!row.client_name && !row.client_email && !row.client_phone) {
    const error = new Error("Add at least a client name, email, or phone number before saving.");
    error.status = 400;
    throw error;
  }

  const saveWithProfileAnswers = () => clientId
    ? updateRestRows({
        ...config,
        table: "clients",
        row,
        searchParams: {
          id: `eq.${clientId}`,
          owner_id: `eq.${ownerId}`
        }
      })
    : insertRestRows({
        ...config,
        table: "clients",
        rows: row
      });

  try {
    return await saveWithProfileAnswers();
  } catch (error) {
    if (!isMissingColumnError(error.payload, "profile_custom_answers")) {
      throw error;
    }

    const { profile_custom_answers, ...fallbackRow } = row;
    return clientId
      ? updateRestRows({
          ...config,
          table: "clients",
          row: fallbackRow,
          searchParams: {
            id: `eq.${clientId}`,
            owner_id: `eq.${ownerId}`
          }
        })
      : insertRestRows({
          ...config,
          table: "clients",
          rows: fallbackRow
        });
  }
}

async function loadAppointments(config, ownerId) {
  const fallbackSelect = "id,client_id,client_name,client_email,client_phone,service_date,service_time,service_location,notes,last_channel,last_source,created_at,updated_at";
  const primarySelect = `${fallbackSelect},custom_answers`;
  const searchParams = {
    owner_id: ownerId ? `eq.${ownerId}` : "",
    order: "updated_at.desc",
    limit: "500"
  };

  try {
    return await fetchRestRows({
      ...config,
      table: "appointments",
      select: primarySelect,
      searchParams
    });
  } catch (error) {
    if (error.payload?.code === "42P01") {
      return [];
    }

    if (!isMissingColumnError(error.payload, "custom_answers")) {
      throw error;
    }

    return fetchRestRows({
      ...config,
      table: "appointments",
      select: fallbackSelect,
      searchParams
    });
  }
}

async function loadCalendarAppointments(config, ownerId) {
  return fetchRestRows({
    ...config,
    table: "appointments",
    select: "id,client_id,client_name,client_email,client_phone,service_date,service_time,service_location,notes,last_channel,last_source,created_at,updated_at",
    searchParams: {
      owner_id: ownerId ? `eq.${ownerId}` : "",
      order: "service_date.asc,service_time.asc"
    }
  }).catch(error => {
    if (error.payload?.code === "42P01") {
      return [];
    }

    throw error;
  });
}

async function loadHistory(config, ownerId) {
  return fetchRestRows({
    ...config,
    table: "client_reminder_history",
    select: "id,client_id,channel,source,message_id,recipient_email,event_type,status,occurred_at,sent_at,created_at,message_preview",
    searchParams: {
      owner_id: ownerId ? `eq.${ownerId}` : "",
      order: "sent_at.desc",
      limit: "500"
    }
  }).catch(error => {
    if (error.payload?.code === "42P01") {
      return [];
    }

    throw error;
  });
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || "";
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";
  const token = getBearerToken(req);
  const resource = String(req.query.resource || "").trim();
  const ownerId = String(req.query.ownerId || "").trim();

  if (!supabaseUrl || !publicKey) {
    sendJson(res, 500, { error: "Supabase is not configured." });
    return;
  }

  if (!token) {
    sendJson(res, 401, { error: "Missing account session." });
    return;
  }

  const config = {
    supabaseUrl,
    publicKey,
    token
  };

  try {
    if (req.method === "POST") {
      if (resource === "profile") {
        const data = await saveProfile(config, ownerId, req.body || {});
        sendJson(res, 200, { data });
        return;
      }

      if (resource === "clients") {
        const data = await saveClient(config, ownerId, req.body || {});
        sendJson(res, 200, { data });
        return;
      }

      if (resource !== "appointments") {
        sendJson(res, 400, { error: "This resource cannot be saved here." });
        return;
      }

      const rows = Array.isArray(req.body?.rows) ? req.body.rows : Array.isArray(req.body) ? req.body : [];

      if (!rows.length) {
        sendJson(res, 400, { error: "No appointment rows were provided." });
        return;
      }

      const data = await insertRestRows({
        ...config,
        table: "appointments",
        rows
      });

      sendJson(res, 200, { data });
      return;
    }

    let data = [];

    if (resource === "clients") {
      data = await loadClients(config);
    } else if (resource === "appointments") {
      data = await loadAppointments(config, ownerId);
    } else if (resource === "calendar-appointments") {
      data = await loadCalendarAppointments(config, ownerId);
    } else if (resource === "history") {
      data = await loadHistory(config, ownerId);
    } else if (resource === "profile") {
      data = await loadProfile(config, ownerId);
    } else {
      sendJson(res, 400, { error: "Unknown account data resource." });
      return;
    }

    sendJson(res, 200, { data });
  } catch (error) {
    sendJson(res, error.status || 500, {
      error: error.message || "Unable to load account data."
    });
  }
}
