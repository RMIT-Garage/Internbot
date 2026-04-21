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

Backend work uses **four** levels (plus architecture meta-tests). Every phase's PR must include unit + integration + component coverage where applicable.

| Level            | Folder                               | Emulator | Typical duration per test | What it covers                                                                                                                                        |
| ---------------- | ------------------------------------ | -------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unit**         | `backend/tests/unit/**`              | No       | < 10ms                    | Pure logic — domain classes & rules, application handlers with mocked UoW, mapper round-trips                                                         |
| **Integration**  | `backend/tests/integration/**`       | Yes      | 50–200ms                  | Infrastructure bound to real Firestore — repo methods, UoW transactions, driver-error translation, index requirements                                 |
| **Component**    | `backend/tests/component/**`         | Yes      | 100–500ms                 | Full `createApp()` via `supertest` against Firestore + Firebase Auth emulators. Black-box HTTP contract — one test per spec `Success criteria` bullet |
| **E2E**          | `e2e/**`                             | Live app | 1–5s                      | Playwright — UI + backend + emulator running together                                                                                                 |
| **Architecture** | `backend/tests/unit/architecture/**` | No       | < 5ms                     | Dep-rule enforcement (`domain/` no zod, `application/` no firebase-admin, `api/routes/` no direct firebase-admin, no `console.log`, etc.)             |

## Where each test goes

### Unit tests — `backend/tests/unit/`

Pure TypeScript, no network, no emulator. Fast feedback loop.

- `tests/unit/domain/entities/user.test.ts` — class behaviour (`User.isStudent()`, `User.withStudentProfile(...)`)
- `tests/unit/domain/value-objects/student-profile.test.ts` — `StudentProfile.isComplete()`, `deriveStatus()`, `equals()`
- `tests/unit/domain/value-objects/academic-info.test.ts` — `hasAllRequiredFields()`, `equals()`
- `tests/unit/application/commands/sync-user.test.ts` — handler with **mocked** `UnitOfWork` and `PlatformClaimsService`. Tests authz decisions, domain-rule branches, command-result shape.
- `tests/unit/application/queries/get-user.test.ts` — same pattern
- `tests/unit/infrastructure/mappers/user.test.ts` — `mapStorageToUser` / `studentProfileToStorage` round-trips with synthetic `UserStorage` fixtures
- `tests/unit/architecture/architecture.test.ts` — dep-rule meta-tests

**Mocks in unit tests**: use `buildMockUow()` from `tests/setup.unit.ts`. Never start the emulator from a unit test.

### Integration tests — `backend/tests/integration/`

Infrastructure layer against the real Firestore emulator. These catch Firestore-specific quirks mocks cannot: transaction retries, index errors, serverTimestamp ordering, `updateTime`-based ETags, concurrent write contention.

- `tests/integration/infrastructure/firestore/firestore-user-repository.test.ts` — `create` / `findById` / `findByFirebaseUid` / `update` / `markAcademicInfoConfirmed` against emulator
- `tests/integration/infrastructure/firestore/firestore-unit-of-work.test.ts` — transaction rollback on throw, concurrent execute contention
- `tests/integration/infrastructure/firestore/translate-firestore-errors.test.ts` — driver-error → DomainError mapping with induced emulator errors

**Setup**: start emulator via `pnpm run emulator`, set `USE_EMULATOR=true`. Each test clears the target collection in a `beforeEach`.

### Component tests — `backend/tests/component/`

Black-box HTTP against `createApp()` with real Firestore + Firebase Auth emulators. The definitive "this endpoint meets the spec" test.

- `tests/component/routes/auth.test.ts` — POST /auth/sync: first call (creates doc + sets claims), repeat call, missing studentNumber, concurrent first-call race
- `tests/component/routes/users.test.ts` — GET /users/:id, PATCH /users/:id, all Success-criteria and Bug-finding bullets from the phase

**One `it(...)` per bullet** in the governing phase's `Success criteria` + `Bug-finding cases` in `docs/WORKFLOW-API-IMPLEMENTATION-PLAN.md`. This is the **definitive** contract check.

Component tests don't mock `UnitOfWork`. They seed the emulator with required state (e.g. a pre-existing user), hit the HTTP endpoint, and assert the wire response + post-state in Firestore.

### E2E — `e2e/`

Playwright, one layer up. Covers user journeys across multiple endpoints + UI navigation. Not per-phase mandatory; added as vertical slices ship.

## What each phase must ship

Every phase PR includes tests at each applicable level:

| When the phase adds…       | Minimum required                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------ |
| A domain class / VO / rule | Unit tests for the class and its methods                                             |
| A CQRS handler             | Unit test with mocked UoW covering every authz branch + every success/failure return |
| A repository method        | Integration test against the emulator                                                |
| A route (the common case)  | Component test per `Success criteria` + `Bug-finding` bullet                         |

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

## Mocking Firebase in unit tests

`backend/tests/setup.unit.ts` stubs `infrastructure/config/firebase-admin` globally so the Admin SDK never initializes during unit tests. Unit tests use the injected mocks:

```typescript
import { createApp } from '../../../src/api/app'
import { mockVerifyToken, mockPlatformClaimsService, buildMockUow, buildRequestActor } from '../../setup'

const { uow, users } = buildMockUow()
const app = createApp({ verifyToken: mockVerifyToken, uow, platformClaimsService: mockPlatformClaimsService })

vi.mocked(mockVerifyToken).mockResolvedValue(buildRequestActor({ platformUser: { id: 'usr_me', role: 'student' } }))
users.findById.mockResolvedValueOnce({ user: …, etag: 'W/"1"' })
```

For **integration** and **component** tests, DO NOT mock — the whole point is to run against real emulator behaviour. These use `createApp()` with the production defaults.

## What to skip

- Don't unit-test Express itself (routing, body parsing) — that's Express's job
- Don't unit-test the Firestore SDK — that's Firebase's job
- Don't duplicate coverage: if a component test asserts the full contract, the unit test for the same branch only needs to cover the decision logic, not the HTTP shape
- Don't write component tests that could be unit tests: if your test doesn't need Firestore, move it to unit
