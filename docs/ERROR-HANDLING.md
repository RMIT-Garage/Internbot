# Error Handling

Normative cross-layer error-handling rules for the backend. Wire format is in [docs/WORKFLOW-API-SPEC.md §7.0](./WORKFLOW-API-SPEC.md); this doc covers how errors originate, propagate, and are translated between layers.

## Principles

1. **Errors are domain concepts, not HTTP status codes.** Inner layers (`domain/`, `application/`) never reference HTTP. HTTP mapping happens exactly once, in `api/middleware/errorHandler.ts`.
2. **Infrastructure errors never cross the domain boundary in their original form.** Persistence adapters catch raw driver errors and translate them into `DomainError` subclasses at the point of translation. The domain must not depend on Firestore, network, or file-system error types.
3. **Two error classes, not four.**
   - `domain/errors.ts` — `DomainError` hierarchy (no HTTP coupling). **Shared by domain and application layers** — application handlers throw from the same hierarchy. No separate `ApplicationError` class: most "application errors" are domain rule violations surfaced during orchestration, and splitting them creates arbitrary boundaries.
   - `api/errors.ts` — `ApiError` (HTTP status + RFC 9457 fields + `reason`/`fields`/`allow`). Used only for HTTP-specific failures with no domain equivalent (malformed JSON, rate limits, auth header missing).
   - Infrastructure has no error class — it either translates driver errors into `DomainError` or lets genuinely unexpected runtime errors bubble up to the errorHandler as `500`.
4. **Throw, don't Result.** We throw `DomainError`s and catch at the api boundary via Express `next(err)`. Result-type alternatives (Either monads) were considered and rejected — they fight Express's native flow and need `fp-ts` for good ergonomics; our `DomainError` already carries `code`/`reason`/`fields` with the same expressiveness.

### Who catches (answer to "throw vs try/catch")

| Layer                             | Catches errors?                                | Why                                                                                                                                                                                                                 |
| --------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `domain/`                         | **No**                                         | Value object constructors throw `ValidationError` and return; entity methods throw `DomainError`. No try/catch inside domain.                                                                                       |
| `application/`                    | **No**                                         | Command/query handlers let errors bubble. Wrapping every step in try/catch defeats the "let `next(err)` handle it" pattern.                                                                                         |
| `infrastructure/`                 | **Yes — but only to translate or log+rethrow** | Firestore driver errors must never reach application code as `grpc.Status` or `FirebaseError`. Repository impls catch, decide: known shape → translate to `DomainError`; unknown → log the infra details + rethrow. |
| `api/middleware/errorHandler.ts`  | **Yes — single catch-all**                     | The _only_ place that converts internal errors to HTTP. Routes call `next(err)`; the errorHandler renders the RFC 9457 envelope.                                                                                    |
| Route handler (`api/routes/*.ts`) | One outer try/catch only, per handler          | Pattern: `try { ... } catch (err) { next(err) }`. Never inspect the error or inline a response — always forward to the errorHandler.                                                                                |

5. **Validation origin lives with the type.** Request-body validation is at the api boundary (Zod in `api/schemas/`). Storage-shape validation is at the infra boundary (Zod in `infrastructure/firestore/schemas/`). Domain invariants are enforced in value-object constructors (throw `ValidationError` on invalid input).

## Error taxonomy

| Class                     | Layer  | HTTP coupling        | When to use                                                                                                           |
| ------------------------- | ------ | -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `NotFoundError`           | domain | none                 | Resource doesn't exist (or caller has no visibility)                                                                  |
| `ForbiddenError`          | domain | none                 | Role or ownership mismatch                                                                                            |
| `ValidationError`         | domain | none                 | Semantic validation failure (business rule violated, required field missing). Carries optional `fields: FieldIssue[]` |
| `ConflictError`           | domain | none                 | Resource state conflict (duplicate, wrong workflow state)                                                             |
| `PreconditionFailedError` | domain | none                 | `If-Match` ETag mismatch                                                                                              |
| `MethodNotAllowedError`   | domain | none                 | Route valid for URL but not caller's role. Carries `allow: string`                                                    |
| `ApiError`                | api    | status code required | HTTP-specific failures with no domain equivalent (e.g. malformed JSON → 400, rate limit → 429)                        |

All `DomainError`s carry an optional `reason: string` fine sub-code (spec §7.0) and `fields: FieldIssue[]` for 400/422 validation failures.

## Where each error originates

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ api boundary                                                                 │
│                                                                              │
│  1. Missing Authorization header             → ApiError(401)                 │
│  2. Invalid Firebase token                   → ApiError(401)                 │
│  3. Zod parse fails on req.body              → ApiError(400, 'invalid_body') │
│  4. Unknown enum in query string             → ApiError(400)                 │
│  5. Writing a non-writable field (PATCH)     → ApiError(400, 'immutable…')   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
         │ cmd dispatched
         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ application (command/query handler)                                          │
│                                                                              │
│  6. Role gate fails                          → throw ForbiddenError('role_…')│
│  7. Ownership check fails                    → throw ForbiddenError('student_not_owner')│
│  8. Method-on-resource not allowed for role  → throw MethodNotAllowedError   │
│  9. Business rule violated (e.g. dup apply)  → throw ConflictError('duplicate_…')│
│ 10. Required field missing on command        → throw ValidationError('missing_…')│
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
         │ uow.execute → repository
         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ domain (value object / entity)                                               │
│                                                                              │
│ 11. VO constructor rejects invalid value     → throw ValidationError         │
│ 12. ETag mismatch detected inside repo       → throw PreconditionFailedError │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ infrastructure (Firestore repository impl)                                   │
│                                                                              │
│ 13. Document not found on findById()         → returns null (NOT a throw)    │
│     The application handler decides whether null is a NotFoundError or legal │
│     (e.g. findByIdentity returns null on first sync — that's the signal      │
│     to create a new user, not an error).                                     │
│                                                                              │
│ 14. Raw Firestore driver error               → CATCH, translate or rethrow:  │
│     - FAILED_PRECONDITION on .update() after delete → NotFoundError          │
│     - ABORTED in transaction (contention)           → rethrow; Firestore     │
│       auto-retries txns                                                       │
│     - quota / network error                         → rethrow as-is;         │
│       errorHandler maps unknown → 500                                         │
│                                                                              │
│     Never let a driver error type (e.g. `grpc.status.FAILED_PRECONDITION`)   │
│     reach application/ or domain/. Translate at the boundary.                │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Translation at the api boundary

`api/middleware/errorHandler.ts` is the sole mapper from domain to HTTP. It:

1. Catches `ApiError` → render as-is.
2. Catches `DomainError` → `ApiError.fromDomainError()` applies the domain-to-HTTP table:
   - `NOT_FOUND` → 404
   - `FORBIDDEN` → 403
   - `VALIDATION_ERROR` → 422 (business-rule violation — spec §7.0 semantic rule)
   - `CONFLICT` → 409
   - `PRECONDITION_FAILED` → 412
   - `METHOD_NOT_ALLOWED` → 405 with `Allow` header from the error
3. Catches anything else → 500, log full stack, return a safe message (never expose stack traces in the response).
4. Writes the RFC 9457 envelope: `{ type, title, status, detail, error: { code, reason?, message, fields? } }`.

Route handlers **never** inline `res.status(xxx).json(...)`. Always `next(err)`.

## What about infrastructure errors?

Infrastructure has **no dedicated error class**. Raw driver errors fall into three buckets at the repository boundary:

| Bucket                           | What it looks like                                                                                                                                               | Translation                                                                                                                                                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Known, user-facing**           | Firestore `NOT_FOUND` on update (doc was deleted mid-txn), `ALREADY_EXISTS` on explicit-id create, `FAILED_PRECONDITION` when a guarded update no longer matches | Catch, rethrow as the matching `DomainError` subclass (`NotFoundError`, `ConflictError('natural_key_exists')`, `PreconditionFailedError`). The caller (application/domain) now sees a type it understands.   |
| **Transient, driver-handled**    | `ABORTED` inside a transaction (contention), network blip that gRPC will retry                                                                                   | **Don't catch.** Let it bubble; `adminDb.runTransaction` retries automatically. If it escapes after retries, it becomes the next bucket.                                                                     |
| **Unexpected / system failures** | Quota exhausted, permission denied on the service account, Firestore outage, unexpected driver shape                                                             | Catch at the infra boundary → `logInfraError(op, ctx, err)` with full context → rethrow as-is. The api `errorHandler` catches unknown errors and renders `500 Internal Server Error` with a generic message. |

Why no `InfrastructureError` class:

- User-facing infra failures already have a domain meaning (`NotFoundError`, `ConflictError`). A separate class would duplicate the hierarchy and force the errorHandler to carry two mapping tables.
- Outages and quota errors are opaque `500`s to the client anyway — an explicit class wouldn't change the wire format.
- The one case that _does_ need special treatment (external dependency down) is modelled as `ServiceUnavailableError extends DomainError` → 503 when we need it (Phase 11 AI endpoints). We'll add that class when the first dependency needs it, not before.

Rule: **infra translates known errors at the boundary; everything else is a bug that the 500 fallback catches.** Never let `grpc.Status`, `FirebaseError`, or `code: 'failed-precondition'` reach `application/` or `domain/`.

## Translation at the infrastructure boundary

Translation is a **two-layer catch** — `throw` everywhere, catch exactly twice:

### Layer 1 — per-repo-method wrapper (infra boundary)

Every repository method wraps its body with a small translation helper. The helper holds the driver-error → DomainError table in one place, tagged with per-operation context:

```typescript
// infrastructure/firestore/translateFirestoreErrors.ts
export async function translateFirestoreErrors<T>(
  fn: () => Promise<T>,
  ctx: { op: string; id?: string },
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isFirestoreNotFound(err)) {
      throw new NotFoundError(ctx.op.split(".")[0]!, ctx.id);
    }
    if (isFirestoreAlreadyExists(err)) {
      throw new ConflictError("Resource already exists", "natural_key_exists");
    }
    if (isFirestorePreconditionFailed(err)) {
      throw new PreconditionFailedError();
    }
    // Unknown driver error — log infra detail here (one-time, at the boundary),
    // then rethrow. The global catch converts it to 500 Internal Server Error.
    console.error(`[infra] ${ctx.op}`, { id: ctx.id, err });
    throw err;
  }
}
```

Used per-method:

```typescript
// firestoreUserRepository.ts
async findById(id: string): Promise<UserRecord | null> {
  return translateFirestoreErrors(async () => {
    const snap = await this.txn.get(adminDb.collection('users').doc(id))
    if (!snap.exists) return null
    return { user: mapStorageToUser(snap.id, parse(snap.data())), etag: computeETag(snap) }
  }, { op: 'users.findById', id })
}
```

**Why per-method (not per-repo-class, not per-transaction):** only the method knows what collection + id are in play. A wrapper higher up can't tag the error with operational context.

### Layer 2 — global catch in `api/middleware/errorHandler.ts`

The errorHandler is the **one** place that converts to HTTP. It catches whatever reaches it via `next(err)`:

- `ApiError` → render as-is
- `DomainError` → `ApiError.fromDomainError()` → render
- Anything else → log stack, render `500 Internal Server Error` with a safe message

### Between those two catches, nothing catches

- **Domain** never catches. VO constructors throw; entity methods throw. Let it propagate.
- **Application handlers** never catch. They `return await deps.uow.execute(...)` and let errors bubble.
- **Route handlers** do **exactly one** outer catch: `try { ... } catch (err) { next(err) }`. No error-type inspection, no inline responses.

Rules:

- **Never catch-all-and-swallow.** If you catch, you must either translate into a known `DomainError` or rethrow.
- **Log infra-level details only at the infra boundary.** Handlers in `application/` and the api error middleware should not re-log the raw error once the infra has logged it.
- **Known translations** (write these explicitly):
  - Firestore `NOT_FOUND` on an `update` or `delete` (race condition: doc deleted between read and write) → `NotFoundError`
  - Firestore `FAILED_PRECONDITION` on a precondition update → `PreconditionFailedError`
  - Firestore `ALREADY_EXISTS` on an explicit-id create → `ConflictError('natural_key_exists')`
  - Firestore `ABORTED` inside a transaction → **rethrow**; `runTransaction` retries automatically. If it surfaces to the caller after retries exhaust, let it bubble to 500.

## Validation strategy by layer

| What                             | Where                                                                 | Mechanism                       | Error                                                              |
| -------------------------------- | --------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------ |
| Request body shape               | `api/schemas/<resource>.ts`                                           | Zod `.safeParse`                | `ApiError(400, 'invalid_body')` with `fields` from Zod issues      |
| Query-param enum values          | `api/schemas/<resource>.ts`                                           | Zod enum                        | `ApiError(400)`                                                    |
| Business rules / required combos | `application/commands                                                 | queries/<name>.ts`              | `if (...) throw`                                                   | `ValidationError` with `reason` + `fields` → 422 |
| Domain invariants                | `domain/valueObjects/<vo>.ts` (in constructors)                       | `if (...) throw`                | `ValidationError` → 422                                            |
| Storage shape on read            | `infrastructure/firestore/schemas/<name>.ts` via `createZodConverter` | Converter throws if parse fails | Bubbles to 500 — storage-shape mismatch is a bug, not a user error |

## Logging strategy

- **Infrastructure layer**: log the raw error (driver code, Firestore path, operation) before rethrowing or translating. This is where enough context exists to diagnose.
- **Application layer**: don't re-log. Do attach user/request context to errors via `ValidationError.fields` or `ConflictError.reason` so the final envelope has something useful.
- **API errorHandler**: log every 5xx with stack. Do not log 4xx — they're expected client mistakes.
- **Never log PII** (tokens, full request bodies with credentials). Don't log the full `req.body` unless you've scrubbed it.

## Security

- 4xx responses carry user-safe `message` fields (see `api/errors.ts`). Never include stack traces, Firestore paths, or internal IDs that leak architecture.
- 5xx responses expose only `"An unexpected error occurred"`. The real error goes to logs.
- For sensitive resources, prefer 404 over 403 when existence itself would be a disclosure (per spec §7.0 — already doc'd).

## Testing errors

Per phase's Success criteria bullets (plan file), every documented 4xx/5xx must have a test asserting:

1. the HTTP status matches
2. `body.error.code` matches the coarse code
3. `body.error.reason` matches when the spec names one
4. for 400/422: `body.error.fields` contains the expected field(s)

`test-writer` scaffolds one `it()` per documented failure case automatically — see `.claude/agents/test-writer.md`.

## Common mistakes (don't do these)

- ❌ `throw new Error('forbidden')` in a handler — use `ForbiddenError` with `reason`.
- ❌ `res.status(409).json(...)` in a route — use `next(new ConflictError(...))`.
- ❌ Importing `ApiError` inside `application/` or `domain/` — they must not know about HTTP.
- ❌ Letting a `grpc.Status` or `FirebaseError` reach application code — translate at infra boundary.
- ❌ `catch (e) { throw e }` with nothing in between — either do something useful (translate, log, attach context) or don't catch.
- ❌ Throwing in a VO constructor without a type the errorHandler knows about — use `ValidationError`.
