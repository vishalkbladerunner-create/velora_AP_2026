# fs and streams walkthrough (Lectures 2–4)

One small module, one JSON file read three ways, and one large CSV processed
as a stream. `process.argv` chooses which section runs.

## Run

```bash
node course-demos/fs/index.js
node course-demos/fs/index.js sync
node course-demos/fs/index.js callback
node course-demos/fs/index.js promise
node course-demos/fs/index.js stream
node course-demos/fs/index.js pipe
```

Running with no argument executes every section in order.

## What each section shows

- **sync** — `fs.readFileSync` blocks the thread until the whole file is in
  memory.
- **callback** — `fs.readFile` returns through a callback.
- **promise** — `fs.promises.readFile` returns a promise; this is the style the
  seed uses.
- **stream** — `fs.createReadStream` reads the CSV in chunks with `.on('data')`
  and `.on('end')`, keeping only one chunk in memory.
- **pipe** — `.pipe()` copies the same read stream into a write stream without
  loading the file.

## Memory story

`readFile` and `readFileSync` load the entire file. A stream keeps one chunk at
a time, so a 200 KB file and a 2 GB file cost the same in memory.

## Files

- `data.json` — five medicines.
- `sales.csv` — 5,000 rows, large enough to produce several chunks.
- `helper.js` — the user-created module (`module.exports`).
