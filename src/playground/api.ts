import type { Exchange } from "../types";

export type TokenCredentials = "correct" | "wrong-secret" | "none";
export type AuthMode = "token" | "none" | "tampered";

async function post<T>(url: string, payload: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as T;
}

/** POST /oauth/token, sent by Ministry A's backend (which holds the secret). */
export const requestToken = (scope: string, credentials: TokenCredentials) =>
  post<Exchange>("/api/playground/token", { scope, credentials });

/** One GET to the Partner API, sent by Ministry A's backend with the chosen token. */
export const sendRequest = (path: string, auth: AuthMode, token: string | null) =>
  post<Exchange>("/api/playground/send", { path, auth, token });

export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
}

/** Reads a JWT's header and payload. Reading is not verifying: anyone can do this. */
export function decodeJwt(token: string): DecodedJwt | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const part = (s: string) => {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))));
  };
  try {
    return { header: part(parts[0]), payload: part(parts[1]), signature: parts[2] };
  } catch {
    return null;
  }
}

/** The same request as a curl command, with the token left as a variable. */
export function curlFor(baseUrl: string, path: string, auth: AuthMode) {
  const lines = [`curl "${baseUrl}${path}"`];
  if (auth !== "none") lines.push(`  -H "Authorization: Bearer $ACCESS_TOKEN"`);
  return lines.join(" \\\n");
}

export const TOKEN_CURL = (baseUrl: string, scope: string) =>
  [
    `curl -X POST "${baseUrl}/oauth/token" \\`,
    `  -u "$ODSC_CLIENT_ID:$ODSC_CLIENT_SECRET" \\`,
    `  -H "Content-Type: application/x-www-form-urlencoded" \\`,
    `  -d "grant_type=client_credentials${scope ? `&scope=${scope}` : ""}"`,
  ].join("\n");

export const statusClass = (status: number) =>
  status < 300 ? "ok" : status < 500 ? "warn" : "bad";
