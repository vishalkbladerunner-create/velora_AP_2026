# Query timings — Velora

All timings come from `EXPLAIN (ANALYZE, BUFFERS)` on PostgreSQL 15.15, run three times per query. The database is the local `velora_dbms` database seeded by `server/prisma/dev-seed.js`: 12 medicines, 6 pharmacies and 20 stock rows. Write queries ran inside `BEGIN; … ROLLBACK;` so the data did not change.

| Query | Type | What it does | Run 1 (ms) | Run 2 (ms) | Run 3 (ms) | Average (ms) | Scan type |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| R1 | READ | List every medicine, sorted by name (`GET /medicines`). | 0.016 | 0.011 | 0.011 | 0.013 | Index Scan (Medicine_name_key) |
| R2 | READ | Filter medicines by a case-insensitive name fragment (`GET /medicines?name=dolo`). | 0.027 | 0.022 | 0.024 | 0.024 | Seq Scan (Medicine) |
| R3 | READ | One medicine by id (`GET /medicines/:id`; pre-check for PUT/DELETE). | 0.014 | 0.015 | 0.014 | 0.014 | Index Scan (Medicine_pkey) |
| R4 | READ | Duplicate-name check before creating or renaming a medicine (`POST/PUT /medicines`). | 0.018 | 0.018 | 0.016 | 0.017 | Index Scan (Medicine_name_key) |
| R5 | READ | Stock rows that block deleting a medicine (`DELETE /medicines/:id`). | 0.014 | 0.014 | 0.015 | 0.014 | Seq Scan (StockItem) |
| R6 | READ | List verified pharmacies with their stock and medicine (`GET /pharmacies`). | 0.070 | 0.066 | 0.063 | 0.066 | Seq Scan (Pharmacy); Bitmap Index Scan (StockItem); Index Scan (Medicine) |
| R7 | READ | The same list filtered by area (`GET /pharmacies?area=Model Town`). | 0.052 | 0.048 | 0.056 | 0.052 | Seq Scan (Pharmacy); Bitmap Index Scan (StockItem); Index Scan (Medicine) |
| R8 | READ | Resolve a medicine name fragment to ids (`GET /pharmacies?medicine=dolo`, step 1). | 0.019 | 0.017 | 0.017 | 0.018 | Seq Scan (Medicine) |
| R9 | READ | Stock rows in verified pharmacies, quantity above zero, cheapest first (`GET /pharmacies?medicine=dolo&area=Sector 14`, step 2). | 0.052 | 0.052 | 0.052 | 0.052 | Seq Scan (Pharmacy); Bitmap Index Scan (StockItem); Index Scan (Medicine) |
| R10 | READ | One pharmacy with all of its stock and medicine (`GET /pharmacies/:id`). | 0.051 | 0.048 | 0.050 | 0.050 | Index Scan (Pharmacy_pkey); Bitmap Index Scan (StockItem); Index Scan (Medicine) |
| R11 | READ | Duplicate-licence check before creating a pharmacy (`POST /pharmacies`). | 0.018 | 0.018 | 0.016 | 0.017 | Index Scan (Pharmacy_licenceNumber_key) |
| W1 | WRITE | Create a medicine (`POST /medicines`, development only). | 0.131 | 0.126 | 0.126 | 0.128 | — |
| W2 | WRITE | Replace a medicine name and form (`PUT /medicines/:id`). | 0.132 | 0.108 | 0.108 | 0.116 | Index Scan (Medicine_pkey) |
| W3 | WRITE | Delete a medicine (`DELETE /medicines/:id`), timed on a temporary unstocked row. | 0.282 | 0.274 | 0.286 | 0.281 | Index Scan (Medicine_pkey) |
| W4 | WRITE | Create a pharmacy (`POST /pharmacies`, development only). | 0.115 | 0.123 | 0.135 | 0.124 | — |

Raw plans: `dbms/plans/R1.txt` … `dbms/plans/W4.txt`. Each file contains the query text and all three runs.

## Reading the plans

- Point lookups (`R3`, `R11`) and the unique-name checks (`R1`, `R4`) use B-tree index scans. `R1` uses `Medicine_name_key` both to filter and to satisfy the `ORDER BY name`.

- `R2` and `R8` use a sequential scan. A leading-wildcard `ILIKE '%dolo%'` is not sargable, so the B-tree on `name` cannot help; on 12 rows the scan is cheaper than any alternative. A trigram index would be the first change if the medicine table grew.

- `R5` reads all 20 `StockItem` rows because `medicineId` is not the leading column of an index on its own. The composite `(pharmacyId, medicineId)` key serves the pharmacy-first joins in `R6`, `R7`, `R9` and `R10`, but not this medicine-first lookup.

- `R6`, `R7`, `R9` and `R10` combine a small sequential scan on `Pharmacy` (6 rows) with a bitmap index scan on `StockItem` and an index scan on `Medicine`. The planner prefers a sequential scan for the tiny pharmacy table; that is a size effect, not a missing index.

- The writes are dominated by index maintenance and the foreign-key check. `W3` is the slowest because deleting a medicine fires the `StockItem_medicineId_fkey` trigger even when no stock row exists.


## Notes on the measurements

- The seed database is deliberately small, so absolute times are fractions of a millisecond. The scan types and the relative order are the useful signal; the DE project measures the large-data case.

- `R9` includes the optional `area` predicate. Without an area the same query runs with only the status and quantity predicates.

- `W3` is measured after inserting a temporary unstocked medicine in the same transaction, because the seeded medicines are all stocked and the API refuses to delete them. The raw plan records the `DELETE` only.

