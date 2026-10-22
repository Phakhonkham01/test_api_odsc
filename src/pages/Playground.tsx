import { useEffect, useMemo, useState } from "react";
import {
  type AuthMode,
  type TokenCredentials,
  TOKEN_CURL,
  curlFor,
  decodeJwt,
  requestToken,
  sendRequest,
  statusClass,
} from "../playground/api";
import { CASES, type Ctx } from "../playground/cases";
import { ENDPOINTS, type Endpoint, buildPath } from "../playground/endpoints";
import type { Exchange, PlaygroundSetup } from "../types";

type Tab = "steps" | "builder" | "runner";

interface Token {
  value: string;
  expiresAt: number;
}

/**
 * A teaching page: how a partner gets a token and calls the Partner API.
 * Requests are sent by Ministry A's backend (it holds the secret); the page
 * shows each one as it went on the wire.
 */
export function PlaygroundPage() {
  const [tab, setTab] = useState<Tab>("steps");
  const [setup, setSetup] = useState<PlaygroundSetup | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [token, setToken] = useState<Token | null>(null);

  useEffect(() => {
    fetch("/api/playground/setup")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
        setSetup(body);
      })
      .catch((e) => setSetupError(e instanceof Error ? e.message : String(e)));
  }, []);

  /** Keeps the token from any successful POST /oauth/token. */
  const takeToken = (x: Exchange) => {
    const body = x.response.body as { access_token?: string; expires_in?: number };
    if (x.response.status === 200 && body.access_token) {
      setToken({ value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 0) * 1000 });
    }
  };

  const quickToken = async () => takeToken(await requestToken("catalog:read", "correct"));

  return (
    <main className="content playground">
      <section className="hero">
        <h1>ທົດລອງ Partner API</h1>
        <p>
          ຮຽນຮູ້ວິທີເຊື່ອມຕໍ່ Smart ODSC ເທື່ອລະຂັ້ນ: ຂໍ token, ອ່ານ token, ແລ້ວເອີ້ນ API — ຄືກັບໃຊ້ Postman ແຕ່ຢູ່ໃນ
          browser.
        </p>
      </section>

      <div className="flow">
        <div className="flow-box">
          <b>browser (ໜ້ານີ້)</b>
          <span>ເລືອກ request ແລະ ເບິ່ງຜົນ</span>
        </div>
        <div className="flow-arrow">→</div>
        <div className="flow-box gold">
          <b>backend ຂອງກະຊວງ ກ</b>
          <span>ເກັບ client_secret · ສົ່ງ request ແທນ</span>
        </div>
        <div className="flow-arrow">→</div>
        <div className="flow-box">
          <b>Smart ODSC Partner API</b>
          <span>{setup?.baseUrl ?? "…"}</span>
        </div>
      </div>
      <p className="flow-note">
        ⚠️ ໜ້ານີ້ສະແດງ access token ໃຫ້ເຫັນເພື່ອການຮຽນຮູ້ (sandbox ເທົ່ານັ້ນ). ລະບົບແທ້ຕ້ອງເກັບ token ໄວ້ທີ່ server
        ຄືກັບໜ້າ "ສູນບໍລິການ" ແລະ "ບໍລິການ".
      </p>

      {setupError && (
        <div className="state error">
          ເຊື່ອມຕໍ່ backend ຂອງກະຊວງ ກ ບໍ່ໄດ້: {setupError}. ກວດວ່າ <code>pnpm dev</code> ເປີດຢູ່.
        </div>
      )}

      <TokenBar token={token} onRefresh={quickToken} onClear={() => setToken(null)} />

      <div className="tabs" role="tablist">
        {(
          [
            ["steps", "① ຂໍ token ເທື່ອລະຂັ້ນ"],
            ["builder", "② ສົ່ງ request (ແບບ Postman)"],
            ["runner", "③ ທົດສອບອັດຕະໂນມັດ"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "tab on" : "tab"} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "steps" && <Steps setup={setup} token={token} onToken={takeToken} goBuilder={() => setTab("builder")} />}
      {tab === "builder" && <Builder setup={setup} token={token} quickToken={quickToken} />}
      {tab === "runner" && <Runner />}
    </main>
  );
}

// --- Token status ----------------------------------------------------------------

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function TokenBar({ token, onRefresh, onClear }: { token: Token | null; onRefresh: () => void; onClear: () => void }) {
  const now = useNow();
  const left = token ? token.expiresAt - now : 0;
  return (
    <div className={`token-bar ${!token ? "none" : left > 0 ? "live" : "expired"}`}>
      <span>
        {!token
          ? "ຍັງບໍ່ມີ access token"
          : left > 0
            ? `✅ ມີ access token · ໃຊ້ໄດ້ອີກ ${mmss(left)} ນາທີ`
            : "⌛ access token ໝົດອາຍຸແລ້ວ — ຂໍໃໝ່"}
      </span>
      <span className="token-actions">
        <button onClick={onRefresh}>{token ? "ຂໍ token ໃໝ່" : "ຂໍ token ດ່ວນ"}</button>
        {token && <button onClick={onClear}>ລ້າງ</button>}
      </span>
    </div>
  );
}

// --- ① Step by step ----------------------------------------------------------------

const CLAIMS: Record<string, string> = {
  alg: "ວິທີເຊັນ: ES256 (ECDSA P-256 + SHA-256)",
  typ: "ຊະນິດ: JWT",
  kid: "ລະຫັດກະແຈທີ່ໃຊ້ເຊັນ — ໃຊ້ຫາ public key ທີ່ກົງກັນໃນ JWKS",
  iss: "ຜູ້ອອກ token (Smart ODSC)",
  aud: "token ນີ້ອອກໃຫ້ໃຊ້ກັບ API ໃດ",
  sub: "ເຈົ້າຂອງ token (client_id)",
  client_id: "client ທີ່ຂໍ token",
  org: "id ຂອງອົງກອນ partner",
  env: "sandbox (ທົດລອງ) ຫຼື live (ຂອງແທ້)",
  scope: "ສິດທີ່ token ນີ້ມີ",
  iat: "ເວລາອອກ token",
  exp: "ເວລາໝົດອາຍຸ — ຫຼັງຈາກນີ້ໄດ້ 401",
  jti: "ລະຫັດຂອງ token ນີ້ (ບໍ່ຊ້ຳກັນ)",
};

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className={`step ${done ? "done" : ""}`}>
      <div className="step-n">{done ? "✓" : n}</div>
      <div className="step-body">
        <h2>{title}</h2>
        {children}
      </div>
    </section>
  );
}

function Steps({
  setup,
  token,
  onToken,
  goBuilder,
}: {
  setup: PlaygroundSetup | null;
  token: Token | null;
  onToken: (x: Exchange) => void;
  goBuilder: () => void;
}) {
  const [scope, setScope] = useState("catalog:read");
  const [credentials, setCredentials] = useState<TokenCredentials>("correct");
  const [tokenX, setTokenX] = useState<Exchange | null>(null);
  const [pingX, setPingX] = useState<Exchange | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const decoded = useMemo(() => (token ? decodeJwt(token.value) : null), [token]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const sendToken = () =>
    run(async () => {
      const x = await requestToken(scope, credentials);
      setTokenX(x);
      onToken(x);
    });

  const ping = () => run(async () => setPingX(await sendRequest("/partner/v1/ping", "token", token?.value ?? null)));

  return (
    <div className="steps-list">
      {error && <div className="state error">{error}</div>}

      <Step n={1} title="ກຽມ credential" done={!!setup}>
        <p>
          ເມື່ອອົງກອນໄດ້ຮັບອະນຸມັດ, ພະນັກງານ ODSC ຈະອອກ <b>client_id</b> ແລະ <b>client_secret</b> ໃຫ້ຄັ້ງດຽວ. ກະຊວງ ກ
          ເກັບມັນໄວ້ໃນໄຟລ໌ <code>.env</code> ຂອງ server — ບໍ່ແມ່ນໃນ browser ຫຼື ແອັບມືຖື.
        </p>
        <dl className="kv">
          <dt>Base URL</dt>
          <dd>
            <code>{setup?.baseUrl ?? "…"}</code>
          </dd>
          <dt>client_id</dt>
          <dd>
            <code>{setup?.clientId ?? "…"}</code> <span className="muted">— ເປີດເຜີຍໄດ້ ຄືຊື່ຜູ້ໃຊ້</span>
          </dd>
          <dt>client_secret</dt>
          <dd>
            <code>{setup?.secretPreview ?? "…"}</code>{" "}
            <span className="muted">— {setup?.secretLength ?? "…"} ຕົວອັກສອນ, ປິດໄວ້. ຄືລະຫັດຜ່ານ</span>
          </dd>
        </dl>
      </Step>

      <Step n={2} title="ສ້າງ header Authorization (HTTP Basic)" done={!!setup}>
        <p>ເອົາ client_id ແລະ client_secret ມາຕໍ່ກັນດ້ວຍ <code>:</code> ແລ້ວແປງເປັນ Base64:</p>
        <pre className="code">
          {`Authorization: Basic base64("${setup?.clientId ?? "client_id"}:${setup?.secretPreview ?? "client_secret"}")\n`}
          {`Authorization: Basic ${setup?.basicPreview ?? "…"}`}
        </pre>
        <p className="muted">
          Base64 ບໍ່ແມ່ນການເຂົ້າລະຫັດ — ໃຜກໍແປງກັບຄືນໄດ້. ສະນັ້ນຕ້ອງສົ່ງຜ່ານ HTTPS ສະເໝີ. ເຄື່ອງມືສ່ວນຫຼາຍເຮັດຂັ້ນນີ້ໃຫ້ເອງ
          (curl <code>-u</code>, Postman ແຖບ Authorization → Basic Auth).
        </p>
      </Step>

      <Step n={3} title="ສົ່ງ POST /oauth/token" done={!!token}>
        <p>ຂໍ access token. ລອງປ່ຽນຕົວເລືອກ ເພື່ອເບິ່ງວ່າເກີດຫຍັງຂຶ້ນເມື່ອຜິດ:</p>
        <div className="controls">
          <label>
            scope
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="catalog:read">catalog:read</option>
              <option value="">(ບໍ່ລະບຸ — ໄດ້ທຸກ scope ທີ່ອະນຸມັດ)</option>
              <option value="catalog:read admin:write">catalog:read admin:write (ບໍ່ໄດ້ອະນຸມັດ)</option>
            </select>
          </label>
          <label>
            credential
            <select value={credentials} onChange={(e) => setCredentials(e.target.value as TokenCredentials)}>
              <option value="correct">ຖືກຕ້ອງ</option>
              <option value="wrong-secret">secret ຜິດ</option>
              <option value="none">ບໍ່ສົ່ງ header Authorization</option>
            </select>
          </label>
          <button className="primary" disabled={busy} onClick={sendToken}>
            {busy ? "ກຳລັງສົ່ງ…" : "ສົ່ງ request"}
          </button>
        </div>
        <details className="curl">
          <summary>ຄຳສັ່ງ curl ທີ່ເທົ່າກັນ</summary>
          <pre className="code">{TOKEN_CURL(setup?.baseUrl ?? "", scope)}</pre>
        </details>
        {tokenX && <ExchangeView x={tokenX} />}
        {tokenX && <TokenResultHelp x={tokenX} />}
      </Step>

      <Step n={4} title="ອ່ານ access token (JWT)" done={!!decoded}>
        {!token || !decoded ? (
          <p className="muted">ເຮັດຂັ້ນຕອນ 3 ໃຫ້ສຳເລັດກ່ອນ.</p>
        ) : (
          <>
            <p>
              Token ມີ 3 ສ່ວນ ຂັ້ນດ້ວຍຈຸດ: <span className="jwt-h">header</span>.<span className="jwt-p">payload</span>.
              <span className="jwt-s">signature</span>
            </p>
            <pre className="code jwt">
              <span className="jwt-h">{token.value.split(".")[0]}</span>.
              <span className="jwt-p">{token.value.split(".")[1]}</span>.
              <span className="jwt-s">{token.value.split(".")[2]}</span>
            </pre>
            <ClaimTable title="Header" data={decoded.header} />
            <ClaimTable title="Payload" data={decoded.payload} />
            <p className="muted">
              ໃຜກໍອ່ານ header ແລະ payload ໄດ້ (ເປັນແຕ່ Base64). ສິ່ງທີ່ປອມບໍ່ໄດ້ຄື <b>signature</b>: ມີແຕ່ Smart ODSC
              ທີ່ມີ private key. ຖ້າແກ້ token ແມ້ຕົວດຽວ ຈະໄດ້ 401 (ລອງໄດ້ໃນ ② ດ້ວຍ "token ຖືກແກ້ໄຂ").
            </p>
          </>
        )}
      </Step>

      <Step n={5} title="ໃຊ້ token ເອີ້ນ API" done={pingX?.response.status === 200}>
        <p>
          ແນບ token ໃນ header <code>Authorization: Bearer &lt;access_token&gt;</code> ທຸກ request. ເລີ່ມດ້ວຍ{" "}
          <code>/partner/v1/ping</code> — endpoint ທີ່ບອກວ່າ token ໃຊ້ໄດ້ບໍ.
        </p>
        <div className="controls">
          <button className="primary" disabled={busy || !token} onClick={ping}>
            GET /partner/v1/ping
          </button>
          {!token && <span className="muted">ຕ້ອງມີ token ກ່ອນ</span>}
        </div>
        {pingX && <ExchangeView x={pingX} />}
        {pingX?.response.status === 200 && (
          <p className="next">
            🎉 ເຊື່ອມຕໍ່ສຳເລັດ. Token ນີ້ໃຊ້ໄດ້ຫຼາຍ request ຈົນໝົດອາຍຸ (ບໍ່ຕ້ອງຂໍໃໝ່ທຸກຄັ້ງ).{" "}
            <button className="link" onClick={goBuilder}>
              ໄປລອງ endpoint ອື່ນໃນ ② →
            </button>
          </p>
        )}
      </Step>
    </div>
  );
}

function TokenResultHelp({ x }: { x: Exchange }) {
  const b = x.response.body as Record<string, unknown>;
  if (x.response.status === 200) {
    return (
      <ul className="help">
        <li>
          <code>access_token</code> — ບັດຜ່ານ. ແນບໄປກັບທຸກ request
        </li>
        <li>
          <code>token_type</code> — Bearer: ໃຜຖືບັດ ຜູ້ນັ້ນໃຊ້ໄດ້ ສະນັ້ນຢ່າໃຫ້ຫຼຸດ
        </li>
        <li>
          <code>expires_in</code> — {String(b.expires_in)} ວິນາທີ. ເກັບ token ໄວ້ໃຊ້ຊ້ຳ ແລະ ຂໍໃໝ່ກ່ອນໝົດອາຍຸປະມານ 1 ນາທີ
        </li>
        <li>
          <code>scope</code> — ສິດທີ່ໄດ້ຈິງ
        </li>
      </ul>
    );
  }
  const why: Record<string, string> = {
    invalid_client: "client_id ຫຼື secret ບໍ່ຖືກ, ຫຼື client ຖືກຖອນສິດ. ຢ່າລອງຄືນອັດຕະໂນມັດ — ກວດ credential.",
    invalid_scope: "ຂໍ scope ທີ່ບໍ່ໄດ້ອະນຸມັດ. ເອົາ scope ນັ້ນອອກ ຫຼື ຂໍອະນຸມັດຈາກ ODSC.",
    invalid_request: "request ຜິດຮູບແບບ ເຊັ່ນ Content-Type ບໍ່ແມ່ນ application/x-www-form-urlencoded.",
  };
  return <p className="help bad">{why[String(b.error)] ?? "ເບິ່ງ error_description."}</p>;
}

function ClaimTable({ title, data }: { title: string; data: Record<string, unknown> }) {
  return (
    <table className="claims">
      <caption>{title}</caption>
      <tbody>
        {Object.entries(data).map(([k, v]) => (
          <tr key={k}>
            <th>
              <code>{k}</code>
            </th>
            <td>
              <code>{JSON.stringify(v)}</code>
              {(k === "iat" || k === "exp") && typeof v === "number" && (
                <span className="muted"> = {new Date(v * 1000).toLocaleString("lo-LA")}</span>
              )}
            </td>
            <td className="muted">{CLAIMS[k] ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// --- Exchange view --------------------------------------------------------------

function ExchangeView({ x, tabs = false }: { x: Exchange; tabs?: boolean }) {
  const [view, setView] = useState<"body" | "headers" | "request">("body");
  const url = new URL(x.request.url);
  const request = [
    `${x.request.method} ${url.pathname}${url.search} HTTP/1.1`,
    `Host: ${url.host}`,
    ...Object.entries(x.request.headers).map(([k, v]) => `${k}: ${v}`),
    ...(x.request.body ? ["", x.request.body] : []),
  ].join("\n");
  const body = typeof x.response.body === "string" ? x.response.body : JSON.stringify(x.response.body, null, 2);
  const headers = Object.entries(x.response.headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  if (!tabs) {
    return (
      <div className="exchange">
        <div>
          <div className="ex-label">Request ທີ່ສົ່ງໄປ</div>
          <pre className="code">{request}</pre>
        </div>
        <div>
          <div className="ex-label">
            Response <span className={`status ${statusClass(x.response.status)}`}>{x.response.status}</span>{" "}
            <span className="muted">{x.ms} ms</span>
          </div>
          <pre className="code">{`${headers}\n\n${body}`}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="response">
      <div className="response-head">
        <span className={`status ${statusClass(x.response.status)}`}>{x.response.status}</span>
        <span className="muted">
          {x.ms} ms · {(x.response.bytes / 1024).toFixed(1)} KB
        </span>
        {x.response.headers["x-request-id"] && (
          <span className="muted">
            X-Request-Id <code>{x.response.headers["x-request-id"]}</code>
          </span>
        )}
      </div>
      <div className="subtabs">
        {(["body", "headers", "request"] as const).map((v) => (
          <button key={v} className={view === v ? "on" : ""} onClick={() => setView(v)}>
            {v === "body" ? "Body" : v === "headers" ? "Headers" : "Request"}
          </button>
        ))}
      </div>
      <pre className="code tall">{view === "body" ? body : view === "headers" ? headers : request}</pre>
    </div>
  );
}

// --- ② Request builder ----------------------------------------------------------

interface HistoryItem {
  id: number;
  path: string;
  auth: AuthMode;
  x: Exchange;
}

function Builder({
  setup,
  token,
  quickToken,
}: {
  setup: PlaygroundSetup | null;
  token: Token | null;
  quickToken: () => Promise<void>;
}) {
  const [endpoint, setEndpoint] = useState<Endpoint>(ENDPOINTS[0]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [id, setId] = useState("");
  const [path, setPath] = useState(ENDPOINTS[0].path);
  const [auth, setAuth] = useState<AuthMode>("token");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [shown, setShown] = useState<HistoryItem | null>(null);
  const [showCurl, setShowCurl] = useState(false);

  const choose = (e: Endpoint) => {
    const initial = Object.fromEntries(e.params.filter((p) => p.example).map((p) => [p.name, p.example!]));
    setEndpoint(e);
    setValues(initial);
    setId(e.idParam?.example ?? "");
    setAuth(e.open ? "none" : "token");
    setPath(buildPath(e, e.idParam?.example ?? "", initial));
    setShown(null);
  };

  const change = (nextValues: Record<string, string>, nextId = id) => {
    setValues(nextValues);
    setId(nextId);
    setPath(buildPath(endpoint, nextId, nextValues));
  };

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const x = await sendRequest(path, auth, token?.value ?? null);
      const item = { id: Date.now(), path, auth, x };
      setShown(item);
      setHistory((h) => [item, ...h].slice(0, 12));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const groups = [...new Set(ENDPOINTS.map((e) => e.group))];
  const needsToken = auth !== "none" && !token;

  return (
    <div className="builder">
      <nav className="collection" aria-label="Endpoint">
        <div className="collection-title">Collection</div>
        {groups.map((g) => (
          <div key={g}>
            <div className="collection-group">{g}</div>
            {ENDPOINTS.filter((e) => e.group === g).map((e) => (
              <button key={e.id} className={endpoint.id === e.id ? "ep on" : "ep"} onClick={() => choose(e)}>
                <span className="method">GET</span> {e.title}
              </button>
            ))}
          </div>
        ))}
        {history.length > 0 && (
          <>
            <div className="collection-title">ປະຫວັດ</div>
            {history.map((h) => (
              <button key={h.id} className={shown?.id === h.id ? "ep on" : "ep"} onClick={() => setShown(h)}>
                <span className={`status small ${statusClass(h.x.response.status)}`}>{h.x.response.status}</span>{" "}
                <span className="hist-path">{h.path.replace("/partner/v1", "")}</span>
              </button>
            ))}
          </>
        )}
      </nav>

      <div className="builder-main">
        <div className="urlbar">
          <span className="method big">GET</span>
          <span className="base">{setup?.baseUrl}</span>
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void send()}
            spellCheck={false}
            aria-label="path"
          />
          <button className="primary" disabled={busy} onClick={() => void send()}>
            {busy ? "…" : "Send"}
          </button>
        </div>
        <p className="muted ep-note">{endpoint.note}</p>

        {(endpoint.idParam || endpoint.params.length > 0) && (
          <table className="params">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>ຄ່າ</th>
                <th>ຄວາມໝາຍ</th>
              </tr>
            </thead>
            <tbody>
              {endpoint.idParam && (
                <tr>
                  <td>
                    <code>{"{id}"}</code>
                  </td>
                  <td>
                    <input value={id} onChange={(e) => change(values, e.target.value)} spellCheck={false} />
                  </td>
                  <td className="muted">{endpoint.idParam.hint} (ໃນ path)</td>
                </tr>
              )}
              {endpoint.params.map((p) => (
                <tr key={p.name}>
                  <td>
                    <code>{p.name}</code>
                  </td>
                  <td>
                    {p.options ? (
                      <select
                        value={values[p.name] ?? ""}
                        onChange={(e) => change({ ...values, [p.name]: e.target.value })}
                      >
                        <option value="">—</option>
                        {p.options.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={values[p.name] ?? ""}
                        onChange={(e) => change({ ...values, [p.name]: e.target.value })}
                        spellCheck={false}
                      />
                    )}
                  </td>
                  <td className="muted">{p.hint}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="controls">
          <label>
            Authorization
            <select value={auth} onChange={(e) => setAuth(e.target.value as AuthMode)}>
              <option value="token">Bearer token (ຈາກ ①)</option>
              <option value="none">ບໍ່ສົ່ງ token</option>
              <option value="tampered">token ຖືກແກ້ໄຂ 1 ຕົວ (ທົດສອບ 401)</option>
            </select>
          </label>
          <button className="link" onClick={() => setShowCurl((v) => !v)}>
            {showCurl ? "ເຊື່ອງ curl" : "ເບິ່ງເປັນ curl"}
          </button>
        </div>
        {needsToken && (
          <div className="state warn">
            ຍັງບໍ່ມີ token — request ຈະໄດ້ 401.{" "}
            <button className="link" onClick={() => void quickToken()}>
              ຂໍ token ດຽວນີ້
            </button>
          </div>
        )}
        {showCurl && <pre className="code">{curlFor(setup?.baseUrl ?? "", path, auth)}</pre>}
        {error && <div className="state error">{error}</div>}

        {shown ? (
          <ExchangeView x={shown.x} tabs />
        ) : (
          <div className="empty">ກົດ Send ເພື່ອເບິ່ງ response</div>
        )}
      </div>
    </div>
  );
}

// --- ③ Runner ------------------------------------------------------------------

interface Result {
  status: number | null;
  ms: number;
  pass: boolean;
  reason: string | null;
  x: Exchange | null;
}

function Runner() {
  const [results, setResults] = useState<(Result | null)[]>([]);
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  const runAll = async () => {
    setRunning(true);
    setOpen(null);
    const ctx: Ctx = { token: null };
    const out: (Result | null)[] = CASES.map(() => null);
    setResults([...out]);
    for (const [i, c] of CASES.entries()) {
      try {
        const x = await c.run(ctx);
        const statusOk = x.response.status === c.expect;
        const reason = statusOk ? (c.check?.(x.response.body) ?? null) : `ຄາດວ່າ ${c.expect}`;
        out[i] = { status: x.response.status, ms: x.ms, pass: statusOk && !reason, reason, x };
      } catch (e) {
        out[i] = { status: null, ms: 0, pass: false, reason: e instanceof Error ? e.message : String(e), x: null };
      }
      setResults([...out]);
    }
    setRunning(false);
  };

  const done = results.filter(Boolean) as Result[];
  const passed = done.filter((r) => r.pass).length;

  return (
    <div className="runner">
      <p>
        ແລ່ນ {CASES.length} ກໍລະນີຕໍ່ກັນ ຄືກັບ Collection Runner ຂອງ Postman: ທັງກໍລະນີທີ່ຖືກ ແລະ ກໍລະນີຜິດທີ່ partner
        ຕ້ອງຮັບມືໃຫ້ໄດ້. ແຕ່ລະກໍລະນີກວດ HTTP status ແລະ ເນື້ອໃນ.
      </p>
      <div className="controls">
        <button className="primary" disabled={running} onClick={() => void runAll()}>
          {running ? "ກຳລັງແລ່ນ…" : "▶ ແລ່ນທັງໝົດ"}
        </button>
        {done.length > 0 && (
          <span className={`summary ${passed === CASES.length ? "ok" : running ? "" : "bad"}`}>
            ຜ່ານ {passed}/{CASES.length}
          </span>
        )}
      </div>
      <table className="runs">
        <thead>
          <tr>
            <th>#</th>
            <th>ກໍລະນີ</th>
            <th>ຄາດວ່າ</th>
            <th>ໄດ້</th>
            <th>ເວລາ</th>
            <th>ຜົນ</th>
          </tr>
        </thead>
        <tbody>
          {CASES.map((c, i) => {
            const r = results[i];
            return (
              <tr key={c.name} className={r?.x ? "clickable" : ""} onClick={() => r?.x && setOpen(open === i ? null : i)}>
                <td>{i + 1}</td>
                <td>
                  {c.name}
                  {open === i && r?.x && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <ExchangeView x={r.x} />
                    </div>
                  )}
                </td>
                <td>{c.expect}</td>
                <td>{r?.status != null ? <span className={`status small ${statusClass(r.status)}`}>{r.status}</span> : "—"}</td>
                <td className="muted">{r ? `${r.ms} ms` : ""}</td>
                <td>{!r ? (running ? "…" : "") : r.pass ? "✅" : `❌ ${r.reason ?? ""}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted">ກົດແຖວໃດໜຶ່ງ ເພື່ອເບິ່ງ request ແລະ response ຂອງມັນ.</p>
    </div>
  );
}
