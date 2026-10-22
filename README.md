# ministry-a-demo — ເວັບໄຊຈຳລອງຂອງ "ກະຊວງ ກ"

ສາທິດວ່າອົງກອນພາຍນອກໃຊ້ **Smart ODSC Partner API** ໃນເວັບໄຊຂອງຕົນແນວໃດ ແລະ ເປັນບ່ອນ **ທົດລອງ API ເທື່ອລະຂັ້ນ**.

```
browser (React, :5180) ──/api──▶ backend ຂອງກະຊວງ ກ (:5181) ──token──▶ Smart ODSC Partner API (:4100)
                                  ເກັບ client_secret                        ດຶງຈາກ master-data ແລະ core
```

## ມີ 3 ໜ້າ

| ໜ້າ | ເຮັດຫຍັງ | Partner API ທີ່ໃຊ້ |
|---|---|---|
| **ສູນບໍລິການ** `#/centers` | ລາຍຊື່ສູນ ຄົ້ນຫາ ແລະ ກັ່ນຕາມແຂວງ/ປະເພດ. ປຸ່ມ "ບໍລິການທີ່ນີ້" ພາໄປໜ້າບໍລິການຂອງສູນນັ້ນ | `/service-centers` |
| **ບໍລິການ** `#/services` | ລາຍຊື່ບໍລິການ ພ້ອມຄ່າທຳນຽມ, ໜ່ວຍງານ, ຊ່ອງທາງ. ກັ່ນຕາມປະເພດ/ອອນລາຍ. ກົດເບິ່ງລາຍລະອຽດ | `/services`, `/services/{id}`, `/service-types` |
| **ທົດລອງ API** `#/playground` | ສອນ ແລະ ທົດສອບ API (ເບິ່ງລຸ່ມ) | ທຸກ endpoint |

ສອງໜ້າທຳອິດເຮັດວຽກຄືລະບົບແທ້: **browser ບໍ່ເຄີຍເຫັນ client_secret ຫຼື token**. Backend ຂອງກະຊວງຂໍ token,
ໃຊ້ token ເດີມຊ້ຳຈົນໃກ້ໝົດອາຍຸ, ແລະ ເກັບຜົນໄວ້ 60 ວິນາທີ. ກ່ອງ "ເບື້ອງຫຼັງການເຊື່ອມຕໍ່" ມຸມຂວາລຸ່ມ
ສະແດງວ່າຂໍ້ມູນມາຈາກ Smart ODSC ຫຼື ຈາກ cache ຂອງກະຊວງ.

## ໜ້າ "ທົດລອງ API"

### ① ຂໍ token ເທື່ອລະຂັ້ນ

| ຂັ້ນ | ສິ່ງທີ່ເຫັນ |
|---|---|
| 1. ກຽມ credential | client_id ແລະ secret (ປິດໄວ້) ທີ່ຢູ່ໃນ `.env` ຂອງ backend |
| 2. ສ້າງ header Basic | `Authorization: Basic base64(client_id:client_secret)` |
| 3. ສົ່ງ `POST /oauth/token` | Request ແລະ response ແທ້. ເລືອກ scope/credential ຜິດໄດ້ ເພື່ອເບິ່ງ `invalid_client`, `invalid_scope` |
| 4. ອ່ານ token (JWT) | ແຍກ header.payload.signature ພ້ອມຄວາມໝາຍຂອງແຕ່ລະ claim ແລະ ເວລາໝົດອາຍຸ |
| 5. ໃຊ້ token | `GET /partner/v1/ping` ດ້ວຍ `Authorization: Bearer …` |

ແຖບດ້ານເທິງນັບຖອຍຫຼັງອາຍຸ token (15 ນາທີ) ແລະ ມີປຸ່ມຂໍໃໝ່.

### ② ສົ່ງ request (ແບບ Postman)

- **Collection** ດ້ານຊ້າຍ: ທຸກ endpoint ແບ່ງກຸ່ມ ລະບົບ / ສູນບໍລິການ / ທີ່ຕັ້ງ / ບໍລິການ
- **URL bar + ຕາຕະລາງ parameter**: ພິມຄ່າແລ້ວ URL ປ່ຽນຕາມ (ຫຼື ແກ້ URL ເອງ) · Enter ຫຼື Send
- **Authorization**: Bearer token / ບໍ່ສົ່ງ token / token ຖືກແກ້ໄຂ 1 ຕົວ (ທົດສອບ 401)
- **Response**: status, ເວລາ, ຂະໜາດ, X-Request-Id · ແຖບ Body / Headers / Request
- **ເບິ່ງເປັນ curl**: ຄຳສັ່ງທີ່ copy ໄປໃຊ້ໃນ terminal ໄດ້ · **ປະຫວັດ** 12 request ລ່າສຸດ

### ③ ທົດສອບອັດຕະໂນມັດ

ຄື Collection Runner ຂອງ Postman: ແລ່ນ 20 ກໍລະນີຕໍ່ກັນ ແລ້ວສະແດງ ✅/❌ — ຂໍ token (ຖືກ, secret ຜິດ, scope ບໍ່ອະນຸມັດ),
ping (ມີ/ບໍ່ມີ/ແກ້ token), ທຸກ endpoint ຂໍ້ມູນ, ແລະ error 400/404. ກົດແຖວເພື່ອເບິ່ງ request/response.

### ຄວາມປອດໄພຂອງໜ້າທົດລອງ

- Request ທັງໝົດຖືກສົ່ງໂດຍ backend ຂອງກະຊວງ (`/api/playground/*`). Secret ບໍ່ອອກຈາກ server.
- Backend ຍອມສົ່ງແຕ່ `/partner/v1/*` ແລະ `/.well-known/jwks.json` ໄປຫາ `ODSC_BASE_URL` ເທົ່ານັ້ນ — ເອີ້ນ `/admin`, host ອື່ນ ຫຼື `../` ບໍ່ໄດ້.
- ໜ້ານີ້ **ສະແດງ access token ໃຫ້ເຫັນເພື່ອການຮຽນຮູ້** (sandbox). ລະບົບແທ້ຕ້ອງເກັບ token ໄວ້ທີ່ server ຄືສອງໜ້າທຳອິດ.

## Run

ຕ້ອງເປີດ `smart-odsc-partner` (port 4100) ກ່ອນ.

```bash
# 1) ລົງທະບຽນກະຊວງ ກ (ຄັ້ງດຽວ) — credential ຖືກຂຽນລົງ .env ຂອງ demo ນີ້
cd ../smart-odsc-partner
pnpm partner:create "ກະຊວງ ກ (ຈຳລອງ)" --type MINISTRY --scope catalog:read --write-env ../ministry-a-demo/.env

# 2) ເປີດ demo
cd ../ministry-a-demo
pnpm install
pnpm dev            # http://localhost:5180
```

ຫຼື ລົງທະບຽນຜ່ານໜ້າ admin http://localhost:4100/admin ແລ້ວໃສ່ `ODSC_CLIENT_ID` / `ODSC_CLIENT_SECRET` ໃນ `.env` ເອງ.
