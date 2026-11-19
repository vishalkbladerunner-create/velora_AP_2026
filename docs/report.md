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

**Velora** addresses this specific problem by providing a focused, real-time discovery engine: users query a required medicine name, and the system returns exclusively **verified** pharmacies that currently hold that medicine in **stock with a quantity greater than zero**, ordered by unit price.

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
  ├─ express.static() [public/]
  └─ Route Handlers (/health, /medicines, /pharmacies, /stock)
           │
           ▼
Controllers (server/src/controllers/)
  ├─ Validation, bracket-query guards, integer casting
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
   - Static asset requests (such as `index.html`, `pharmacy.html`, `app.js`, and `styles.css`) are served from `server/public/` before API routing.
   - Resource routers handle `/health`, `/medicines`, `/pharmacies`, and `/stock`.
   - Unmatched paths fall through to a terminal 404 handler that dispatches a structured JSON error `{ "error": "Route not found" }` and terminates the request without invoking `next()`.

2. **Environment & Fail-Fast Configuration ([`server/src/config/env.js`](../server/src/config/env.js)):**
   - In adherence to 12-factor principles, environment variables (`DATABASE_URL`, `PORT`, `NODE_ENV`) are validated upon boot. Missing mandatory variables halt startup immediately with a clear diagnostics message rather than throwing runtime errors mid-flight.

3. **HTTP Response Contract:**
   - **Success (Read):** HTTP 200 with raw resource payload (no extraneous envelopes).
   - **Success (Creation):** HTTP 201 with newly created resource entity.
   - **Success (Deletion):** HTTP 204 No Content with an empty response body.
   - **Client Errors:** HTTP 400 Bad Request with `{ "error": "<explanation>" }`.
   - **Resource Not Found:** HTTP 404 Not Found with `{ "error": "<explanation>" }`.
   - **Server Fault:** HTTP 500 Internal Server Error with `{ "error": "<message>" }`; internal stack traces and Prisma query diagnostics are strictly logged on the server and suppressed from the client.
   - No other status codes (e.g. 401, 403, 409, 422, 429) are introduced.

---

## 3. Relational Data Model

The database schema ([`server/prisma/schema.prisma`](../server/prisma/schema.prisma)) models the emergency medicine inventory domain across three core tables, managed via Prisma migrations:

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

### Relational Integrity Rules

1. **Many-to-Many Decomposition:** `StockItem` serves as an associative table linking `Pharmacy` and `Medicine`.
2. **Compound Uniqueness:** A unique constraint on `(pharmacyId, medicineId)` prevents duplicate inventory records for the same medication at a single pharmacy.
3. **Monetary Precision:** Prices are stored exclusively as integer **paise** (`pricePaise`), eliminating IEEE 754 floating-point inaccuracies. Formatted rupee symbols (`₹`) are generated solely at the presentation boundary.
4. **Verification State:** Pharmacies feature a `status` attribute defaulting to `'PENDING'`. Only pharmacies marked as `'VERIFIED'` are searchable by consumers or retrievable via detail routes.
5. **Timestamp Tracking:** `StockItem.updatedAt` is defined as a concrete `DateTime` field; application controllers explicitly assign `new Date()` upon creation and modification to guarantee predictable timestamp refreshes.

---

## 4. Lecture Syllabus Traceability

The project exercises the CSA213 curriculum across dedicated components and standalone proof programs.

*Note on Syllabus Scope: Lecture 10 was not provided in the course syllabus; this report covers all taught lectures (L0–L9, L11, and L12).*

| Lecture | Syllabus Subject | Repository Evidence | Concrete Role in Velora |
| --- | --- | --- | --- |
| **L0–L1** | Node.js Architecture, CommonJS, V8 Runtime | [`server/src/server.js`](../server/src/server.js)<br>[`server/package.json`](../server/package.json) | Process lifecycle, CommonJS `require`/`module.exports`, non-blocking event loop execution. |
| **L2** | Asynchronous Programming & Event Loop | [`course-demos/event-loop/index.js`](../course-demos/event-loop/index.js) | Benchmarking CPU-bound `pbkdf2Sync` versus thread-pooled `pbkdf2` with `UV_THREADPOOL_SIZE`. |
| **L3–L4** | File System (`fs`), Buffers & Streams | [`server/prisma/dev-seed.js`](../server/prisma/dev-seed.js)<br>[`course-demos/fs/index.js`](../course-demos/fs/index.js) | `fs.promises.readFile` for asynchronous JSON fixture loading; CSV stream piping via `fs.createReadStream`. |
| **L5–L6** | Native Node HTTP Server | [`course-demos/http/server.js`](../course-demos/http/server.js) | Raw HTTP routing using `http.createServer`, manual status code dispatch, Buffer-based chunk concatenation for POST bodies. |
| **L7** | Express Basics & Routing | [`course-demos/express/server.js`](../course-demos/express/server.js)<br>[`server/src/routes/`](../server/src/routes/) | Route parameters (`:id`), query parameters, HTTP verbs (GET, POST, PUT, DELETE), JSON error responses. |
| **L8** | Express Middleware Chain | [`server/src/app.js`](../server/src/app.js)<br>[`server/src/middlewares/logger.js`](../server/src/middlewares/logger.js) | Linear pipeline: body parsing, custom request logging, static directory mounting, terminal 404 fallback. |
| **L9** | RESTful Architecture & Static Serving | [`server/src/controllers/`](../server/src/controllers/)<br>[`server/public/`](../server/public/) | Resource-oriented URL schemas, state-driven vanilla front-end (`index.html`, `pharmacy.html`) consuming JSON APIs. |
| **L11** | PostgreSQL & Direct Driver (`pg`) | [`server/course-demos/pg/index.js`](../server/course-demos/pg/index.js)<br>[`server/course-demos/pg/README.md`](../server/course-demos/pg/README.md) | `pg.Pool` connection pooling, `$1` parameterized queries, PostgreSQL quoted identifier semantics (`"StockItem"`). |
| **L12** | ORM Modeling & Prisma Client | [`server/prisma/schema.prisma`](../server/prisma/schema.prisma)<br>[`server/src/db/prisma.js`](../server/src/db/prisma.js)<br>[`server/src/controllers/stock.controller.js`](../server/src/controllers/stock.controller.js) | Shared Prisma singleton pool, declarative relation filtering, `findMany`, `findUnique`, `create`, `update`, `delete`. |

---

## 5. Verification & Test Evidence

All API endpoints and operational workflows were verified through end-to-end command line testing (`curl`), manual browser verification, and reproducible seed checks. The detailed evidence is cataloged in [`docs/api-checks.md`](api-checks.md).

### Summary of Acceptance Test Suites

- **t0 · Health Check:** `GET /health` confirms runtime health returning `200 {"ok":true}`.
- **t1 · Medicines API (Commit 14):** 10/10 checks passing. Validates name filtering, integer validation on `:id`, duplicate prevention, and blocking deletion of medicines linked to active stock rows.
- **t2 · Pharmacies API (Commit 15):** 13/13 checks passing. Validates that search returns only verified pharmacies with stock quantity > 0, verifies cheapest-first price sorting, and verifies that `GET /pharmacies/5` (unverified `PENDING` pharmacy) returns `404 Not Found`.
- **t3 · Stock API (Commit 16):** 11/11 checks passing. Confirms listing by `pharmacyId`, foreign-key existence validation for parents, compound uniqueness prevention (`400 Stock row already exists`), non-negative quantity validation, and `204` deletion.
- **t4 · Envelope & Status Code Sweep (Commit 19):** 8/8 checks passing. Confirms no route returns unapproved HTTP codes, validates `{ error }` envelope structure, ensures terminal 404 on invalid routes, and verifies bracket parameter rejection (`?name[]=dolo` → `400`).
- **t5 · Client Wiring (Commit 18):** Verified on desktop (1280px) and mobile (390px) viewports. Search results link to `/pharmacy.html?id=<id>`, displaying pharmacy metadata and stock table; 404 and API down states render graceful human-readable errors.
- **t6 · Seed Idempotency & pg Demo (Commit 17):** Running `node prisma/dev-seed.js` twice produces zero net creations on subsequent runs. `node course-demos/pg/index.js 1` proves identical row counts between raw `pg.Pool` and Prisma Client.

---

## 6. Documented Limitations & Explicit Non-Goals

In accordance with capstone specifications and to maintain strict fidelity to the course syllabus, the following elements are intentionally excluded from the architecture:

1. **No User Accounts or Authentication:** The system has no passwords, sessions, JWT tokens, bcrypt hashing, or user roles. Administrative write routes (`POST`, `PUT`, `DELETE`) are protected solely by an environment guard (`NODE_ENV !== 'production'`).
2. **No Inventory Holds or Distributed Transactions:** There is no 30-minute cart reservation, atomic stock decrement, or distributed locking.
3. **No Geolocation or Spatial Indexing:** Proximity matching uses textual area containment rather than GPS coordinates, PostGIS, or haversine calculations.
4. **No MongoDB or Polyglot Persistence:** PostgreSQL and Prisma comprise the entire database tier; NoSQL engines are deliberately omitted.
5. **No Client Frameworks or Heavy Toolchains:** The front-end contains no React, Vue, TypeScript, Tailwind, Webpack, or Babel. It utilizes standard DOM APIs with zero build steps.
6. **No Cloud Deployment Automation:** The project is configured for local evaluation via Node.js and local PostgreSQL.

---

## 7. Team Contributions

| Member | Branch Responsibilities | Key Deliverables |
| --- | --- | --- |
| **Vishal** | Toolchain, Express Skeleton, Search Client, Documentation | Architecture design, README, basic client, PR review |
| **Manav** | Prisma Schema, Migration, Dev Seed, Medicines & Pharmacies APIs | Data model migrations, seed fixtures, t1/t2 test suites |
| **Yash** | Error Utilities, Course Demos, Viva Presentation | HTTP/FS/Event-Loop demos; presents t4 |
| **Sayem** | Stock API, Direct pg Demo, Client Detail Wiring, Contract Sweep, Viva & Report | Commits c16–c20: Stock CRUD, pg pool demo, pharmacy detail page, sweep audit, viva script and final report |

---

*Report finalized on 17 November 2026 for CSA213 Advanced Programming.*
