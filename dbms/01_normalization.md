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

The three relations map directly to the Prisma models. The physical key `StockItem(pharmacyId, medicineId)` is now enforced by the CP2 migration.
