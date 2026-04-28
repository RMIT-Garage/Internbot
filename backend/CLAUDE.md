# Backend — Claude Instructions

Loaded automatically when editing files in `backend/`. Supplements root `CLAUDE.md`.

**This file is a rule sheet, not a reference manual.** Deep dives live in [`docs/BACKEND.md`](../docs/BACKEND.md) — read it on demand when you need the "why" or a detailed example.

---

## Architecture in one paragraph

Clean Architecture + DDD + CQRS + Unit of Work. Four layers, strict dependency rule: `domain ← application ← infrastructure ← api`. Each layer owns its own data model; mappers at every boundary. **Aggregate roots (`User`) are mutable; value objects (`StudentProfile`, `AcademicInfo`) are immutable.** All domain classes use `#props` + getters + private constructor + static `create` / `rehydrate` factories. See [docs/BACKEND.md](../docs/BACKEND.md) for the full pattern.

---

## Enforced rules

**Dependency rule** (architecture test fails if violated):

| Layer             | May import                | Must NOT import                                |
| ----------------- | ------------------------- | ---------------------------------------------- |
| `domain/`         | only other `domain/`      | zod, firebase-admin, anything outside domain   |
| `application/`    | `domain/`                 | zod, firebase-admin, `infrastructure/`, `api/` |
| `infrastructure/` | `domain/`, `application/` | `api/`                                         |
| `api/`            | everything below          | (none — api is outermost)                      |

**Additional enforced rules:**

- `api/routes/` must not import `firebase-admin` directly — delegate through application handlers.
- No business logic in route handlers — validate body → build command → `handler.handle(cmd)` → serialize.
- No `console.log` anywhere in `src/`.
- Only import firebase-admin from `infrastructure/config/firebase-admin` (the re-export module).

---

## Hard conventions (don't drift from these)

### Domain classes

- **Private `#props`** field (ECMAScript `#`, not TypeScript `private`) + **getters** for reads.
- **Private constructor** + two static factories:
  - `create(props)` — command-handler input path, validates.
  - `rehydrate(props)` — storage path, no validation.
- Never call `new User(...)` — use the factories.
- **Aggregates are mutable** (`change*` / `set*` / `clear*` → `void`).
- **Value objects are immutable** (`with*` → new instance).

### Method-name prefixes

| Prefix                 | Returns                    | Use                                    |
| ---------------------- | -------------------------- | -------------------------------------- |
| `is*()`                | boolean (often type guard) | Predicate                              |
| `has*()`               | boolean                    | Presence check                         |
| `ensure*()`            | void (throws)              | Invariant guard                        |
| `with*()`              | new VO instance            | VO mutator (immutable)                 |
| `change*` / `set*`     | void (aggregate mutates)   | Aggregate command                      |
| `clear*()`             | void (aggregate mutates)   | Aggregate command that removes a field |
| `markX` / domain event | new VO / void              | Intent-revealing state transition      |

### CQRS handlers

- Single `handle(cmd)` signature. **Never** a second `ctx` argument.
- Cross-cutting transport metadata goes on `cmd.metadata: CommandMetadata` (expectedVersion, future correlationId / idempotencyKey).
- `actor: RequestActor` is always the first field of the command/query.
- Specific id naming: `userId`, `semesterId` — **not** generic `targetId`.
- Authz inline; no shared `application/authz/` module.
- Handlers call aggregate methods — they don't mutate `user.studentProfile` directly.
- Commands return `{ id }` only; route dispatches a follow-up query for the response body.
- Throw `DomainError` / `ValidationError`, never `Result`.

### Optimistic concurrency

- `User.version` / `Semester.version` is an **app-managed monotonic integer** persisted on the doc.
- **Never incremented client-side.** New aggregates start at `0`; the repo bumps to `stored + 1` on every save inside the transaction.
- `repo.save(...)` reads the stored `version` in-txn, compares against the domain version, throws `PreconditionFailedError` on mismatch.
- API layer parses `If-Match` → `cmd.metadata.expectedVersion`; handler throws early on mismatch (clean 412).
- HTTP ETag is `W/"${user.version}"`; same integer round-trips through the wire.

### Naming

| Artifact                       | Style                                                           |
| ------------------------------ | --------------------------------------------------------------- |
| Files & folders                | `kebab-case` (`firestore-user-repository.ts`, `value-objects/`) |
| Classes, interfaces, types     | `PascalCase` (`SyncUserCommandHandler`, `UserProps`)            |
| Functions, variables, exports  | `lowerCamelCase` (`verifyFirebaseToken`)                        |
| URL path segments (multi-word) | `kebab-case` (`/offer-submissions`)                             |
| Express route params           | `lowerCamelCase` (`:studentId`)                                 |
| Enum / status values           | `snake_case` (`offer_pending_review`)                           |

---

## Testing

Three tiers; emulator required for integration + component. Full details: [docs/TESTING.md](../docs/TESTING.md).

| Tier         | Folder                                     | Emulator |
| ------------ | ------------------------------------------ | -------- |
| Unit         | `backend/tests/unit/domain/**`             | No       |
| Integration  | `backend/tests/integration/application/**` | Yes      |
| Component    | `backend/tests/component/routes/**`        | Yes      |
| Architecture | `backend/tests/architecture/**`            | No       |

**Isolation rules (mandatory):** every test generates its own random IDs via `crypto.randomUUID()`; `trackDoc(collection, id)` every doc; `afterEach(clearDocs)`; no `beforeAll` for mutable state; tests run in parallel.

**Domain test construction:** `Xxx.rehydrate({...})` or `Xxx.create({...})` — never `new Xxx(...)` (private constructor).

```bash
pnpm --filter backend run test:unit          # fast, no emulator
pnpm run emulator                            # docker compose up firebase-emulators
pnpm --filter backend run test:integration   # hits localhost:8080
pnpm --filter backend run test:component     # hits localhost:8080
pnpm --filter backend run test               # all tiers
```

---

## Adding a new route

Use the `/add-route` Claude Code skill. See [docs/BACKEND.md § Adding a new route](../docs/BACKEND.md#adding-a-new-route) for the full cascade.

---

## Pointers

- **Deep architecture reference**: [docs/BACKEND.md](../docs/BACKEND.md)
- **API wire contract**: [docs/WORKFLOW-API-SPEC.md](../docs/WORKFLOW-API-SPEC.md)
- **Implementation plan (phased)**: [docs/WORKFLOW-API-IMPLEMENTATION-PLAN.md](../docs/WORKFLOW-API-IMPLEMENTATION-PLAN.md)
- **Firestore schema**: [docs/FIRESTORE-SCHEMA.md](../docs/FIRESTORE-SCHEMA.md)
- **Error handling rules**: [docs/ERROR-HANDLING.md](../docs/ERROR-HANDLING.md)
- **Testing conventions**: [docs/TESTING.md](../docs/TESTING.md)
