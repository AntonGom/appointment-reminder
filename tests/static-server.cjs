const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 4173);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || "application/octet-stream";

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Unable to read file.");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store"
    });
    response.end(contents);
  });
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
  const pathname = decodeURIComponent(requestUrl.pathname);

  if (pathname === "/api/public-config") {
    sendJson(response, 200, {
      accountsEnabled: false,
      supabaseUrl: "",
      supabaseAnonKey: "",
      supabasePublishableKey: ""
    });
    return;
  }

  if (pathname === "/api/runtime-env") {
    sendJson(response, 200, {
      label: "DEV",
      env: "preview",
      branch: "codex-qa",
      version: "20260429.2",
      commitSha: "testsha"
    });
    return;
  }

  if (pathname === "/api/calendar-ics") {
    response.writeHead(200, {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-store"
    });
    response.end("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n");
    return;
  }

  const relativePath = pathname === "/" ? "/index.html" : pathname;
  const absolutePath = path.resolve(ROOT_DIR, `.${relativePath}`);

  if (!absolutePath.startsWith(ROOT_DIR)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  fs.stat(absolutePath, (error, stats) => {
    if (error || !stats.isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    sendFile(response, absolutePath);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Static test server listening on http://127.0.0.1:${PORT}`);
});
