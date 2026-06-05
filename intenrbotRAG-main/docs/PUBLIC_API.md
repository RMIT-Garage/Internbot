# Public HTTP API (v1)

This service exposes a **versioned public API** for the **[Internbot](https://github.com/giatinhuynh/Internbot)** platform (and similar server-to-server clients). The browser-facing demo in this repo continues to use legacy `/api/chat/*` routes; **new integrations should use `/api/v1/*`**.

Maintainer: Duc Gia Tin Huynh (s3962053).

## Base URL

- **Production (Firebase Cloud Functions v2):** use your deployed HTTPS URL for the `api` function. It typically ends with **`/api`** (the function name), e.g.  
  `https://australia-southeast1-<FIREBASE_PROJECT_ID>.cloudfunctions.net/api`

- **Calling a path:** concatenate that base (no trailing slash) with the path from OpenAPI. Paths in this API all start with **`/api/...`**, for example:  
  `POST https://…cloudfunctions.net/api/api/v1/chat/message`

- **Local:** When you run the Functions emulator or an Express host, use the host/port you configure (see [README](../README.md)).

Set `PUBLIC_API_BASE_URL` in the backend environment so generated OpenAPI `servers` match your deployment (optional; defaults to `/` in the spec).

## OpenAPI / Swagger

| Resource         | Path                | Auth |
| ---------------- | ------------------- | ---- |
| OpenAPI 3.1 JSON | `GET /openapi.json` | No   |
| Swagger UI       | `GET /docs`         | No   |

When deployed on Cloud Functions (`...cloudfunctions.net/api`), these resolve to:

- `https://...cloudfunctions.net/api/openapi.json`
- `https://...cloudfunctions.net/api/docs`

Backward-compatible aliases are also available:

- `/api/openapi.json`
- `/api/docs`

Regenerate a static file (e.g. for CI or publishing):

```bash
pnpm --filter backend openapi:emit
# writes backend/dist/openapi.json
```

## Authentication (v1)

Protected v1 routes require a **platform API key** (not a Firebase ID token):

```http
Authorization: Bearer ibk_<env>_<64-hex-secret>
```

- **Prefix:** `ibk_`
- **Environment segment:** `live` or `test`
- **Secret:** 32 bytes as 64 hex characters (32 hex pairs)

Example (fake): `ibk_live_a1b2c3d4e5f6789012345678901234abcdef5678901234567890abcd`

### Issuing keys

Operators with Firebase Admin credentials run:

```bash
pnpm --filter backend keys:issue -- --label "internbot-prod" --env live
```

The plaintext key is printed **once**. Only a **SHA-256 hash** is stored in Firestore (`api_keys` collection, document id = hash).

### Revoking keys

```bash
pnpm --filter backend keys:revoke -- <keyHashHex64>
```

Use the `keyHash` value printed when the key was issued.

### Client guidance (internbot)

- Call this API **only from your server** (Next.js Route Handler, Cloud Function, etc.).
- **Never** expose the API key in browser JavaScript or mobile apps.
- Internbot already has Firebase Auth for students/coordinators; this backend does **not** verify those users. You may log `X-Forwarded-For` / request ids on your side for abuse tracing.

## CORS

- **`/api/v1/*`:** CORS is **disabled** (`Origin` not reflected). Intended for **server-to-server** use.
- **Other `/api/*` routes:** CORS reflects the request `Origin` (demo / first-party tooling). Auth is still required where documented.

## Rate limits

| Scope       | Default          | Notes                                                                       |
| ----------- | ---------------- | --------------------------------------------------------------------------- |
| Global (IP) | 300 req / 15 min | All routes                                                                  |
| Per API key | 60 req / min     | `/api/v1` protected routes only; override with `API_KEY_RATE_LIMIT_PER_MIN` |

Responses may include standard `RateLimit-*` headers where applicable.

## Endpoints (v1)

### `GET /api/v1/health`

Public liveness. Same shape as `GET /api/health` (`status`, `timestamp`, `environment`).

### `POST /api/v1/chat/message`

Runs one of the three core features:

| `feature`          | Behaviour                              |
| ------------------ | -------------------------------------- |
| `faq-rag`          | FAQ RAG chat (optional `useWebSearch`) |
| `job-checker`      | Job listing checker                    |
| `contract-checker` | Contract checker                       |

**Body (JSON):**

| Field          | Type                                             | Required                                  |
| -------------- | ------------------------------------------------ | ----------------------------------------- |
| `feature`      | `faq-rag` \| `job-checker` \| `contract-checker` | Yes                                       |
| `userInput`    | string                                           | Yes                                       |
| `fileContext`  | string (max 200k chars)                          | No                                        |
| `model`        | string                                           | No                                        |
| `useWebSearch` | boolean                                          | No (FAQ only; also depends on server env) |

**Response:** JSON with `reply`, `feature`, optional structured output, `sources`, optional `webSources`, `debug`, etc. See `ChatResponse` in the codebase or the OpenAPI schema.

### `GET /api/v1/chat/models`

Returns `{ "models": string[] }` of Gemini model ids. Requires `GEMINI_API_KEY` on the server.

## Errors

Errors use **RFC 9457 Problem Details** JSON:

```json
{
  "type": "https://httpstatuses.io/400",
  "title": "Bad Request",
  "status": 400,
  "detail": "Invalid request payload"
}
```

## Versioning

- **`v1`** is stable for integrators. Breaking changes should ship as **`/api/v2`** (future), not silent changes to v1.
- Non-versioned `/api/chat`, `/api/knowledge`, `/api/benchmarks` remain for **internal / demo** use and Firebase ID token auth (see [BACKEND.md](./BACKEND.md)).

## Changelog policy

Document additive changes in release notes. For breaking changes, bump the public API path version and keep v1 available for a deprecation window when feasible.
