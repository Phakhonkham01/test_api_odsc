import { useEffect, useState } from "react";
import type { Connection } from "./types";

const time = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString("lo-LA", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";

/** Bottom-right box: how the page in front of you got its data. */
export function ConnectionPanel() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!open) return;
    const load = () =>
      fetch("/api/connection")
        .then((r) => r.json())
        .then(setConnection)
        .catch(() => setConnection(null));
    void load();
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [open]);

  return (
    <aside className={open ? "panel" : "panel closed"} aria-label="ເບື້ອງຫຼັງການເຊື່ອມຕໍ່">
      <button className="panel-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? "ເຊື່ອງ ▾" : "ເບື້ອງຫຼັງການເຊື່ອມຕໍ່ ▴"}
      </button>
      {open && (
        <div className="panel-body">
          <div className="panel-title">ເບື້ອງຫຼັງການເຊື່ອມຕໍ່ (ສຳລັບສາທິດ)</div>
          <ol className="steps">
            <li>
              <b>ຂໍ token</b> <code>POST /oauth/token</code>
              <div>client_id: <code>{connection?.clientId ?? "—"}</code></div>
              <div>
                ຜົນ: {connection?.token ? `${connection.token.status} · scope ${connection.token.scope ?? "—"}` : "—"}
              </div>
              <div>ໝົດອາຍຸ: {time(connection?.token?.expiresAt)}</div>
            </li>
            <li>
              <b>ເອີ້ນ API</b> <code>{connection?.lastCall?.path ?? "—"}</code>
              <div>
                ຜົນ:{" "}
                {connection?.lastCall
                  ? `${connection.lastCall.status} · ${connection.lastCall.ms} ms · ${connection.lastCall.rows ?? "—"} ແຖວ`
                  : "—"}
              </div>
              <div>X-Request-Id: <code>{connection?.lastCall?.requestId ?? "—"}</code></div>
            </li>
            <li>
              <b>ສະແດງຜົນ</b>
              <div>
                ຂໍ້ມູນລ່າສຸດມາຈາກ:{" "}
                {connection?.listServedFrom === "ministry-cache"
                  ? "cache ຂອງກະຊວງ ກ (ບໍ່ໄດ້ເອີ້ນ Smart ODSC ຊ້ຳ)"
                  : connection?.listServedFrom === "smart-odsc"
                    ? "Smart ODSC Partner API (ດຶງໃໝ່)"
                    : "—"}
              </div>
            </li>
          </ol>
          <p className="panel-note">client_secret ຢູ່ server ຂອງກະຊວງ ກ ເທົ່ານັ້ນ — browser ນີ້ບໍ່ເຄີຍເຫັນມັນ.</p>
        </div>
      )}
    </aside>
  );
}
