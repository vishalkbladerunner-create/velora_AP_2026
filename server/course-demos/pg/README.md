# PostgreSQL pool and parameterized query demo (Lecture 11)

A runnable demonstration of direct PostgreSQL connectivity using the `pg` driver (`node-postgres`), a connection `Pool`, and parameterized queries, verified side-by-side with Prisma Client.

## What it demonstrates

1. **Connection pool (`new Pool`):** Manages a pool of reusable database connections rather than opening a new TCP connection per query.
2. **Parameterized queries (`$1`):** User inputs are passed as separate parameters in an array (`[pharmacyId]`), never concatenated into the SQL string. This prevents SQL injection attacks because the database engine treats parameter values strictly as data, never as executable SQL tokens.
3. **Quoted identifiers:** In PostgreSQL, unquoted identifiers are automatically folded to lower-case. Because Prisma generates mixed-case identifiers (table `"StockItem"`, column `"pharmacyId"`), direct SQL queries must quote these identifiers using double quotes (`"StockItem"`, `"pharmacyId"`) to match the database catalog.
4. **Side-by-side verification:** Executes the parameterized raw SQL query via `pg` and compares the row count against Prisma's `findMany({ select: { id: true } })` to prove both access the identical data.

## Run

From the `server/` directory:

```bash
node course-demos/pg/index.js <pharmacyId>
```

Example:

```bash
node course-demos/pg/index.js 1
```

If an invalid or non-integer pharmacy ID is provided:

```bash
node course-demos/pg/index.js abc
```

Output:
```text
Usage: node course-demos/pg/index.js <pharmacyId>
```
and exits with exit code `1`.

## Expected output

When run against a seeded database with pharmacy ID 1:

```text
pg rows: 5
{
  id: 1,
  pharmacyId: 1,
  medicineId: 1,
  quantity: 40,
  pricePaise: 3200,
  createdAt: ...,
  updatedAt: ...
}
prisma rows: 5
```

Both `pg` and Prisma return the exact same count of stock rows for the pharmacy.
