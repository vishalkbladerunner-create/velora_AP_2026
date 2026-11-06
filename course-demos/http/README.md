# Raw http server (Lectures 5–6)

The two endpoints the Express app will later serve, written with no
framework: routing by `req.url` and `req.method`, status and headers by
hand, and the POST body read through the request stream.

## Run

```bash
node course-demos/http/server.js
```

The demo listens on port 3001 so it can run beside the API on 3000.

## Check

```bash
curl -i http://localhost:3001/hello

curl -i -X POST http://localhost:3001/echo \
  -H 'Content-Type: application/json' \
  -d '{"medicine":"paracetamol"}'

curl -i http://localhost:3001/missing
```

Expected:

- `GET /hello` → `200` with JSON.
- `POST /echo` → `201` with the parsed body under `received`.
- Anything else → `404` with the JSON error.
- `POST /echo` with invalid JSON → `400`.
