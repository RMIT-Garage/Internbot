# Backend

> Canonical reference for backend conventions. `backend/CLAUDE.md` is a
> thin rule sheet; this file is the deep dive. Spec-level behaviour lives
> in [docs/WORKFLOW-API-SPEC.md](/Users/nhatdongdang/Documents/Code/Internbot/docs/WORKFLOW-API-SPEC.md).

---

## Overview

The backend is a **Firebase Cloud Functions v2** app using the **Express fat-lambda** pattern — a single Cloud Function (`api`) that delegates all routing to an Express app.

Architecture: **Clean Architecture + DDD + CQRS + Unit of Work.** Four layers with a strict dependency rule:

```
domain  ←  application  ←  infrastructure  ←  api
```

Each layer owns its own data model. Mappers sit at every boundary — no type ever leaks across layers.

Identity: **platform `users/{id}`** is the app identity. Firebase UID is an IdP identity mapped through `userIdentities/{provider}__{providerUserId}`; never use it as a foreign key or route param.

---

## Directory layout

```
backend/src/
├── index.ts                                    Cloud Functions v2 entry
│
├── domain/                                     Pure TypeScript — no zod, no firebase, no express
│   ├── errors.ts                               DomainError hierarchy (no HTTP coupling)
│   ├── entities/user.ts                        User aggregate — MUTABLE, #props + getters + create/rehydrate
│   ├── value-objects/
│   │   ├── user-enums.ts                       Role, UserStatus, ProfileStatus, …
│   │   ├── academic-info.ts                    Immutable VO — #props + getters + create/rehydrate + with*
│   │   └── student-profile.ts                  Immutable VO — with*/settleStatus/markComplete
│   └── repositories/user-repository.ts         UserRepository port — findById / findByIdentity / create / save
│
├── application/                                Use cases — no zod, no firebase, no express
│   ├── actor.ts                                RequestActor + PlatformUser
│   ├── command-metadata.ts                     CommandMetadata — cross-cutting transport metadata (expectedVersion)
│   ├── unit-of-work.ts                         UnitOfWork port + UnitOfWorkContext
│   ├── models/user.ts                          UserResult application DTO
│   ├── ports/platform-claims-service.ts        External-service port (Firebase custom claims)
│   ├── commands/
│   │   ├── sync-user.ts                        SyncUserCommandHandler → { id, created }
│   │   └── update-user-profile.ts              UpdateUserProfileCommandHandler → { id }
│   └── queries/get-user.ts                     GetUserQueryHandler → UserResult
│
├── infrastructure/                             Adapters — may import domain + application, never api
│   ├── config/firebase-admin.ts                Admin SDK singleton + FieldValue / Timestamp re-exports
│   ├── firestore/
│   │   ├── schemas/user.ts                     Zod storage schema (Timestamp-based)
│   │   ├── mappers/user.ts                     storage ↔ domain — calls Xxx.rehydrate()
│   │   ├── translate-firestore-errors.ts       Translate Firestore driver errors → DomainError
│   │   ├── firestore-user-repository.ts        save() enforces optimistic concurrency in-txn
│   │   └── firestore-unit-of-work.ts           UnitOfWork impl (adminDb.runTransaction wrapper)
│   └── services/firebase-platform-claims-service.ts
│
└── api/                                        Outermost — no ports, depends on everything below
    ├── app.ts                                  Composition root: wires DI into createApp()
    ├── errors.ts                               ApiError (RFC 9457)
    ├── auth/firebase-token-verifier.ts         Reads role/platformUserId from ID-token claims
    ├── middleware/{auth,error-handler}.ts
    ├── routes/                                 Router factories — one per resource
    ├── schemas/user.ts                         Zod request DTOs + .meta({ id }) for OpenAPI
    ├── dto/user.ts                             Zod response DTOs
    ├── openapi/{common,operations/*,spec}.ts   OpenAPI 3.1 generation
    ├── mappers/user.ts                         request → command; result → response
    └── utils/{etag,pagination,resolve-user-id}.ts
```

---

## Domain modelling (DDD) — the patterns this codebase enforces

### Aggregate roots are MUTABLE

Aggregate methods (`changePhone`, `setAcademicInfo`, …) return `void` and mutate internal state via a private `#props` field. Handlers load → mutate → save:

```typescript
const user = await uow.users.findById(cmd.userId)
if (!user) throw new NotFoundError('User', cmd.userId)
user.changeProgramCode(code)
user.setAcademicInfo(AcademicInfo.create(...))
await uow.users.save(user)
```

Mutation methods enforce their own invariants (e.g. `ForbiddenError` if the aggregate isn't in a student state) and reconcile derived state (`profileStatus`, `onboardingStage`, `confirmedAt` stamping). Handlers never orchestrate derived state.

### Value objects are IMMUTABLE

`with*` mutators return new instances. State transitions that stamp time (`markComplete(now)`, `settleStatus(now)`) take `now: Date` as an explicit parameter so the domain stays deterministic and testable.

### Every domain class uses `#props` + getters + `create` / `rehydrate`

- Private ECMAScript `#props` field — runtime privacy, not just TypeScript `private`.
- Public **getters** expose each field (read-only to callers).
- `private constructor` — no direct `new User(...)`.
- Two static factories:
  - **`create(props)`** — command-handler input path. Validates required invariants; throws `ValidationError` / `Error` on bad input.
  - **`rehydrate(props)`** — storage path. No validation (trust our own persisted data); the Firestore mapper calls this.
- `with*` mutators spread `#props` and call `rehydrate`:
  ```typescript
  withConfirmedAt(confirmedAt: Date): AcademicInfo {
    return AcademicInfo.rehydrate({ ...this.#props, confirmedAt })
  }
  ```

### Method naming conventions

| Prefix / shape         | Returns                      | Use                                                                           |
| ---------------------- | ---------------------------- | ----------------------------------------------------------------------------- |
| `is*()`                | `boolean` (often type guard) | Predicate. `isStudent()`, `isCoordinator()`                                   |
| `has*()`               | `boolean`                    | Presence / invariant check. `hasAllRequiredFields()`                          |
| `ensure*()`            | `void` (throws on violation) | Invariant guard. `ensureStudentNumberMatches(x)`                              |
| `with*()`              | new VO instance              | VO field mutator (immutable). `withProgramCode('BP096')`                      |
| `change*` / `set*`     | `void` (aggregate mutates)   | Aggregate command. `changePhone(x)`, `setAcademicInfo(info)`                  |
| `clear*()`             | `void` (aggregate mutates)   | Aggregate command that removes a field. `clearPhone()`, `clearAcademicInfo()` |
| `markX` / domain event | new VO / void                | Intent-revealing state transition. `markComplete(now)` — not CRUD-shaped      |

### Optimistic concurrency lives at the persistence boundary

- `User.version` is set from Firestore's `updateTime.toMillis()` on load.
- **Never incremented client-side.** Firestore's `updateTime` is authoritative; client increment would need reconciliation with whatever Firestore writes, for no benefit.
- `repository.save(user)` reads the doc in-txn, compares `snap.updateTime.toMillis()` to `user.version`, throws `PreconditionFailedError` on mismatch, then writes.
- HTTP `If-Match` is parsed at the api boundary into `CommandMetadata.expectedVersion`. The handler also throws early `PreconditionFailedError` on mismatch — the repo's save-time check is the race-safe authoritative one.

### Delegate domain logic to the aggregate cleanly

Command handlers translate patch keys to aggregate method calls one-per-field. Business rules (`studentNumber` immutability, `confirmedAt` preservation, `profileStatus` derivation) live on the domain class.

---

## Per-concern implementation choices

| Concern                                          | Uses                                                                                                                 |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Aggregate root (`User`)                          | **class**, mutable, `#props` + getters, private ctor, `create` / `rehydrate`, `change*`/`set*`/`clear*` void methods |
| Value objects (`StudentProfile`, `AcademicInfo`) | **class**, immutable, `#props` + getters, private ctor, `create` / `rehydrate`, `with*` returning new instances      |
| Repository contracts                             | **interface** (port) — in `domain/repositories/`                                                                     |
| Repository implementations                       | **class** — in `infrastructure/firestore/`; `save(user)` enforces optimistic concurrency in-txn                      |
| UnitOfWork                                       | **interface** (port) in application + **class** impl in infrastructure                                               |
| Route handlers / controllers                     | **plain function** inside a Router factory                                                                           |
| CQRS command/query handlers                      | **class** with flat constructor-injected deps, single `handle(cmd)` method                                           |
| Cross-cutting transport metadata on commands     | Nested `cmd.metadata: CommandMetadata` (NOT a second `handle(cmd, ctx)` argument)                                    |
| DTOs, command/query payloads, results            | **interface** or **type**                                                                                            |
| Auth helpers (token verifier, claims setter)     | **plain function** (no port — api is outermost layer)                                                                |

---

## Naming

| Artifact                          | Style                                                               |
| --------------------------------- | ------------------------------------------------------------------- |
| Files & folders                   | `kebab-case` (`firestore-user-repository.ts`, `value-objects/`)     |
| Classes, interfaces, type aliases | `PascalCase` (`SyncUserCommandHandler`, `UserProps`)                |
| Functions, variables, exports     | `lowerCamelCase` (`verifyFirebaseToken`)                            |
| Command/query target id           | Specific name (`userId`, `semesterId`) — **not generic `targetId`** |
| URL path segments (multi-word)    | `kebab-case` (`/offer-submissions`)                                 |
| Express route params              | `lowerCamelCase` (`:studentId`)                                     |
| Enum / status values              | `snake_case` (`offer_pending_review`)                               |

---

## CQRS contract

Every use case is one of:

- **Command** — a mutation. Returns `{ id, … }` only (strict CQRS). Route re-dispatches a query for the response body.
- **Query** — a read. Returns an application DTO.

Handler shape:

```typescript
// application/commands/update-user-profile.ts
export interface UpdateUserProfileCommand {
  actor: RequestActor         // always first — identity is carried in the payload
  userId: string              // specific id, not generic `targetId`
  patch: { ... }              // business intent
  metadata?: CommandMetadata  // cross-cutting transport metadata (expectedVersion, future correlationId / idempotencyKey)
}

export class UpdateUserProfileCommandHandler {
  constructor(private readonly uow: UnitOfWork) {}

  async handle(cmd: UpdateUserProfileCommand): Promise<{ id: string }> {
    // inline authz
    return this.uow.execute(async (uow) => {
      const user = await uow.users.findById(cmd.userId)
      if (!user) throw new NotFoundError('User', cmd.userId)
      // call aggregate mutation methods — one per patch key
      if (cmd.patch.programCode !== undefined) user.changeProgramCode(cmd.patch.programCode)
      // ...
      await uow.users.save(user)
      return { id: cmd.userId }
    })
  }
}
```

Rules:

- **`actor: RequestActor` is the first field of every command/query payload.** Handlers read `cmd.actor.platformUser` directly.
- **Business intent stays on the command payload; transport metadata is nested on `cmd.metadata`.** Preserves the uniform `handle(cmd)` signature across the codebase. Room to add `correlationId` / `idempotencyKey` on `CommandMetadata` when infrastructure exists.
- **Authz lives inside the handler.** No shared `application/authz/` helpers — each handler owns its own role/ownership checks.
- **Deps are constructor-injected.** Instantiate once in the router factory.
- **Handlers never call Firestore directly.** They go through `uow.execute(async (uow) => { await uow.users.findById(…) })`.
- **Domain logic lives on the aggregate.** Handlers call `user.change*()` / `user.ensure*()` — they don't mutate `user.studentProfile` directly.
- **Commands return identifiers only.** The route dispatches a follow-up query for the response body.
- **Errors thrown are DomainErrors** (shared with domain) or `ValidationError` with `reason`/`fields`. The api errorHandler maps to HTTP.

---

## Unit of Work

```typescript
export interface UnitOfWork {
  execute<T>(work: (ctx: UnitOfWorkContext) => Promise<T>): Promise<T>;
}

export interface UnitOfWorkContext {
  readonly users: UserRepository;
  // Future phases extend: opportunities, internships, semesters, …
}
```

`uow.execute(work)` opens a persistence session (Firestore transaction in production), constructs session-scoped repositories bound to the transaction, runs `work(ctx)`, and commits. Throwing rolls back.

Firestore quirk: transactions cannot re-read a document after a write in the same txn — so `create` / `save` return `{ id }` or `void`; callers re-read via `findById` outside the transaction (the route does this by dispatching a follow-up query for the response body).

---

## Repository port shape

```typescript
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByIdentity(identity: UserIdentityLookup): Promise<User | null>;
  create(user: User, identity: UserIdentityCreate): Promise<{ id: string }>;
  save(user: User): Promise<void>; // update — optimistic lock via user.version
}
```

- `findByIdentity(identity)` resolves an IdP subject through `userIdentities/{provider}__{providerUserId}` and returns the app user.
- `create(user, identity)` accepts a fresh aggregate from `User.create(...)`, inserts `users/{id}`, and creates the identity mapping in the same transaction. The returned `id` replaces the aggregate's empty id.
- `save(user)` reads the doc in-txn, compares `updateTime.toMillis()` to `user.version`, throws `PreconditionFailedError` on mismatch, then writes the mutable subset (`displayName`, `studentProfile`, `onboardingStage`, `status`, `updatedAt`).
- `save(user)` does **not** mutate `user.version`. Callers discard the instance after save or re-read.

---

## Authentication — edge hydration with JIT bootstrap (Pattern B)

Identity is hydrated from Firestore at the api edge on every request. No JWT custom claims, no client handshake. The flow:

1. `verifyFirebaseToken` decodes the IdP-attested token and returns `{ firebaseUid, email }` only.
2. `createPlatformUserHydrator(uow, idGenerator)` runs a transactional lookup of `userIdentities/firebase__{uid}` → `users/{id}`. If found, returns `{ id, role }`.
3. **JIT bootstrap (students only):** if not found and the email is RMIT-student-shape (`s\d+@student.rmit.edu.au`), the hydrator creates the `users/{id}` aggregate (with derived `studentNumber` + initial `studentProfile`) plus the `userIdentities` sentinel in the same transaction. Coordinators are admin-provisioned (Auth user + Firestore doc together) so they reach this hydrator already-hydrated and never trigger the JIT branch.
4. `createAuthMiddleware` assembles `actor = { firebaseUid, email, platformUser }` on the request. Routes whose handlers require a synced user check `actor.platformUser !== null` inline; null at this stage means email shape couldn't drive the JIT (auth provider drift) — treat as 403.

Email-domain enforcement lives at the IdP boundary (`enforceStudentEmail` GCIP `beforeUserCreated` blocking function, see `backend/src/index.ts`), not in the application layer. The hydrator's regex check is a system-invariant guard, not a policy gate.

---

## Authorization — inside each CQRS handler

No shared guards. Each handler enforces its own rules at the top of `handle()`:

```typescript
async handle(cmd: GetUserQuery): Promise<UserResult> {
  const platformUser = cmd.actor.platformUser
  if (!platformUser) throw new ForbiddenError('...', 'no_platform_user')
  if (platformUser.role === 'student' && platformUser.id !== cmd.userId) {
    throw new ForbiddenError('Students may only read their own record', 'student_not_owner')
  }
  // ... work
}
```

---

## Error handling

Full rules: [docs/ERROR-HANDLING.md](/Users/nhatdongdang/Documents/Code/Internbot/docs/ERROR-HANDLING.md).

Summary:

- **Two error classes only.** `DomainError` (shared by domain + application) and `ApiError` (api-only, HTTP-coupled).
- **Throw, don't Result.** Express `next(err)` propagates to the middleware.
- **Infrastructure translates known driver errors at the boundary.** Use `translateFirestoreErrors(fn, { op, id })` around every repo method body. Unknown errors log + rethrow → 500.
- **Exactly three catch points:** (1) per-repo-method wrapper, (2) one `try { } catch (err) { next(err) }` per route handler, (3) the global `errorHandler` middleware.

---

## Route handler skeleton

```typescript
export function createAuthRouter(deps: AuthRouterDeps): ExpressRouter {
  const router: ExpressRouter = Router()
  const syncUser = new SyncUserCommandHandler(deps.uow, deps.platformClaimsService)
  const getUser = new GetUserQueryHandler(deps.uow)

  router.post('/sync', async (req, res, next) => {
    try {
      const parsed = authSyncRequestSchema.safeParse(req.body)
      if (!parsed.success) return next(new ApiError(400, 'Bad Request', ...))
      const { actor } = req as AuthenticatedRequest
      const cmd = toSyncUserCommand(actor, parsed.data)
      const { id, created } = await syncUser.handle(cmd)
      const result = await getUser.handle({
        actor: { ...actor, platformUser: { id, role: 'student' } },
        userId: id,
      })
      if (created) res.setHeader('Location', `/api/v1/users/${id}`)
      res.setHeader('ETag', etagFrom(result))
      res.status(created ? 201 : 200).json(toUserResponse(result))
    } catch (err) { next(err) }
  })

  return router
}
```

---

## Firestore access

Routes and handlers never touch `adminDb` directly. All persistence flows:

```
route handler → handler.handle(cmd) → uow.execute(uow ⇒ uow.users.method(…))
                                          │
                                          ↓
                                 FirestoreUserRepository (infra)
                                 ↓ (wraps with translateFirestoreErrors)
                                 adminDb + Firestore Transaction
```

Only `infrastructure/firestore/` imports `firebase-admin` (through the re-exports in `infrastructure/config/firebase-admin.ts`).

---

## Dependency rule (enforced by `tests/architecture/architecture.test.ts`)

| Layer             | May import                | Must NOT import                                |
| ----------------- | ------------------------- | ---------------------------------------------- |
| `domain/`         | only other `domain/`      | zod, firebase-admin, anything outside domain   |
| `application/`    | `domain/`                 | zod, firebase-admin, `infrastructure/`, `api/` |
| `infrastructure/` | `domain/`, `application/` | `api/`                                         |
| `api/`            | everything below          | (none — api is outermost)                      |

Additional enforced rules:

- `api/routes/` must not import `firebase-admin` directly — delegate through application handlers.
- No business logic in route handlers — validate body → build command → `handler.handle(cmd)` → serialize.
- No `console.log` anywhere in `src/`.

---

## Adding a new route

Use the `/add-route` Claude Code skill. The CQRS cascade typically produces:

1. `api/schemas/<name>.ts` — Zod request DTO
2. `api/dto/<name>.ts` — response DTO
3. `api/mappers/<name>.ts` — request → command; result → response
4. `application/commands/<name>.ts` or `application/queries/<name>.ts` — handler **class**
5. `application/models/<name>.ts` — if introducing a new read model
6. `api/routes/<name>.ts` — Router factory that instantiates handler classes
7. `api/routes/index.ts` — mount new router
8. If new aggregate: domain entity / VOs / repository port + infra schema / mapper / repo impl + UoW extension

Tests via the `test-writer` agent — one `it(…)` per bullet in the governing phase of [docs/WORKFLOW-API-IMPLEMENTATION-PLAN.md](/Users/nhatdongdang/Documents/Code/Internbot/docs/WORKFLOW-API-IMPLEMENTATION-PLAN.md).

---

## Firebase Admin SDK

Only import from `infrastructure/config/firebase-admin` — never directly from `firebase-admin`:

```typescript
import {
  adminDb,
  adminAuth,
  adminStorage,
  FieldValue,
  Timestamp,
} from "../../infrastructure/config/firebase-admin";
```

The architecture test fails if `api/routes/` imports `firebase-admin` directly.

---

## API conventions (wire-level)

The **normative** contract lives in [docs/WORKFLOW-API-SPEC.md §7.0](/Users/nhatdongdang/Documents/Code/Internbot/docs/WORKFLOW-API-SPEC.md). This section summarises what Express + middleware + routes must enforce. When the spec and this section disagree, the spec wins.

### Base

- Base path: `/api/v1`
- Content type: `application/json; charset=utf-8`
- Timestamps: ISO 8601 UTC with `Z` suffix (never local time or offsets)
- Naming conventions:
  - `kebab-case` for multi-word URL path segments (`/offer-submissions`, `/ai-reviews`, `/semester-selection`)
  - `camelCase` for all JSON fields and query params (`studentProfile`, `pageToken`, `semesterId`)
  - `snake_case` for enum / status / activity-type values (`offer_pending_review`, `pre_approved`)

### Success status codes

| Code             | When                                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `200 OK`         | Successful `GET`, `PATCH`, `PUT`, or action `POST` that returns a body                                                           |
| `201 Created`    | Successful `POST` that creates a new resource. Must include a `Location` header pointing to the created resource's canonical URL |
| `204 No Content` | Reserved — not used in v1                                                                                                        |

### Status-code semantics

- `400` — syntactically malformed (bad JSON, unknown query param, unknown enum, writing an immutable field)
- `401` — missing / expired / invalid Firebase token
- `403` — authenticated but not permitted (wrong role or ownership mismatch)
- `404` — resource doesn't exist or caller has no visibility
- `405` — method valid for URL but not for this caller's role (include `Allow` header)
- `409` — conflict with current state (duplicate, wrong workflow status)
- `412` — `If-Match` header provided and mismatched the current ETag
- `422` — semantically invalid (missing required field, business rule violated)
- `429` — rate limit exceeded (include `Retry-After` header)
- `503` — dependent service (AI provider, email) temporarily down

**`400` vs `422`**: `400` = "I can't parse this"; `422` = "I parsed it, but it breaks a rule."

### Concurrency (ETag / If-Match)

- Every `GET` on a mutable resource sets an `ETag` response header — `W/"${user.version}"` formatted by `api/utils/etag.ts#formatETag`.
- Mutating endpoints accept optional `If-Match`. The api layer parses it into `cmd.metadata.expectedVersion`. The handler throws early on mismatch (clean 412); the repository's `save(user)` also checks in-txn (race-safe).
- CORS exposes `ETag` to the frontend.

### Action endpoints

Non-CRUD actions use plural-noun sub-resources (GitHub/Twitter/Jira pattern), not `:verb` custom methods or verb paths:

- `POST /internships/{id}/offer-submissions`
- `POST /internships/{id}/decisions`
- `POST /opportunities/{id}/verifications`
- `POST /opportunities/{id}/transitions`

### Pagination

- Cursor-based only. Query params: `limit` (default `50`, max `200`), `pageToken` (opaque)
- Response: `{ "items": [...], "nextPageToken": "..." | null }`
- Encode the Firestore `DocumentSnapshot` into `pageToken` (base64 the doc path + the ordered field values). Clients treat it as opaque.

### Sorting / filtering

- `sort=createdAt` ascending, `sort=-createdAt` descending. Each endpoint declares allowed sort fields; reject unknown fields with `400`.
- Single value: `?status=open`. Multi-value: repeated param (`?status=open&status=in_progress`) — comma-separated not accepted.

### CORS

- Allowed request headers: `Authorization`, `Content-Type`, `If-Match`
- Exposed response headers: `ETag`, `Location`, `Retry-After`
- Allowed origins: env-configured (see [docs/ENV-VARS.md](/Users/nhatdongdang/Documents/Code/Internbot/docs/ENV-VARS.md))

### Soft-delete

No endpoint accepts `DELETE` in v1. Resources retire through status transitions (`archived`, `closed`, `rejected`). Do not add `DELETE` routes without updating the spec first.

---

## Testing

Three tiers + architecture checks. Canonical reference: [docs/TESTING.md](/Users/nhatdongdang/Documents/Code/Internbot/docs/TESTING.md).

| Tier         | Folder                                     | Emulator                      | Contents                                                                                                                |
| ------------ | ------------------------------------------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Unit         | `backend/tests/unit/domain/**`             | No                            | Pure domain class / VO rule tests. Nothing else lives here.                                                             |
| Integration  | `backend/tests/integration/application/**` | **Yes** (`pnpm run emulator`) | CQRS handlers wired to a REAL `FirestoreUnitOfWork`.                                                                    |
| Component    | `backend/tests/component/routes/**`        | **Yes**                       | Full `createApp()` via `supertest`. One `it(...)` per `Success criteria` / `Bug-finding` bullet in the governing phase. |
| Architecture | `backend/tests/architecture/**`            | No                            | Dep-rule meta checks (no zod in `domain/`, no firebase-admin in `application/`, no `console.log`, etc.)                 |

Do not add API or application unit tests. API routes, DTOs, and mappers are covered by component tests; CQRS handlers are covered by integration tests against the real Firestore UnitOfWork.

**Isolation rules (mandatory):** every test generates its own random IDs via `crypto.randomUUID()`; `trackDoc(collection, id)` every doc; `afterEach(clearDocs)`; no `beforeAll` for mutable state; tests run in parallel.

**Domain test construction:** use `Xxx.rehydrate({...})` (storage-path fixtures) or `Xxx.create({...})` (when you want to exercise validation). Never use `new Xxx(...)` directly — the constructor is private.

Scripts:

```bash
pnpm --filter backend run test:unit          # fast, no emulator
pnpm run emulator                            # docker compose up firebase-emulators
pnpm --filter backend run test:integration   # hits localhost:8080
pnpm --filter backend run test:component     # hits localhost:8080
pnpm --filter backend run test               # all tiers (unit + integration + component)
```

---

## Local development

```bash
pnpm run emulator                            # start Firestore + Auth emulators (docker)
pnpm --filter backend run dev                # watch + recompile TypeScript
```

## Deployment

```bash
pnpm --filter backend build
firebase deploy --config docker/firebase-emulator/firebase.json --only functions
```

The function is deployed to `australia-southeast1`. Change the region in `src/index.ts` and `infrastructure/variables.tf`.
