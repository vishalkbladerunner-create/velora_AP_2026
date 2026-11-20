# Velora — Capstone Project Report

**Course:** CSA213 Advanced Programming  
**Institution:** Rishihood University  
**Term:** Autumn 2026  
**Authors:** Vishal, Manav, Yash, Sayem  
**Repository:** [github.com/vishalkbladerunner-create/velora_AP_2026](https://github.com/vishalkbladerunner-create/velora_AP_2026)  
**Live Tracker:** [velora-capstone.pages.dev/tracker](https://velora-capstone.pages.dev/tracker/)

---

## 1. Executive Summary & Problem Statement

In emergency and acute medical situations—particularly outside standard business hours in suburban or peri-urban centers such as Sonipat, Haryana—locating a pharmacy with essential prescribed medications in stock is frequently slow, fragmented, and distressing. The prevailing real-world workflow requires families or caregivers to travel physically or place sequential phone calls to independent chemists, encountering frequent stock-outs or unverified providers.

**Velora** addresses this specific problem by providing a focused, real-time discovery engine: users query a required medicine name, and the system returns exclusively **verified** pharmacies that currently hold that medicine in **stock with a quantity greater than zero**, ordered by unit price. A patient can create an account and reserve part of that stock for 30 minutes, so the medicine is still there when they arrive.

The software was developed as a pedagogical demonstration of the CSA213 curriculum, implemented using Node.js, Express 5, Prisma ORM, and PostgreSQL. The engineering scope intentionally prioritizes architectural clarity, strict contract conformance, and verifiable reproducibility over feature sprawl.

---

## 2. System Architecture

Velora is engineered as a monolithic single-process Node.js service combining a RESTful API backend with a static web client served directly by the Node runtime.

### Layered Separation of Concerns

```text
Browser Client (HTML / CSS / Vanilla JS)
           │ HTTP
           ▼
Express App Middleware Chain (server/src/app.js)
  ├─ express.json()
  ├─ Custom Request Logger (server/src/middlewares/logger.js)
  ├─ express-session (HttpOnly, SameSite=Lax)
  ├─ express.static() [public/]
  └─ Route Handlers (/health, /medicines, /pharmacies, /stock, /auth, /holds)
           │
           ▼
Controllers (server/src/controllers/)
  ├─ Validation, bracket-query guards, integer casting
  ├─ Session guard + hold/pharmacy ownership checks
  └─ Status code mapping & response formatting
           │
           ▼
Prisma ORM Client (server/src/db/prisma.js)
           │ TCP / Connection Pool
           ▼
PostgreSQL Database (schema: public)
```

1. **Middleware Pipeline ([`server/src/app.js`](../server/src/app.js)):**
   - Inbound HTTP payloads pass first through `express.json()`.
   - Logging is executed by custom middleware printing `METHOD URL` ([`server/src/middlewares/logger.js`](../server/src/middlewares/logger.js)).
   - Static asset requests (such as `index.html`, `pharmacy.html`, `account.html`, `catalogue.html`, `app.js`, and `styles.css`) are served from `server/public/` before API routing.
   - Resource routers handle `/health`, `/medicines`, `/pharmacies` (including `/mine`), `/stock`, `/auth`, and `/holds`.
   - Unmatched paths fall through to a terminal 404 handler that dispatches a structured JSON error `{ "error": "Route not found" }` and terminates the request without invoking `next()`.

2. **Environment & Fail-Fast Configuration ([`server/src/config/env.js`](../server/src/config/env.js)):**
   - In adherence to 12-factor principles, environment variables (`DATABASE_URL`, `SESSION_SECRET`, `PORT`, `NODE_ENV`) are validated upon boot. Missing mandatory variables halt startup immediately with a clear diagnostics message rather than throwing runtime errors mid-flight.

3. **HTTP Response Contract:**
   - **Success (Read):** HTTP 200 with raw resource payload (no extraneous envelopes).
   - **Success (Creation):** HTTP 201 with newly created resource entity.
   - **Success (Deletion):** HTTP 204 No Content with an empty response body.
   - **Client Errors:** HTTP 400 Bad Request with `{ "error": "<explanation>" }`.
   - **Authentication / Role:** HTTP 401 for a missing session (accounts, holds, live search) and HTTP 403 when the session’s account type or ownership does not permit the write. No other route returns 401/403.
   - **Resource Not Found:** HTTP 404 Not Found with `{ "error": "<explanation>" }`.
   - **Server Fault:** HTTP 500 Internal Server Error with `{ "error": "<message>" }`; internal stack traces and Prisma query diagnostics are strictly logged on the server and suppressed from the client.
   - 401/403 are the approved exception; 409, 422 and 429 are still not used.

---

## 3. Relational Data Model

The database schema ([`server/prisma/schema.prisma`](../server/prisma/schema.prisma)) models the emergency medicine inventory domain across five core tables, managed via Prisma migrations. The first three are the catalogue; `User` and `Hold` add accounts and 30-minute reservations.

```text
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│    Medicine     │       │    StockItem    │       │    Pharmacy     │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │◄───┐  │ id (PK)         │  ┌───►│ id (PK)         │
│ name (UK)       │    └──┤ medicineId (FK) │  │    │ name            │
│ form            │       │ pharmacyId (FK) ├──┘    │ area            │
└─────────────────┘       │ quantity        │       │ address         │
                          │ pricePaise      │       │ phone           │
                          │ createdAt       │       │ licenceNumber(UK)
                          │ updatedAt       │       │ status (default │
                          └─────────────────┘       │   'PENDING')    │
                                                    └─────────────────┘
```

A `User` stores an id, name, unique mobile number, an optional stored address, an `accountType` of `CUSTOMER` or `PHARMACY`, a bcrypt `passwordHash` and `createdAt`. A `Hold` stores an id, `userId`, `stockItemId`, quantity, status (`ACTIVE`, `CANCELLED` or `EXPIRED`), `expiresAt` and `createdAt`. `User` has many holds and can own one `Pharmacy` through the nullable unique `ownerId`; seeded pharmacies have no owner. `StockItem` has many holds.

### Relational Integrity Rules

1. **Many-to-Many Decomposition:** `StockItem` serves as an associative table linking `Pharmacy` and `Medicine`.
2. **Compound Uniqueness:** A unique constraint on `(pharmacyId, medicineId)` prevents duplicate inventory records for the same medication at a single pharmacy.
3. **Monetary Precision:** Prices are stored exclusively as integer **paise** (`pricePaise`), eliminating IEEE 754 floating-point inaccuracies. Formatted rupee symbols (`₹`) are generated solely at the presentation boundary.
4. **Verification State:** Pharmacies feature a `status` attribute defaulting to `'PENDING'`. Only pharmacies marked as `'VERIFIED'` are searchable by consumers, retrievable via detail routes, or reservable through `/stock` and `/holds`.
5. **Timestamp Tracking:** `StockItem.updatedAt` is defined as a concrete `DateTime` field; application controllers explicitly assign `new Date()` upon creation and modification to guarantee predictable timestamp refreshes.
6. **Account Identity:** `User.phone` is unique. The password is stored only as a bcrypt hash and is never returned by an endpoint.
7. **Hold Ownership:** A `Hold` has one `userId` and one `stockItemId`; only the owner may cancel it, and the check returns `403` for anyone else.
8. **Atomic Stock:** A hold is created inside `$transaction`: `updateMany` decrements only when `quantity >= requested`, so two users cannot reserve the same last strip. Cancelling or expiring the hold increments the row back once.
9. **Pharmacy Ownership:** `Pharmacy.ownerId` is nullable and unique, so one account owns at most one pharmacy. `POST`/`PUT`/`DELETE /stock` compare the session user with the row’s `ownerId` and return `403` for anyone else, and `PUT /pharmacies/mine` edits only that owner’s row.
10. **Account Types:** `User.accountType` is set by the server at registration. Medicine writes require a `PHARMACY` account; stock writes require the pharmacy’s owner. A customer receives `403`, so the role boundary survives a direct API call.
11. **Stored Distance:** `Pharmacy.distanceKm` is a sample value seeded per pharmacy and displayed beside each result. It is deliberately not a GPS, geocoder or haversine computation.

---

## 4. Lecture Syllabus Traceability

The project exercises the CSA213 curriculum across the API, the client and the database layer.

*Note on Syllabus Scope: Lecture 10 was not provided in the course syllabus; this report covers all taught lectures (L0–L9, L11, and L12). The accounts and holds row is the one approved exception, recorded in `AGENTS.md`.*

| Lecture | Syllabus Subject | Repository Evidence | Concrete Role in Velora |
| --- | --- | --- | --- |
| **L0–L1** | Node.js Architecture, CommonJS, V8 Runtime | [`server/src/server.js`](../server/src/server.js)<br>[`server/package.json`](../server/package.json) | Process lifecycle, CommonJS `require`/`module.exports`, non-blocking event loop execution. |
| **L2** | Asynchronous Programming | [`server/src/controllers/holds.controller.js`](../server/src/controllers/holds.controller.js) | Promise-based request handling with `async`/`await`, asynchronous bcrypt calls and propagated errors. |
| **L3–L4** | File System (`fs`) & Modules | [`server/prisma/dev-seed.js`](../server/prisma/dev-seed.js) | `fs.promises.readFile` for asynchronous JSON fixture loading; CommonJS modules share one Prisma client. |
| **L5–L6** | HTTP Methods, Status Codes & JSON | [`server/src/controllers/`](../server/src/controllers/) | Verbs map to routes; 200/201/204/400/404 responses carry JSON bodies and structured errors. |
| **L7** | Express Basics & Routing | [`server/src/routes/`](../server/src/routes/) | Route parameters (`:id`), query parameters, HTTP verbs (GET, POST, PUT, DELETE), JSON error responses. |
| **L8** | Express Middleware Chain | [`server/src/app.js`](../server/src/app.js)<br>[`server/src/middlewares/logger.js`](../server/src/middlewares/logger.js) | Linear pipeline: body parsing, custom request logging, static directory mounting, terminal 404 fallback. |
| **L9** | RESTful Architecture & Static Serving | [`server/src/controllers/`](../server/src/controllers/)<br>[`server/public/`](../server/public/) | Resource-oriented URL schemas, state-driven vanilla front-end (`index.html`, `pharmacy.html`) consuming JSON APIs. |
| **L11** | PostgreSQL | [`server/prisma/schema.prisma`](../server/prisma/schema.prisma)<br>[`server/prisma/migrations/`](../server/prisma/migrations/) | PostgreSQL stores the full relational model; access goes through Prisma Client rather than a separate driver. |
| **L12** | ORM Modeling & Prisma Client | [`server/prisma/schema.prisma`](../server/prisma/schema.prisma)<br>[`server/src/db/prisma.js`](../server/src/db/prisma.js)<br>[`server/src/controllers/stock.controller.js`](../server/src/controllers/stock.controller.js) | Shared Prisma singleton pool, declarative relation filtering, `findMany`, `findUnique`, `create`, `update`, `delete`. |
| **Approved exception** | bcrypt, express-session, 401/403, Prisma `updateMany` + `$transaction` | [`server/src/controllers/auth.controller.js`](../server/src/controllers/auth.controller.js)<br>[`server/src/controllers/holds.controller.js`](../server/src/controllers/holds.controller.js)<br>[`server/src/middlewares/auth.js`](../server/src/middlewares/auth.js) | Patient accounts and 30-minute stock holds. Recorded in `AGENTS.md`; time-boxed to CP5. |

---

## 5. Verification & Test Evidence

All API endpoints and operational workflows were verified through end-to-end command line testing (`curl`), manual browser verification, and reproducible seed checks. The detailed evidence is cataloged in [`docs/api-checks.md`](api-checks.md).

### Summary of Acceptance Test Suites

- **t0 · Health Check:** `GET /health` confirms runtime health returning `200 {"ok":true}`.
- **t1 · Medicines API (Commit 14):** 10/10 checks passing. Validates name filtering, integer validation on `:id`, duplicate prevention, and blocking deletion of medicines linked to active stock rows.
- **t2 · Pharmacies API (Commit 15):** 13/13 checks passing. Validates that search returns only verified pharmacies with stock quantity > 0, verifies cheapest-first price sorting, and verifies that `GET /pharmacies/5` (unverified `PENDING` pharmacy) returns `404 Not Found`.
- **t3 · Stock reads (Commit 16):** 3/3 checks passing. Confirms listing by `pharmacyId`, invalid-id `400`, bracket-query `400`, and PENDING exclusion. Writes are now owner-only and are covered by t9.
- **t4 · Envelope & Status Code Sweep (Commit 19):** 8/8 checks passing. Confirms the status set, validates `{ error }` envelope structure, ensures terminal 404 on invalid routes, and verifies bracket parameter rejection (`?name[]=dolo` → `400`).
- **t5 · Client Wiring (Commit 18):** Verified on desktop (1280px) and mobile (390px) viewports. Search results link to `/pharmacy.html?id=<id>`, displaying pharmacy metadata and stock table; 404 and API down states render graceful human-readable errors.
- **t6 · Seed Idempotency (Commit 17):** Running `node prisma/dev-seed.js` twice produces zero net creations on subsequent runs and reports the same totals.
- **t7 · Accounts:** 9/9 checks passing. Register, duplicate phone, login, bad password, `/auth/me`, logout, and a stored `$2b$` hash with no hash in any response.
- **t8 · Holds:** 10/10 checks passing. Reserve, list, cross-user `403`, cancel with stock restore, insufficient stock, PENDING stock, expiry restore, and no double restore.
- **t9 · Pharmacy ownership:** 12/12 checks passing. `GET /pharmacies/mine` is 404 before registration, `POST /pharmacies/mine` creates one VERIFIED pharmacy, a second registration is 400, own stock is 201, another pharmacy and another user get 403, an anonymous write gets 401, and an owner `PUT`/`DELETE` returns 200/204.
- **t10 · Catalogue page:** 4/4 checks passing. Signup with pharmacy fields creates the account and pharmacy, the page shows only that pharmacy, stock is added in rupees, and the medicine appears in search.
- **t11 · Account types and editing:** 12/12 checks passing. Customer and pharmacy signups produce the right `accountType`, a customer gets `403` on medicine and stock writes, search requires a session, profile and pharmacy details update, medicine and stock rows edit and delete, and the distance label renders on results and detail.

---

## 6. Documented Limitations & Explicit Non-Goals

The following elements remain excluded or deliberately limited:

1. **Local-only sessions and holds:** Accounts use bcrypt and Express MemoryStore sessions; holds use `$transaction` + `updateMany`. Both are the approved exception recorded in `AGENTS.md`. The MemoryStore loses sessions on restart and is not a production store; there is no CSRF token, rate limiting, email verification or password reset.
2. **Two account types, no admin workflow:** Accounts are either `CUSTOMER` or `PHARMACY`, which gates the catalogue and stock writes server-side. There is no administrator role, no licence-verification workflow, no email/SMS and no payment integration. Catalogue write routes remain development-only. An account can register one pharmacy and change only that pharmacy’s stock; the development build auto-verifies it, while production would keep it PENDING until a real verification workflow exists.
3. **No Geolocation or Spatial Indexing:** Proximity matching uses textual area containment rather than GPS coordinates, PostGIS, or haversine calculations. The distance shown beside each result is a seeded `distanceKm` value stored on the pharmacy for presentation; it is not derived from the user’s address.
4. **No MongoDB or Polyglot Persistence:** PostgreSQL and Prisma comprise the entire database tier; NoSQL engines are deliberately omitted.
5. **No Client Frameworks or Heavy Toolchains:** The front-end contains no React, Vue, TypeScript, Tailwind, Webpack, or Babel. It utilizes standard DOM APIs with zero build steps.
6. **No Cloud Deployment Automation:** The project is configured for local evaluation via Node.js and local PostgreSQL.

---

## 7. Team Contributions

| Member | Branch Responsibilities | Key Deliverables |
| --- | --- | --- |
| **Vishal** | Toolchain, Express Skeleton, Search Client, Documentation, Accounts and Holds, Pharmacy Ownership, Development Catalogue, Account Types and Editing | Architecture design, README, basic client, PR review, approved-exception auth/hold build, owner-only stock, typed accounts, profile/pharmacy/medicine/stock editing, responsive client |
| **Manav** | Prisma Schema, Migration, Dev Seed, Medicines & Pharmacies APIs | Data model migrations, seed fixtures, t1/t2 test suites |
| **Yash** | Error Utilities, Demo Presentation | Error infrastructure; presents t4 |
| **Sayem** | Stock API, Client Detail Wiring, Contract Sweep & Report | Commits c16–c20: Stock CRUD, pharmacy detail page, sweep audit and final report |

---

*Report finalized on 20 November 2026 for CSA213 Advanced Programming.*
