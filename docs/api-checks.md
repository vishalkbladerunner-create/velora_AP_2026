# API checks

Manual checks run with `curl` against a local PostgreSQL filled by
`node prisma/dev-seed.js`. Success returns the bare resource; failure returns
`{ "error": "..." }`. Allowed codes: 200, 201, 204, 400, 404, 500.

## Medicines (commit 14, test t1)

Run on 2026-11-11 by Manav, `NODE_ENV=development`, seeded database
(12 medicines).

| # | Method | Request | Expected | Actual | Body / note |
| --- | --- | --- | --- | --- | --- |
| 1 | `GET` | `/medicines` | 200 | 200 | 12 seeded rows, sorted by name |
| 2 | `GET` | `/medicines?name=dolo` | 200 | 200 | `[{"id":1,"name":"Dolo 650","form":"TABLET"}]`, case ignored |
| 3 | `GET` | `/medicines/abc` | 400 | 400 | `{"error":"Invalid medicine id"}` |
| 4 | `GET` | `/medicines/999` | 404 | 404 | `{"error":"Medicine not found"}` |
| 5 | `POST` | `/medicines` `{"form":"TABLET"}` | 400 | 400 | `{"error":"Missing medicine name or form"}` |
| 6 | `POST` | `/medicines` `{"name":"Dolo 650","form":"TABLET"}` | 400 | 400 | `{"error":"A medicine with this name already exists"}` |
| 7 | `POST` | `/medicines` `{"name":"Cetzine","form":"TABLET"}` | 201 | 201 | `{"id":13,"name":"Cetzine","form":"TABLET"}`; re-run on 2026-11-11 against a freshly seeded scratch database (`velora_fixcheck`) to observe the code |
| 8 | `PUT` | `/medicines/13` `{"name":"Cetzine 10","form":"TABLET"}` | 200 | 200 | `{"id":13,"name":"Cetzine 10","form":"TABLET"}` |
| 9 | `DELETE` | `/medicines/13` | 204 | 204 | empty body |
| 10 | `DELETE` | `/medicines/1` | 400 | 400 | `{"error":"Medicine is still stocked by a pharmacy"}` |

After the run the medicines table is back to the 12 seeded rows.

## Pharmacies (commit 15, test t2)

Run on 2026-11-11 by Manav, `NODE_ENV=development`, seeded database
(4 VERIFIED and 2 PENDING pharmacies). Bodies are summarised as
`name [status] stock: medicine x quantity`.

| # | Method | Request | Expected | Actual | Body / note |
| --- | --- | --- | --- | --- | --- |
| 1 | `GET` | `/pharmacies` | 200 | 200 | 4 rows, all VERIFIED, each with its stock and medicine |
| 2 | `GET` | `/pharmacies?area=model town` | 200 | 200 | Sanjeevani Medicos only; PENDING Shree Ram Chemists excluded |
| 3 | `GET` | `/pharmacies?medicine=dolo` | 200 | 200 | City Care x15, Sanjeevani x40, Highway 24x7 x100 (cheapest first); PENDING Apna Medical Hall excluded |
| 4 | `GET` | `/pharmacies?medicine=dolo&area=sector 14` | 200 | 200 | City Care Pharmacy only |
| 5 | `GET` | `/pharmacies?medicine=ascoril` | 200 | 200 | `[]`: the only verified holder has quantity 0 |
| 6 | `GET` | `/pharmacies/1` | 200 | 200 | Sanjeevani Medicos with 5 stock rows, each including its medicine |
| 7 | `GET` | `/pharmacies/abc` | 400 | 400 | `{"error":"Invalid pharmacy id"}` |
| 8 | `GET` | `/pharmacies/999` | 404 | 404 | `{"error":"Pharmacy not found"}` |
| 9 | `POST` | `/pharmacies` `{"name":"Test Chemist"}` | 400 | 400 | `{"error":"Missing pharmacy fields: area, address, phone, licenceNumber"}` |
| 10 | `POST` | `/pharmacies` full body plus `"status":"VERIFIED"` | 201 | 201 | created as `PENDING`: the body's status is ignored |
| 11 | `POST` | same body again | 400 | 400 | `{"error":"A pharmacy with this licence number already exists"}` |
| 12 | `GET` | `/pharmacies/5` (a PENDING pharmacy) | 404 | 404 | `{"error":"Pharmacy not found"}`: a PENDING pharmacy is treated as not found |
| 13 | `GET` | `/pharmacies?medicine=dolo&medicine=pan` (array query) | 400 | 400 | `{"error":"Invalid medicine parameter"}`. Note: `?medicine[]=dolo` returns 200 with every verified pharmacy, because Express 5's default query parser reads `medicine[]` as a separate key, not an array |

Rows 12 and 13 were run on 2026-11-11 against a freshly seeded scratch database
(`velora_fixcheck`) after the P2 review fixes.

The run leaves one PENDING "Test Chemist" row (licence `HR-SNP-TEST-0199`) in
the local database; it never appears in search because it is not VERIFIED.
