# Backend

## Overview

The backend is a **Firebase Cloud Functions v2** app using the **Express fat-lambda** pattern — a single Cloud Function (`api`) that delegates all routing to an Express app (`createApp()` in `backend/src/api/app.ts`).

## Structure

```
backend/
├── src/
│   ├── index.ts                 Cloud Functions entry point (exports `api`)
│   ├── api/
│   │   ├── app.ts               Express app factory (middleware order, routers)
│   │   ├── chat/                Shared HTTP helpers (e.g. Gemini model list)
│   │   ├── middleware/          auth, apiKey, rateLimitByKey, errorHandler
│   │   ├── openapi/             OpenAPI registry + generator + Swagger mount
│   │   ├── routes/
│   │   │   ├── index.ts         Internal `/api` router (benchmarks, chat, knowledge)
│   │   │   ├── health.ts        GET /api/health
│   │   │   ├── chat.ts          Legacy demo chat (Firebase / demo auth bypass)
│   │   │   └── v1/              Public versioned API (`/api/v1/*`)
│   │   └── schemas/             Zod + OpenAPI metadata (shared with routes)
│   ├── application/             Use-cases, ports, prompts, benchmarks
│   ├── domain/                  Domain errors, repositories
│   ├── infrastructure/        Firebase Admin, Supabase, AI providers, `api_keys` repo
│   └── types/                   Express `Request` augmentation (API key context)
├── scripts/                     CLI (ingest samples, issue/revoke API keys, emit OpenAPI)
├── tests/
│   ├── unit/                    Vitest + supertest (mocked Firebase / injected repos)
│   ├── integration/             Optional emulator-backed tests
│   └── setup.ts                 Vitest setup + Firebase mocks
├── dist/                        Generated OpenAPI JSON (`pnpm openapi:emit`) — gitignored
└── docker/                      Firebase emulator image
```

## Routes

### Public / partner (documented)

| Method | Path                   | Auth                       | Description                      |
| ------ | ---------------------- | -------------------------- | -------------------------------- |
| GET    | `/api/health`          | No                         | Health check                     |
| GET    | `/api/openapi.json`    | No                         | OpenAPI 3.1 document             |
| GET    | `/api/docs`            | No                         | Swagger UI                       |
| GET    | `/api/v1/health`       | No                         | Public liveness (v1)             |
| POST   | `/api/v1/chat/message` | **API key** `Bearer ibk_*` | FAQ RAG / job / contract checker |
| GET    | `/api/v1/chat/models`  | **API key**                | List Gemini models               |

See [PUBLIC_API.md](./PUBLIC_API.md) for integrator details.

### Internal / demo (existing)

Mounted under `/api` after Firebase `authMiddleware` (see `backend/src/api/middleware/auth.ts`):

| Method   | Path                          | Auth                                               | Description             |
| -------- | ----------------------------- | -------------------------------------------------- | ----------------------- |
| POST     | `/api/chat/message`           | Firebase ID token **or** demo bypass for `/chat/*` | Demo + first-party chat |
| GET      | `/api/chat/models`            | Same as above                                      | List models             |
| POST     | `/api/benchmarks/single-case` | Firebase ID token                                  | Benchmark runner        |
| GET/POST | `/api/knowledge/documents`    | Firebase ID token + `admin` custom claim           | Knowledge ingest        |

## Authentication

- **Internal `/api/*` (except `/chat/*` demo bypass):** Firebase ID token: `Authorization: Bearer <firebase-id-token>`.
- **`/api/v1/*` (protected):** long-lived platform API key: `Authorization: Bearer ibk_<live|test>_<64-hex>` (stored as SHA-256 in Firestore). See [PUBLIC_API.md](./PUBLIC_API.md).

## Error Handling

Use `next(error)` — never inline ad-hoc error JSON for domain failures. The global `errorHandler` renders RFC 9457 Problem Details: `{ type, title, status, detail }`.

## Local Development

```bash
# Start emulators (repo root)
pnpm run emulator

# Typecheck / test backend only
pnpm --filter backend typecheck
pnpm --filter backend test
```

## Deployment

```bash
pnpm --filter backend build
firebase deploy --only functions
```

The function is deployed to `australia-southeast1` (see `backend/src/index.ts`).
