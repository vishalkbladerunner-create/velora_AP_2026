# Normalization — Velora

Velora stores three relations: `Medicine`, `Pharmacy` and `StockItem`. This document starts from the way the data arrives in practice — one row per pharmacy, with a list of stock lines — and takes it through 1NF, 2NF and 3NF. BCNF is checked at the end.

The final relations match `server/prisma/schema.prisma`. The Prisma `id` columns are surrogate keys; they do not change the normalization.

## 1. The unnormalized register (UNF)

A pharmacy keeps its stock as one row in a register. The `stock_lines` column holds every medicine the pharmacy stocks, together with its form, quantity, price and last update:

| licence_number | pharmacy_name | area | address | phone | status | stock_lines |
| --- | --- | --- | --- | --- | --- | --- |
| HR-SON-01 | MedPlus Sonipat | Model Town | 12 Model Town Road | 9812345670 | VERIFIED | Dolo 650 (TABLET) × 120 @ 2550 paise, updated 2026-11-10; Azithral 500 (TABLET) × 40 @ 9200 paise, updated 2026-11-09 |
| HR-SON-02 | City Care Pharmacy | Civil Lines | 8 Civil Lines Market | 9812345671 | PENDING | Dolo 650 (TABLET) × 60 @ 2600 paise, updated 2026-11-11 |

Problems with this register:

- `stock_lines` is a **repeating group**: one cell holds many medicine entries, so it is not atomic.
- Pharmacy details (`name`, `area`, `address`, `phone`, `status`) repeat for every stock line once the register is flattened.
- Medicine `form` repeats for every pharmacy that stocks the same medicine.
- The only key is `licence_number`; an individual stock line has no key of its own.

## 2. First normal form (1NF)

**Rule:** every column holds one atomic value, there are no repeating groups, and each row is identified by a key.

Flatten `stock_lines` into one row per pharmacy–medicine pair:

| licence_number | pharmacy_name | area | address | phone | status | medicine_name | form | quantity | price_paise | updated_at |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | --- |
| HR-SON-01 | MedPlus Sonipat | Model Town | 12 Model Town Road | 9812345670 | VERIFIED | Dolo 650 | TABLET | 120 | 2550 | 2026-11-10 18:00 |
| HR-SON-01 | MedPlus Sonipat | Model Town | 12 Model Town Road | 9812345670 | VERIFIED | Azithral 500 | TABLET | 40 | 9200 | 2026-11-09 11:30 |
| HR-SON-02 | City Care Pharmacy | Civil Lines | 8 Civil Lines Market | 9812345671 | PENDING | Dolo 650 | TABLET | 60 | 2600 | 2026-11-11 09:15 |

**Key:** `(licence_number, medicine_name)`.

**Functional dependencies:**

- `(licence_number, medicine_name) → quantity, price_paise, updated_at`
- `licence_number → pharmacy_name, area, address, phone, status`
- `medicine_name → form`

The table is in 1NF: all values are atomic and each row has a key. The last two FDs are **partial dependencies** — they depend on only one column of the composite key — so the table is not yet in 2NF.

## 3. Second normal form (2NF)

**Rule:** the relation is in 1NF, and every non-prime attribute depends on the **whole** candidate key, not on part of it.

The key is `(licence_number, medicine_name)`, so each non-key column is checked against both parts:

| Column | Depends on | Verdict |
| --- | --- | --- |
| `pharmacy_name`, `area`, `address`, `phone`, `status` | `licence_number` only | Partial dependency — move to `Pharmacy` |
| `form` | `medicine_name` only | Partial dependency — move to `Medicine` |
| `quantity`, `price_paise`, `updated_at` | both columns | Depends on the whole key — stay in `StockItem` |

Decompose into three relations:

### Pharmacy

| Column | Type | Constraint |
| --- | --- | --- |
| `licence_number` | text | primary key |
| `pharmacy_name` | text | not null |
| `area` | text | not null |
| `address` | text | not null |
| `phone` | text | not null |
| `status` | text | not null, `PENDING` by default |

FD: `licence_number → pharmacy_name, area, address, phone, status`.

### Medicine

| Column | Type | Constraint |
| --- | --- | --- |
| `medicine_name` | text | primary key |
| `form` | text | not null |

FD: `medicine_name → form`.

### StockItem

| Column | Type | Constraint |
| --- | --- | --- |
| `licence_number` | text | foreign key → `Pharmacy` |
| `medicine_name` | text | foreign key → `Medicine` |
| `quantity` | integer | not null, default 0 |
| `price_paise` | integer | not null |
| `created_at` | timestamp | not null, set at insert |
| `updated_at` | timestamp | not null |

Primary key: `(licence_number, medicine_name)`.

FD: `(licence_number, medicine_name) → quantity, price_paise, created_at, updated_at`.

`created_at` is added by the application when a stock row is first created. It depends on the same pharmacy–medicine key and does not change the decomposition.

Every non-key attribute now depends on the whole key of its relation, so the schema is in 2NF.

## 4. Third normal form (3NF)

**Rule:** the relation is in 2NF, and no non-prime attribute is transitively dependent on a candidate key.

### Pharmacy

`licence_number → pharmacy_name, area, address, phone, status`

- `area` does not determine `address`; one area contains many addresses.
- `phone` is not declared unique. If the business made it unique, it would be an **alternate key**, not a transitive dependency.
- `status` describes the pharmacy itself, not another non-key column.

No non-prime attribute depends on another non-prime attribute, so `Pharmacy` is in 3NF.

### Medicine

`medicine_name → form`

The only determinant is the candidate key. `form` does not determine any other column. `Medicine` is in 3NF.

### StockItem

`(licence_number, medicine_name) → quantity, price_paise, created_at, updated_at`

- `price_paise` is the pharmacy's price, not the medicine's price.
- `quantity` is the pharmacy's stock, not a property of the medicine.
- `created_at` and `updated_at` are the row's audit timestamps; they are not derived from `quantity` or `price_paise`.
- None of the four determines another.

No transitive dependency exists, so `StockItem` is in 3NF. All three relations are in 3NF.

## 5. BCNF

**Rule:** every determinant is a candidate key.

| Relation | Determinants | Candidate keys | BCNF? |
| --- | --- | --- | --- |
| `Pharmacy` | `licence_number` | `licence_number` | Yes |
| `Medicine` | `medicine_name` | `medicine_name` | Yes |
| `StockItem` | `(licence_number, medicine_name)` | `(licence_number, medicine_name)` | Yes |

`pharmacy_name` is not unique — two pharmacies can share a name — so it is not a determinant. `phone` is not declared unique. No non-key determinant exists, so all three relations are in BCNF.

## 6. Final relations and Prisma mapping

| Normalized relation | Prisma model | Primary key | Natural key | Notes |
| --- | --- | --- | --- | --- |
| `Pharmacy` | `Pharmacy` | `id` (surrogate) | `licenceNumber` (unique) | `area`, `address`, `phone`, `status` stay here |
| `Medicine` | `Medicine` | `id` (surrogate) | `name` (unique) | `form` stays here |
| `StockItem` | `StockItem` | `id` (surrogate) | `(pharmacyId, medicineId)` | `quantity`, `pricePaise`, `createdAt`, `updatedAt` stay here |

Why each attribute sits where it does:

- `area`, `address`, `phone` and `status` describe the **pharmacy**, not a stock line.
- `form` describes the **medicine**, not the pharmacy.
- `quantity` and `pricePaise` describe the **pharmacy–medicine pair**, so they belong in `StockItem`.
- `createdAt` and `updatedAt` are audit attributes of the stock row.

The surrogate `id` columns are stable identifiers for the API. The natural keys above remain unique, so the normalization is unchanged.

## 7. Functional dependency summary

| Relation | Functional dependencies | Candidate key | Highest normal form |
| --- | --- | --- | --- |
| `Pharmacy` | `licence_number → pharmacy_name, area, address, phone, status` | `licence_number` | BCNF |
| `Medicine` | `medicine_name → form` | `medicine_name` | BCNF |
| `StockItem` | `(licence_number, medicine_name) → quantity, price_paise, created_at, updated_at` | `(licence_number, medicine_name)` | BCNF |

## 8. The constraint that closes the gap

At the time of CP1, the normalized key of `StockItem` was `(pharmacyId, medicineId)`, but the Prisma model declared only `id` as the primary key and did **not** put a unique constraint on the pair. The database therefore allowed two stock rows for the same medicine at the same pharmacy, which reintroduced the redundancy 2NF removed and made “how many units does this pharmacy have?” ambiguous.

CP2 closes that gap with:

```prisma
@@unique([pharmacyId, medicineId])
```

and a migration (`20261112170000_stock_pair_unique`). `dbms/03_schema.sql` declares the same unique index, so the normalized key and the physical schema now agree.

## 9. Summary

The register starts in UNF because `stock_lines` is a repeating group. Flattening it to one row per pharmacy–medicine pair gives 1NF. Removing the partial dependencies on `licence_number` and `medicine_name` gives `Pharmacy`, `Medicine` and `StockItem` in 2NF. None of the three has a transitive dependency, so they are in 3NF; every determinant is a candidate key, so they are also in BCNF.

The three catalogue relations map directly to the Prisma models. The physical key `StockItem(pharmacyId, medicineId)` is now enforced by the CP2 migration.

---

# Part B — Identity, holds, audit and OAuth relations

The CP1 analysis above covers the catalogue. The production build added seven
relations for identity, reservations, audit and partner access. Each one is
checked here with the same 1NF → 2NF → 3NF → BCNF sequence.

## 10. User

A user is one account. The unnormalized register would repeat the name, phone,
address and password hash for every hold and every token, which is the same
partial-dependency problem as the pharmacy register.

| Column | Type | Constraint |
| --- | --- | --- |
| `id` | integer | primary key (surrogate) |
| `name` | text | not null |
| `phone` | text | not null, unique |
| `address` | text | nullable |
| `passwordHash` | text | not null |
| `role` | text | not null, `CUSTOMER` by default |
| `mfaSecret` | text | nullable |
| `mfaEnabled` | boolean | not null, false by default |
| `createdAt` | timestamp | not null, now() by default |

Functional dependencies:

- `id → name, phone, address, passwordHash, role, mfaSecret, mfaEnabled, createdAt`
- `phone → name, address, passwordHash, role, mfaSecret, mfaEnabled, createdAt`

Both `id` and `phone` are candidate keys. Every non-key attribute depends on
the whole key, there is no composite key, and there is no transitive
dependency. `User` is in **3NF and BCNF**. Keeping `mfaSecret` on the user is a
1:1 attribute, not a repeating group.

## 11. Pharmacy ownership

`Pharmacy.ownerId` is a nullable unique foreign key to `User`. It records the
1:1 relation “one account owns at most one pharmacy”.

- `ownerId → Pharmacy` (when not null)
- `Pharmacy.id → ownerId`

`ownerId` is a candidate key when present, so the relation remains in **BCNF**.
Null is allowed because the seeded pharmacies are unclaimed. A separate
`PharmacyOwner` table would add no attribute and would make the 1:1 constraint
harder to enforce, so the nullable unique column is the correct decomposition.

## 12. Hold

A hold is one reservation of one stock row by one user.

| Column | Type | Constraint |
| --- | --- | --- |
| `id` | integer | primary key |
| `userId` | integer | not null, FK → `User.id` |
| `stockItemId` | integer | not null, FK → `StockItem.id` |
| `quantity` | integer | not null |
| `status` | text | not null, `ACTIVE` by default |
| `expiresAt` | timestamp | not null |
| `createdAt` | timestamp | not null, now() by default |

FD: `id → userId, stockItemId, quantity, status, expiresAt, createdAt`.

There is no natural key: the same user can reserve the same stock row more
than once, and the same stock row can be held by different users at different
times. `id` is the only determinant, so `Hold` is in **BCNF**. `quantity` and
`expiresAt` describe the reservation, not the user or the stock row, so they
stay here.

## 13. RefreshToken

A refresh token belongs to one user and one rotation family.

| Column | Type | Constraint |
| --- | --- | --- |
| `id` | integer | primary key |
| `userId` | integer | not null, FK → `User.id` |
| `tokenHash` | text | not null, unique |
| `familyId` | text | not null |
| `expiresAt` | timestamp | not null |
| `revokedAt` | timestamp | nullable |
| `replacedByHash` | text | nullable |
| `createdAt` | timestamp | not null, now() by default |

FDs:

- `id → userId, tokenHash, familyId, expiresAt, revokedAt, replacedByHash, createdAt`
- `tokenHash → id, userId, familyId, expiresAt, revokedAt, replacedByHash, createdAt`

`id` and `tokenHash` are candidate keys; `familyId` is not unique because a
family contains a chain of rotated tokens. No non-key determinant exists, so
`RefreshToken` is in **BCNF**. The token hash is stored instead of the raw
token, which is a security decision, not a normalization one.

## 14. AuditLog

An audit row records one domain event.

| Column | Type | Constraint |
| --- | --- | --- |
| `id` | integer | primary key |
| `actorId` | integer | nullable, FK → `User.id` |
| `action` | text | not null |
| `entity` | text | not null |
| `entityId` | text | nullable |
| `metadata` | text | nullable |
| `createdAt` | timestamp | not null, now() by default |

FD: `id → actorId, action, entity, entityId, metadata, createdAt`.

`actorId` is nullable because some events are system events. `metadata` is a
serialized JSON string because the shape varies per action; at the database
level it is one atomic value. `id` is the only determinant, so `AuditLog` is in
**BCNF**. A separate `AuditMetadata` table would add a join without a stable
schema, which is why the JSON string is used.

## 15. OAuthClient

A partner application is one client.

| Column | Type | Constraint |
| --- | --- | --- |
| `id` | integer | primary key |
| `name` | text | not null |
| `clientId` | text | not null, unique |
| `clientSecretHash` | text | not null |
| `redirectUris` | text | not null |
| `scopes` | text | not null |
| `createdAt` | timestamp | not null, now() by default |

FD: `id → name, clientId, clientSecretHash, redirectUris, scopes, createdAt`;
`clientId → id, name, clientSecretHash, redirectUris, scopes, createdAt`.

`id` and `clientId` are candidate keys, so the relation is in **BCNF**. The
redirect URI list and the scope list are stored as newline/space separated
strings. A strict 1NF version would split them into
`OAuthClientRedirectUri` and `OAuthClientScope`; that is the normal form to use
if the list ever needs to be queried or indexed. For a small configuration
table the application treats each list as one opaque value, which is a
documented trade-off rather than an accidental repeating group.

## 16. AuthorizationCode

A code is issued to one client for one user.

| Column | Type | Constraint |
| --- | --- | --- |
| `id` | integer | primary key |
| `codeHash` | text | not null, unique |
| `clientId` | integer | not null, FK → `OAuthClient.id` |
| `userId` | integer | not null, FK → `User.id` |
| `scopes` | text | not null |
| `redirectUri` | text | not null |
| `codeChallenge` | text | nullable |
| `codeChallengeMethod` | text | nullable |
| `expiresAt` | timestamp | not null |
| `usedAt` | timestamp | nullable |
| `createdAt` | timestamp | not null, now() by default |

FDs: `id → …`; `codeHash → id, clientId, userId, scopes, redirectUri,
codeChallenge, codeChallengeMethod, expiresAt, usedAt, createdAt`.

`id` and `codeHash` are candidate keys, so the relation is in **BCNF**. The
code is single-use because `usedAt` is updated with a count guard; the code
hash is stored, never the raw code.

## 17. OAuthRefreshToken

An OAuth refresh token is issued to one client for one user.

FDs: `id → tokenHash, clientId, userId, scopes, expiresAt, revokedAt, createdAt`;
`tokenHash → id, clientId, userId, scopes, expiresAt, revokedAt, createdAt`.

`id` and `tokenHash` are candidate keys, so the relation is in **BCNF**.
`clientId` is not unique because one client has many tokens over time.

## 18. Summary of all ten relations

| Relation | Candidate key(s) | Highest normal form |
| --- | --- | --- |
| `Medicine` | `id`, `name` | BCNF |
| `Pharmacy` | `id`, `licenceNumber`, `ownerId` (when not null) | BCNF |
| `StockItem` | `id`, `(pharmacyId, medicineId)` | BCNF |
| `User` | `id`, `phone` | BCNF |
| `Hold` | `id` | BCNF |
| `RefreshToken` | `id`, `tokenHash` | BCNF |
| `AuditLog` | `id` | BCNF |
| `OAuthClient` | `id`, `clientId` | BCNF |
| `AuthorizationCode` | `id`, `codeHash` | BCNF |
| `OAuthRefreshToken` | `id`, `tokenHash` | BCNF |

The relational design adds seven tables without repeating a fact: identity is
on `User`, ownership is a unique foreign key on `Pharmacy`, reservations are
their own relation, token hashes are their own relation, audit events are
append-only, and OAuth clients, codes and tokens are separate because they
have different lifetimes and different owners.
