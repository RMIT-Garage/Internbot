# Backend — Claude Instructions

Loaded automatically when editing files in `backend/`. Supplements root `CLAUDE.md`.

---

## Architecture: Clean Architecture

The backend uses Clean Architecture with four layers. Dependency rule: outer layers depend on inner layers, never the reverse.

```
domain ← application ← infrastructure ← api
```

```
backend/src/
├── index.ts                              # Cloud Function entry — exports `api` via onRequest()
├── domain/                               # Pure TypeScript — no infrastructure dependencies
│   ├── errors.ts                         # DomainError subclasses with code (no HTTP status)
│   └── repositories/
│       └── unitOfWork.ts                 # IRepository<T> + IUnitOfWork interfaces
├── application/                          # Use cases, ports (interfaces), actor
│   ├── actor.ts                          # Actor { uid, email, claims } — auth identity
│   └── ports/
│       └── tokenVerifier.ts              # TokenVerifier interface (DI contract)
├── infrastructure/                       # Adapters to external systems
│   ├── config/
│   │   └── firebaseAdmin.ts              # Admin SDK singleton (sole entry point)
│   ├── auth/
│   │   └── firebaseTokenVerifier.ts      # Implements TokenVerifier via Firebase Admin
│   └── firestore/
│       ├── zodConverter.ts               # Typed Firestore converter with _schemaVersion
│       └── firestoreUnitOfWork.ts        # Implements IUnitOfWork with Firestore transactions
└── api/                                  # HTTP delivery — Express routes, middleware
    ├── app.ts                            # Composition root — wires DI, mounts routes
    ├── errors.ts                         # ApiError (RFC 9457 Problem Details)
    ├── middleware/
    │   ├── auth.ts                       # createAuthMiddleware(tokenVerifier) — injects DI
    │   └── errorHandler.ts               # Maps DomainError/ApiError → RFC 9457 response
    └── routes/
        ├── index.ts                      # Route registry
        └── health.ts                     # GET /health — public, no auth
```

---

## Dependency Rule

| Layer             | May import from                     | Must NOT import from             |
| ----------------- | ----------------------------------- | -------------------------------- |
| `domain/`         | nothing (pure TS)                   | application, infrastructure, api |
| `application/`    | domain                              | infrastructure, api              |
| `infrastructure/` | domain, application                 | api                              |
| `api/`            | domain, application, infrastructure | — (outermost)                    |

The architecture tests in `tests/unit/architecture/architecture.test.ts` enforce this at CI time.

---

## Composition Root (`api/app.ts`)

`createApp()` is the DI wiring point. It accepts an optional `TokenVerifier` for testing:

```typescript
// Production (default)
const app = createApp()

// Tests — inject a mock instead of calling Firebase
const app = createApp({ tokenVerifier: mockTokenVerifier })
```

Never import `firebaseTokenVerifier` directly in route handlers — it's wired once in `app.ts`.

---

## Route Handler Pattern

```typescript
import { Router } from 'express'
import { type Router as ExpressRouter } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth'
import type { Request, Response, NextFunction } from 'express'
import { ApiError } from '../errors'
import { NotFoundError } from '../../domain/errors'
import { adminDb } from '../../infrastructure/config/firebaseAdmin'
import { z } from 'zod'

const router: ExpressRouter = Router()

const createItemSchema = z.object({
  title: z.string().min(1).max(200),
})

// GET /api/items/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { actor } = req as AuthenticatedRequest
    const { id } = req.params

    const doc = await adminDb
      .collection('items')
      .doc(id ?? '')
      .get()
    if (!doc.exists) {
      return next(new NotFoundError('Item', id)) // DomainError → auto-mapped to 404
    }

    res.json({ item: doc.data() })
  } catch (err) {
    next(err)
  }
})

// POST /api/items
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { actor } = req as AuthenticatedRequest

    const parsed = createItemSchema.safeParse(req.body)
    if (!parsed.success) {
      return next(
        new ApiError(400, 'Bad Request', parsed.error.errors[0]?.message ?? 'Invalid input')
      )
    }

    const ref = adminDb.collection('items').doc()
    await ref.set({ ...parsed.data, uid: actor.uid, _schemaVersion: 1 })

    res.status(201).json({ id: ref.id })
  } catch (err) {
    next(err)
  }
})

export { router as itemsRouter }
```

**Rules:**

- Access the authed user via `(req as AuthenticatedRequest).actor` (not `.uid` directly)
- Throw domain errors (`NotFoundError`, `ForbiddenError`) — they auto-map to HTTP in `errorHandler`
- Use `next(new ApiError(...))` for HTTP-specific errors without a domain equivalent
- Never `res.status(500).json(...)` inline — always propagate via `next(err)`
- Always validate `req.body` with Zod before use

---

## Error Handling

```
DomainError (domain/errors.ts)
    ↓ mapped by ApiError.fromDomainError()
ApiError (api/errors.ts)
    ↓ rendered by errorHandler
RFC 9457 Problem Details response: { type, title, status, detail }
```

**From a route handler:**

```typescript
// Domain errors (preferred — no HTTP coupling)
next(new NotFoundError('User', uid)) // → 404
next(new ForbiddenError()) // → 403
next(new ValidationError('Bad input')) // → 400

// API errors (when no domain equivalent)
next(new ApiError(422, 'Unprocessable Entity', 'File too large'))
```

**Error response format (RFC 9457):**

```json
{
  "type": "https://httpstatuses.io/404",
  "title": "Not Found",
  "status": 404,
  "detail": "User 'abc123' not found"
}
```

---

## Firestore Zod Converter

Use `createZodConverter()` for typed collection access with schema validation and lazy migration:

```typescript
import { z } from 'zod'
import { createZodConverter } from '../../infrastructure/firestore/zodConverter'
import { adminDb } from '../../infrastructure/config/firebaseAdmin'

const userSchema = z.object({
  uid: z.string(),
  email: z.string(),
  role: z.enum(['user', 'admin']),
  _schemaVersion: z.literal(1),
})
type User = z.infer<typeof userSchema>

const userConverter = createZodConverter(userSchema, 1)

// Typed read:
const ref = adminDb.collection('users').doc(uid).withConverter(userConverter)
const snap = await ref.get()
const user = snap.data() // User | undefined — fully typed
```

---

## Auth Middleware

```typescript
// Access the authenticated actor in route handlers:
const { actor } = req as AuthenticatedRequest
// actor.uid    — Firebase UID
// actor.email  — email (may be undefined)
// actor.claims — full decoded token claims
```

Public endpoints must be registered before `authMiddleware` in `api/app.ts`.

---

## Testing

**Unit tests** — `tests/unit/` — inject `mockTokenVerifier` via `createApp()`:

```typescript
import { createApp } from '../../../src/api/app'
import { mockTokenVerifier, mockActor } from '../../setup'
import { vi } from 'vitest'

const app = createApp({ tokenVerifier: mockTokenVerifier })

// Simulate authenticated request:
vi.mocked(mockTokenVerifier.verify).mockResolvedValue(mockActor)

// Simulate unauthenticated:
vi.mocked(mockTokenVerifier.verify).mockRejectedValue(new Error('invalid'))
```

The `tests/setup.ts` also mocks `infrastructure/config/firebaseAdmin` so the SDK never initializes.

**Integration tests** — `tests/integration/` — require Docker emulators (`pnpm run emulator`).

---

## Registering a New Route

1. Create `src/api/routes/{name}.ts` — export `{name}Router`
2. Import and mount in `src/api/routes/index.ts`:
   ```typescript
   import { {name}Router } from './{name}'
   router.use('/{name}', {name}Router)
   ```
3. Write unit tests in `tests/unit/routes/{name}.test.ts`
4. Use the `/add-route` skill to scaffold the boilerplate

---

## Firebase Admin SDK

Only import from `infrastructure/config/firebaseAdmin` — never directly from `firebase-admin`:

```typescript
import { adminDb, adminAuth, adminStorage } from '../../infrastructure/config/firebaseAdmin'
```

The architecture test will fail if routes import `firebase-admin` directly.
