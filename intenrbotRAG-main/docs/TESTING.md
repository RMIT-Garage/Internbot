# Testing

## Test Layers

| Layer               | Command                     | Tool                     | Firebase      | Description                          |
| ------------------- | --------------------------- | ------------------------ | ------------- | ------------------------------------ |
| Frontend unit       | `pnpm run test:component`   | Vitest + Testing Library | Mocked        | Utils, hooks, components             |
| Backend unit        | `pnpm run test`             | Vitest + supertest       | Mocked        | Route handlers, middleware           |
| Backend integration | `pnpm run test:integration` | Vitest + supertest       | Real emulator | Full request/response with Firestore |
| All                 | `pnpm run test:all`         | —                        | —             | Runs all layers                      |

## Running Tests

```bash
# Start emulators first (needed for integration tests)
pnpm run emulator

# Run all tests
pnpm run test:all

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
- **Skip:** `src/app/` page files (test via integration or E2E)
- Firebase is always mocked via `tests/setup.ts` — never call real Firebase in unit tests

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
vi.mock("../src/infrastructure/config/firebaseAdmin", () => ({
  adminAuth: { verifyIdToken: vi.fn() },
  adminDb: { collection: vi.fn(), runTransaction: vi.fn() },
  adminStorage: { bucket: vi.fn() },
}));
```

Override auth behavior via the injected token verifier in tests:

```typescript
import { mockTokenVerifier, mockActor } from "../setup";
vi.mocked(mockTokenVerifier.verify).mockResolvedValue(mockActor);
```

## Integration Test Setup

Integration tests require the Firebase emulators to be running:

```bash
pnpm run emulator   # starts Docker container with emulators
pnpm run test:integration
```

Set `USE_EMULATOR=true` in `backend/.env` to connect the backend to the emulators.

## AI Benchmark Platform (Backend-first)

Benchmark runner scripts are in `backend` and support `contract-checker`, `job-checker`, and `faq-rag` suites.

```bash
# fast local validation using fixture responses (default for smoke)
pnpm --filter backend run benchmark:smoke

# full benchmark run (live model calls; requires GEMINI_API_KEY and pricing env vars)
pnpm --filter backend run benchmark:full

# run a single feature
pnpm --filter backend run benchmark -- --mode=smoke --feature=faq-rag

# live run with explicit pricing
pnpm --filter backend run benchmark -- --mode=full --fixtures=false --input-price-per-1k=0.0003 --output-price-per-1k=0.0006

# if Gemini rate-limits, add per-request pacing
pnpm --filter backend run benchmark -- --mode=full --fixtures=false --delay-ms=2500 --input-price-per-1k=0.0003 --output-price-per-1k=0.0006

# run one specific case (requires a single feature)
pnpm --filter backend run benchmark -- --mode=full --fixtures=false --feature=contract-checker --case-id=CC-FULL-001 --delay-ms=3000 --input-price-per-1k=0.0003 --output-price-per-1k=0.0006
pnpm --filter backend run benchmark -- --mode=full --fixtures=false --feature=job-checker --case-id=JC-FULL-001 --delay-ms=3000 --input-price-per-1k=0.0003 --output-price-per-1k=0.0006
pnpm --filter backend run benchmark -- --mode=full --fixtures=false --feature=faq-rag --case-id=FAQ-FULL-001 --delay-ms=3000 --input-price-per-1k=0.0003 --output-price-per-1k=0.0006

# note: --case-id cannot be used with --feature=all
# and must match a case id in the selected dataset file.
# retry/backoff controls (env)
# GEMINI_RETRY_MAX_ATTEMPTS
# GEMINI_RETRY_BASE_DELAY_MS
# GEMINI_RETRY_MAX_DELAY_MS

# note: live runs require either env vars or CLI pricing
# BENCHMARK_PRICE_INPUT_PER_1K_USD
# BENCHMARK_PRICE_OUTPUT_PER_1K_USD
# plus GEMINI_API_KEY for non-fixture runs.
```

Artifacts are written to `backend/benchmarks/reports/` as both JSON and Markdown.

### Manual benchmark UI (single-case)

A protected dashboard page is available at `/benchmarks` for manual single-case runs.

- It calls backend `POST /api/benchmarks/single-case` with Firebase ID token bearer auth.
- Default mode should stay on **fixture responses** to avoid Gemini quota/rate-limit issues.
- Live mode (`fixtures=false`) can return 429 when quota is exhausted.

Use single-case IDs for quick checks:

```bash
# contract checker
CC-SMOKE-001

# job checker
JC-SMOKE-001

# faq rag (answerable)
FAQ-SMOKE-001

# faq rag (unanswerable)
FAQ-SMOKE-002
```

Note: for FAQ, a single case can fail suite-level thresholds by design (refusal/citation metrics depend on mixed case coverage).
For threshold verdicts, run the full feature suite rather than one case.

### Benchmark data and prompts

- Datasets: `backend/benchmarks/datasets/<feature>/{smoke,full}.json`
- Prompts: `backend/benchmarks/prompts/<feature>/v1.0.0.txt`

Each report includes: parse success, feature-level accuracy metrics, threshold evaluation, run metadata (provider/model/prompt version), and pass/fail status.
