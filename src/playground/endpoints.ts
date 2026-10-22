/**
 * The Partner API endpoints the playground knows, grouped as the docs group
 * them. Examples are real ids from the sandbox.
 */
export interface Param {
  name: string;
  hint: string;
  example?: string;
  options?: string[];
}

export interface Endpoint {
  id: string;
  group: string;
  title: string;
  /** May hold {id}, filled from `idParam`. */
  path: string;
  idParam?: { example: string; hint: string };
  params: Param[];
  /** Needs no token (JWKS is public). */
  open?: boolean;
  note: string;
}

const page = (limit = "10"): Param[] => [
  { name: "page", hint: "ໜ້າ (ເລີ່ມ 1)" },
  { name: "limit", hint: "ຈຳນວນຕໍ່ໜ້າ 1–100", example: limit },
];

export const CENTER_ID = "2ea8440d-c39c-48d2-aade-0906870337a2";
export const SERVICE_ID = "789d0fc6-cd85-475e-91da-882d580d7113";

export const ENDPOINTS: Endpoint[] = [
  {
    id: "ping",
    group: "ລະບົບ",
    title: "ທົດສອບ token",
    path: "/partner/v1/ping",
    params: [],
    note: "ຖ້າໄດ້ \"pong\" ແປວ່າ token ຜ່ານທຸກດ່ານ: ລາຍເຊັນ, ອາຍຸ, client ຍັງໃຊ້ໄດ້ ແລະ ມີ scope.",
  },
  {
    id: "jwks",
    group: "ລະບົບ",
    title: "Public key (JWKS)",
    path: "/.well-known/jwks.json",
    params: [],
    open: true,
    note: "ກະແຈສາທາລະນະ ສຳລັບກວດລາຍເຊັນ token ເອງ. ບໍ່ຕ້ອງໃຊ້ token.",
  },
  {
    id: "centers",
    group: "ສູນບໍລິການ",
    title: "ລາຍການສູນ",
    path: "/partner/v1/service-centers",
    params: [
      { name: "provinceId", hint: "UUID ແຂວງ (ຈາກ /locations/provinces)" },
      { name: "districtId", hint: "UUID ເມືອງ" },
      { name: "type", hint: "ປະເພດ", options: ["CENTER", "TASAENG"] },
      { name: "q", hint: "ຄົ້ນຊື່ສູນ" },
      ...page("5"),
    ],
    note: "ສູນບໍລິການ ແລະ ຈຸດບໍລິການຕາແສງທີ່ເປີດຢູ່.",
  },
  {
    id: "center",
    group: "ສູນບໍລິການ",
    title: "ສູນດຽວ",
    path: "/partner/v1/service-centers/{id}",
    idParam: { example: CENTER_ID, hint: "id ຂອງສູນ" },
    params: [],
    note: "id ທີ່ບໍ່ມີ → 404, id ທີ່ບໍ່ແມ່ນ UUID → 400.",
  },
  {
    id: "provinces",
    group: "ທີ່ຕັ້ງ",
    title: "ແຂວງ",
    path: "/partner/v1/locations/provinces",
    params: [],
    note: "18 ແຂວງ ລຽງຕາມລະຫັດທາງການ. ບໍ່ມີ parameter.",
  },
  {
    id: "districts",
    group: "ທີ່ຕັ້ງ",
    title: "ເມືອງ",
    path: "/partner/v1/locations/districts",
    params: [{ name: "provinceId", hint: "UUID ແຂວງ" }, ...page("5")],
    note: "ເມືອງທັງໝົດ ຫຼື ສະເພາະແຂວງດຽວ.",
  },
  {
    id: "services",
    group: "ບໍລິການ",
    title: "ລາຍການບໍລິການ",
    path: "/partner/v1/services",
    params: [
      { name: "serviceTypeId", hint: "UUID ປະເພດ (ຈາກ /service-types)" },
      { name: "organizationId", hint: "UUID ອົງກອນ" },
      { name: "serviceCenterId", hint: "UUID ສູນ: ບໍລິການທີ່ສູນນີ້ໃຫ້" },
      { name: "online", hint: "ຍື່ນອອນລາຍໄດ້", options: ["true", "false"] },
      { name: "q", hint: "ຄົ້ນໃນຊື່ ແລະ ຄຳອະທິບາຍສັ້ນ" },
      ...page("3"),
    ],
    note: "ບໍລິການທີ່ປະຊາຊົນເຫັນໃນ odsc.gov.la.",
  },
  {
    id: "service",
    group: "ບໍລິການ",
    title: "ບໍລິການດຽວ",
    path: "/partner/v1/services/{id}",
    idParam: { example: SERVICE_ID, hint: "id ຂອງບໍລິການ" },
    params: [],
    note: "ຄືກັບລາຍການ ບວກ description (ຂໍ້ຄວາມທຳມະດາ ບໍ່ແມ່ນ HTML).",
  },
  {
    id: "types",
    group: "ບໍລິການ",
    title: "ປະເພດບໍລິການ",
    path: "/partner/v1/service-types",
    params: [],
    note: "serviceCount = ຈຳນວນບໍລິການທີ່ປະຊາຊົນເຫັນໃນປະເພດນັ້ນ.",
  },
];

/** Builds the path a request will go to, leaving out empty parameters. */
export function buildPath(e: Endpoint, id: string, values: Record<string, string>) {
  const path = e.path.replace("{id}", encodeURIComponent(id.trim()));
  const query = new URLSearchParams(
    Object.entries(values).filter(([, v]) => v.trim() !== "") as [string, string][],
  ).toString();
  return query ? `${path}?${query}` : path;
}
