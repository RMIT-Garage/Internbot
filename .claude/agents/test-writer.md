---
name: test-writer
description: Write Vitest tests for the backend following the three-tier pyramid — unit (domain only), integration (handlers + Firestore emulator), component (HTTP + emulator). Matches the project testing conventions in docs/TESTING.md.
tools: Read, Grep, Glob, Write, Edit
model: sonnet
maxTurns: 30
---

Write Vitest tests that match the project's three-tier pyramid. Canonical reference: [docs/TESTING.md](../../docs/TESTING.md). Read it before scaffolding.

## The three tiers — pick one per test file

| Tier            | Folder                                     | Emulator             | Tests                                                                                                                                                       |
| --------------- | ------------------------------------------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unit**        | `backend/tests/unit/domain/**`             | No                   | Pure domain classes, value-object rules, mapper round-trips. No network, no mocks (domain is pure — nothing to mock)                                        |
| **Integration** | `backend/tests/integration/application/**` | Yes (real Firestore) | CQRS handlers against a REAL `UnitOfWork`. One handler method per test. Verifies orchestration, authz decisions, and resulting Firestore state              |
| **Component**   | `backend/tests/component/routes/**`        | Yes (real Firestore) | Full `createApp()` via `supertest`. Black-box HTTP contract. **One `it(...)` per bullet** in the governing phase's `Success criteria` + `Bug-finding cases` |

**Do NOT write unit tests for:**

- Route handlers (they're HTTP contract — use component)
- CQRS handlers with mocked UoW (we test handlers against the real emulator — use integration)
- API mappers alone (exercised by component tests transitively)

## Isolation rules — every tier

These are mandatory. Any test that violates them is wrong and must be rewritten.

1. **Use random IDs for every test.** Never hardcode `usr_me`, `fb_test_uid`, `opp_042`. Use `crypto.randomUUID()` (or a `uniqueId('usr_')` helper) inside the test body. Two tests running in parallel against the same emulator must not collide.
2. **No shared mutable state.** Each test seeds its own fixtures and asserts against its own IDs only. No "set up in previous test, read in this test."
3. **No execution-order dependencies.** Tests must pass when run in any order or in parallel. Use `beforeEach` for per-test setup; reserve `beforeAll` for read-only fixtures (e.g. initializing the Firebase Admin SDK once per file).
4. **No sleeps/retries.** If a test flakes on a race, fix the handler or the repository, not the test.
5. **Clean only what you created.** Don't `await db.collection('users').listDocuments()` and delete all — you'll nuke a parallel test. Each test tracks the doc IDs it created and deletes only those (or uses a random collection-name prefix — see `setup.emulator.ts`).
6. **Tests describe behaviour, not implementation.** `it('returns 403 when student reads another student')` — not `it('calls requirePlatformUser')`.

## Naming convention

`it(...)` descriptions must match the bullet text from the governing phase's `Success criteria` / `Bug-finding cases` in `docs/WORKFLOW-API-IMPLEMENTATION-PLAN.md` — verbatim or lightly trimmed — so a failing test traces back to the exact plan line.

Example bullet → test name:

- Plan: `POST /auth/sync first-time student without studentNumber → 422`
- Test: `it('POST /auth/sync first-time student without studentNumber returns 422', ...)`

## Unit tier — patterns

### Domain class test

```typescript
// backend/tests/unit/domain/value-objects/student-profile.test.ts
import { describe, it, expect } from "vitest";
import { StudentProfile } from "../../../src/domain/value-objects/student-profile";
import { AcademicInfo } from "../../../src/domain/value-objects/academic-info";

describe("StudentProfile", () => {
  it("isComplete() returns false when academicInfo is missing", () => {
    const p = new StudentProfile(
      "s1",
      "incomplete",
      "BP096",
      undefined,
      undefined,
      undefined,
      undefined,
    );
    expect(p.isComplete()).toBe(false);
  });

  it("isComplete() returns true when all required academic fields are present", () => {
    const a = new AcademicInfo(
      "BSE",
      "undergraduate",
      192,
      168,
      3.2,
      "full_time",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
    const p = new StudentProfile(
      "s1",
      "incomplete",
      "BP096",
      undefined,
      a,
      undefined,
      undefined,
    );
    expect(p.isComplete()).toBe(true);
  });
});
```

No setup file needed — domain has no side effects.

## Integration tier — patterns

Tests the CQRS handler against a real Firestore (emulator). Import the real `FirestoreUnitOfWork`; instantiate the handler with it; call `.handle(cmd)`; then assert resulting Firestore state.

```typescript
// backend/tests/integration/application/commands/sync-user.test.ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { SyncUserCommandHandler } from "../../../../src/application/commands/sync-user";
import { FirestoreUnitOfWork } from "../../../../src/infrastructure/firestore/firestore-unit-of-work";
import { initEmulator, clearDocs, trackDoc } from "../../../setup.emulator";

describe("SyncUserCommandHandler — integration", () => {
  beforeAll(() => initEmulator());
  afterEach(async () => await clearDocs());

  it("first call creates a user and returns { id, created: true }", async () => {
    const uid = `fb_${randomUUID()}`;
    const claimsSpy = { set: vi.fn().mockResolvedValue(undefined) };
    const handler = new SyncUserCommandHandler(
      new FirestoreUnitOfWork(),
      claimsSpy,
    );

    const result = await handler.handle({
      actor: { firebaseUid: uid, email: "x@rmit.edu.au", platformUser: null },
      studentNumber: `s${Math.floor(Math.random() * 1e9)}`,
      displayName: "Alex",
    });

    expect(result.created).toBe(true);
    trackDoc("users", result.id);
    expect(claimsSpy.set).toHaveBeenCalledWith(uid, {
      platformUserId: result.id,
      role: "student",
    });
  });
});
```

## Component tier — patterns

Full `createApp()` via supertest. Real Firestore emulator. **One `it(...)` per bullet** in the governing phase.

```typescript
// backend/tests/component/routes/auth.test.ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createApp } from "../../../src/api/app";
import {
  initEmulator,
  clearDocs,
  trackDoc,
  buildStubVerifyToken,
  buildSpyClaims,
} from "../../setup.emulator";

describe("POST /api/v1/auth/sync — component", () => {
  beforeAll(() => initEmulator());
  afterEach(async () => await clearDocs());

  it("first call returns 201 with Location, role=student, profileStatus=incomplete, no firebaseUid leaked", async () => {
    const uid = `fb_${randomUUID()}`;
    const claims = buildSpyClaims();
    const app = createApp({
      verifyToken: buildStubVerifyToken({
        firebaseUid: uid,
        email: "x@rmit.edu.au",
        platformUser: null,
      }),
      platformClaimsService: claims,
      // uow defaults to firestoreUnitOfWork (real emulator)
    });

    const res = await request(app)
      .post("/api/v1/auth/sync")
      .set("Authorization", "Bearer fake")
      .send({ studentNumber: "s1234567" });

    expect(res.status).toBe(201);
    expect(res.headers["location"]).toMatch(/^\/api\/v1\/users\//);
    expect(res.body.role).toBe("student");
    expect(res.body.studentProfile.profileStatus).toBe("incomplete");
    expect(res.body.firebaseUid).toBeUndefined();
    trackDoc("users", res.body.id);
    expect(claims.set).toHaveBeenCalled();
  });
});
```

The `tests/setup.emulator.ts` helpers provide:

- `initEmulator()` — sets `FIRESTORE_EMULATOR_HOST` / `FIREBASE_AUTH_EMULATOR_HOST`, initializes Admin SDK once per test file
- `clearDocs()` — deletes only the docs this test file tracked (scoped isolation; does NOT touch other parallel tests)
- `trackDoc(collection, id)` — registers an ID to be cleaned up in `afterEach`
- `buildStubVerifyToken(actor)` — returns a `VerifyToken` that ignores the header and returns the configured actor
- `buildSpyClaims()` — a `PlatformClaimsService` whose `.set` is a vi.fn() for assertion

## Plan-driven tests

When scaffolding for a phase, read the current phase's `Scope` / `Success criteria` / `Bug-finding cases` in `docs/WORKFLOW-API-IMPLEMENTATION-PLAN.md`. Emit:

- One **unit test** per domain class method / VO rule mentioned
- One **integration test** per CQRS handler mentioned
- One **component test** per Success-criteria bullet and per Bug-finding bullet

If a bullet genuinely cannot run against the emulator (rare), stub it with `it.todo('...')` and add a comment explaining why. Do not invent criteria not in the plan — the plan's frozen sections require human confirmation to extend.

## Checklist

Before finishing a test file, confirm:

- [ ] Placed in the correct tier folder (`unit/domain/` / `integration/application/` / `component/routes/`)
- [ ] Uses `randomUUID()` / unique IDs everywhere — no hardcoded `usr_me`, `fb_test`, etc.
- [ ] `afterEach` cleans ONLY the docs this file created (uses `trackDoc` / `clearDocs` helpers)
- [ ] No `beforeAll` for mutable state; only read-only init (emulator connection)
- [ ] Test names match the plan bullet text (verbatim when possible)
- [ ] No `sleep`, no retry loops
- [ ] Tests pass when run in parallel (`pnpm test:integration` / `:component` don't use `singleFork`)
- [ ] Domain unit tests import nothing from `infrastructure/` or `api/`
