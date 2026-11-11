# Velora

Emergency medicine discovery: search a medicine and see which verified
pharmacies in an area have it in stock.

This is a CSA213 Advanced Programming capstone. The build follows the supplied
lectures only, so the scope is deliberately smaller than the original
architecture sketch.

## Status

The foundations are in place:

- Express API skeleton with JSON parsing, a request logger, a health route and
  a JSON 404.
- Environment configuration that reads `process.env` once and fails fast.
- A static search page served from `public/` with loading, empty, error and
  data states.

The database, seed and search endpoints arrive in the data phase
(commits 12–15). Until then a search returns `404 Route not found`.

## Requirements

- Node.js 18 or newer
- npm
- PostgreSQL 12 or newer (from commit 12 onward)

## Install

```bash
cd server
npm install
```

## Environment

The API reads its environment once at start-up. There is no `dotenv`: export
the values in the shell you run the server from.

```bash
cd server
cp .env.example .env          # Prisma's CLI reads this file
export DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/velora?schema=public"
export PORT=3000              # optional
```

| Variable | Required | Default | Read by |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | — | API config, Prisma |
| `PORT` | no | `3000` | API |
| `NODE_ENV` | no | `development` | API |

A missing `DATABASE_URL` stops boot with one message:
`Missing environment variables: DATABASE_URL`.

## Run

```bash
cd server
npm run dev     # nodemon, restarts on save
npm start       # plain node
```

Check it:

```bash
curl http://localhost:3000/health
# {"ok":true}

curl http://localhost:3000/nope
# {"error":"Route not found"}
```

Then open <http://localhost:3000> for the search page.

## API today

| Method | Path | What it does |
| --- | --- | --- |
| `GET` | `/health` | `{"ok":true}` |
| `GET` | `/` | static search page |
| `GET` | `/medicines` | every medicine; `?name=dolo` filters by name, ignoring case |
| `GET` | `/medicines/:id` | one medicine; `400` for a non-numeric id, `404` when missing |
| `POST` | `/medicines` | development only: `{ "name", "form" }` → `201` |
| `PUT` | `/medicines/:id` | development only: replaces `name` and `form` |
| `DELETE` | `/medicines/:id` | development only: `204`; `400` while a pharmacy stocks it |

Success returns the bare resource; failure returns `{ "error": "..." }`. The
development-only writes are not registered when `NODE_ENV=production`.

The `/pharmacies` and `/stock` routes are added in commits 15 and 16.

## Course demos

| Demo | Run | What it shows |
| --- | --- | --- |
| Raw http | `node course-demos/http/server.js` | routing, status and headers by hand; POST body through a Buffer |
| Files and streams | `node course-demos/fs/index.js` | `readFileSync` vs callback vs promises; streaming a 5,000-row CSV; `.pipe()` |
| Event loop | `node course-demos/event-loop/index.js` | blocking `pbkdf2Sync` vs pooled `pbkdf2`, with timings |
| Express routing | `node course-demos/express/server.js` | all five methods, route params, query filtering and the JSON error envelope |

The http and Express demos listen on ports 3001 and 3002; the others print to
the terminal and exit.

## Project structure

```text
course-demos/
  event-loop/        L2 demo: blocking vs pooled crypto
  express/           L7 demo: five methods and routing
  fs/                L2–L4 demo: modules, fs, streams
  http/              L5–L6 demo: raw http server
server/
  prisma/            schema (models arrive in commit 12)
  public/            static search page
  src/
    config/          environment read once, fail fast
    controllers/     request handling
    db/              one shared Prisma client
    middlewares/     logger
    routes/          one router per resource
    app.js           middleware order
    server.js        entry point
  package.json
```

## Scope

The supplied lectures stop at Express, routers, PostgreSQL and Prisma. The
project therefore does **not** include accounts, authentication, roles,
reservations/holds, admin verification, MongoDB, a React client, distance
sorting or cloud deployment. The report and the tracker state these gaps.

The write endpoints added in the data phase are development-only: there is no
authentication, so they must not be exposed publicly.

## Tracker

The live build tracker (20 commits, three phases) is at
<https://velora-capstone.pages.dev/tracker/>.

## Repository

<https://github.com/vishalkbladerunner-create/velora_AP_2026>
