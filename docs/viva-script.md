# Velora — Capstone Viva Script

CSA213 Advanced Programming · Rishihood University  
Presentation time: 14–16 minutes. If the examiner caps the viva at 15 minutes, fold Check 6 into the closing and keep Check 7 — accounts and holds are now the product differentiator.

## Roles & Presenters

| Team Member | Domain | Viva Checks |
| --- | --- | --- |
| **Vishal** | Project Overview, Architecture, Search, Accounts & Holds, Catalogue | Introduction, Check 2, Check 5, Check 7 |
| **Manav** | Database Modeling, Prisma Schema, Seed, Medicines API | Check 1, Check 6 (Seed) |
| **Sayem** | Stock API, Writes & Updates, Contract Sweep | Check 3, Architecture Summary |
| **Yash** | Error Envelopes, Course Demos, PostgreSQL Driver Demo | Check 4, Check 6 (pg Demo) |

---

## Timed Viva Checks (2 minutes each)

### Check 1 — Medicines read and filter (t1)

- **Presenter:** Manav
- **Focus:** Case-insensitive search, sorting, and single-resource retrieval.
- **Setup:** Seeded PostgreSQL database, server running on port 3000 (`cd server && npm start`).
- **Command:**
  ```bash
  curl -i "http://localhost:3000/medicines?name=dolo"
  ```
- **Expected Output:**
  - Status `HTTP/1.1 200 OK`
  - Body: `[{"id":1,"name":"Dolo 650","form":"TABLET"}]`
- **What it demonstrates:**
  - Case-insensitive substring filtering with Prisma (`mode: 'insensitive'`).
  - Return of bare JSON resource without superfluous response wrappers.
- **Fallback:** Open [`docs/api-checks.md`](api-checks.md#medicines-commit-14-test-t1), Medicines section, row 2.

---

### Check 2 — Pharmacies search and verification guard (t2)

- **Presenter:** Vishal
- **Focus:** Join entity query, in-stock filtering, and excluding unverified pharmacies.
- **Setup:** Server running on port 3000 and a signed-in session — live search is account-only.
- **Commands:**
  ```bash
  curl -c /tmp/velora.jar -X POST http://localhost:3000/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"phone":"9000000001","password":"password123"}'

  curl -b /tmp/velora.jar "http://localhost:3000/pharmacies?medicine=dolo"
  ```
- **Expected Output:**
  - Status `HTTP/1.1 200 OK`
  - Body: 4 verified pharmacies (City Care Pharmacy, Kundli Health Store, Sanjeevani Medicos, Highway 24x7) ordered by `pricePaise` ascending, each carrying its `distanceKm`.
  - Zero-stock rows and `PENDING` pharmacies (such as "Apna Medical Hall") are strictly excluded from the output.
  - The same request without the cookie returns `401 {"error":"Authentication required"}`.
- **What it demonstrates:**
  - Business requirement: Emergency discovery only returns pharmacies with physical stock ready for dispensing.
- **Fallback:** Open [`docs/api-checks.md`](api-checks.md#pharmacies-commit-15-test-t2), Pharmacies section, row 3.

---

### Check 3 — Stock API writes and pair uniqueness (t3)

- **Presenter:** Sayem
- **Focus:** Development-only stock writes, pharmacy ownership, parent existence validation, compound uniqueness.
- **Setup:** `NODE_ENV=development`; a demo owner session. One-time setup:
  ```bash
  # Register the demo owner (skip if it already exists)
  curl -c /tmp/owner.jar -X POST http://localhost:3000/auth/register \
    -H 'Content-Type: application/json' \
    -d '{"name":"Demo Owner","phone":"9000000001","password":"password123"}'

  # Register the owner's pharmacy
  curl -b /tmp/owner.jar -X POST http://localhost:3000/pharmacies/mine \
    -H 'Content-Type: application/json' \
    -d '{"name":"Demo Pharmacy","area":"Demo Area","address":"1 Demo Road","phone":"9000000091","licenceNumber":"HR-SNP-DEMO-0091"}'

  PHARMACY_ID=$(curl -s -b /tmp/owner.jar http://localhost:3000/pharmacies/mine \
    | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
  ```
- **Commands:**
  ```bash
  # Own pharmacy: 201, then 400 on the duplicate pair
  curl -i -b /tmp/owner.jar -X POST http://localhost:3000/stock \
    -H 'Content-Type: application/json' \
    -d "{\"pharmacyId\":$PHARMACY_ID,\"medicineId\":2,\"quantity\":10,\"pricePaise\":5000}"

  # Someone else's pharmacy: 403
  curl -i -b /tmp/owner.jar -X POST http://localhost:3000/stock \
    -H 'Content-Type: application/json' \
    -d '{"pharmacyId":1,"medicineId":2,"quantity":10,"pricePaise":5000}'
  ```
- **Expected Output:**
  - First run: `HTTP/1.1 201 Created` with the new stock row and medicine.
  - Second run: `HTTP/1.1 400 Bad Request` with `{"error":"Stock row already exists; use PUT to change it"}`.
  - Other pharmacy: `HTTP/1.1 403 Forbidden` with `{"error":"You can only add stock to your own pharmacy"}`.
- **What it demonstrates:**
  - Check-before-write validation: parent `Pharmacy` and `Medicine` must exist.
  - Pharmacy ownership: the session user must match `Pharmacy.ownerId`; a different pharmacy is `403`, and no session is `401`.
  - Duplicate `(pharmacyId, medicineId)` pairs become `400`, not an uncaught constraint error.
- **Fallback:** Open [`docs/api-checks.md`](api-checks.md#pharmacy-ownership-test-t9), Pharmacy ownership section, rows 6–11.

---

### Check 4 — Uniform error envelope and status codes (t4)

- **Presenter:** Yash
- **Evidence run:** Sayem (commit 19, t4)
- **Focus:** Predictable error shapes, terminal 404, query hardening, no stack trace leaks.
- **Setup:** Server running.
- **Commands:**
  ```bash
  # 1. PENDING pharmacy detail lookup
  curl -i "http://localhost:3000/pharmacies/5"

  # 2. Bracket query hardening
  curl -i "http://localhost:3000/medicines?name[]=dolo"

  # 3. Unmatched route
  curl -i "http://localhost:3000/unmatched-route"
  ```
- **Expected Output:**
  - Request 1: `HTTP/1.1 404 Not Found` → `{"error":"Pharmacy not found"}`
  - Request 2: `HTTP/1.1 400 Bad Request` → `{"error":"Invalid query parameter: name[]"}`
  - Request 3: `HTTP/1.1 404 Not Found` → `{"error":"Route not found"}`
- **What it demonstrates:**
  - Restricted HTTP status code set; 401/403 appear only on auth/hold routes (approved exception).
  - Absolute suppression of server stack traces and raw Prisma errors.
- **Fallback:** Open [`docs/api-checks.md`](api-checks.md#contract-sweep--envelope-verification-commit-19-test-t4), Contract sweep section, rows 1, 7, 8.

---

### Check 5 — Client search-to-detail interaction (t5)

- **Presenter:** Vishal
- **Focus:** Responsive client, navigation from search results to pharmacy detail page, DOM safety.
- **Setup:** Open browser at `http://localhost:3000` and sign in as a customer.
- **Steps:**
  1. Logged out, point out the “Log in to search” panel instead of the search form.
  2. Sign in, type `dolo` into the search field and submit.
  3. Point out that the results slide into view: 4 verified pharmacy cards with price, quantity and distance.
  4. Click on the pharmacy name link (e.g. `City Care Pharmacy`).
  5. Observe navigation to `/pharmacy.html?id=2`.
  6. Point out the rendered details: name, area, address, distance, phone, licence number, and tabular current stock breakdown.
  7. Each quantity stepper starts at `0` and **Reserve** stays disabled until it reaches `1`.
  8. Navigate directly to `/pharmacy.html?id=5` to show graceful error handling ("Pharmacy not found.") with a functional back link.
- **What it demonstrates:**
  - Zero build step, static client served via `express.static`.
  - Safe DOM manipulation using `textContent` and `document.createElement`, strictly avoiding `innerHTML` interpolation of API data.
- **Fallback:** Inspect [`server/public/pharmacy.js`](../server/public/pharmacy.js) and [`server/public/app.js`](../server/public/app.js).

---

### Check 6 — Seed idempotency and direct PostgreSQL demo (t6)

- **Presenter:** Yash & Manav
- **Focus:** Idempotent development fixtures and lecture-aligned PostgreSQL driver demonstration.
- **Setup:** Terminal inside `server/` directory.
- **Commands:**
  ```bash
  # 1. Rerun seed script
  node prisma/dev-seed.js

  # 2. Run standalone pg driver demo
  node course-demos/pg/index.js 1
  ```
- **Expected Output:**
  - Seed execution: Reports `created: 0` across all models (18 medicines, 6 pharmacies, 31 stock rows existing), confirming idempotency.
  - pg demo execution:
    ```text
    pg rows: 7
    { id: 1, pharmacyId: 1, medicineId: 1, quantity: 40, pricePaise: 3200, ... }
    prisma rows: 7
    ```
- **What it demonstrates:**
  - L3–L4 asynchronous file operations with `fs.promises.readFile`.
  - L11 `pg.Pool`, parameterized query with `$1`, quoted identifiers (`"StockItem"`), and verification against Prisma's count.
- **Fallback:** Open [`server/course-demos/pg/README.md`](../server/course-demos/pg/README.md) and [`server/prisma/dev-seed.js`](../server/prisma/dev-seed.js).

---

### Check 7 — Accounts and 30-minute holds (t7 / t8)

- **Presenter:** Vishal
- **Focus:** Session authentication, bcrypt storage, owner-only holds, atomic stock decrement and expiry restore.
- **Setup:** Server running, seeded database, `NODE_ENV=development`.
- **Commands:**
  ```bash
  curl -c /tmp/velora.jar -X POST http://localhost:3000/auth/register \
    -H 'Content-Type: application/json' \
    -d '{"name":"Asha","phone":"9000000001","address":"12 Model Town, Sonipat","password":"password123","accountType":"CUSTOMER"}'

  curl -b /tmp/velora.jar -X POST http://localhost:3000/holds \
    -H 'Content-Type: application/json' \
    -d '{"stockItemId":1,"quantity":2}'

  curl -b /tmp/velora.jar http://localhost:3000/holds
  ```
- **Expected Output:**
  - Register: `201` with the user and no `passwordHash`.
  - Hold: `201`, status `ACTIVE`, `expiresAt` about 30 minutes ahead.
  - List: one hold; pharmacy 1 stock drops by 2.
  - `DELETE /holds/:id` returns `204` and restores the stock.
- **What it demonstrates:**
  - bcrypt hashing, an HttpOnly session cookie, `401` without a session and `403` for another user's hold.
  - `$transaction` + `updateMany` so two users cannot reserve the same last strip; an expired hold returns its stock once.
  - The approved exception recorded in `AGENTS.md`; the MemoryStore and missing CSRF token are stated as local-only limits.
  - **Pharmacy ownership:** the account form can register one pharmacy; `GET /pharmacies/mine` returns it, and `/catalogue.html` lets the owner add stock only to that pharmacy. Another pharmacy is `403`.
  - The catalogue is a development tool, not a staff role; the public pharmacy create route still starts PENDING, and the development build auto-verifies the account's pharmacy.
  - **Account types and editing:** signup records `CUSTOMER` or `PHARMACY`. A customer gets `403` on medicine and stock writes, so the hidden catalogue link is presentation only. The profile form edits name, mobile and address; the pharmacy form edits name, area, address and phone; medicine and stock rows edit and delete from the catalogue.
- **Fallback:** Open [`docs/api-checks.md`](api-checks.md#accounts-approved-exception-test-t7), Accounts, Holds, Pharmacy ownership and Catalogue sections.

---

## Conclusion & Examiner Questions (~2 minutes)

- Summarize the strict adherence to the CSA213 syllabus (L0–L9, L11, L12).
- Highlight the approved exception (accounts and 30-minute holds), its local-only limits (MemoryStore, no CSRF token, no password reset), and the remaining exclusions (no admin role, payments, GPS/geospatial calculation, React). State plainly that the distance label is a stored sample value, not a measurement.
- Invite examiner questions.
