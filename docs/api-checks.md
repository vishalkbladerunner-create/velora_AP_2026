# API checks

Manual checks run with `curl` against a local PostgreSQL filled by
`node prisma/dev-seed.js`. Success returns the bare resource; failure returns
`{ "error": "..." }`. Allowed codes: 200, 201, 204, 400, 401, 403, 404, 500.
Since the JWT migration on 2026-11-20 the canonical base is `/api/v1`, protected routes expect `Authorization: Bearer <accessToken>`, and the refresh token is the HttpOnly `velora_refresh` cookie. Sections recorded before that date document the session-era client; the JWT suites below record the current behaviour.

401 and 403 are used by the JWT guard, the RBAC guard, the authenticated search and the owner-only pharmacy and stock writes.

The fixture set was expanded on 2026-11-20 to 18 medicines, 6 pharmacies and 31 stock rows. Sections recorded before that date keep the counts that were in force when they were run; the “Fixture refresh” section below states the current numbers.

## Route index

| Method | Route | Valid request | Expected | Actual | Evidence |
| --- | --- | --- | --- | --- | --- |
| GET | `/health` | none | 200 | 200 | Health section, row 1 |
| GET | `/medicines` | none | 200 | 200 | Medicines section, row 1 |
| GET | `/medicines?name=dolo` | query string | 200 | 200 | Medicines section, row 2 |
| GET | `/medicines/:id` | seeded id | 200 | 200 | Medicines section, row 4 |
| POST | `/medicines` | owner session + `{"name":"...","form":"..."}` | 201 | 201 | Medicines section, row 7; 403 for a customer (Account types, row 6) |
| PUT | `/medicines/:id` | owner session + body | 200 | 200 | Medicines section, row 8 |
| DELETE | `/medicines/:id` | owner session + unstocked id | 204 | 204 | Medicines section, row 9 |
| GET | `/pharmacies` | session cookie | 200 | 200 | Pharmacies section, row 1; 401 without a cookie (Account types, row 4) |
| GET | `/pharmacies?area=model town` | query string + cookie | 200 | 200 | Pharmacies section, row 2 |
| GET | `/pharmacies?medicine=dolo` | query string + cookie | 200 | 200 | Pharmacies section, row 3 |
| GET | `/pharmacies?medicine=dolo&area=sector 14` | query string + cookie | 200 | 200 | Pharmacies section, row 4 |
| GET | `/pharmacies/:id` | verified id | 200 | 200 | Pharmacies section, row 6 |
| POST | `/pharmacies` | full body | 201 | 201 | Pharmacies section, row 10 |
| GET | `/stock?pharmacyId=1` | seeded id | 200 | 200 | Stock section, row 1 |
| POST | `/stock` | owner session + body | 201 | 201 | Pharmacy ownership, row 6 |
| PUT | `/stock/:id` | owner session | 200 | 200 | Pharmacy ownership, success note |
| DELETE | `/stock/:id` | owner session | 204 | 204 | Pharmacy ownership, success note |
| GET | `/pharmacies/mine` | session cookie | 200 | 200 | Pharmacy ownership, row 4 |
| POST | `/pharmacies/mine` | full body + owner session | 201 | 201 | Pharmacy ownership, row 4 |
| PUT | `/pharmacies/mine` | full body + owner session | 200 | 200 | Account types and editing, row 10 |
| POST | `/auth/register` | name + phone + address + password | 201 | 201 | Accounts section, row 2 |
| POST | `/auth/login` | phone + password | 200 | 200 | Accounts section, row 5 |
| POST | `/auth/logout` | session cookie | 204 | 204 | Accounts section, row 8 |
| GET | `/auth/me` | session cookie | 200 | 200 | Accounts section, row 7 |
| PUT | `/auth/me` | session cookie + profile body | 200 | 200 | Account types and editing, row 11 |
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

## Stock reads (commit 16, test t3)

Run on 2026-11-17 by Sayem, `NODE_ENV=development`, seeded database. Since
2026-11-20, stock writes require a signed-in pharmacy owner; those checks are
recorded in Pharmacy ownership (test t9).

| # | Method | Request | Expected | Actual | Body / note |
| --- | --- | --- | --- | --- | --- |
| 1 | `GET` | `/stock?pharmacyId=1` | 200 | 200 | 5 rows, each carrying its medicine |
| 2 | `GET` | `/stock?pharmacyId=abc` | 400 | 400 | `{"error":"Invalid pharmacy id"}` |
| 3 | `GET` | `/stock?pharmacyId[]=1` | 400 | 400 | `{"error":"Invalid query parameter: pharmacyId[]"}` |

PENDING pharmacies are excluded from the list: `GET /stock?pharmacyId=5` returns `[]`.

## Contract sweep & envelope verification (commit 19, test t4)

Run on 2026-11-17 by Sayem, verifying status codes, error shapes, and absence of leakages across all routes.

| # | Check | Route / Request | Expected | Actual | Note |
| --- | --- | --- | --- | --- | --- |
| 1 | Terminal 404 | `GET /nonexistent-route` | 404 | 404 | `{"error":"Route not found"}` |
| 2 | Terminal 404 method | `POST /nonexistent` | 404 | 404 | `{"error":"Route not found"}` |
| 3 | Approved code set | All endpoints | 200/201/204/400/401/403/404/500 | Confirmed | 401/403 only on `/auth`, `/holds`, `/stock` and `/pharmacies/mine`; no 409, 422 or 429 |
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

## Pharmacy ownership (test t9)

Run on 2026-11-20 by Vishal against the live local database, `NODE_ENV=development`. Owner A registered a pharmacy; Owner B registered a separate account.

| # | Method | Request | Expected | Actual | Body / note |
| --- | --- | --- | --- | --- | --- |
| 1 | `GET` | `/pharmacies/mine` with no cookie | 401 | 401 | `{"error":"Authentication required"}` |
| 2 | `POST` | `/auth/register` Owner A | 201 | 201 | no pharmacy yet |
| 3 | `GET` | `/pharmacies/mine` as A | 404 | 404 | `{"error":"No pharmacy registered"}` |
| 4 | `POST` | `/pharmacies/mine` as A, full body | 201 | 201 | `status: VERIFIED`, `ownerId` = A |
| 5 | `POST` | `/pharmacies/mine` as A again | 400 | 400 | `{"error":"This account already registered a pharmacy"}` |
| 6 | `POST` | `/stock` as A for A’s pharmacy, medicine 1 | 201 | 201 | stock row 24 |
| 7 | `POST` | `/stock` as A for pharmacy 1 (not A’s) | 403 | 403 | `{"error":"You can only add stock to your own pharmacy"}` |
| 8 | `POST` | `/stock` as B for A’s pharmacy | 403 | 403 | same ownership check |
| 9 | `PUT` | `/stock/24` as B | 403 | 403 | `{"error":"You can only change your own pharmacy stock"}` |
| 10 | `DELETE` | `/stock/24` as B | 403 | 403 | same ownership check |
| 11 | `POST` | `/stock` with no cookie | 401 | 401 | `{"error":"Authentication required"}` |
| 12 | `GET` | `/pharmacies?medicine=dolo` | 200 | 200 | A’s pharmacy is included once it has stock |

A second owner account confirmed the success path on its own stock: `PUT /stock/26` returned 200 with the new quantity and price, and `DELETE /stock/26` returned 204. The test users, pharmacy and stock rows were removed afterward.

## Catalogue page (development tool, test t10)

Run on 2026-11-20 by Vishal in headless Chrome against the live local database.

| # | Check | Result | Note |
| --- | --- | --- | --- |
| 1 | Create an account with the optional pharmacy fields | 201 + 201 | account and pharmacy created; the account page shows the pharmacy name and the registration form is hidden |
| 2 | Open the catalogue as a user with no pharmacy | Pass | “No pharmacy registered for this account” is shown and the stock form is hidden |
| 3 | Open the catalogue as the pharmacy owner | Pass | “Your pharmacy” shows the name, area, status and licence; the stock form is visible |
| 4 | Add 3 units of Dolo 650 in rupees | 201 | the page shows “Stock added”, the stock table gains a row, and the medicine appears in search |

The page sends `pharmacyId` from `/pharmacies/mine`, so it cannot be pointed at another pharmacy; the API returns `403` if it is (ownership row 7/8). The earlier `/catalogue/pharmacies` fixture was removed.

## Fixture refresh (2026-11-20)

The development fixtures now hold **18 medicines, 6 pharmacies (4 VERIFIED, 2 PENDING) and 31 stock rows**. Every pharmacy carries a seeded `distanceKm` value (1.2, 2.4, 3.6, 4.8, 5.3, 6.1) that the client shows beside a result; it is stored sample data, not a GPS or haversine measurement.

A fresh authenticated `GET /pharmacies?medicine=dolo` returns four verified pharmacies, cheapest first: City Care Pharmacy ₹31.00 (2.4 km), Kundli Health Store ₹31.50 (4.8 km), Sanjeevani Medicos ₹32.00 (1.2 km), Highway 24x7 Chemist ₹33.00 (3.6 km). The two PENDING pharmacies and the zero-quantity rows stay hidden.

## Account types, address and editing (test t11)

Run on 2026-11-20 by Vishal against the live local database, `NODE_ENV=development`, fixture set 18/6/31. A customer (`Tara`, 9333333333) and a pharmacy account (`Om`, 9444444444) were registered, then removed with their pharmacy and temporary medicine.

| # | Method | Request | Expected | Actual | Body / note |
| --- | --- | --- | --- | --- | --- |
| 1 | `POST` | `/auth/register` customer without `address` | 400 | 400 | `{"error":"Provide a name, a 10-digit mobile number, an address, a password of 8 to 72 characters, and a valid account type"}` |
| 2 | `POST` | `/auth/register` customer with address | 201 | 201 | `accountType: CUSTOMER`, `address` echoed, no `passwordHash` |
| 3 | `POST` | `/auth/register` pharmacy account with address | 201 | 201 | `accountType: PHARMACY`; a session is started |
| 4 | `GET` | `/pharmacies?medicine=dolo` with no cookie | 401 | 401 | `{"error":"Authentication required"}`: live search is account-only |
| 5 | `GET` | `/pharmacies?medicine=dolo` as the customer | 200 | 200 | 4 verified pharmacies, cheapest first, each with `distanceKm`; no `ownerId` |
| 6 | `POST` | `/medicines` as the customer | 403 | 403 | `{"error":"Pharmacy owners only"}` |
| 7 | `POST` | `/stock` as the customer | 403 | 403 | `{"error":"Pharmacy owners only"}` |
| 8 | `GET` | `/pharmacies/mine` as the customer | 403 | 403 | `{"error":"Pharmacy owners only"}` |
| 9 | `POST` | `/pharmacies/mine` as the owner | 201 | 201 | `status: VERIFIED`, `distanceKm: 2.5`, `ownerId` set |
| 10 | `PUT` | `/pharmacies/mine` as the owner | 200 | 200 | name, area, address and phone changed; `status` and `licenceNumber` unchanged |
| 11 | `PUT` | `/auth/me` as the customer | 200 | 200 | name and address changed; `accountType` and `phone` unchanged; no hash |
| 12 | `POST` | `/medicines` as the owner | 201 | 201 | `{"id":24,"name":"Temp Med","form":"TABLET"}` |
| 13 | `PUT` | `/medicines/24` as the owner | 200 | 200 | renamed to `Temp Med 10`, form `CAPSULE` |
| 14 | `DELETE` | `/medicines/24` as the customer | 403 | 403 | `{"error":"Pharmacy owners only"}` |
| 15 | `POST` | `/stock` for the owner’s pharmacy, medicine 24 | 201 | 201 | stock row 41, quantity 9, ₹42.00 |
| 16 | `PUT` | `/stock/41` as the owner | 200 | 200 | quantity 12, ₹45.00; `updatedAt` moved forward |
| 17 | `PUT` | `/stock/41` as the customer | 403 | 403 | `{"error":"Pharmacy owners only"}` |
| 18 | `DELETE` | `/stock/41` as the owner | 204 | 204 | empty body |
| 19 | `DELETE` | `/medicines/24` as the owner | 204 | 204 | allowed once the stock row was gone |

Cleanup left the database at 6 pharmacies, 18 medicines, 31 stock rows, 1 account and 0 holds. The distance label was also checked in headless Chrome on `/` and `/pharmacy.html?id=2` (`2.4 km`); the steppers render at `0` and the Reserve button stays disabled until the quantity reaches 1.

## JWT, refresh rotation and RBAC (test t12)

Run on 2026-11-20 by Vishal against the live local database with the JWT build. A customer and a pharmacy account were registered, then removed.

| # | Method | Request | Expected | Actual | Body / note |
| --- | --- | --- | --- | --- | --- |
| 1 | `POST` | `/api/v1/auth/register` customer | 201 | 201 | `user.role: CUSTOMER`, `accessToken`, `expiresIn: 900`; refresh cookie set |
| 2 | `GET` | `/api/v1/auth/me` with `Bearer` | 200 | 200 | account returned; no `passwordHash` |
| 3 | `GET` | `/api/v1/auth/me` with `Bearer not-a-token` | 401 | 401 | `{"error":"Invalid or expired access token"}` |
| 4 | `POST` | customer tries `/api/v1/medicines` | 403 | 403 | `{"error":"Insufficient permissions"}` |
| 5 | `GET` | customer tries `/api/v1/admin/overview` | 403 | 403 | `{"error":"Insufficient permissions"}` |
| 6 | `POST` | `/api/v1/auth/refresh` with the cookie | 200 | 200 | new access token; old refresh hash revoked |
| 7 | `POST` | `/api/v1/auth/logout` | 204 | 204 | cookie cleared |
| 8 | `POST` | `/api/v1/auth/refresh` after logout | 401 | 401 | `{"error":"Refresh token missing"}` |
| 9 | `PUT` | `/api/v1/auth/password` with the current password | 204 | 204 | every refresh token revoked |
| 10 | `POST` | login with the old password | 401 | 401 | `{"error":"Invalid phone or password"}` |
| 11 | `POST` | login with the new password | 200 | 200 | new access token |
| 12 | `POST` | `/api/v1/auth/logout-all` | 204 | 204 | refresh after it returns 401 |

## Admin, audit and operations (test t13)

Run on 2026-11-20 by Vishal with an administrator account.

| # | Method | Request | Expected | Actual | Body / note |
| --- | --- | --- | --- | --- | --- |
| 1 | `GET` | `/api/v1/admin/overview` | 200 | 200 | counts, `nextPending`, recent audit |
| 2 | `GET` | `/api/v1/admin/pharmacies?status=PENDING&page=1&limit=5` | 200 | 200 | `pagination` envelope with two pending rows |
| 3 | `POST` | `/api/v1/pharmacies` (development create) | 201 | 201 | PENDING pharmacy 19 |
| 4 | `PATCH` | `/api/v1/admin/pharmacies/19` `{"status":"VERIFIED"}` | 200 | 200 | status changed; audit entry written |
| 5 | `GET` | `/api/v1/admin/audit?page=1&limit=5` | 200 | 200 | `pagination` envelope, newest first |
| 6 | `POST` | `/api/v1/admin/oauth-clients` | 201 | 201 | client id + one-time secret |
| 7 | `POST` | `/api/v1/admin/stock/bulk` two rows | 201 | 201 | `{"requested":2,"created":2,"skipped":0}` |
| 8 | `POST` | the same bulk row again | 201 | 201 | `{"requested":1,"created":0,"skipped":1}` |
| 9 | `GET` | `/api/v1/admin/export/stock.csv` | 200 | 200 | `text/csv`; streamed header + 31 data rows |
| 10 | `GET` | `/api/v1/admin/runtime` | 200 | 200 | event-loop p99, heap, uptime |

The test pharmacy, its stock rows, the test accounts, the OAuth clients and the audit rows were removed afterwards.

## OAuth 2.0 and OpenID Connect (test t14)

Run on 2026-11-20 by Vishal. The browser playground at `/developers.html` completed the same code + PKCE flow end to end.

| # | Request | Expected | Actual | Note |
| --- | --- | --- | --- | --- |
| 1 | `POST /oauth/token` client_credentials | 200 | 200 | `scope: holds:read`, HS256 access token |
| 2 | `GET /oauth/authorize` while signed in | 200 | 200 | consent page names the client and scopes |
| 3 | `POST /oauth/authorize` decision=approve | 302 | 302 | redirect with one-time `code` and `state` |
| 4 | `POST /oauth/token` authorization_code + PKCE | 200 | 200 | access, ID and refresh tokens |
| 5 | `GET /oauth/userinfo` | 200 | 200 | `sub`, `name`, `phone_number`, `role` |
| 6 | Decode the ID token | RS256 | RS256 | `kid` matches the JWKS key |
| 7 | `GET /.well-known/openid-configuration` | 200 | 200 | issuer, endpoints, grants, RS256 |
| 8 | `GET /oauth/jwks` | 200 | 200 | one RSA signing key |
| 9 | `POST /oauth/token` refresh_token | 200 | 200 | access and refresh tokens rotated |
| 10 | Wrong PKCE verifier | 400 | 400 | `invalid_grant` |
| 11 | `/developers.html` full browser flow | tokens | tokens | UserInfo rendered in the page |

## TOTP multi-factor authentication (test t15)

Run on 2026-11-20 by Vishal. Codes were generated with the same TOTP service (`hotp`, 30-second window).

| # | Request | Expected | Actual | Note |
| --- | --- | --- | --- | --- |
| 1 | `POST /api/v1/auth/mfa/setup` | 200 | 200 | 32-character base32 secret and `otpauth://` URI |
| 2 | `POST /api/v1/auth/mfa/enable` with a current code | 200 | 200 | `{"mfaEnabled":true}` |
| 3 | Logout, then login without `totp` | 401 | 401 | `{"error":"Enter the code from your authenticator app","mfaRequired":true}` |
| 4 | Login with a wrong code | 401 | 401 | `{"error":"Invalid authenticator code","mfaRequired":true}` |
| 5 | Login with a valid code | 200 | 200 | access token issued |
| 6 | `POST /api/v1/auth/mfa/disable` with password + code | 204 | 204 | secret cleared |
| 7 | Login without a code after disabling | 200 | 200 | MFA challenge gone |
| 8 | Browser login at 390 px | prompt | prompt | code field appears, valid code opens the dashboard, security panel shows “Enabled” |

The test account and its tokens were removed afterwards. The demo administrator (`9000000000`) and the owner account remain.
