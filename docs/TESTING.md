# Testing

## The Pyramid

```
                   ▲
          /─────────────\
         /   E2E         \    ← Playwright; full UI + backend + emulator
        /─────────────────\
       /  Component (API)  \  ← supertest + `createApp()` + real emulator
      /─────────────────────\
     /   Integration         \ ← repo + UoW vs real Firestore emulator
    /─────────────────────────\
   /          Unit             \ ← pure TS, no emulator, no network
  /─────────────────────────────\
```

Backend work uses **four** levels (plus architecture meta-tests). Every phase's PR must include domain unit + integration + component coverage where applicable.

| Level            | Folder                          | Emulator | Typical duration per test | What it covers                                                                                                                                        |
| ---------------- | ------------------------------- | -------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unit**         | `backend/tests/unit/domain/**`  | No       | < 10ms                    | Pure domain logic — aggregate classes, value objects, and domain services/rules only                                                                  |
| **Integration**  | `backend/tests/integration/**`  | Yes      | 50–200ms                  | CQRS handlers wired to real Firestore UoW, repo methods, UoW transactions, driver-error translation, index requirements                               |
| **Component**    | `backend/tests/component/**`    | Yes      | 100–500ms                 | Full `createApp()` via `supertest` against Firestore + Firebase Auth emulators. Black-box HTTP contract — one test per spec `Success criteria` bullet |
| **E2E**          | `e2e/**`                        | Live app | 1–5s                      | Playwright — UI + backend + emulator running together                                                                                                 |
| **Architecture** | `backend/tests/architecture/**` | No       | < 5ms                     | Dep-rule enforcement (`domain/` no zod, `application/` no firebase-admin, `api/routes/` no direct firebase-admin, no `console.log`, etc.)             |

## Where each test goes

### Unit tests — `backend/tests/unit/`

Pure TypeScript, no network, no emulator. Fast feedback loop.

- `tests/unit/domain/entities/user.test.ts` — class behaviour (`User.isStudent()`, `User.withStudentProfile(...)`)
- `tests/unit/domain/value-objects/student-profile.test.ts` — `StudentProfile.isComplete()`, `deriveStatus()`, `equals()`
- `tests/unit/domain/value-objects/academic-info.test.ts` — `hasAllRequiredFields()`, `equals()`
- `tests/architecture/architecture.test.ts` — dep-rule meta-tests

Unit tests are **domain-only**. Do not add `tests/unit/api/**`, `tests/unit/application/**`, or mocked-UoW tests. CQRS handlers are covered through integration tests against the real Firestore UoW. API routes, wire DTOs, and mappers are covered through component tests.

### Integration tests — `backend/tests/integration/`

Infrastructure layer against the real Firestore emulator. These catch Firestore-specific quirks mocks cannot: transaction retries, index errors, serverTimestamp ordering, `updateTime`-based ETags, concurrent write contention.

- Firestore user repository behavior is exercised through auth-sync integration/component tests: `create` / `findById` / `findByIdentity` / `save` against the emulator
- `tests/integration/infrastructure/firestore/firestore-unit-of-work.test.ts` — transaction rollback on throw, concurrent execute contention
- `tests/integration/infrastructure/firestore/translate-firestore-errors.test.ts` — driver-error → DomainError mapping with induced emulator errors

**Setup**: start emulator via `pnpm run emulator`, set `USE_EMULATOR=true`. Each test clears the target collection in a `beforeEach`.

### Component tests — `backend/tests/component/`

Black-box HTTP against `createApp()` with real Firestore + Firebase Auth emulators. The definitive "this endpoint meets the spec" test.

- `tests/component/routes/users.test.ts` — JIT bootstrap on first authenticated request (GET /users/me triggers it via the hydrator middleware), GET /users/:id, PATCH /users/:id, derived `studentNumber` from RMIT email, no `firebaseUid` leaked, concurrent first-request race resolves to a single user record

**One `it(...)` per bullet** in the governing phase's `Success criteria` + `Bug-finding cases` in `docs/WORKFLOW-API-IMPLEMENTATION-PLAN.md`. This is the **definitive** contract check.

Component tests don't mock `UnitOfWork`. They seed the emulator with required state (e.g. a pre-existing user), hit the HTTP endpoint, and assert the wire response + post-state in Firestore.

### E2E — `e2e/`

Playwright, one layer up. Covers user journeys across multiple endpoints + UI navigation. Not per-phase mandatory; added as vertical slices ship.

## What each phase must ship

Every phase PR includes tests at each applicable level:

| When the phase adds…       | Minimum required                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------- |
| A domain class / VO / rule | Unit tests for the class and its methods                                               |
| A CQRS handler             | Integration test against the emulator with the real `FirestoreUnitOfWork`              |
| A repository method        | Integration test against the emulator                                                  |
| A route (the common case)  | Component test per `Success criteria` + `Bug-finding` bullet                           |
| API DTOs / mappers         | Component assertions on request parsing, response body, headers, and persistence state |

If a phase introduces a new aggregate, it ships new fixtures + integration tests for the full repo API.

## Running tests

```bash
# Fast unit tier only — no emulator, <1s (good for save-on-save / pre-commit)
pnpm --filter backend run test:unit

# Full backend pyramid (unit + integration + component) — needs emulator
pnpm run emulator                          # once, in a separate terminal
pnpm --filter backend run test             # all three tiers

# Individual tiers
pnpm --filter backend run test:integration
pnpm --filter backend run test:component

# With coverage gate (fails if any metric < 80%)
pnpm --filter backend run test:coverage

# Frontend unit
pnpm --filter frontend run test

# Playwright E2E (auto-starts frontend)
pnpm run test:e2e
```

## CI layout

Five jobs, all blocking merge (see `.github/workflows/_ci.yml`):

1. **Lint & Typecheck** — `pnpm run lint` + `pnpm run typecheck`
2. **Build** — `pnpm run build` (both frontend and backend)
3. **Frontend Tests** — `pnpm --filter frontend run test`
4. **Backend Tests (all tiers + coverage ≥80%)** — boots Firebase emulators via `docker compose`, runs `pnpm --filter backend run test:coverage`. Fails if any coverage metric (lines/statements/functions/branches) drops below 80%.
5. **Security Scan** — gitleaks secret scan

## No Firebase mocks in unit tests

Unit tests stay in `backend/tests/unit/domain/**`, so they must not import API, application, infrastructure, Firestore, Firebase Admin, or mocked `UnitOfWork` helpers. `backend/tests/setup.unit.ts` only freezes the clock for deterministic domain fixtures.

For **integration** and **component** tests, do not mock Firebase — the whole point is to run against real emulator behaviour. These use application handlers and `createApp()` with production wiring.

## Time in tests — fixtures must not date-rot

Several handlers and aggregates read `new Date()` directly (semester window check, `confirmedAt` settle, `createdAt`/`updatedAt` stamping). Fixtures encoded as absolute ISO dates silently expire. We learned this when `enrolmentCloseAt: 2026-05-01` started failing on 2026-05-02 with no code change.

Two patterns, picked by tier:

**Unit tests** — clock is frozen globally in `tests/setup.unit.ts` to `TEST_NOW` (`2026-04-01T00:00:00Z`), via `vi.useFakeTimers({ shouldAdvanceTime: true, now: TEST_NOW })` in `beforeEach`. Every unit test runs with the same wall-clock value forever. Align fixture dates around `TEST_NOW` (`createdAt: TEST_NOW`, `enrolmentOpenAt: addDays(TEST_NOW, -7)`) and assertions stay valid regardless of when the suite runs. Tests that need a different now can call `vi.setSystemTime(...)` mid-test — `afterEach` resets.

**Integration + component tests** — emulator stamps timestamps server-side and runs out-of-process, so `vi.useFakeTimers` is not an option. Use the `ALWAYS_OPEN_WINDOW` / `ALWAYS_CLOSED_WINDOW` sentinels from `tests/setup.emulator.ts` for any window-state fixture. They expand to `2000-01-01 → 2099-12-31` (and vice-versa), so they're unambiguous and won't expire in any reasonable lifetime.

If you need a window with a _specific_ relationship to "now" (e.g., "open until tomorrow"), compute it from `Date.now()` rather than hard-coding a calendar date.

## What to skip

- Don't unit-test Express itself (routing, body parsing) — that's Express's job
- Don't unit-test the Firestore SDK — that's Firebase's job
- Don't unit-test CQRS handlers with mocked UoW — use integration tests with real Firestore UoW
- Don't unit-test API mappers separately — assert the wire contract in component tests
- Don't write component tests for pure domain rules: move those to domain unit tests
