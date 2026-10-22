import { useEffect, useMemo, useState } from "react";
import { href } from "../route";
import type { Page, Service, ServiceDetail, ServiceType } from "../types";

const money = (n: number, currency: string) =>
  `${n.toLocaleString("en-US")} ${currency === "LAK" ? "ກີບ" : currency}`;

const fee = (s: Service) => (s.fee.type === "NONE" ? "ບໍ່ເສຍຄ່າ" : money(s.fee.total, s.fee.currency));

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api/catalog/${path}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as T;
}

/**
 * Services, as Ministry A's site would list them. With ?center=… it shows only
 * what one service centre offers (the link on each centre card).
 */
export function ServicesPage({ params }: { params: URLSearchParams }) {
  const center = params.get("center");
  const centerName = params.get("name");

  const [services, setServices] = useState<Page<Service> | null>(null);
  const [types, setTypes] = useState<ServiceType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    setServices(null);
    setError(null);
    const query = new URLSearchParams({ limit: "100", ...(center ? { serviceCenterId: center } : {}) });
    Promise.all([get<Page<Service>>(`services?${query}`), get<{ data: ServiceType[] }>("service-types")])
      .then(([s, t]) => {
        setServices(s);
        setTypes(t.data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [center]);

  const shown = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase();
    return (services?.data ?? []).filter(
      (s) =>
        (!type || s.serviceTypeIds.includes(type)) &&
        (!onlineOnly || s.channels.online) &&
        (!needle ||
          s.name.toLocaleLowerCase().includes(needle) ||
          (s.organization?.name ?? "").toLocaleLowerCase().includes(needle)),
    );
  }, [services, q, type, onlineOnly]);

  return (
    <main className="content">
      <section className="hero">
        <h1>ບໍລິການຂອງລັດ</h1>
        <p>ບໍລິການທີ່ຂໍໄດ້ຜ່ານ Smart ODSC: ຄ່າທຳນຽມ, ໜ່ວຍງານທີ່ຮັບຜິດຊອບ ແລະ ຍື່ນໄດ້ຢູ່ໃສ.</p>
      </section>

      {center && (
        <div className="scope-banner">
          ສະແດງສະເພາະບໍລິການທີ່ <strong>{centerName ?? "ສູນນີ້"}</strong> ໃຫ້
          <a href={href("services")}>ສະແດງທັງໝົດ ✕</a>
        </div>
      )}

      <section className="filters" aria-label="ຕົວກອງ">
        <input
          className="search"
          type="search"
          placeholder="ຄົ້ນຫາຊື່ບໍລິການ ຫຼື ໜ່ວຍງານ…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="chips" role="group" aria-label="ປະເພດ">
          <button className={!type ? "chip on" : "chip"} onClick={() => setType("")}>
            ທຸກປະເພດ
          </button>
          {types
            .filter((t) => t.serviceCount > 0)
            .map((t) => (
              <button key={t.id} className={type === t.id ? "chip on" : "chip"} onClick={() => setType(t.id)}>
                {t.name} ({t.serviceCount})
              </button>
            ))}
          <button className={onlineOnly ? "chip on" : "chip"} onClick={() => setOnlineOnly((v) => !v)}>
            ຍື່ນອອນລາຍໄດ້
          </button>
        </div>
      </section>

      {!services && !error && <p className="state">ກຳລັງໂຫຼດຂໍ້ມູນ…</p>}
      {error && <div className="state error">ໂຫຼດຂໍ້ມູນບໍ່ສຳເລັດ: {error}</div>}

      {services && (
        <>
          <p className="count">
            ພົບ <strong>{shown.length}</strong> ບໍລິການ ຈາກທັງໝົດ {services.page.total}
          </p>
          <ul className="service-list">
            {shown.map((s) => (
              <li key={s.id}>
                <button className="service-row" onClick={() => setOpenId(s.id)}>
                  <span className="service-icon">
                    {s.iconUrl ? <img src={s.iconUrl} alt="" loading="lazy" /> : "ບ"}
                  </span>
                  <span className="service-main">
                    <span className="service-name">{s.name}</span>
                    <span className="service-org">{s.organization?.name ?? "—"}</span>
                  </span>
                  <span className="service-meta">
                    <span className="fee">{fee(s)}</span>
                    <span className="channels">
                      {s.channels.online && <span className="tag online">ອອນລາຍ</span>}
                      {s.channels.serviceCenter && <span className="tag">ທີ່ສູນ</span>}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {openId && <ServiceDrawer id={openId} onClose={() => setOpenId(null)} />}
    </main>
  );
}

function ServiceDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [service, setService] = useState<ServiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    get<{ data: ServiceDetail }>(`services/${id}`)
      .then((r) => setService(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={(e) => e.stopPropagation()} aria-label="ລາຍລະອຽດບໍລິການ">
        <button className="drawer-close" onClick={onClose} aria-label="ປິດ">
          ✕
        </button>
        {error && <p className="state error">{error}</p>}
        {!service && !error && <p>ກຳລັງໂຫຼດ…</p>}
        {service && (
          <>
            <h2>{service.name}</h2>
            <p className="service-org">{service.organization?.name ?? "—"}</p>
            <div className="channels">
              {service.channels.online && <span className="tag online">ຍື່ນອອນລາຍໄດ້</span>}
              {service.channels.serviceCenter && <span className="tag">ຍື່ນທີ່ສູນບໍລິການໄດ້</span>}
            </div>

            <h3>ຄ່າທຳນຽມ</h3>
            {service.fee.type === "NONE" ? (
              <p>ບໍ່ເສຍຄ່າ</p>
            ) : (
              <table className="fee-table">
                <tbody>
                  {service.fee.items.map((i, n) => (
                    <tr key={n}>
                      <td>{i.label}</td>
                      <td>{money(i.amount, i.currency)}</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td>ລວມ</td>
                    <td>{money(service.fee.total, service.fee.currency)}</td>
                  </tr>
                </tbody>
              </table>
            )}

            <h3>ລາຍລະອຽດ</h3>
            {/* Plain text from the API: React escapes it; line breaks are kept by CSS. */}
            <p className="description">{service.description ?? service.shortDescription ?? "—"}</p>
            <p className="updated">ອັບເດດ: {new Date(service.updatedAt).toLocaleDateString("lo-LA")}</p>
          </>
        )}
      </aside>
    </div>
  );
}
