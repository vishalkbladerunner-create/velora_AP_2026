# Velora — Capstone Project Report

**Course:** CSA213 Advanced Programming  
**Institution:** Rishihood University  
**Term:** Autumn 2026  
**Authors:** Vishal, Manav, Yash, Sayem  
**Repository:** [github.com/vishalkbladerunner-create/velora_AP_2026](https://github.com/vishalkbladerunner-create/velora_AP_2026)

---

## 1. Executive Summary & Problem Statement

In emergency and acute medical situations—particularly outside standard business hours in suburban or peri-urban centers such as Sonipat, Haryana—locating a pharmacy with essential prescribed medications in stock is frequently slow, fragmented, and distressing. The prevailing real-world workflow requires families or caregivers to travel physically or place sequential phone calls to independent chemists, encountering frequent stock-outs or unverified providers.

**Velora** addresses this problem with a focused, real-time discovery engine: users query a required medicine name, and the system returns exclusively **verified** pharmacies that currently hold that medicine in **stock with a quantity greater than zero**, ordered by unit price. A patient can reserve part of that stock for 30 minutes, so the medicine is still there when they arrive.

The product has three roles. **Customers** search, reserve and manage holds. **Pharmacy owners** register one pharmacy, maintain the shared medicine catalogue and edit only their own stock. **Administrators** review licences, suspend or reject a pharmacy, read the audit trail and register OAuth clients for partner integrations.

The software is a pedagogical demonstration of the CSA213 curriculum, implemented with **Node.js, Express 5, Prisma ORM and PostgreSQL**. Authentication uses **JSON Web Tokens** at the request boundary with rotating refresh tokens; authorization combines **role-based access control (RBAC)** with **attribute-based ownership checks (ABAC)**. A built-in **OAuth 2.0 authorization server and OpenID Connect provider** exposes scoped access to partner applications.

---

## 2. System Architecture

Velora is a monolithic single-process Node.js service combining a RESTful API, an OAuth/OIDC provider and a static web client served directly by the Node runtime.

### Layered Separation of Concerns

```text
Browser Client (HTML / CSS / Vanilla JS)
           │ HTTP + Bearer token
           ▼
Express App Middleware Chain (server/src/app.js)
  ├─ express.json() · express.urlencoded()
  ├─ cookie-parser (HttpOnly refresh cookie)
  ├─ Custom request logger
  ├─ Security headers
  ├─ express.static() [public/]
  ├─ JWT guard (requireAuth) · RBAC (requirePermission)
  ├─ Route Handlers (/api/v1, /oauth, /.well-known)
  └─ Central error handler (AppError → JSON envelope)
           │
           ▼
Controllers (server/src/controllers/)
  ├─ Validation, bracket-query guards, integer casting
  ├─ Ownership checks (ABAC) and admin status changes
  └─ Status code mapping & response formatting
           │
           ▼
Services (server/src/services/)
  ├─ token.service      access JWT, refresh rotation, replay detection
  ├─ oauth.service      clients, codes, PKCE, RS256 ID tokens, JWKS
  └─ audit.service      EventEmitter → AuditLog listener
           │
           ▼
Prisma ORM Client (server/src/db/prisma.js)
           │ TCP / Connection Pool
           ▼
PostgreSQL Database (schema: public)
```

1. **Middleware Pipeline ([`server/src/app.js`](../server/src/app.js)):**
   - Inbound HTTP payloads pass through `express.json()` and `express.urlencoded()`.
   - `cookie-parser` exposes the HttpOnly refresh cookie.
   - A custom logger prints `METHOD URL`.
   - Static assets are served from `server/public/` before API routing.
   - Versioned routers handle `/api/v1/health`, `/auth`, `/medicines`, `/pharmacies`, `/stock`, `/holds` and `/admin`; OAuth runs at `/oauth` and discovery at `/.well-known/openid-configuration`.
   - Unmatched paths reach a terminal 404 that returns `{ "error": "Route not found" }`.
   - The central error handler maps `AppError` and unexpected failures to the response contract and never leaks a stack trace.

2. **Environment & Fail-Fast Configuration ([`server/src/config/env.js`](../server/src/config/env.js)):**
   - `DATABASE_URL` and `JWT_SECRET` are validated at boot. Missing values stop the process with one diagnostic line.
   - Optional settings cover token lifetimes, the OAuth issuer, the metrics port and development auto-verification.

3. **HTTP Response Contract:**
   - **Success (Read):** `200` with the bare resource or a `{ data, pagination }` envelope.
   - **Success (Creation):** `201` with the created entity.
   - **Success (Deletion):** `204` with an empty body.
   - **Client Errors:** `400` with `{ "error": "<explanation>" }`.
   - **Authentication / Authorization:** `401` for a missing or invalid access token, `403` for a role or ownership refusal.
   - **Resource Not Found:** `404` with `{ "error": "…" }`.
   - **Server Fault:** `500`; diagnostics stay in the server log.

4. **Operations:**
   - A separate raw `http.createServer` on port `9464` exposes Prometheus metrics, a JSON runtime snapshot and a plain health probe.
   - Audit events are emitted on an `EventEmitter` and persisted asynchronously.
   - The stock export is streamed with `Readable` + `pipeline`, so the response respects backpressure.

---

## 3. Relational Data Model

The schema ([`server/prisma/schema.prisma`](../server/prisma/schema.prisma)) models the inventory domain, identity, audit and OAuth integrations across **ten tables**, managed by versioned Prisma migrations.

```text
Medicine ──< StockItem >── Pharmacy ──? User ──< Hold
                                 │         ├──< RefreshToken
                                 │         ├──< AuditLog
                                 │         ├──< AuthorizationCode >── OAuthClient
                                 │         └──< OAuthRefreshToken >── OAuthClient
```

- `Medicine`, `Pharmacy` and `StockItem` form the catalogue; `StockItem` is the explicit many-to-many join that carries quantity and price.
- `User` stores a unique mobile number, an optional address, a bcrypt `passwordHash` and a `role` of `CUSTOMER`, `PHARMACY` or `ADMIN`.
- `Hold` reserves part of one stock row for 30 minutes.
- `RefreshToken` stores only a SHA-256 hash, a family id and rotation metadata.
- `AuditLog` records the actor, action, entity and JSON metadata.
- `OAuthClient`, `AuthorizationCode` and `OAuthRefreshToken` implement the authorization server.

### Relational Integrity Rules

1. **Compound Uniqueness:** `@@unique([pharmacyId, medicineId])` prevents duplicate inventory records.
2. **Monetary Precision:** prices are integer **paise**; the client formats `₹`.
3. **Verification State:** `Pharmacy.status` defaults to `PENDING`; only `VERIFIED` pharmacies are searchable, retrievable, reservable or stockable.
4. **Ownership:** `Pharmacy.ownerId` is nullable and unique; hold and stock operations compare the record’s owner with the authenticated account.
5. **Roles:** `User.role` drives the permission map. A role cannot be supplied by a public registration payload beyond `CUSTOMER` and `PHARMACY`.
6. **Token Storage:** refresh tokens are stored as SHA-256 hashes. The raw value exists only in the HttpOnly cookie.
7. **Rotation and Replay Detection:** every refresh revokes the old hash and links it to its replacement; presenting a rotated token revokes the whole family.
8. **Atomic Holds:** `$transaction` + `updateMany` decrements stock only when `quantity >= requested`; expiry and cancellation restore it exactly once.
9. **OAuth Code Lifecycle:** authorization codes live for five minutes, are bound to the client, redirect URI and PKCE challenge, and are consumed with an `updateMany` guard.
10. **Secret Hashing:** OAuth client secrets are bcrypt hashes; the raw secret is returned once at creation.
11. **Audit:** every sensitive action emits an event that the listener persists, without blocking the request.

---

## 4. Engineering & Security Decisions

| Decision | Reasoning |
| --- | --- |
| **JWT access tokens (HS256, 15 minutes)** | Stateless verification at every route; no session lookup on the hot path. |
| **Opaque refresh token in an HttpOnly cookie** | JavaScript cannot read it; the database stores only a hash. |
| **Refresh rotation with a family id** | Limits the lifetime of a stolen token and detects replay by revoking the family. |
| **RBAC permission map** | Routes ask for a permission (`medicine:write`, `stock:write`, `admin:access`) rather than a role name, so the policy is auditable in one file. |
| **ABAC ownership policies** | A permission is necessary but not sufficient: stock and holds also compare `ownerId`/`userId`. |
| **OAuth 2.0 authorization code + PKCE** | Partner apps never receive a user password; the code is single-use and bound to a verifier. |
| **Client credentials grant** | Machine-to-machine access to scoped read endpoints without a user context. |
| **RS256 ID tokens + JWKS** | Relying parties verify identity with the public key; the client secret stays secret. |
| **Scopes** | `openid`, `profile`, `holds:read`, `stock:read` bound what a partner token can do. |
| **TOTP multi-factor authentication** | An optional authenticator-app factor is verified after the password and before any token is issued. |
| **Audit via `EventEmitter`** | The request path does not wait for the insert, and new listeners can be added without touching controllers. |
| **Streamed CSV** | `pipeline(Readable, res)` respects backpressure instead of buffering the stock table. |
| **Offset pagination** | `skip`/`take` plus `count` in one transaction gives stable admin pages. |
| **`upsert` / `createMany` seeding** | Idempotent fixtures without a check-then-create loop; duplicate stock rows are skipped by the database. |
| **Central error handler** | One middleware owns the envelope; controllers throw `AppError`. |

### Token and identity flow

1. `POST /api/v1/auth/login` verifies the bcrypt hash, asks for a TOTP code when MFA is enabled, stores a refresh hash, sets the HttpOnly cookie and returns a 15-minute access JWT.
2. Protected routes verify the JWT signature, issuer, audience and expiry, then attach `{ id, role }` to `req`.
3. `POST /api/v1/auth/refresh` rotates the refresh token and returns a new access JWT.
4. `POST /api/v1/auth/logout` revokes the presented refresh token; `logout-all` revokes the account’s whole set.
5. `PUT /api/v1/auth/password` verifies the current password, stores a new bcrypt hash and revokes every refresh token.

### OAuth 2.0 / OIDC flow

1. An administrator creates a client in `/admin.html`; the client id and secret are shown once.
2. The client redirects the browser to `/oauth/authorize` with `response_type=code`, `client_id`, `redirect_uri`, `scope`, `state`, and a PKCE `code_challenge`.
3. Velora renders a consent page using the signed-in browser session, then redirects with a one-time code.
4. The client exchanges the code at `/oauth/token` with its secret and PKCE verifier.
5. The response contains an HS256 OAuth access token, an RS256 ID token when `openid` is granted, and a rotating OAuth refresh token.
6. `/oauth/userinfo` returns the standard claims; `/.well-known/openid-configuration` and `/oauth/jwks` let a relying party discover and verify the provider.

---

## 5. Lecture Syllabus Traceability

| Lecture | Syllabus Subject | Repository Evidence | Concrete Role in Velora |
| --- | --- | --- | --- |
| **L0–L1** | Node.js Architecture, CommonJS, V8 Runtime | [`server/src/server.js`](../server/src/server.js)<br>[`server/package.json`](../server/package.json) | Process lifecycle, CommonJS modules, non-blocking request handling. |
| **L2** | Asynchronous Programming & Event Loop | [`server/src/controllers/holds.controller.js`](../server/src/controllers/holds.controller.js)<br>[`server/src/runtime/metrics.js`](../server/src/runtime/metrics.js) | Promise-based handlers, async bcrypt, transactional work, event-loop delay percentiles. |
| **L3–L4** | File System, Buffers, Streams | [`server/prisma/dev-seed.js`](../server/prisma/dev-seed.js)<br>[`server/src/controllers/admin.controller.js`](../server/src/controllers/admin.controller.js) | `fs.promises.readFile` for fixtures; `Readable` + `pipeline` for the CSV export; `Buffer.from` in the metrics server. |
| **L5–L6** | HTTP Methods, Status Codes, JSON | [`server/src/controllers/`](../server/src/controllers/) | Verbs map to routes; 200/201/204/400/401/403/404; JSON bodies and structured errors. |
| **L7** | Express Basics & Routing | [`server/src/routes/`](../server/src/routes/) | Route parameters, query parameters, HTTP verbs, JSON responses. |
| **L8** | Express Middleware Chain | [`server/src/app.js`](../server/src/app.js)<br>[`server/src/middlewares/`](../server/src/middlewares/) | Body parsers, cookies, logger, security headers, JWT guard, RBAC, central error handler. |
| **L9** | RESTful Architecture & Static Serving | [`server/src/routes/`](../server/src/routes/)<br>[`server/public/`](../server/public/) | Resource URLs, plural nouns, `express.Router()`, `express.static()`, versioned API. |
| **L11** | PostgreSQL | [`server/prisma/schema.prisma`](../server/prisma/schema.prisma)<br>[`server/prisma/migrations/`](../server/prisma/migrations/) | PostgreSQL stores the full relational model; Prisma is the access layer. |
| **L12** | Prisma ORM | [`server/src/controllers/`](../server/src/controllers/)<br>[`server/prisma/dev-seed.js`](../server/prisma/dev-seed.js) | CRUD, `include`, `select`, `where`, `orderBy`, `skip`/`take`, `upsert`, `createMany`, nested writes, `$transaction`. |
| **Auth module** | bcrypt, cookies, JWT, TOTP | [`server/src/services/token.service.js`](../server/src/services/token.service.js)<br>[`server/src/services/totp.service.js`](../server/src/services/totp.service.js) | Adaptive hashing, HttpOnly refresh cookie, access/refresh lifecycle, rotation, revocation, TOTP multi-factor authentication. |
| **OAuth module** | OAuth 2.0, OIDC, RBAC, ABAC | [`server/src/services/oauth.service.js`](../server/src/services/oauth.service.js)<br>[`server/src/auth/`](../server/src/auth/) | Authorization code + PKCE, client credentials, scopes, RS256 ID tokens, JWKS, UserInfo, role and ownership checks. |

---

## 6. Verification & Test Evidence

All API endpoints and operational workflows were verified through end-to-end command line testing (`curl`), browser verification and reproducible seed checks. Detailed evidence is cataloged in [`docs/api-checks.md`](api-checks.md).

- **t1 · Medicines API:** list, filter, integer validation, duplicate prevention, blocked delete while stocked.
- **t2 · Pharmacies API:** verified-only search, cheapest-first ordering, PENDING exclusion, detail guard.
- **t3 · Stock reads:** list by pharmacy, invalid-id `400`, bracket-query `400`, PENDING exclusion.
- **t4 · Envelope and status sweep:** approved status set, `{ error }` shape, terminal 404, no stack traces.
- **t7 · Accounts:** register, duplicate phone, login, bad password, `/auth/me`, logout, bcrypt-only storage.
- **t8 · Holds:** reserve, list, cross-user `403`, cancel with stock restore, insufficient stock, PENDING stock, expiry restore, no double restore.
- **t9 · Pharmacy ownership:** one pharmacy per account, duplicate `400`, own stock `201`, other pharmacy `403`, anonymous `401`.
- **t10 · Catalogue page:** signup with pharmacy fields, own stock, search hit.
- **t11 · Account types and editing:** customer/pharmacy signup, role `403`s, profile, pharmacy, medicine and stock edits.
- **t12 · JWT and RBAC:** login returns an access token, Bearer access works, refresh rotates the cookie, logout revokes it, customers receive `403` on medicine writes.
- **t13 · Admin and audit:** overview counts, pending queue, status change, paginated audit, streamed CSV, `createMany` bulk import with duplicate skipping.
- **t14 · OAuth 2.0 / OIDC:** client credentials, authorization code + PKCE, consent, token exchange, RS256 ID token, JWKS, UserInfo, refresh grant and discovery. The browser playground at `/developers.html` completes the same flow end to end.
- **t15 · TOTP MFA:** setup returns a secret and provisioning URI, enable verifies a current code, login returns `mfaRequired` without one, a valid code issues tokens, a wrong code is refused, and disable requires the password plus a code.

---

## 7. Documented Limitations & Explicit Non-Goals

1. **External identity federation:** Velora is an OAuth/OIDC provider; it does not yet consume Google, GitHub or Apple as an upstream identity provider.
2. **No email/SMS or payments:** there is no verification email, OTP delivery or payment integration.
3. **No GPS or maps:** the distance label is a seeded `distanceKm` value stored on each pharmacy, not a geolocation or haversine calculation.
4. **No uploaded licence documents:** the admin workflow changes a pharmacy’s status; it does not store licence files.
5. **Local operations:** the build runs over HTTP locally. The refresh cookie becomes `Secure` in production, but TLS termination and a managed secret store are deployment concerns.
6. **OIDC key rotation:** the RSA key pair is generated at boot, so it rotates on restart. A production provider would persist keys and publish overlapping JWKS entries during rotation.
7. **No recovery codes for MFA:** an account that loses its authenticator can disable MFA only through a future admin recovery flow; the current build has none.
8. **No client frameworks or build step:** the front end remains HTML, CSS and vanilla JavaScript.

---

## 8. Team Contributions

| Member | Branch Responsibilities | Key Deliverables |
| --- | --- | --- |
| **Vishal** | Toolchain, Express skeleton, search client, documentation, accounts and holds, JWT/OAuth/RBAC, admin console, operations | Architecture, README, static client, access/refresh tokens, OAuth/OIDC provider, RBAC/ABAC, audit, metrics |
| **Manav** | Prisma schema, migrations, development seed, Medicines and Pharmacies APIs | Data model, seed fixtures, t1/t2 test suites |
| **Yash** | Error utilities, demo presentation | `AppError`, response envelope review, presentation |
| **Sayem** | Stock API, client detail wiring, contract sweep and report | Stock CRUD, pharmacy detail page, sweep audit, final report |

---

*Report finalized on 20 November 2026 for CSA213 Advanced Programming.*
