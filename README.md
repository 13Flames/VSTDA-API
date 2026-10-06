# VSTDA API

A REST API for a to-do list ("Very Simple To-Do App"), built with Node.js and
Express. It supports full CRUD on to-do items, validates and sanitizes every
request, and logs server errors to disk.

**Deployed on Render:** https://vstda-api-s03l.onrender.com/api/TodoItems
(free tier - the first request after a while idle can take up to a minute)

## Features

- **Full CRUD** - create, read, replace, partially update and delete items
- **Filtering** - separate endpoints for complete and incomplete items
- **Validation** - checks types for every field (`name` must be a non-empty
  string, `priority` a number, `completed` a boolean) and returns all the
  problems in a single `400` response
- **Sanitization** - strips HTML tags and SQL keywords/characters from names
- **Consistent errors** - `400` for bad input or malformed JSON, `404` for
  unknown items or routes, `500` without leaking internals
- **Error logging** - unexpected errors are appended to `logs/error.log` with a
  timestamp, method and URL

## Endpoints

| Method | Route                          | Description                                  |
| ------ | ------------------------------ | -------------------------------------------- |
| GET    | `/`                            | Health check - status and uptime              |
| GET    | `/api/TodoItems`               | All items                                    |
| GET    | `/api/TodoItems/complete`      | Completed items only                         |
| GET    | `/api/TodoItems/incomplete`    | Incomplete items only                        |
| GET    | `/api/TodoItems/:id`           | One item by ID                               |
| POST   | `/api/TodoItems`               | Create an item (`201`)                       |
| PUT    | `/api/TodoItems/:id`           | Replace an item - all fields required        |
| PATCH  | `/api/TodoItems/:id`           | Update only the fields provided              |
| DELETE | `/api/TodoItems/:id`           | Delete an item and return it                 |

### Example

```bash
curl -X POST http://localhost:8484/api/TodoItems \
  -H "Content-Type: application/json" \
  -d '{"name": "Write README", "priority": 1, "completed": false}'
```

```json
{ "todoItemId": 3, "name": "Write README", "priority": 1, "completed": false }
```

A validation failure looks like:

```json
{ "error": "Validation failed", "details": ["priority must be a valid number"] }
```

## Run locally

```bash
npm install
npm start        # http://localhost:8484 (or $PORT)
npm test         # Mocha + Chai endpoint tests
```

## Notes

Items are stored in memory, so the list resets to three sample items whenever
the server restarts.

## Built with

Node.js, Express, Morgan, Mocha, Chai
