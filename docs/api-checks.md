# API checks

Manual checks run with `curl` against a local PostgreSQL filled by
`node prisma/dev-seed.js`. Success returns the bare resource; failure returns
`{ "error": "..." }`. Allowed codes: 200, 201, 204, 400, 401, 403, 404, 500.
401 and 403 are used only by `/auth` and `/holds` (approved exception).

## Route index

| Method | Route | Valid request | Expected | Actual | Evidence |
| --- | --- | --- | --- | --- | --- |
| GET | `/health` | none | 200 | 200 | Health section, row 1 |
| GET | `/medicines` | none | 200 | 200 | Medicines section, row 1 |
| GET | `/medicines?name=dolo` | query string | 200 | 200 | Medicines section, row 2 |
| GET | `/medicines/:id` | seeded id | 200 | 200 | Medicines section, row 4 |
| POST | `/medicines` | `{"name":"...","form":"..."}` | 201 | 201 | Medicines section, row 7 |
| PUT | `/medicines/:id` | `{"name":"...","form":"..."}` | 200 | 200 | Medicines section, row 8 |
| DELETE | `/medicines/:id` | unstocked id | 204 | 204 | Medicines section, row 9 |
| GET | `/pharmacies` | none | 200 | 200 | Pharmacies section, row 1 |
| GET | `/pharmacies?area=model town` | query string | 200 | 200 | Pharmacies section, row 2 |
| GET | `/pharmacies?medicine=dolo` | query string | 200 | 200 | Pharmacies section, row 3 |
| GET | `/pharmacies?medicine=dolo&area=sector 14` | query string | 200 | 200 | Pharmacies section, row 4 |
| GET | `/pharmacies/:id` | verified id | 200 | 200 | Pharmacies section, row 6 |
| POST | `/pharmacies` | full body | 201 | 201 | Pharmacies section, row 10 |
| GET | `/stock?pharmacyId=1` | seeded id | 200 | 200 | Stock section, row 1 |
| POST | `/stock` | full body | 201 | 201 | Stock section, row 4 |
| PUT | `/stock/1` | quantity + price | 200 | 200 | Stock section, row 8 |
| DELETE | `/stock/21` | none | 204 | 204 | Stock section, row 10 |
| POST | `/auth/register` | name + phone + password | 201 | 201 | Accounts section, row 2 |
| POST | `/auth/login` | phone + password | 200 | 200 | Accounts section, row 5 |
| POST | `/auth/logout` | session cookie | 204 | 204 | Accounts section, row 8 |
| GET | `/auth/me` | session cookie | 200 | 200 | Accounts section, row 7 |
| GET | `/holds` | session cookie | 200 | 200 | Holds section, row 3 |
| POST | `/holds` | stockItemId + quantity | 201 | 201 | Holds section, row 2 |
| DELETE | `/holds/:id` | own active hold | 204 | 204 | Holds section, row 6 |

## Health (commit 1, test t0)

Run on 2026-11-10 by Vishal.

| # | Method | Request | Expected | Actual | Body / note |
| --- | --- | --- | --- | --- | --- |
| 1 | `GET` | `/health` | 200 | 200 | `{"ok":true}` |

## Medicines (commit 14, test t1)

Run on 2026-11-11 by Manav, `NODE_ENV=development`, seeded database
(12 medicines).

| # | Method | Request | Expected | Actual | Body / note |
| --- | --- | --- | --- | --- | --- |
| 1 | `GET` | `/medicines` | 200 | 200 | 12 seeded rows, sorted by name |
| 2 | `GET` | `/medicines?name=dolo` | 200 | 200 | `[{"id":1,"name":"Dolo 650","form":"TABLET"}]`, case ignored |
| 3 | `GET` | `/medicines/abc` | 400 | 400 | `{"error":"Invalid medicine id"}` |
| 4 | `GET` | `/medicines/999` | 404 | 404 | `{"error":"Medicine not found"}` |
| 5 | `POST` | `/medicines` `{"form":"TABLET"}` | 400 | 400 | `{"error":"Missing medicine name or form"}` |
| 6 | `POST` | `/medicines` `{"name":"Dolo 650","form":"TABLET"}` | 400 | 400 | `{"error":"A medicine with this name already exists"}` |
| 7 | `POST` | `/medicines` `{"name":"Cetzine","form":"TABLET"}` | 201 | 201 | `{"id":13,"name":"Cetzine","form":"TABLET"}`; re-run on 2026-11-11 against a freshly seeded scratch database (`velora_fixcheck`) to observe the code |
| 8 | `PUT` | `/medicines/13` `{"name":"Cetzine 10","form":"TABLET"}` | 200 | 200 | `{"id":13,"name":"Cetzine 10","form":"TABLET"}` |
| 9 | `DELETE` | `/medicines/13` | 204 | 204 | empty body |
| 10 | `DELETE` | `/medicines/1` | 400 | 400 | `{"error":"Medicine is still stocked by a pharmacy"}` |

After the run the medicines table is back to the 12 seeded rows.

## Pharmacies (commit 15, test t2)

Run on 2026-11-11 by Manav, `NODE_ENV=development`, seeded database
(4 VERIFIED and 2 PENDING pharmacies). Bodies are summarised as
`name [status] stock: medicine x quantity`.

| # | Method | Request | Expected | Actual | Body / note |
| --- | --- | --- | --- | --- | --- |
| 1 | `GET` | `/pharmacies` | 200 | 200 | 4 rows, all VERIFIED, each with its stock and medicine |
| 2 | `GET` | `/pharmacies?area=model town` | 200 | 200 | Sanjeevani Medicos only; PENDING Shree Ram Chemists excluded |
| 3 | `GET` | `/pharmacies?medicine=dolo` | 200 | 200 | City Care x15, Sanjeevani x40, Highway 24x7 x100 (cheapest first); PENDING Apna Medical Hall excluded |
| 4 | `GET` | `/pharmacies?medicine=dolo&area=sector 14` | 200 | 200 | City Care Pharmacy only |
| 5 | `GET` | `/pharmacies?medicine=ascoril` | 200 | 200 | `[]`: the only verified holder has quantity 0 |
| 6 | `GET` | `/pharmacies/1` | 200 | 200 | Sanjeevani Medicos with 5 stock rows, each including its medicine |
| 7 | `GET` | `/pharmacies/abc` | 400 | 400 | `{"error":"Invalid pharmacy id"}` |
| 8 | `GET` | `/pharmacies/999` | 404 | 404 | `{"error":"Pharmacy not found"}` |
| 9 | `POST` | `/pharmacies` `{"name":"Test Chemist"}` | 400 | 400 | `{"error":"Missing pharmacy fields: area, address, phone, licenceNumber"}` |
| 10 | `POST` | `/pharmacies` full body plus `"status":"VERIFIED"` | 201 | 201 | created as `PENDING`: the body's status is ignored |
| 11 | `POST` | same body again | 400 | 400 | `{"error":"A pharmacy with this licence number already exists"}` |
| 12 | `GET` | `/pharmacies/5` (a PENDING pharmacy) | 404 | 404 | `{"error":"Pharmacy not found"}`: a PENDING pharmacy is treated as not found |
| 13 | `GET` | `/pharmacies?medicine=dolo&medicine=pan` (array query) | 400 | 400 | `{"error":"Invalid medicine parameter"}`. Note: at the time of this run, `?medicine[]=dolo` returned 200 with every verified pharmacy, because Express 5's default query parser reads `medicine[]` as a separate key, not an array. It is rejected after the 2026-11-12 hardening below |

Rows 12 and 13 were run on 2026-11-11 against a freshly seeded scratch database
(`velora_fixcheck`) after the P2 review fixes.

## P2 query hardening (2026-11-12, Vishal)

Run after the F5 follow-up, `NODE_ENV=development`, against a freshly seeded
scratch database. Bracket syntax is rejected before Prisma sees it.

| # | Method | Request | Expected | Actual | Body / note |
| --- | --- | --- | --- | --- | --- |
| 1 | `GET` | `/medicines?name[]=dolo` | 400 | 400 | `{"error":"Invalid query parameter: name[]"}` |
| 2 | `GET` | `/pharmacies?medicine[]=dolo` | 400 | 400 | `{"error":"Invalid query parameter: medicine[]"}` |
| 3 | `GET` | `/medicines?name=dolo` | 200 | 200 | the normal filter still returns one row |
| 4 | `GET` | `/pharmacies?medicine=dolo` | 200 | 200 | three verified pharmacies, cheapest first |

The regular `curl` sweep from the fix brief was run again on the same database;
no route returned a 500.

The run leaves one PENDING "Test Chemist" row (licence `HR-SNP-TEST-0199`) in
the local database; it never appears in search because it is not VERIFIED.

## Stock (commit 16, test t3)

Run on 2026-11-17 by Sayem, `NODE_ENV=development`, seeded database (20 stock rows).

| # | Method | Request | Expected | Actual | Body / note |
| --- | --- | --- | --- | --- | --- |
| 1 | `GET` | `/stock?pharmacyId=1` | 200 | 200 | 5 rows, each carrying its medicine |
| 2 | `GET` | `/stock?pharmacyId=abc` | 400 | 400 | `{"error":"Invalid pharmacy id"}` |
| 3 | `GET` | `/stock?pharmacyId[]=1` | 400 | 400 | `{"error":"Invalid query parameter: pharmacyId[]"}` |
| 4 | `POST` | `/stock` `{"pharmacyId":1,"medicineId":2,"quantity":10,"pricePaise":5000}` | 201 | 201 | row created; visible in `GET /pharmacies/1` |
| 5 | `POST` | `/stock` `{"pharmacyId":1,"medicineId":3,"quantity":-1,"pricePaise":5000}` | 400 | 400 | `{"error":"Invalid stock fields"}` |
| 6 | `POST` | `/stock` `{"pharmacyId":999,"medicineId":1,"quantity":10,"pricePaise":5000}` | 404 | 404 | `{"error":"Pharmacy or medicine not found"}` |
| 7 | `POST` | `/stock` same pair again (`pharmacyId:1, medicineId:2`) | 400 | 400 | `{"error":"Stock row already exists; use PUT to change it"}` |
| 8 | `PUT` | `/stock/1` `{"quantity":45,"pricePaise":3200}` | 200 | 200 | updated row returned; `updatedAt` is refreshed |
| 9 | `PUT` | `/stock/999` `{"quantity":10,"pricePaise":5000}` | 404 | 404 | `{"error":"Stock row not found"}` |
| 10 | `DELETE` | `/stock/21` (the row created in row 4) | 204 | 204 | empty body |
| 11 | `DELETE` | `/stock/999` | 404 | 404 | `{"error":"Stock row not found"}` |

PENDING pharmacies are excluded from the list: `GET /stock?pharmacyId=5` returns `[]`.

## Contract sweep & envelope verification (commit 19, test t4)

Run on 2026-11-17 by Sayem, verifying status codes, error shapes, and absence of leakages across all routes.

| # | Check | Route / Request | Expected | Actual | Note |
| --- | --- | --- | --- | --- | --- |
| 1 | Terminal 404 | `GET /nonexistent-route` | 404 | 404 | `{"error":"Route not found"}` |
| 2 | Terminal 404 method | `POST /nonexistent` | 404 | 404 | `{"error":"Route not found"}` |
| 3 | Approved code set | All endpoints | 200/201/204/400/401/403/404/500 | Confirmed | 401/403 only on `/auth` and `/holds`; no 409, 422 or 429 |
| 4 | Error envelope format | All 4xx and 5xx responses | `{"error":"..."}` | Confirmed | Never returns bare strings, HTML errors, or Prisma internals |
| 5 | Stack trace suppression | Uncaught / database errors | 500 `{"error":"..."}` | Confirmed | Errors logged server-side via `console.error`; stack traces never leak |
| 6 | 204 No Content body | `DELETE /medicines/:id`, `DELETE /stock/:id` | 204 empty | Confirmed | `res.status(204).send()` sends empty body |
| 7 | Detail PENDING guard | `GET /pharmacies/5` | 404 | 404 | `{"error":"Pharmacy not found"}`: PENDING pharmacies treated as 404 |
| 8 | Bracket query rejection | `GET /medicines?name[]=dolo`, `GET /pharmacies?medicine[]=dolo`, `GET /stock?pharmacyId[]=1` | 400 | 400 | `{"error":"Invalid query parameter: ..."}` |

## Accounts (approved exception, test t7)

Run on 2026-11-19 by Vishal against `velora_auth_test` (seeded with the 12/6/20 fixtures), `NODE_ENV=development`.

| # | Method | Request | Expected | Actual | Body / note |
| --- | --- | --- | --- | --- | --- |
| 1 | `GET` | `/auth/me` with no cookie | 401 | 401 | `{"error":"Authentication required"}` |
| 2 | `POST` | `/auth/register` `{"name":"Asha","phone":"9000000001","password":"password123"}` | 201 | 201 | `{"id":1,"name":"Asha","phone":"9000000001","createdAt":"..."}`; no `passwordHash` in the body |
| 3 | `POST` | `/auth/register` same phone again | 400 | 400 | `{"error":"Phone number already registered"}` |
| 4 | `POST` | `/auth/register` password `short` | 400 | 400 | `{"error":"Provide a name, a 10-digit mobile number, and a password of 8 to 72 characters"}` |
| 5 | `POST` | `/auth/login` correct phone and password | 200 | 200 | user object; session cookie set |
| 6 | `POST` | `/auth/login` wrong password | 401 | 401 | `{"error":"Invalid phone or password"}` |
| 7 | `GET` | `/auth/me` with the session cookie | 200 | 200 | `{"id":1,"name":"Asha","phone":"9000000001",...}` |
| 8 | `POST` | `/auth/logout` with the session cookie | 204 | 204 | empty body |
| 9 | `GET` | `/auth/me` after logout | 401 | 401 | session destroyed |

The database stores `passwordHash` as a bcrypt hash (`$2b$...`); no endpoint returns it.

## Holds (approved exception, test t8)

Run on 2026-11-19 by Vishal against the same test database. Stock row 1 starts at 40 units.

| # | Method | Request | Expected | Actual | Body / note |
| --- | --- | --- | --- | --- | --- |
| 1 | `GET` | `/holds` with no cookie | 401 | 401 | `{"error":"Authentication required"}` |
| 2 | `POST` | `/holds` `{"stockItemId":1,"quantity":2}` as Asha | 201 | 201 | hold `ACTIVE`, expires in 30 minutes; stock 40 → 38 |
| 3 | `GET` | `/holds` as Asha | 200 | 200 | 1 hold |
| 4 | `GET` | `/holds` as Bilal | 200 | 200 | 0 holds; the list is owner-scoped |
| 5 | `DELETE` | `/holds/1` as Bilal | 403 | 403 | `{"error":"Not allowed to change this hold"}` |
| 6 | `DELETE` | `/holds/1` as Asha | 204 | 204 | stock restored 38 → 40 |
| 7 | `POST` | `/holds` `{"stockItemId":1,"quantity":9999}` | 400 | 400 | `{"error":"Not enough stock"}`; stock unchanged |
| 8 | `POST` | `/holds` `{"stockItemId":18,"quantity":1}` (PENDING pharmacy 5) | 404 | 404 | `{"error":"Stock item not found"}` |
| 9 | `GET` | `/holds` after moving a hold’s `expiresAt` into the past in the test database | 200 | 200 | hold `EXPIRED`; stock restored 37 → 40 |
| 10 | `GET` | `/holds` again | 200 | 200 | stock still 40; the expiry restore runs once |
