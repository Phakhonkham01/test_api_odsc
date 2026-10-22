/**
 * Ministry A's own backend — the part of a partner's system that talks to the
 * Smart ODSC Partner API. It holds the client secret, so the browser never sees
 * it, and it keeps a token for as long as it is valid instead of asking for a
 * new one on every page view.
 *
 * Endpoints for the site pages:
 *   GET  /api/service-centers        the centre list, as Ministry A's site shows it
 *   GET  /api/catalog/<path>         other Partner API reads (services, types, …)
 *   GET  /api/connection             what happened on the wire, for the demo panel
 *
 * Endpoints for the "ທົດລອງ API" page — a teaching tool, sandbox only:
 *   GET  /api/playground/setup       client_id and a masked secret
 *   POST /api/playground/token       one POST /oauth/token, returned as sent and received
 *   POST /api/playground/send        one request to the Partner API, returned as sent and received
 *
 * The playground hands the access token to the browser so each step can be
 * seen. A real partner keeps it on the server, as the site pages above do.
 *
 * No dependencies: Node 20+ (fetch, --env-file, --watch).
 */
import { createServer } from "node:http";

const PORT = 5181;
const BASE_URL = process.env.ODSC_BASE_URL ?? "http://localhost:4100";
const CLIENT_ID = process.env.ODSC_CLIENT_ID;
const CLIENT_SECRET = process.env.ODSC_CLIENT_SECRET;
/** How long Ministry A keeps a list before asking Smart ODSC again. */
const LIST_CACHE_MS = 60_000;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing ODSC_CLIENT_ID / ODSC_CLIENT_SECRET in .env — see .env.example");
  process.exit(1);
}

/** Everything the demo panel shows. Never contains the secret or the token. */
const trace = {
  token: null, // { requestedAt, expiresAt, scope, status }
  lastCall: null, // { at, method, path, status, requestId, ms, rows }
  listServedFrom: null, // "smart-odsc" | "ministry-cache"
};

let token = { value: null, expiresAt: 0 };
const cache = new Map(); // path → { at, body }

const basicAuth = (id, secret) => `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;

async function getToken() {
  if (token.value && Date.now() < token.expiresAt - 60_000) return token.value;

  const res = await fetch(`${BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuth(CLIENT_ID, CLIENT_SECRET),
    },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "catalog:read" }),
  });
  const body = await res.json();
  trace.token = {
    requestedAt: new Date().toISOString(),
    status: res.status,
    scope: body.scope ?? null,
    expiresAt: res.ok ? new Date(Date.now() + body.expires_in * 1000).toISOString() : null,
    error: res.ok ? null : body.error,
  };
  if (!res.ok) throw new Error(`token: ${body.error} — ${body.error_description}`);

  token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return token.value;
}

async function callPartnerApi(path) {
  const send = async () => {
    const started = Date.now();
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${await getToken()}` },
    });
    trace.lastCall = {
      at: new Date().toISOString(),
      method: "GET",
      path,
      status: res.status,
      requestId: res.headers.get("x-request-id"),
      ms: Date.now() - started,
      rows: null,
    };
    return res;
  };

  let res = await send();
  if (res.status === 401) {
    token = { value: null, expiresAt: 0 }; // rejected: one fresh token, one retry
    res = await send();
  }
  const body = await res.json();
  if (!res.ok) throw new HttpError(res.status, `${res.status} ${body.code} — ${body.detail}`);
  return body;
}

/** A Partner API read, kept for LIST_CACHE_MS so page views don't each reach Smart ODSC. */
async function cachedRead(path) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < LIST_CACHE_MS) {
    trace.listServedFrom = "ministry-cache";
    return hit.body;
  }
  const body = await callPartnerApi(path);
  trace.lastCall.rows = Array.isArray(body.data) ? body.data.length : 1;
  trace.listServedFrom = "smart-odsc";
  cache.set(path, { at: Date.now(), body });
  return body;
}

/** The Partner API reads the site pages may make through /api/catalog. */
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const CATALOG_PATHS = [
  /^service-centers$/,
  new RegExp(`^service-centers/${UUID}$`),
  /^locations\/(provinces|districts)$/,
  /^services$/,
  new RegExp(`^services/${UUID}$`),
  /^service-types$/,
];

// --- Playground ---------------------------------------------------------------

const mask = (s, keep = 10) => (s.length <= keep + 4 ? "••••" : `${s.slice(0, keep)}…${s.slice(-4)}`);
const WRONG_SECRET = "sk_sbx_this-is-not-the-real-secret";
/** Response headers worth showing a developer; the rest are helmet's. */
const SHOWN_HEADERS = ["content-type", "cache-control", "x-request-id", "www-authenticate"];

const pickHeaders = (headers) =>
  Object.fromEntries(SHOWN_HEADERS.filter((h) => headers.has(h)).map((h) => [h, headers.get(h)]));

async function exchange(url, init, shownRequestHeaders) {
  const started = Date.now();
  const res = await fetch(url, init);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return {
    request: {
      method: init.method ?? "GET",
      url,
      headers: shownRequestHeaders,
      body: typeof init.body === "string" ? init.body : (init.body?.toString() ?? null),
    },
    response: { status: res.status, headers: pickHeaders(res.headers), body, bytes: text.length },
    ms: Date.now() - started,
  };
}

/** POST /oauth/token exactly as a partner would send it — or deliberately wrong. */
function playgroundToken({ scope, credentials }) {
  const secret = credentials === "wrong-secret" ? WRONG_SECRET : CLIENT_SECRET;
  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  const shown = { ...headers };
  if (credentials !== "none") {
    headers.Authorization = basicAuth(CLIENT_ID, secret);
    shown.Authorization = `Basic ${mask(headers.Authorization.slice(6), 16)}`;
  }
  const form = new URLSearchParams({ grant_type: "client_credentials" });
  if (scope) form.set("scope", scope);
  return exchange(`${BASE_URL}/oauth/token`, { method: "POST", headers, body: form.toString() }, shown);
}

/** One GET to the Partner API with the token the browser chose. Only Partner API paths. */
function playgroundSend({ path, auth, token: bearer }) {
  if (typeof path !== "string" || !path.startsWith("/")) throw new HttpError(400, "path must start with /");
  const url = new URL(path, BASE_URL);
  const allowed =
    url.origin === new URL(BASE_URL).origin &&
    (url.pathname.startsWith("/partner/v1/") || url.pathname === "/.well-known/jwks.json");
  if (!allowed) throw new HttpError(400, "Only /partner/v1/* and /.well-known/jwks.json can be called here.");

  const headers = {};
  if (auth !== "none" && bearer) {
    // "tampered": one character of the signature changed, as an attacker would.
    const sent =
      auth === "tampered" ? bearer.slice(0, -2) + (bearer.at(-2) === "A" ? "B" : "A") + bearer.at(-1) : bearer;
    headers.Authorization = `Bearer ${sent}`;
  }
  const shown = headers.Authorization ? { Authorization: `Bearer ${mask(headers.Authorization.slice(7), 16)}` } : {};
  return exchange(url.toString(), { method: "GET", headers }, shown);
}

// --- HTTP ---------------------------------------------------------------------

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const send = (res, status, payload) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
};

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 20_000) throw new HttpError(413, "body too large");
  }
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new HttpError(400, "body must be JSON");
  }
}

createServer(async (req, res) => {
  const { pathname, search } = new URL(req.url, "http://localhost");
  try {
    if (req.method === "GET" && pathname === "/api/service-centers") {
      return send(res, 200, await cachedRead("/partner/v1/service-centers?limit=100"));
    }
    if (req.method === "GET" && pathname.startsWith("/api/catalog/")) {
      const rest = pathname.slice("/api/catalog/".length);
      if (!CATALOG_PATHS.some((p) => p.test(rest))) throw new HttpError(404, "not a catalog path");
      return send(res, 200, await cachedRead(`/partner/v1/${rest}${search}`));
    }
    if (req.method === "GET" && pathname === "/api/connection") {
      return send(res, 200, { baseUrl: BASE_URL, clientId: CLIENT_ID, ...trace });
    }

    if (req.method === "GET" && pathname === "/api/playground/setup") {
      const header = basicAuth(CLIENT_ID, CLIENT_SECRET).slice(6);
      return send(res, 200, {
        baseUrl: BASE_URL,
        clientId: CLIENT_ID,
        secretPreview: mask(CLIENT_SECRET),
        secretLength: CLIENT_SECRET.length,
        basicPreview: mask(header, 16),
      });
    }
    if (req.method === "POST" && pathname === "/api/playground/token") {
      return send(res, 200, await playgroundToken(await readJson(req)));
    }
    if (req.method === "POST" && pathname === "/api/playground/send") {
      return send(res, 200, await playgroundSend(await readJson(req)));
    }

    send(res, 404, { error: "not found" });
  } catch (error) {
    if (!(error instanceof HttpError)) console.error(error);
    const status = error instanceof HttpError && error.status < 500 ? error.status : 502;
    send(res, status, { error: error.message });
  }
}).listen(PORT, () => {
  console.log(`Ministry A backend on http://localhost:${PORT} → Partner API ${BASE_URL}`);
});
