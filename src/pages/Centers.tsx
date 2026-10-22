import { useCallback, useEffect, useMemo, useState } from "react";
import { href } from "../route";
import type { ListResponse, ServiceCenter } from "../types";

const DAY: Record<string, string> = {
  MONDAY: "ຈັນ",
  TUESDAY: "ອັງຄານ",
  WEDNESDAY: "ພຸດ",
  THURSDAY: "ພະຫັດ",
  FRIDAY: "ສຸກ",
  SATURDAY: "ເສົາ",
  SUNDAY: "ອາທິດ",
};

const TYPE_LABEL = { CENTER: "ສູນບໍລິການ", TASAENG: "ຈຸດບໍລິການຕາແສງ" } as const;

function hours(c: ServiceCenter) {
  const { openDay, closeDay, morning, afternoon } = c.openingHours;
  const days = openDay && closeDay ? `ວັນ${DAY[openDay] ?? openDay} – ${DAY[closeDay] ?? closeDay}` : null;
  const ranges = [morning, afternoon].filter(Boolean).join(", ");
  return [days, ranges].filter(Boolean).join(" · ") || "ບໍ່ມີຂໍ້ມູນເວລາເປີດ";
}

function place(c: ServiceCenter) {
  return [c.village && `ບ້ານ${c.village}`, c.district && `ເມືອງ${c.district.nameLo}`, c.province?.nameLo]
    .filter(Boolean)
    .join(", ");
}

export function CentersPage() {
  const [list, setList] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [province, setProvince] = useState("");
  const [type, setType] = useState<"" | ServiceCenter["type"]>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/service-centers");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setList(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const provinces = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of list?.data ?? []) if (c.province) seen.set(c.province.id, c.province.nameLo);
    return [...seen].sort((a, b) => a[1].localeCompare(b[1], "lo"));
  }, [list]);

  const shown = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase();
    return (list?.data ?? []).filter(
      (c) =>
        (!province || c.province?.id === province) &&
        (!type || c.type === type) &&
        (!needle || c.name.toLocaleLowerCase().includes(needle) || place(c).toLocaleLowerCase().includes(needle)),
    );
  }, [list, q, province, type]);

  return (
    <main className="content">
      <section className="hero">
        <h1>ສູນບໍລິການປະຕູດຽວ ທົ່ວປະເທດ</h1>
        <p>
          ຊອກຫາສູນບໍລິການ ແລະ ຈຸດບໍລິການຕາແສງທີ່ໃກ້ທ່ານ. ຂໍ້ມູນມາຈາກ Smart ODSC ໂດຍກົງ ແລະ ອັບເດດອັດຕະໂນມັດ.
        </p>
      </section>

      <section className="filters" aria-label="ຕົວກອງ">
        <input
          className="search"
          type="search"
          placeholder="ຄົ້ນຫາຊື່ສູນ, ບ້ານ, ເມືອງ…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={province} onChange={(e) => setProvince(e.target.value)} aria-label="ແຂວງ">
          <option value="">ທຸກແຂວງ</option>
          {provinces.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <div className="chips" role="group" aria-label="ປະເພດ">
          {(["", "CENTER", "TASAENG"] as const).map((t) => (
            <button key={t} className={type === t ? "chip on" : "chip"} onClick={() => setType(t)}>
              {t ? TYPE_LABEL[t] : "ທັງໝົດ"}
            </button>
          ))}
        </div>
      </section>

      {loading && <p className="state">ກຳລັງໂຫຼດຂໍ້ມູນ…</p>}
      {error && (
        <div className="state error">
          ໂຫຼດຂໍ້ມູນບໍ່ສຳເລັດ: {error}
          <button onClick={() => void load()}>ລອງໃໝ່</button>
        </div>
      )}

      {!loading && !error && (
        <>
          <p className="count">
            ພົບ <strong>{shown.length}</strong> ແຫ່ງ ຈາກທັງໝົດ {list?.page.total ?? 0} ແຫ່ງ
          </p>
          <ul className="grid">
            {shown.map((c) => (
              <li key={c.id} className="card">
                <div className="thumb">
                  {c.imageUrl ? <img src={c.imageUrl} alt="" loading="lazy" /> : <span>ODSC</span>}
                  <span className={`badge ${c.type.toLowerCase()}`}>{TYPE_LABEL[c.type]}</span>
                </div>
                <div className="card-body">
                  <h2>{c.name}</h2>
                  <p className="place">{place(c) || "—"}</p>
                  <p className="hours">{hours(c)}</p>
                  <div className="card-links">
                    <a className="map" href={href("services", { center: c.id, name: c.name })}>
                      ບໍລິການທີ່ນີ້ →
                    </a>
                    {c.location && (
                      <a
                        className="map"
                        href={`https://www.google.com/maps?q=${c.location.latitude},${c.location.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        ແຜນທີ່ ↗
                      </a>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
