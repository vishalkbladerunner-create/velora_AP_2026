# Query timings — Velora

All timings come from `EXPLAIN (ANALYZE, BUFFERS)` on PostgreSQL 15.15, three runs per query. The database is `velora_dbms` after the migrations and the development seed: 18 medicines, 6 pharmacies, 31 stock rows, 2 accounts, 0 active holds and 0 OAuth clients. Write queries ran inside `BEGIN; … ROLLBACK;` with the minimal setup rows shown in the plan file, so the data did not change.

| Query | Type | What it does | Run 1 (ms) | Run 2 (ms) | Run 3 (ms) | Average (ms) | Scan type |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| R1 | READ | list every medicine, sorted by name (GET /medicines). | 0.040 | 0.037 | 0.039 | 0.039 | Seq Scan |
| R2 | READ | filter medicines by a case-insensitive name fragment (GET /medicines?name=dolo). | 0.032 | 0.028 | 0.036 | 0.032 | Seq Scan |
| R3 | READ | one medicine by id (GET /medicines/:id; also the pre-check for PUT and DELETE). | 0.020 | 0.020 | 0.019 | 0.020 | Seq Scan |
| R4 | READ | duplicate-name check before creating or renaming a medicine (POST /medicines and PUT /medicines/:id). | 0.019 | 0.019 | 0.020 | 0.019 | Seq Scan |
| R5 | READ | stock rows that block deleting a medicine (DELETE /medicines/:id). | 0.018 | 0.018 | 0.018 | 0.018 | Seq Scan |
| R6 | READ | verified pharmacies with their stock and each medicine (GET /pharmacies). The API groups these flat rows by pharmacy; this JOIN is the equivalent read for the nested response. | 0.092 | 0.089 | 0.091 | 0.091 | Seq Scan |
| R7 | READ | the same list filtered by area, case-insensitively (GET /pharmacies?area=Model Town). | 0.068 | 0.067 | 0.079 | 0.071 | Seq Scan |
| R8 | READ | first step of the medicine search — resolve the name fragment to medicine ids (GET /pharmacies?medicine=dolo). | 0.022 | 0.021 | 0.023 | 0.022 | Seq Scan |
| R9 | READ | second step of the medicine search — stock rows in verified pharmacies, quantity above zero, cheapest first, with the pharmacy and medicine attached. The area predicate is optional; it is kept here to match GET /pharmacies?medicine=dolo&area=Sector 14. The app binds the ids returned by R8; the subquery below is equivalent when the two steps are run as one statement. | 0.063 | 0.067 | 0.065 | 0.065 | Seq Scan, Index Scan |
| R10 | READ | one pharmacy with all of its stock and each medicine (GET /pharmacies/:id). The controller checks status = VERIFIED in code. | 0.063 | 0.064 | 0.061 | 0.063 | Seq Scan |
| R11 | READ | duplicate-licence check before creating a pharmacy (POST /pharmacies). | 0.019 | 0.018 | 0.018 | 0.018 | Seq Scan |
| W1 | WRITE | create a medicine (POST /medicines, development only). | 0.256 | 0.177 | 0.168 | 0.200 | — |
| W2 | WRITE | replace a medicine's name and form (PUT /medicines/:id). | 0.115 | 0.114 | 0.134 | 0.121 | Seq Scan |
| W3 | WRITE | delete a medicine (DELETE /medicines/:id). The API only reaches this query after R5 confirms the medicine has no stock rows. For timing, set :delete_id to a temporary unstocked medicine inside the transaction. | 0.309 | 0.296 | 0.336 | 0.314 | Seq Scan |
| W4 | WRITE | create a pharmacy (POST /pharmacies, development only). The schema supplies the PENDING status; the API never accepts a status from the body. | 0.175 | 0.156 | 0.152 | 0.161 | — |
| R12 | READ | find an account by phone for login and the duplicate-phone check. | 0.018 | 0.022 | 0.018 | 0.019 | Seq Scan |
| R13 | READ | load the current account by id (GET /auth/me, refresh, password and MFA operations). | 0.020 | 0.018 | 0.017 | 0.018 | Seq Scan |
| R14 | READ | resolve a refresh-token hash to its user (GET /auth/refresh and the OAuth consent page). | 0.021 | 0.023 | 0.019 | 0.021 | Seq Scan |
| R15 | READ | one user's holds with the stock row, medicine and pharmacy (GET /holds). | 0.042 | 0.043 | 0.042 | 0.042 | Seq Scan, Index Scan |
| R16 | READ | active holds that are due (expireHolds, before any hold request). | 0.011 | 0.011 | 0.010 | 0.011 | Seq Scan |
| R17 | READ | one stock row and its pharmacy status before reserving (POST /holds). | 0.035 | 0.031 | 0.035 | 0.034 | Seq Scan |
| R18 | READ | one hold by id before cancelling (DELETE /holds/:id). | 0.018 | 0.017 | 0.017 | 0.017 | Seq Scan |
| R19 | READ | the pharmacy owned by the signed-in account (GET /pharmacies/mine). | 0.021 | 0.024 | 0.019 | 0.021 | Seq Scan |
| R20 | READ | the admin overview counts in one round trip. Each scalar subquery is one aggregate; this is the SQL equivalent of the six Prisma count calls. | 0.061 | 0.059 | 0.062 | 0.061 | Seq Scan |
| R21 | READ | the next pharmacy waiting for licence review (admin overview). | 0.026 | 0.022 | 0.020 | 0.023 | Seq Scan |
| R22 | READ | the eight most recent audit events with the actor (admin overview). | 0.024 | 0.035 | 0.028 | 0.029 | Seq Scan |
| R23 | READ | resolve an OAuth client by its public id (authorize and token). | 0.019 | 0.020 | 0.019 | 0.019 | Seq Scan |
| R24 | READ | look up a one-time authorization code by hash (POST /oauth/token). | 0.018 | 0.019 | 0.022 | 0.020 | Seq Scan |
| R25 | READ | look up an OAuth refresh token by hash (refresh grant). | 0.019 | 0.019 | 0.021 | 0.020 | Seq Scan |
| R26 | READ | the stock export join (GET /admin/export/stock.csv). | 0.073 | 0.071 | 0.066 | 0.070 | Seq Scan |
| R27 | READ | one page of pharmacies with the owner (GET /admin/pharmacies). | 0.034 | 0.035 | 0.036 | 0.035 | Seq Scan |
| R28 | READ | one page of accounts with their pharmacy (GET /admin/users). | 0.037 | 0.037 | 0.032 | 0.035 | Seq Scan |
| R29 | READ | one page of audit events with the actor (GET /admin/audit). | 0.025 | 0.027 | 0.023 | 0.025 | Seq Scan |
| R30 | READ | check whether a pharmacy already stocks a medicine before creating the row (POST /stock). The unique pair is the database backstop. | 0.015 | 0.014 | 0.014 | 0.014 | Seq Scan |
| W5 | WRITE | create an account (POST /auth/register). | 0.172 | 0.140 | 0.135 | 0.149 | — |
| W6 | WRITE | update the editable account fields. The same UPDATE shape serves the profile, the password hash and the MFA secret (PUT /auth/me, /auth/password, /auth/mfa/*). | 0.123 | 0.110 | 0.128 | 0.120 | Seq Scan |
| W7 | WRITE | store a new refresh-token hash after login or rotation. | 0.492 | 0.441 | 0.528 | 0.487 | — |
| W8 | WRITE | revoke one refresh token on logout. | 0.091 | 0.086 | 0.093 | 0.090 | Seq Scan |
| W9 | WRITE | revoke every active token for an account (logout-all, password change). | 0.077 | 0.074 | 0.087 | 0.079 | Seq Scan |
| W10 | WRITE | remove expired and long-revoked tokens (hourly cleanup). | 0.067 | 0.067 | 0.066 | 0.067 | Seq Scan |
| W11 | WRITE | create a 30-minute hold (POST /holds). | 0.631 | 0.648 | 0.585 | 0.621 | — |
| W12 | WRITE | mark a due hold EXPIRED (expireHolds). | 0.112 | 0.104 | 0.120 | 0.112 | Seq Scan |
| W13 | WRITE | decrement stock only when the requested quantity is available (POST /holds). | 0.111 | 0.120 | 0.144 | 0.125 | Seq Scan |
| W14 | WRITE | restore stock on expiry or cancellation. | 0.122 | 0.118 | 0.138 | 0.126 | Seq Scan |
| W15 | WRITE | mark a hold CANCELLED (DELETE /holds/:id). | 0.119 | 0.117 | 0.116 | 0.117 | Seq Scan |
| W16 | WRITE | persist one audit event (EventEmitter listener). | 0.575 | 0.596 | 0.527 | 0.566 | — |
| W17 | WRITE | change a pharmacy's verification status (PATCH /admin/pharmacies/:id). | 0.114 | 0.124 | 0.146 | 0.128 | Seq Scan |
| W18 | WRITE | register an OAuth client (POST /admin/oauth-clients). | 0.165 | 0.156 | 0.140 | 0.154 | — |
| W19 | WRITE | issue a one-time authorization code (POST /oauth/authorize). | 0.427 | 0.399 | 0.512 | 0.446 | Seq Scan |
| W20 | WRITE | spend an authorization code with a usedAt count guard. | 0.096 | 0.090 | 0.085 | 0.090 | Seq Scan |
| W21 | WRITE | issue an OAuth refresh token (POST /oauth/token). | 0.472 | 0.486 | 0.425 | 0.461 | Seq Scan |
| W22 | WRITE | revoke an OAuth refresh token on rotation. | 0.083 | 0.111 | 0.091 | 0.095 | Seq Scan |
| W23 | WRITE | add a stock row (POST /stock). | 0.734 | 0.715 | 0.760 | 0.736 | — |
| W24 | WRITE | update quantity and price on an owned stock row (PUT /stock/:id). | 0.138 | 0.119 | 0.123 | 0.127 | Seq Scan |
| W25 | WRITE | delete an owned stock row (DELETE /stock/:id). | 0.324 | 0.292 | 0.285 | 0.300 | Seq Scan |

Raw plans: `dbms/plans/R1.txt` … `dbms/plans/W25.txt`. Each file contains the query text and all three runs.

## Reading the plans

- At this size the planner mostly chooses sequential scans: `Medicine` has 18 rows, `Pharmacy` 6, `StockItem` 31 and `User` 2. A sequential scan of 18 rows is genuinely cheaper than an index lookup, so this is the correct plan, not a missing index.
- The indexes still appear where the planner expects a selective lookup: `R18` (primary key), `R23`–`R25` (unique `clientId`, `codeHash`, `tokenHash`) and the hold/code updates `W12`, `W15`, `W19`–`W22`. `R12` (phone) and `R4` (medicine name) stay on a sequential scan with 2 and 18 rows; the unique index is the plan once the table grows.
- `R2` and `R8` use a sequential scan because a leading-wildcard `ILIKE` is not sargable. A trigram index would be the first change if the medicine table grew.
- `Hold` has no standalone `userId` index, so `R15` and `R16` scan the small hold table. At production volume the first indexes would be `("userId", "createdAt")` for the list and a partial index on `("expiresAt") WHERE status = 'ACTIVE'` for expiry.
- `AuditLog` has indexes on `createdAt` and `action`; with a small table the planner may still choose a sequential scan and sort. The index matters once the audit trail grows.
- The write timings are dominated by index maintenance and foreign-key checks, not by the row itself. The admin bulk import (`createMany`) amortises that cost across rows; a single insert does not.
- Absolute times are fractions of a millisecond because the seed database is small. The scan types and the relative order are the useful signal; the DE project is the large-data measurement.

## Notes on the measurements

- `W3` inserts a temporary unstocked medicine and then deletes it by id, all inside the timing transaction; the rollback removes it.
- `W8`, `W10`, `W12`, `W15`, `W19`–`W22` create their one prerequisite row inside the transaction before the measured statement; the plan file records the measured query only.
- Read queries use the seeded ids (`1` for the first medicine, `3` for the owner account, `5` for a pending pharmacy). The API binds the same values as parameters.
