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
  if (req.method !== "GET") {
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
    let data = [];

    if (resource === "clients") {
      data = await loadClients(config);
    } else if (resource === "appointments") {
      data = await loadAppointments(config, ownerId);
    } else if (resource === "calendar-appointments") {
      data = await loadCalendarAppointments(config, ownerId);
    } else if (resource === "history") {
      data = await loadHistory(config, ownerId);
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
