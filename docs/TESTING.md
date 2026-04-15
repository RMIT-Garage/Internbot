# Testing

## Test Layers

| Layer               | Command                     | Tool                     | Firebase                    | Description                                       |
| ------------------- | --------------------------- | ------------------------ | --------------------------- | ------------------------------------------------- |
| Frontend unit       | `pnpm run test:component`   | Vitest + Testing Library | Mocked                      | Utils, hooks, components                          |
| Backend unit        | `pnpm run test`             | Vitest + supertest       | Mocked                      | Route handlers, middleware                        |
| Backend integration | `pnpm run test:integration` | Vitest + supertest       | Real emulator               | Full request/response with Firestore              |
| E2E                 | `pnpm run test:e2e`         | Playwright               | Auto-started local frontend | Browser-level smoke tests against a live frontend |
| All                 | `pnpm run test:all`         | —                        | —                           | Runs all layers                                   |

## Running Tests

```bash
# Start emulators first (needed for integration tests)
pnpm run emulator

# Run all tests
pnpm run test:all

# Run Playwright E2E
pnpm run test:e2e

# Watch mode (frontend)
pnpm --filter frontend run test:watch

# Watch mode (backend)
pnpm --filter backend run test:watch

# Coverage
pnpm --filter frontend run test:coverage
pnpm --filter backend run test:coverage
```

## What to Test

### Frontend

- **Always test:** utility functions in `src/lib/`, Zod validation schemas, custom hooks
- **Skip:** shadcn `src/components/ui/` components (not hand-authored)
- **Skip:** `src/app/` page files in unit tests (test via E2E)
- Firebase is always mocked via `tests/setup.ts` — never call real Firebase in unit tests

### E2E

- Use E2E for page loads, auth flow smoke tests, protected-route behavior, and cross-page workflows
- `pnpm run test:e2e` starts the frontend automatically via Playwright's `webServer` unless `BASE_URL` is overridden
- E2E is intentionally kept separate from `test:all` because it depends on a live app process

### Backend

- **Unit tests:** Each route handler tested with supertest; Firebase Admin is mocked
- **Integration tests:** Full request cycle against real Firestore emulator (Docker)
- Every new route created via `/add-route` skill must have at minimum: 200/201 happy path + 401 without token

## Mocking Firebase

**Frontend** (`frontend/tests/setup.ts`):

```typescript
vi.mock('@/lib/firebase/client', () => ({ auth: ..., db: {}, storage: {} }))
vi.mock('@/lib/firebase/admin', () => ({ adminAuth: { verifySessionCookie: vi.fn() }, ... }))
```

**Backend** (`backend/tests/setup.ts`):

```typescript
vi.mock("../src/lib/firebase", () => ({
  adminAuth: { verifyIdToken: vi.fn() },
  adminDb: {},
}));
```

Override mock implementations in individual test files:

```typescript
import { adminAuth } from "../../../src/lib/firebase";
vi.mocked(adminAuth.verifyIdToken).mockResolvedValue({
  uid: "test-uid",
  email: "test@example.com",
} as any);
```

## Integration Test Setup

Integration tests require the Firebase emulators to be running:

```bash
pnpm run emulator   # starts Docker container with emulators
pnpm run test:integration
```

Set `USE_EMULATOR=true` in `backend/.env` to connect the backend to the emulators.
