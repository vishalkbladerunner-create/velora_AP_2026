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
-- (GET /pharmacies). The API groups these flat rows by pharmacy; Prisma's
-- include is the same nested read expressed as a join.
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
WHERE "id" = :delete_id
RETURNING "id";

-- @W4
-- WRITE: create a pharmacy (POST /pharmacies, development only). The schema
-- supplies the PENDING status; the API never accepts a status from the body.
INSERT INTO "Pharmacy" ("name", "area", "address", "phone", "licenceNumber")
VALUES ('Timing Pharmacy', 'Timing Area', '1 Timing Road', '9000000199', 'HR-SNP-TIMING-0199')
RETURNING "id", "name", "area", "address", "phone", "licenceNumber", "status";
