# Velora — Capstone Viva Script

CSA213 Advanced Programming · Rishihood University  
Presentation time: 12–14 minutes (under 15 minutes total).

## Roles & Presenters

| Team Member | Domain | Viva Checks |
| --- | --- | --- |
| **Vishal** | Project Overview, Architecture, Search & Static Client | Introduction, Check 2, Check 5 |
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
- **Setup:** Server running on port 3000.
- **Command:**
  ```bash
  curl -i "http://localhost:3000/pharmacies?medicine=dolo"
  ```
- **Expected Output:**
  - Status `HTTP/1.1 200 OK`
  - Body: List of 3 verified pharmacies (City Care Pharmacy, Sanjeevani Medicos, Highway 24x7) ordered by `pricePaise` ascending.
  - Zero-stock rows and `PENDING` pharmacies (such as "Apna Medical Hall") are strictly excluded from the output.
- **What it demonstrates:**
  - Business requirement: Emergency discovery only returns pharmacies with physical stock ready for dispensing.
- **Fallback:** Open [`docs/api-checks.md`](api-checks.md#pharmacies-commit-15-test-t2), Pharmacies section, row 3.

---

### Check 3 — Stock API writes and pair uniqueness (t3)

- **Presenter:** Sayem
- **Focus:** Development-only write operations, parent existence validation, compound uniqueness.
- **Setup:** `NODE_ENV=development`.
- **Command:**
  ```bash
  curl -i -X POST http://localhost:3000/stock \
    -H 'Content-Type: application/json' \
    -d '{"pharmacyId":1,"medicineId":2,"quantity":10,"pricePaise":5000}'
  ```
- **Expected Output:**
  - First run: `HTTP/1.1 201 Created` returning the new stock row with associated medicine data and `updatedAt`.
  - Second run (immediate re-run): `HTTP/1.1 400 Bad Request` with `{"error":"Stock row already exists; use PUT to change it"}`.
- **What it demonstrates:**
  - Check-before-write validation: Verifies parent `Pharmacy` and `Medicine` exist before insert.
  - Prevention of duplicate `(pharmacyId, medicineId)` pairs mapped to `400` instead of uncaught database constraint crashes.
- **Fallback:** Open [`docs/api-checks.md`](api-checks.md#stock-commit-16-test-t3), Stock section, rows 4 and 7.

---

### Check 4 — Uniform error envelope and status codes (t4)

- **Presenter:** Yash
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
  - Restricted HTTP status code set (200, 201, 204, 400, 404, 500).
  - Absolute suppression of server stack traces and raw Prisma errors.
- **Fallback:** Open [`docs/api-checks.md`](api-checks.md#contract-sweep--envelope-verification-commit-19-test-t4), Contract sweep section, rows 1, 7, 8.

---

### Check 5 — Client search-to-detail interaction (t5)

- **Presenter:** Vishal
- **Focus:** Responsive client, navigation from search results to pharmacy detail page, DOM safety.
- **Setup:** Open browser at `http://localhost:3000`.
- **Steps:**
  1. Type `dolo` into the search field and submit.
  2. Point out that the 3 verified pharmacy cards appear with pricing and matching stock.
  3. Click on the pharmacy name link (e.g. `City Care Pharmacy`).
  4. Observe navigation to `/pharmacy.html?id=2`.
  5. Point out the rendered details: name, area, address, phone, licence number, and tabular current stock breakdown.
  6. Navigate directly to `/pharmacy.html?id=5` to show graceful error handling ("Pharmacy not found.") with a functional back link.
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
  - Seed execution: Reports `created: 0` across all models (12 medicines, 6 pharmacies, 20 stock rows existing), confirming idempotency.
  - pg demo execution:
    ```text
    pg rows: 5
    { id: 1, pharmacyId: 1, medicineId: 1, quantity: 40, pricePaise: 3000, ... }
    prisma rows: 5
    ```
- **What it demonstrates:**
  - L3–L4 asynchronous file operations with `fs.promises.readFile`.
  - L11 `pg.Pool`, parameterized query with `$1`, quoted identifiers (`"StockItem"`), and verification against Prisma's count.
- **Fallback:** Open [`server/course-demos/pg/README.md`](../server/course-demos/pg/README.md) and [`server/prisma/dev-seed.js`](../server/prisma/dev-seed.js).

---

## Conclusion & Examiner Questions (~2 minutes)

- Summarize the strict adherence to the CSA213 syllabus (L0–L9, L11, L12).
- Highlight documented limitations (no authentication, no transaction reservations, no geospatial math, no React).
- Invite examiner questions.
