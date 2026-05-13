import dns from "node:dns/promises";
import net from "node:net";

const REQUEST_TIMEOUT_MS = 9000;
const MAX_FEED_BYTES = 1024 * 1024;
const MAX_REDIRECTS = 3;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  const token = getBearerToken(req);

  if (!token) {
    return sendJson(res, 401, { error: "Missing account session." });
  }

  try {
    await validateAccountSession(token);
    const sourceUrl = await normalizeAndValidateFeedUrl(req.body?.url);
    const text = await fetchCalendarFeed(sourceUrl);

    return sendJson(res, 200, {
      sourceUrl,
      text
    });
  } catch (error) {
    return sendJson(res, error.status || 500, {
      error: error.message || "Unable to read that calendar link."
    });
  }
}

function sendJson(res, statusCode, payload) {
  res.setHeader("Cache-Control", "no-store");
  res.status(statusCode).json(payload);
}

function getBearerToken(req) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
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
      const timeoutError = new Error("Calendar link request timed out.");
      timeoutError.status = 504;
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function validateAccountSession(token) {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !publicKey) {
    const error = new Error("Supabase is not configured.");
    error.status = 500;
    throw error;
  }

  const response = await fetchWithTimeout(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: publicKey,
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const error = new Error("Account session is no longer valid.");
    error.status = 401;
    throw error;
  }
}

async function normalizeAndValidateFeedUrl(rawValue) {
  const rawText = String(rawValue || "").trim();

  if (!rawText) {
    const error = new Error("Paste a webcal or .ics calendar link first.");
    error.status = 400;
    throw error;
  }

  const normalizedText = rawText.replace(/^webcal:\/\//i, "https://");
  let url = null;

  try {
    url = new URL(normalizedText);
  } catch (_error) {
    const error = new Error("That calendar link is not a valid URL.");
    error.status = 400;
    throw error;
  }

  if (url.protocol !== "https:") {
    const error = new Error("Calendar links must use https or webcal.");
    error.status = 400;
    throw error;
  }

  if (url.username || url.password) {
    const error = new Error("Calendar links cannot include usernames or passwords.");
    error.status = 400;
    throw error;
  }

  await assertPublicHostname(url.hostname);
  return url.toString();
}

async function assertPublicHostname(hostname) {
  const lowerHostname = String(hostname || "").trim().toLowerCase();

  if (!lowerHostname || lowerHostname === "localhost" || lowerHostname.endsWith(".localhost")) {
    const error = new Error("Calendar links must point to a public calendar feed.");
    error.status = 400;
    throw error;
  }

  let records = [];

  try {
    records = await dns.lookup(lowerHostname, { all: true });
  } catch (_error) {
    const error = new Error("That calendar link host could not be verified.");
    error.status = 400;
    throw error;
  }

  if (!records.length || records.some(record => isPrivateAddress(record.address))) {
    const error = new Error("Calendar links must point to a public calendar feed.");
    error.status = 400;
    throw error;
  }
}

function isPrivateAddress(address) {
  if (!address) {
    return true;
  }

  if (net.isIPv4(address)) {
    const parts = address.split(".").map(part => Number(part));
    const [first, second] = parts;

    return first === 0
      || first === 10
      || first === 127
      || (first === 169 && second === 254)
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168);
  }

  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return normalized === "::1"
      || normalized.startsWith("fc")
      || normalized.startsWith("fd")
      || normalized.startsWith("fe80:");
  }

  return true;
}

async function fetchCalendarFeed(sourceUrl, redirectCount = 0) {
  if (redirectCount > MAX_REDIRECTS) {
    const error = new Error("That calendar link redirected too many times.");
    error.status = 400;
    throw error;
  }

  const response = await fetchWithTimeout(sourceUrl, {
    redirect: "manual",
    headers: {
      Accept: "text/calendar,text/plain,*/*",
      "User-Agent": "AppointmentReminderCalendarSync/1.0"
    }
  });

  if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
    const redirectUrl = new URL(response.headers.get("location"), sourceUrl).toString();
    const validatedRedirectUrl = await normalizeAndValidateFeedUrl(redirectUrl);
    return fetchCalendarFeed(validatedRedirectUrl, redirectCount + 1);
  }

  if (!response.ok) {
    const error = new Error("That calendar link could not be opened.");
    error.status = response.status;
    throw error;
  }

  const contentLength = Number(response.headers.get("content-length") || "0");

  if (contentLength > MAX_FEED_BYTES) {
    const error = new Error("That calendar feed is too large to import.");
    error.status = 413;
    throw error;
  }

  const text = await response.text();

  if (text.length > MAX_FEED_BYTES) {
    const error = new Error("That calendar feed is too large to import.");
    error.status = 413;
    throw error;
  }

  return text;
}
