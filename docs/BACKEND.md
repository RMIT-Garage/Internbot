# Backend

## Overview

The backend is a **Firebase Cloud Functions v2** app using the **Express fat-lambda** pattern — a single Cloud Function (`api`) that delegates all routing to an Express app.

## Structure

```
backend/
├── src/
│   ├── index.ts          Cloud Functions entry point (exports `api`)
│   ├── app.ts            Express app factory
│   ├── routes/
│   │   ├── index.ts      Route registry
│   │   └── health.ts     GET /api/health
│   ├── middleware/
│   │   ├── auth.ts       Firebase ID token verification
│   │   └── error.ts      Global error handler
│   └── lib/
│       └── firebase.ts   Admin SDK singleton
├── tests/
│   ├── unit/             supertest tests (mocked Firebase)
│   ├── integration/      supertest tests (real emulators)
│   └── setup.ts          Vitest setup + Firebase mocks
```

Repo root:

```
docker/
└── firebase-emulator/
    ├── Dockerfile      Firebase emulator image
    ├── firebase.json   Firebase CLI config for emulators/deploys
    └── firebase/       Firestore rules, Storage rules, indexes
```

## Routes

| Method | Path          | Auth | Description  |
| ------ | ------------- | ---- | ------------ |
| GET    | `/api/health` | No   | Health check |

Add new routes with the `/add-route` Claude Code skill.

## Authentication

All routes under `/api/` (except `/api/health`) require a valid Firebase ID token:

```
Authorization: Bearer {firebase-id-token}
```

The `authMiddleware` verifies the token and attaches `uid` and `email` to the request:

```typescript
const { uid, email } = req as AuthenticatedRequest;
```

## Error Handling

Always use `next(error)` — never inline error responses:

```typescript
router.get("/", async (req, res, next) => {
  try {
    // ...
  } catch (error) {
    next(error); // ← reaches the global errorHandler
  }
});

// Create typed errors with status codes
throw createError("Resource not found", 404);
```

## Local Development

```bash
# Start emulators
pnpm run emulator

# The Express app can also be run directly (no Cloud Functions wrapper)
# pnpm --filter backend run dev  ← watches and recompiles TypeScript
```

## Deployment

```bash
pnpm --filter backend build
firebase deploy --config docker/firebase-emulator/firebase.json --only functions
```

The function is deployed to `australia-southeast1`. Change the region in `src/index.ts` and `infrastructure/variables.tf`.
