-- Velora queries used by the API.
-- Every database operation in server/src/controllers is listed once. The
-- values in WHERE clauses are examples; the API binds them as parameters.
-- READ queries are safe to run as-is. WRITE queries must run inside a
-- transaction and be rolled back when they are used for timing.

SET search_path TO public;

-- @R1
-- READ: list every medicine, sorted by name (GET /medicines).
SELECT "id", "name", "form"
FROM "Medicine"
ORDER BY "name" ASC;

-- @R2
-- READ: filter medicines by a case-insensitive name fragment
-- (GET /medicines?name=dolo).
SELECT "id", "name", "form"
FROM "Medicine"
WHERE "name" ILIKE '%dolo%'
ORDER BY "name" ASC;

-- @R3
-- READ: one medicine by id (GET /medicines/:id; also the pre-check for PUT
-- and DELETE).
SELECT "id", "name", "form"
FROM "Medicine"
WHERE "id" = 1;

-- @R4
-- READ: duplicate-name check before creating or renaming a medicine
-- (POST /medicines and PUT /medicines/:id).
SELECT "id", "name", "form"
FROM "Medicine"
WHERE "name" = 'Dolo 650';

-- @R5
-- READ: stock rows that block deleting a medicine (DELETE /medicines/:id).
SELECT "id"
FROM "StockItem"
WHERE "medicineId" = 1;

-- @R6
-- READ: verified pharmacies with their stock and each medicine
-- (GET /pharmacies). The API groups these flat rows by pharmacy; this JOIN
-- is the equivalent read for the nested response.
SELECT
    p."id" AS pharmacy_id,
    p."name" AS pharmacy_name,
    p."area",
    p."address",
    p."phone",
    p."licenceNumber",
    p."status",
    s."id" AS stock_id,
    s."quantity",
    s."pricePaise",
    s."createdAt",
    s."updatedAt",
    m."id" AS medicine_id,
    m."name" AS medicine_name,
    m."form"
FROM "Pharmacy" p
LEFT JOIN "StockItem" s ON s."pharmacyId" = p."id"
LEFT JOIN "Medicine" m ON m."id" = s."medicineId"
WHERE p."status" = 'VERIFIED'
ORDER BY p."name" ASC, m."name" ASC;

-- @R7
-- READ: the same list filtered by area, case-insensitively
-- (GET /pharmacies?area=Model Town).
SELECT
    p."id" AS pharmacy_id,
    p."name" AS pharmacy_name,
    p."area",
    p."address",
    p."phone",
    p."licenceNumber",
    p."status",
    s."id" AS stock_id,
    s."quantity",
    s."pricePaise",
    s."createdAt",
    s."updatedAt",
    m."id" AS medicine_id,
    m."name" AS medicine_name,
    m."form"
FROM "Pharmacy" p
LEFT JOIN "StockItem" s ON s."pharmacyId" = p."id"
LEFT JOIN "Medicine" m ON m."id" = s."medicineId"
WHERE p."status" = 'VERIFIED'
  AND p."area" ILIKE '%Model Town%'
ORDER BY p."name" ASC, m."name" ASC;

-- @R8
-- READ: first step of the medicine search — resolve the name fragment to
-- medicine ids (GET /pharmacies?medicine=dolo).
SELECT "id"
FROM "Medicine"
WHERE "name" ILIKE '%dolo%';

-- @R9
-- READ: second step of the medicine search — stock rows in verified
-- pharmacies, quantity above zero, cheapest first, with the pharmacy and
-- medicine attached. The area predicate is optional; it is kept here to
-- match GET /pharmacies?medicine=dolo&area=Sector 14.
-- The app binds the ids returned by R8; the subquery below is equivalent
-- when the two steps are run as one statement.
SELECT
    s."id" AS stock_id,
    s."pharmacyId",
    s."medicineId",
    s."quantity",
    s."pricePaise",
    s."createdAt",
    s."updatedAt",
    p."id" AS pharmacy_id,
    p."name" AS pharmacy_name,
    p."area",
    p."address",
    p."phone",
    p."licenceNumber",
    p."status",
    m."id" AS medicine_id,
    m."name" AS medicine_name,
    m."form"
FROM "StockItem" s
JOIN "Pharmacy" p ON p."id" = s."pharmacyId"
JOIN "Medicine" m ON m."id" = s."medicineId"
WHERE s."medicineId" IN (
        SELECT "id"
        FROM "Medicine"
        WHERE "name" ILIKE '%dolo%'
    )
  AND s."quantity" > 0
  AND p."status" = 'VERIFIED'
  AND p."area" ILIKE '%Sector 14%'
ORDER BY s."pricePaise" ASC;

-- @R10
-- READ: one pharmacy with all of its stock and each medicine
-- (GET /pharmacies/:id). The controller checks status = VERIFIED in code.
SELECT
    p."id" AS pharmacy_id,
    p."name" AS pharmacy_name,
    p."area",
    p."address",
    p."phone",
    p."licenceNumber",
    p."status",
    s."id" AS stock_id,
    s."quantity",
    s."pricePaise",
    s."createdAt",
    s."updatedAt",
    m."id" AS medicine_id,
    m."name" AS medicine_name,
    m."form"
FROM "Pharmacy" p
LEFT JOIN "StockItem" s ON s."pharmacyId" = p."id"
LEFT JOIN "Medicine" m ON m."id" = s."medicineId"
WHERE p."id" = 1
ORDER BY m."name" ASC;

-- @R11
-- READ: duplicate-licence check before creating a pharmacy
-- (POST /pharmacies).
SELECT "id", "licenceNumber"
FROM "Pharmacy"
WHERE "licenceNumber" = 'HR-SNP-DEMO-0101';

-- @W1
-- WRITE: create a medicine (POST /medicines, development only).
INSERT INTO "Medicine" ("name", "form")
VALUES ('Timing Medicine', 'TABLET')
RETURNING "id", "name", "form";

-- @W2
-- WRITE: replace a medicine's name and form (PUT /medicines/:id).
UPDATE "Medicine"
SET "name" = 'Dolo 650', "form" = 'TABLET'
WHERE "id" = 1
RETURNING "id", "name", "form";

-- @W3
-- WRITE: delete a medicine (DELETE /medicines/:id). The API only reaches
-- this query after R5 confirms the medicine has no stock rows. For timing,
-- set :delete_id to a temporary unstocked medicine inside the transaction.
DELETE FROM "Medicine"
WHERE "id" = (SELECT "id" FROM "Medicine" WHERE "name" = 'Timing Delete')
RETURNING "id";

-- @W4
-- WRITE: create a pharmacy (POST /pharmacies, development only). The schema
-- supplies the PENDING status; the API never accepts a status from the body.
INSERT INTO "Pharmacy" ("name", "area", "address", "phone", "licenceNumber")
VALUES ('Timing Pharmacy', 'Timing Area', '1 Timing Road', '9000000199', 'HR-SNP-TIMING-0199')
RETURNING "id", "name", "area", "address", "phone", "licenceNumber", "status";

-- @R12
-- READ: find an account by phone for login and the duplicate-phone check.
SELECT "id", "name", "phone", "address", "passwordHash", "role",
       "mfaSecret", "mfaEnabled", "createdAt"
FROM "User"
WHERE "phone" = '7678509233';

-- @R13
-- READ: load the current account by id (GET /auth/me, refresh, password and
-- MFA operations).
SELECT "id", "name", "phone", "address", "role", "mfaEnabled", "createdAt"
FROM "User"
WHERE "id" = 3;

-- @R14
-- READ: resolve a refresh-token hash to its user (GET /auth/refresh and the
-- OAuth consent page).
SELECT r."id", r."familyId", r."expiresAt", r."revokedAt",
       u."id" AS user_id, u."name", u."phone", u."role"
FROM "RefreshToken" r
JOIN "User" u ON u."id" = r."userId"
WHERE r."tokenHash" = 'timing-refresh-hash';

-- @R15
-- READ: one user's holds with the stock row, medicine and pharmacy
-- (GET /holds).
SELECT h."id", h."quantity", h."status", h."expiresAt", h."createdAt",
       s."id" AS stock_id, s."quantity" AS stock_quantity, s."pricePaise",
       m."id" AS medicine_id, m."name" AS medicine_name, m."form",
       p."id" AS pharmacy_id, p."name" AS pharmacy_name, p."area"
FROM "Hold" h
JOIN "StockItem" s ON s."id" = h."stockItemId"
JOIN "Medicine" m ON m."id" = s."medicineId"
JOIN "Pharmacy" p ON p."id" = s."pharmacyId"
WHERE h."userId" = 3
ORDER BY h."createdAt" DESC;

-- @R16
-- READ: active holds that are due (expireHolds, before any hold request).
SELECT "id", "stockItemId", "quantity"
FROM "Hold"
WHERE "status" = 'ACTIVE' AND "expiresAt" <= now();

-- @R17
-- READ: one stock row and its pharmacy status before reserving
-- (POST /holds).
SELECT s."id", s."quantity", s."pricePaise", p."id" AS pharmacy_id, p."status"
FROM "StockItem" s
JOIN "Pharmacy" p ON p."id" = s."pharmacyId"
WHERE s."id" = 1;

-- @R18
-- READ: one hold by id before cancelling (DELETE /holds/:id).
SELECT "id", "userId", "stockItemId", "quantity", "status", "expiresAt"
FROM "Hold"
WHERE "id" = 1;

-- @R19
-- READ: the pharmacy owned by the signed-in account (GET /pharmacies/mine).
SELECT "id", "name", "area", "address", "phone", "licenceNumber",
       "status", "distanceKm", "ownerId"
FROM "Pharmacy"
WHERE "ownerId" = 3;

-- @R20
-- READ: the admin overview counts in one round trip. Each scalar subquery is
-- one aggregate; this is the SQL equivalent of the six Prisma count calls.
SELECT
    (SELECT count(*) FROM "Pharmacy") AS pharmacies,
    (SELECT count(*) FROM "Pharmacy" WHERE "status" = 'PENDING') AS pending_pharmacies,
    (SELECT count(*) FROM "User") AS users,
    (SELECT count(*) FROM "Medicine") AS medicines,
    (SELECT count(*) FROM "StockItem") AS stock_rows,
    (SELECT count(*) FROM "Hold" WHERE "status" = 'ACTIVE') AS active_holds;

-- @R21
-- READ: the next pharmacy waiting for licence review (admin overview).
SELECT "id", "name", "area", "licenceNumber"
FROM "Pharmacy"
WHERE "status" = 'PENDING'
ORDER BY "id" ASC
LIMIT 1;

-- @R22
-- READ: the eight most recent audit events with the actor (admin overview).
SELECT a."id", a."action", a."entity", a."entityId", a."createdAt",
       u."id" AS actor_id, u."name" AS actor_name, u."role" AS actor_role
FROM "AuditLog" a
LEFT JOIN "User" u ON u."id" = a."actorId"
ORDER BY a."createdAt" DESC
LIMIT 8;

-- @R23
-- READ: resolve an OAuth client by its public id (authorize and token).
SELECT "id", "name", "clientId", "clientSecretHash", "redirectUris", "scopes"
FROM "OAuthClient"
WHERE "clientId" = 'vlr_timing';

-- @R24
-- READ: look up a one-time authorization code by hash (POST /oauth/token).
SELECT "id", "codeHash", "clientId", "userId", "scopes", "redirectUri",
       "codeChallenge", "codeChallengeMethod", "expiresAt", "usedAt"
FROM "AuthorizationCode"
WHERE "codeHash" = 'timing-code-hash';

-- @R25
-- READ: look up an OAuth refresh token by hash (refresh grant).
SELECT "id", "clientId", "userId", "scopes", "expiresAt", "revokedAt"
FROM "OAuthRefreshToken"
WHERE "tokenHash" = 'timing-oauth-refresh-hash';

-- @R26
-- READ: the stock export join (GET /admin/export/stock.csv).
SELECT s."id", p."name" AS pharmacy, p."area", p."status",
       m."name" AS medicine, m."form", s."quantity", s."pricePaise"
FROM "StockItem" s
JOIN "Pharmacy" p ON p."id" = s."pharmacyId"
JOIN "Medicine" m ON m."id" = s."medicineId"
ORDER BY s."id" ASC;

-- @R27
-- READ: one page of pharmacies with the owner (GET /admin/pharmacies).
SELECT p."id", p."name", p."area", p."status", p."licenceNumber",
       u."id" AS owner_id, u."name" AS owner_name, u."phone" AS owner_phone
FROM "Pharmacy" p
LEFT JOIN "User" u ON u."id" = p."ownerId"
ORDER BY p."id" ASC
LIMIT 20 OFFSET 0;

-- @R28
-- READ: one page of accounts with their pharmacy (GET /admin/users).
SELECT u."id", u."name", u."phone", u."role", u."createdAt",
       p."id" AS pharmacy_id, p."name" AS pharmacy_name, p."status" AS pharmacy_status
FROM "User" u
LEFT JOIN "Pharmacy" p ON p."ownerId" = u."id"
ORDER BY u."id" ASC
LIMIT 20 OFFSET 0;

-- @R29
-- READ: one page of audit events with the actor (GET /admin/audit).
SELECT a."id", a."action", a."entity", a."entityId", a."metadata", a."createdAt",
       u."id" AS actor_id, u."name" AS actor_name
FROM "AuditLog" a
LEFT JOIN "User" u ON u."id" = a."actorId"
ORDER BY a."createdAt" DESC
LIMIT 25 OFFSET 0;

-- @R30
-- READ: check whether a pharmacy already stocks a medicine before creating
-- the row (POST /stock). The unique pair is the database backstop.
SELECT "id"
FROM "StockItem"
WHERE "pharmacyId" = 1 AND "medicineId" = 1
LIMIT 1;

-- @W5
-- WRITE: create an account (POST /auth/register).
INSERT INTO "User" ("name", "phone", "address", "passwordHash", "role")
VALUES ('Timing User', '9000000999', '1 Timing Road', 'bcrypt-placeholder', 'CUSTOMER')
RETURNING "id", "name", "phone", "role";

-- @W6
-- WRITE: update the editable account fields. The same UPDATE shape serves the
-- profile, the password hash and the MFA secret (PUT /auth/me, /auth/password,
-- /auth/mfa/*).
UPDATE "User"
SET "name" = 'Vishal', "address" = 'Model Town, Sonipat'
WHERE "id" = 3
RETURNING "id", "name", "phone", "address";

-- @W7
-- WRITE: store a new refresh-token hash after login or rotation.
INSERT INTO "RefreshToken" ("userId", "tokenHash", "familyId", "expiresAt")
VALUES (3, 'timing-new-refresh', 'timing-family', now() + interval '30 days')
RETURNING "id", "tokenHash", "familyId";

-- @W8
-- WRITE: revoke one refresh token on logout.
UPDATE "RefreshToken"
SET "revokedAt" = now()
WHERE "tokenHash" = 'timing-revoke' AND "revokedAt" IS NULL
RETURNING "id";

-- @W9
-- WRITE: revoke every active token for an account (logout-all, password
-- change).
UPDATE "RefreshToken"
SET "revokedAt" = now()
WHERE "userId" = 3 AND "revokedAt" IS NULL
RETURNING "id";

-- @W10
-- WRITE: remove expired and long-revoked tokens (hourly cleanup).
DELETE FROM "RefreshToken"
WHERE "expiresAt" < now()
RETURNING "id";

-- @W11
-- WRITE: create a 30-minute hold (POST /holds).
INSERT INTO "Hold" ("userId", "stockItemId", "quantity", "expiresAt")
VALUES (3, 1, 1, now() + interval '30 minutes')
RETURNING "id", "status", "expiresAt";

-- @W12
-- WRITE: mark a due hold EXPIRED (expireHolds).
UPDATE "Hold"
SET "status" = 'EXPIRED'
WHERE "id" = (SELECT "id" FROM "Hold" WHERE "status" = 'ACTIVE' ORDER BY "id" DESC LIMIT 1)
  AND "status" = 'ACTIVE'
RETURNING "id";

-- @W13
-- WRITE: decrement stock only when the requested quantity is available
-- (POST /holds).
UPDATE "StockItem"
SET "quantity" = "quantity" - 1, "updatedAt" = now()
WHERE "id" = 1 AND "quantity" >= 1
RETURNING "id", "quantity";

-- @W14
-- WRITE: restore stock on expiry or cancellation.
UPDATE "StockItem"
SET "quantity" = "quantity" + 1, "updatedAt" = now()
WHERE "id" = 1
RETURNING "id", "quantity";

-- @W15
-- WRITE: mark a hold CANCELLED (DELETE /holds/:id).
UPDATE "Hold"
SET "status" = 'CANCELLED'
WHERE "id" = (SELECT "id" FROM "Hold" WHERE "status" = 'ACTIVE' ORDER BY "id" DESC LIMIT 1)
  AND "status" = 'ACTIVE'
RETURNING "id";

-- @W16
-- WRITE: persist one audit event (EventEmitter listener).
INSERT INTO "AuditLog" ("actorId", "action", "entity", "entityId")
VALUES (3, 'timing.audit', 'User', '3')
RETURNING "id", "action", "createdAt";

-- @W17
-- WRITE: change a pharmacy's verification status (PATCH /admin/pharmacies/:id).
UPDATE "Pharmacy"
SET "status" = 'VERIFIED'
WHERE "id" = 5
RETURNING "id", "name", "status";

-- @W18
-- WRITE: register an OAuth client (POST /admin/oauth-clients).
INSERT INTO "OAuthClient" ("name", "clientId", "clientSecretHash", "redirectUris", "scopes")
VALUES ('Timing Client', 'vlr_timing_new', 'bcrypt-placeholder',
        'http://localhost:3000/developers.html', 'openid profile')
RETURNING "id", "name", "clientId";

-- @W19
-- WRITE: issue a one-time authorization code (POST /oauth/authorize).
INSERT INTO "AuthorizationCode"
    ("codeHash", "clientId", "userId", "scopes", "redirectUri",
     "codeChallenge", "codeChallengeMethod", "expiresAt")
VALUES ('timing-code-new',
        (SELECT "id" FROM "OAuthClient" ORDER BY "id" DESC LIMIT 1),
        3, 'openid profile', 'http://localhost:3000/developers.html',
        'timing-challenge', 'S256', now() + interval '5 minutes')
RETURNING "id", "codeHash", "expiresAt";

-- @W20
-- WRITE: spend an authorization code with a usedAt count guard.
UPDATE "AuthorizationCode"
SET "usedAt" = now()
WHERE "codeHash" = 'timing-code' AND "usedAt" IS NULL
RETURNING "id";

-- @W21
-- WRITE: issue an OAuth refresh token (POST /oauth/token).
INSERT INTO "OAuthRefreshToken" ("tokenHash", "clientId", "userId", "scopes", "expiresAt")
VALUES ('timing-oauth-refresh-new',
        (SELECT "id" FROM "OAuthClient" ORDER BY "id" DESC LIMIT 1),
        3, 'openid profile', now() + interval '14 days')
RETURNING "id", "tokenHash";

-- @W22
-- WRITE: revoke an OAuth refresh token on rotation.
UPDATE "OAuthRefreshToken"
SET "revokedAt" = now()
WHERE "tokenHash" = 'timing-oauth-refresh' AND "revokedAt" IS NULL
RETURNING "id";

-- @W23
-- WRITE: add a stock row (POST /stock).
INSERT INTO "StockItem" ("pharmacyId", "medicineId", "quantity", "pricePaise", "updatedAt")
VALUES (6, 1, 5, 3200, now())
RETURNING "id", "pharmacyId", "medicineId", "quantity";

-- @W24
-- WRITE: update quantity and price on an owned stock row (PUT /stock/:id).
UPDATE "StockItem"
SET "quantity" = 9, "pricePaise" = 3150, "updatedAt" = now()
WHERE "id" = 1
RETURNING "id", "quantity", "pricePaise";

-- @W25
-- WRITE: delete an owned stock row (DELETE /stock/:id).
DELETE FROM "StockItem"
WHERE "id" = 1
RETURNING "id";
