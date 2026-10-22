/**
 * The collection the runner plays, like Postman's Collection Runner: each case
 * sends one request and checks the answer. Together they cover the happy path
 * and every error a partner should be ready for.
 */
import type { Exchange } from "../types";
import { type AuthMode, requestToken, sendRequest } from "./api";
import { CENTER_ID, SERVICE_ID } from "./endpoints";

export interface Ctx {
  token: string | null;
}

export interface Case {
  name: string;
  expect: number;
  run: (ctx: Ctx) => Promise<Exchange>;
  /** Extra check on a response with the expected status; returns what went wrong. */
  check?: (body: any) => string | null;
}

const get = (path: string, auth: AuthMode = "token") => (ctx: Ctx) => sendRequest(path, auth, ctx.token);
const code = (want: string) => (b: any) => (b?.code === want || b?.error === want ? null : `ຄາດວ່າ ${want}`);

export const CASES: Case[] = [
  {
    name: "ຂໍ token ດ້ວຍ credential ທີ່ຖືກ",
    expect: 200,
    run: async (ctx) => {
      const x = await requestToken("catalog:read", "correct");
      ctx.token = (x.response.body as any)?.access_token ?? null;
      return x;
    },
    check: (b) => (b?.token_type === "Bearer" && b?.access_token ? null : "ບໍ່ມີ access_token"),
  },
  {
    name: "ຂໍ token ດ້ວຍ secret ຜິດ",
    expect: 401,
    run: () => requestToken("catalog:read", "wrong-secret"),
    check: code("invalid_client"),
  },
  {
    name: "ຂໍ scope ທີ່ບໍ່ໄດ້ອະນຸມັດ",
    expect: 400,
    run: () => requestToken("catalog:read admin:write", "correct"),
    check: code("invalid_scope"),
  },
  { name: "ping ດ້ວຍ token", expect: 200, run: get("/partner/v1/ping"), check: (b) => (b?.data?.message === "pong" ? null : "ບໍ່ແມ່ນ pong") },
  { name: "ບໍ່ສົ່ງ token", expect: 401, run: get("/partner/v1/ping", "none"), check: code("missing_token") },
  { name: "token ຖືກແກ້ໄຂ 1 ຕົວອັກສອນ", expect: 401, run: get("/partner/v1/ping", "tampered"), check: code("invalid_token") },
  {
    name: "ແຂວງ ຄົບ 18",
    expect: 200,
    run: get("/partner/v1/locations/provinces"),
    check: (b) => (b?.data?.length === 18 ? null : `ໄດ້ ${b?.data?.length} ແຂວງ`),
  },
  {
    name: "ເມືອງ 5 ລາຍການທຳອິດ",
    expect: 200,
    run: get("/partner/v1/locations/districts?limit=5"),
    check: (b) => (b?.data?.length === 5 ? null : `ໄດ້ ${b?.data?.length} ແຖວ`),
  },
  { name: "ສູນບໍລິການ", expect: 200, run: get("/partner/v1/service-centers?limit=5") },
  { name: "ສູນດຽວ", expect: 200, run: get(`/partner/v1/service-centers/${CENTER_ID}`) },
  {
    name: "ລາຍການບໍລິການ",
    expect: 200,
    run: get("/partner/v1/services?limit=3"),
    check: (b) => (b?.page?.total > 0 ? null : "ບໍ່ມີບໍລິການ"),
  },
  {
    name: "ບໍລິການດຽວ ມີ description",
    expect: 200,
    run: get(`/partner/v1/services/${SERVICE_ID}`),
    check: (b) => (typeof b?.data?.description === "string" ? null : "ບໍ່ມີ description"),
  },
  { name: "ບໍລິການທີ່ສູນໜຶ່ງໃຫ້", expect: 200, run: get(`/partner/v1/services?serviceCenterId=${CENTER_ID}&limit=3`) },
  { name: "ປະເພດບໍລິການ", expect: 200, run: get("/partner/v1/service-types") },
  { name: "parameter ຜິດ (online=yes)", expect: 400, run: get("/partner/v1/services?online=yes"), check: code("invalid_request") },
  { name: "parameter ທີ່ບໍ່ຮູ້ຈັກ (foo=1)", expect: 400, run: get("/partner/v1/services?foo=1"), check: code("invalid_request") },
  { name: "id ບໍ່ແມ່ນ UUID", expect: 400, run: get("/partner/v1/services/abc"), check: code("invalid_request") },
  {
    name: "ບໍລິການທີ່ບໍ່ມີ",
    expect: 404,
    run: get("/partner/v1/services/00000000-0000-4000-8000-000000000000"),
    check: code("not_found"),
  },
  { name: "endpoint ທີ່ບໍ່ມີ", expect: 404, run: get("/partner/v1/nothing-here"), check: code("not_found") },
  {
    name: "JWKS (ບໍ່ຕ້ອງ token)",
    expect: 200,
    run: get("/.well-known/jwks.json", "none"),
    check: (b) => (b?.keys?.[0]?.kid ? null : "ບໍ່ມີ kid"),
  },
];
