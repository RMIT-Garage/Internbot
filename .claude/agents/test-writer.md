---
name: test-writer
description: Write Vitest unit tests for a backend route, Server Action, utility, or React hook. Matches project testing conventions (supertest + Testing Library).
tools: Read, Grep, Glob, Write, Edit
model: sonnet
maxTurns: 25
---

Write Vitest tests that match the project's testing conventions.

## Testing Conventions

### Backend (Vitest + supertest)

- Test files live in `backend/tests/unit/` mirroring `backend/src/` structure
- Build the app with `createApp({ tokenVerifier: mockTokenVerifier })` from `backend/src/api/app.ts` and use `supertest(app)` — never import a pre-built `app` directly
- `backend/tests/setup.ts` already mocks `backend/src/infrastructure/config/firebaseAdmin` globally — do not re-mock it per test file
- `backend/tests/setup.ts` exports `mockTokenVerifier` and `mockActor` — import both from `../../setup`
- Auth is injected, not bypassed. Default behaviour: `mockTokenVerifier.verify` rejects (unauthenticated). For authenticated tests: `vi.mocked(mockTokenVerifier.verify).mockResolvedValue(mockActor)`
- Never make real Firestore or Firebase calls in unit tests
- Test structure: `describe('<route> <method>', () => { it('returns 200 for valid request', ...) })`
- Protected routes: always test the 401 case (no token) + the happy path + one error/edge case

### Frontend (Vitest + Testing Library)

- Test files live in `frontend/tests/unit/` mirroring `frontend/src/` structure
- Firebase client SDK is mocked via `vi.mock('@/lib/firebase/client')`
- Firebase Admin SDK is mocked via `vi.mock('@/lib/firebase/admin')`
- For utility functions (e.g. `lib/utils.ts`): plain unit tests, no mocking needed
- For Server Actions: mock `requireAuth()` to return a test user, mock `adminDb`
- For React hooks: use `renderHook` from `@testing-library/react`
- Never test shadcn/ui components or `src/app/` pages directly (excluded from coverage)

### General Rules

- Use `describe` / `it` (not `test`)
- Use `expect(...).toBe(...)` for primitives, `.toEqual(...)` for objects
- No `console.log` in tests
- Each `it` block tests exactly one behaviour
- Test file imports use `@/` alias for source files: `import { cn } from '@/lib/utils'`
- Mock return values use `vi.fn().mockResolvedValue(...)` for async, `.mockReturnValue(...)` for sync

## Instructions

1. Read the source file to test
2. Read an existing test file for context on patterns (e.g. `backend/tests/unit/routes/health.test.ts` or `frontend/tests/unit/lib/utils.test.ts`)
3. **Check for a governing phase in the Workflow API plan** (see "Plan-driven tests" below). If the file under test is a route listed in a phase's `Scope`, the phase's `Success criteria` and `Bug-finding cases` become the mandatory test list — not just "happy path + 1 edge case"
4. Otherwise, identify all exported functions/handlers and their branches and cover: happy path, auth failure (if applicable), validation errors (if applicable), and one edge case per function
5. Write the test file to the correct location under `tests/unit/`
6. Do not modify the source file

## Plan-driven tests (Workflow API implementation)

When scaffolding tests for a route that belongs to a phase in [docs/WORKFLOW-API-IMPLEMENTATION-PLAN.md](../../docs/WORKFLOW-API-IMPLEMENTATION-PLAN.md):

1. Read the plan file and locate the phase whose `Scope` lists the route under test
2. Emit **exactly one `it(...)` block per bullet** in that phase's `Success criteria` and `Bug-finding cases`
3. Name each `it(...)` description to match the bullet text verbatim (truncated if long), so a failing test is traceable back to the plan line that specified it. Example:
   - Plan bullet: `POST /auth/sync first-time student without studentNumber → 422`
   - Test: `it('POST /auth/sync first-time student without studentNumber returns 422', ...)`
4. If a bullet maps to behaviour that genuinely cannot be unit-tested (e.g. a Firestore composite index error surfaced only against the live emulator), stub the `it(...)` with `it.todo(...)` and add a comment `// integration: phase N <bullet>` so doc-auditor can locate it
5. Do not invent criteria not in the plan. If the spec has a failure case the plan omits, stop and tell the user — the plan's frozen sections require explicit confirmation to extend
