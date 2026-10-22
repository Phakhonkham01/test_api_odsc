import { ConnectionPanel } from "./ConnectionPanel";
import { CentersPage } from "./pages/Centers";
import { PlaygroundPage } from "./pages/Playground";
import { ServicesPage } from "./pages/Services";
import { href, useRoute } from "./route";

const NAV = [
  { page: "centers", label: "ສູນບໍລິການ" },
  { page: "services", label: "ບໍລິການ" },
  { page: "playground", label: "ທົດລອງ API" },
] as const;

export function App() {
  const route = useRoute();

  return (
    <div className="page">
      <header className="masthead">
        <div className="masthead-inner">
          <div className="emblem" aria-hidden>ກ</div>
          <div>
            <div className="ministry">ກະຊວງ ກ</div>
            <div className="ministry-sub">ເວັບໄຊຈຳລອງ — ສຳລັບທົດສອບການເຊື່ອມຕໍ່ Smart ODSC</div>
          </div>
          <nav className="nav">
            {NAV.map((n) => (
              <a key={n.page} href={href(n.page)} className={route.page === n.page ? "active" : ""}>
                {n.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {route.page === "centers" && <CentersPage />}
      {route.page === "services" && <ServicesPage params={route.params} />}
      {route.page === "playground" && <PlaygroundPage />}

      <footer className="footer">ຂໍ້ມູນ © Smart ODSC · ສະແດງຜ່ານ Smart ODSC Partner API</footer>

      {route.page !== "playground" && <ConnectionPanel />}
    </div>
  );
}
