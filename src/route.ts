import { useEffect, useState } from "react";

/** Hash routes (#/services?center=…), so the demo needs no router or server rewrites. */
export interface Route {
  page: "centers" | "services" | "playground";
  params: URLSearchParams;
}

function read(): Route {
  const [path, query = ""] = window.location.hash.replace(/^#\/?/, "").split("?");
  const page = path === "services" || path === "playground" ? path : "centers";
  return { page, params: new URLSearchParams(query) };
}

export function useRoute() {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export const href = (page: Route["page"], params?: Record<string, string>) =>
  `#/${page}${params ? `?${new URLSearchParams(params)}` : ""}`;
