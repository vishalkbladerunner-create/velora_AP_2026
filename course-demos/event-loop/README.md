# Event loop, measured (Lecture 2)

The same CPU-heavy work — `crypto.pbkdf2` — once synchronously and once through
the thread pool, with wall-clock timings and a timer that shows whether the loop
was free.

## Run

```bash
node course-demos/event-loop/index.js
```

Optional experiment: give libuv five threads and run it again.

```bash
UV_THREADPOOL_SIZE=5 node course-demos/event-loop/index.js
```

## What to look for

- **Blocking section.** `pbkdf2Sync` runs one call after another. The 10 ms
  timer cannot fire until the whole loop finishes, so it prints *after* the
  five calls.
- **Async section.** `pbkdf2` hands each job to libuv. With the default pool of
  four threads, the first four run together and the fifth waits, so five calls
  finish in roughly two batches. The timer fires *while* the work is running.
- **Summary.** The ratio compares total time, not a single call.

## Why it matters for the API

A synchronous call blocks every other request on that thread. The app therefore
uses asynchronous I/O on request paths: `fs.promises`, `Prisma` queries, and
`crypto` callbacks. CPU work belongs on the thread pool, never in a sync loop.
