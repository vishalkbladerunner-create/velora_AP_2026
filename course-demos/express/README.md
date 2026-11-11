# Express routing demo (Lecture 7)

An in-memory medicines list that shows the five methods the API uses, route
parameters, query filtering and the JSON error envelope.

## Run

```bash
node course-demos/express/server.js
```

It listens on port 3002 so it can run beside the API (3000) and the raw http
demo (3001). The data lives in memory and resets when the process restarts.

## Endpoints

| Method | Path | Codes |
| --- | --- | --- |
| `GET` | `/medicines` | 200 |
| `GET` | `/medicines?name=par` | 200 |
| `GET` | `/medicines/:id` | 200, 400, 404 |
| `POST` | `/medicines` | 201, 400 |
| `PUT` | `/medicines/:id` | 200, 400, 404 |
| `PATCH` | `/medicines/:id` | 200, 400, 404 |
| `DELETE` | `/medicines/:id` | 204, 400, 404 |

## Check

```bash
curl -i http://localhost:3002/medicines
curl -i "http://localhost:3002/medicines?name=par"
curl -i http://localhost:3002/medicines/1
curl -i http://localhost:3002/medicines/abc

curl -i -X POST http://localhost:3002/medicines \
  -H 'Content-Type: application/json' \
  -d '{"name":"Cetirizine","form":"tablet"}'

curl -i -X PUT http://localhost:3002/medicines/3 \
  -H 'Content-Type: application/json' \
  -d '{"name":"Cetirizine","form":"syrup"}'

curl -i -X PATCH http://localhost:3002/medicines/3 \
  -H 'Content-Type: application/json' \
  -d '{"form":"tablet"}'

curl -i -X DELETE http://localhost:3002/medicines/3
curl -i http://localhost:3002/nope
```
