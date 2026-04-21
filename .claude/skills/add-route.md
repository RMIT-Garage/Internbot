---
description: Add a new HTTP route to the Cloud Functions Express backend with the full CQRS + DDD cascade (request DTO → application command/query class → aggregate mutation → repo.save → response DTO). Use when adding a new API endpoint.
argument-hint: "[METHOD /path e.g. GET /users/:id]"
---

# Skill: /add-route

Add a new HTTP route to the `backend/` package using the codebase's Clean Architecture + DDD + CQRS + UoW conventions. Read [backend/CLAUDE.md](../../backend/CLAUDE.md) and [docs/BACKEND.md](../../docs/BACKEND.md) first — this skill scaffolds the patterns they define.

## Step 0 — Verify the route shape matches the API convention

Check the proposed path against [docs/WORKFLOW-API-SPEC.md §"Actions as plural-noun sub-resources"](../../docs/WORKFLOW-API-SPEC.md). GitHub-style reify-as-noun pattern — not `:verb` custom methods, not verb paths.

**Pass** if the path is one of:

- **Standard REST verb on a resource** — `POST /internships`, `GET /opportunities/:id`, `PATCH /users/:id`
- **Action reified as plural-noun sub-resource** — `POST /internships/:id/decisions`, `POST /opportunities/:id/verifications`
- **Singleton sub-resource for per-parent state** — `PUT /users/:id/semester-selection`
- **Collection-level state replacement** — `PUT /notifications` with `{ read: true }`

**Stop and propose a rewrite** if the path contains a verb segment (`/archive`, `/submit`, `/cancel`, `/mark-read`) or a `:verb` custom method (`/users:export`). `/auth/*` endpoints are the one conventional exception.

## Step 1 — Gather requirements

1. **Route path** and HTTP method.
2. **What it does** — Command (mutation) or Query (read)?
3. **Governing phase** — which phase in [docs/WORKFLOW-API-IMPLEMENTATION-PLAN.md](../../docs/WORKFLOW-API-IMPLEMENTATION-PLAN.md)? The phase's `Success criteria` bullets become the mandatory test list.
4. **Aggregates touched** — existing (`users`) or new? New aggregate = domain entity + VOs + repository port + infra schema / mapper / repo impl + UoW extension.

## Step 2 — Files to create/update

### api/ layer (always new per route)

1. **`backend/src/api/schemas/<resource>.ts`** — Zod request body schema with `.meta({ id })` for OpenAPI:

   ```typescript
   import { z } from 'zod'

   export const createFooRequestSchema = z
     .object({
       name: z.string().min(1).max(200),
     })
     .strict()
     .meta({ id: 'CreateFooRequest' })

   export type CreateFooRequest = z.infer<typeof createFooRequestSchema>
   ```

2. **`backend/src/api/dto/<resource>.ts`** — response DTO as a Zod schema (ISO timestamps; never `firebaseUid` or persistence fields):

   ```typescript
   import { z } from 'zod'

   export const fooResponseSchema = z
     .object({
       id: z.string(),
       name: z.string(),
       createdAt: z.string().datetime(),
     })
     .meta({ id: 'FooResponse' })

   export type FooResponse = z.infer<typeof fooResponseSchema>
   ```

3. **`backend/src/api/mappers/<resource>.ts`** — request → command; application result → response DTO; ETag from `user.version`:

   ```typescript
   import type { RequestActor } from '../../application/actor'
   import type { FooResult } from '../../application/models/foo'
   import type { CreateFooCommand } from '../../application/commands/create-foo'
   import { formatETag, parseIfMatch } from '../utils/etag'

   export function toCreateFooCommand(
     actor: RequestActor,
     ifMatch: string | undefined,
     body: CreateFooRequest
   ): CreateFooCommand {
     const expectedVersion = parseIfMatch(ifMatch)
     return {
       actor,
       name: body.name,
       ...(expectedVersion !== undefined ? { metadata: { expectedVersion } } : {}),
     }
   }

   export function toFooResponse(result: FooResult): FooResponse {
     return {
       id: result.foo.id,
       name: result.foo.name,
       createdAt: result.foo.createdAt.toISOString(),
     }
   }

   export function etagFrom(result: FooResult): string {
     return formatETag(result.foo.version)
   }
   ```

4. **`backend/src/api/routes/<resource>.ts`** — thin handler. Instantiate handler **classes** in the Router factory; delegate to `handle(cmd)`:

   ```typescript
   import { Router, type Router as ExpressRouter } from 'express'
   import type { Request, Response, NextFunction } from 'express'
   import type { AuthenticatedRequest } from '../middleware/auth'
   import { ApiError } from '../errors'
   import { createFooRequestSchema } from '../schemas/foo'
   import { CreateFooCommandHandler } from '../../application/commands/create-foo'
   import { GetFooQueryHandler } from '../../application/queries/get-foo'
   import { toCreateFooCommand, toFooResponse, etagFrom } from '../mappers/foo'
   import type { UnitOfWork } from '../../application/ports/unit-of-work'

   export interface FooRouterDeps {
     uow: UnitOfWork
   }

   export function createFooRouter(deps: FooRouterDeps): ExpressRouter {
     const router: ExpressRouter = Router()
     const createFoo = new CreateFooCommandHandler(deps.uow)
     const getFoo = new GetFooQueryHandler(deps.uow)

     router.post('/', async (req: Request, res: Response, next: NextFunction) => {
       try {
         const parsed = createFooRequestSchema.safeParse(req.body)
         if (!parsed.success) {
           return next(
             new ApiError(400, 'Bad Request', parsed.error.issues[0]!.message, {
               reason: 'invalid_body',
             })
           )
         }
         const { actor } = req as AuthenticatedRequest
         const ifMatch = req.header('If-Match')
         const cmd = toCreateFooCommand(actor, ifMatch, parsed.data)
         const { id } = await createFoo.handle(cmd)

         const result = await getFoo.handle({ actor, fooId: id })
         res.setHeader('Location', `/api/v1/foos/${id}`)
         res.setHeader('ETag', etagFrom(result))
         res.status(201).json(toFooResponse(result))
       } catch (err) {
         next(err)
       }
     })

     return router
   }
   ```

### application/ layer (new per use case)

5. **`backend/src/application/commands/<name>.ts`** or `application/queries/<name>.ts` — handler **class** with flat constructor-injected deps, single `handle(cmd)` method:

   ```typescript
   import type { RequestActor } from '../actor'
   import type { UnitOfWork } from '../ports/unit-of-work'
   import type { CommandMetadata } from '../command-metadata'
   import { NotFoundError, ForbiddenError } from '../../domain/errors'
   import { Foo } from '../../domain/entities/foo'

   export interface CreateFooCommand {
     actor: RequestActor         // always first — identity is carried in the payload
     name: string                // business intent
     metadata?: CommandMetadata  // cross-cutting transport metadata (expectedVersion, ...)
   }

   export interface CreateFooResult {
     id: string
   }

   export class CreateFooCommandHandler {
     constructor(private readonly uow: UnitOfWork) {}

     async handle(cmd: CreateFooCommand): Promise<CreateFooResult> {
       // inline authz — no shared guards module
       const platformUser = cmd.actor.platformUser
       if (!platformUser) {
         throw new ForbiddenError('...', 'no_platform_user')
       }
       if (platformUser.role !== 'coordinator') {
         throw new ForbiddenError('Coordinators only', 'role_restricted_action')
       }

       return this.uow.execute(async (uow) => {
         // for a CREATE: build a fresh aggregate via Foo.create(...), insert via repo.create
         const foo = Foo.create({ id: '', version: 0, name: cmd.name, /* ... */ })
         const { id } = await uow.foos.create(foo)
         return { id }
       })
     }
   }
   ```

   **For an UPDATE command**, the shape is:

   ```typescript
   return this.uow.execute(async (uow) => {
     const foo = await uow.foos.findById(cmd.fooId)
     if (!foo) throw new NotFoundError('Foo', cmd.fooId)
     foo.changeName(cmd.name)              // aggregate mutation method
     await uow.foos.save(foo)              // optimistic concurrency via foo.version
     return { id: cmd.fooId }
   })
   ```

6. **`backend/src/application/models/<name>.ts`** — application DTO, only if introducing a new read model:

   ```typescript
   import type { Foo } from '../../domain/entities/foo'
   export interface FooResult {
     foo: Foo
   }
   ```

### domain/ layer (only when adding a new aggregate)

7. **Entity + value objects + repository port.** Follow the patterns in:
   - [`backend/src/domain/entities/user.ts`](../../backend/src/domain/entities/user.ts) — mutable aggregate, `#props` + getters + `create` / `rehydrate` + `change*`/`set*`/`clear*` void methods
   - [`backend/src/domain/value-objects/`](../../backend/src/domain/value-objects/) — immutable VO, `#props` + getters + `create` / `rehydrate` + `with*` returning new instances
   - [`backend/src/domain/repositories/user-repository.ts`](../../backend/src/domain/repositories/user-repository.ts) — port with `findById` / `create(user)` / `save(user)`

   Domain files use **pure TypeScript only** — no `zod`, no `firebase-admin`.

### infrastructure/ layer (only when adding a new aggregate)

8. **Storage schema + mapper + repository impl + UoW extension:**
   - `backend/src/infrastructure/firestore/schemas/<name>.ts` — Zod storage shape (Timestamps)
   - `backend/src/infrastructure/firestore/mappers/<name>.ts` — storage ↔ domain via `Xxx.rehydrate()`
   - `backend/src/infrastructure/firestore/firestore-<name>-repository.ts` — transaction-scoped repo. `save(agg)` reads doc in-txn, compares `snap.updateTime.toMillis()` to `agg.version`, throws `PreconditionFailedError` on mismatch, writes.
   - Extend `UnitOfWorkContext` in `backend/src/application/ports/unit-of-work.ts` with the new repo
   - Wire the new repo into `FirestoreUnitOfWork.execute` in `backend/src/infrastructure/firestore/firestore-unit-of-work.ts`

### Mount the route

9. **`backend/src/api/routes/index.ts`** — import and mount:

   ```typescript
   import { createFooRouter } from './foo'
   router.use('/foos', createFooRouter(deps))
   ```

## Step 2b — Register the route in the OpenAPI spec

Every new route MUST be registered in `api/openapi/` so it appears in the generated spec and CI's spec-freeze check stays meaningful. Two steps:

1. **Add `.meta({ id, description, example })` to Zod schemas** in `api/schemas/` and `api/dto/`. zod-openapi auto-lifts `.meta`-tagged schemas into `components/schemas`.
2. **Create an operation file** at `backend/src/api/openapi/operations/<resource>.ts` exporting a `ZodOpenApiOperationObject` per verb, then register it in `backend/src/api/openapi/spec.ts` under `paths`.

After adding, run `pnpm --filter backend run openapi:generate` to refresh `backend/openapi.json`. Commit the diff — CI rejects any PR whose committed snapshot doesn't match the live spec (`openapi:check`).

## Step 3 — Tests

Use the `test-writer` subagent. Every new route ships tests at all applicable tiers per [docs/TESTING.md](../../docs/TESTING.md):

- **Unit** (`backend/tests/unit/domain/**`) — only if the route introduces new domain classes / VOs / rules. Pure TS, no mocks, no emulator. Use `Xxx.rehydrate({...})` / `Xxx.create({...})` to construct fixtures — never `new Xxx(...)` (private constructor).
- **Integration** (`backend/tests/integration/application/**`) — CQRS handler class against the real `FirestoreUnitOfWork` + real `FirebasePlatformClaimsService` against the Firebase emulators. Zero mocks. Uses helpers from [`backend/tests/setup.emulator.ts`](../../backend/tests/setup.emulator.ts): `initEmulator`, `trackDoc`, `clearDocs`, `ensureFirebaseUser`.
- **Component** (`backend/tests/component/routes/**`) — full `createApp()` via `supertest` against the emulators with real Firebase ID tokens minted through `mintEmulatorIdToken`. Zero mocks. **One `it(...)` per bullet** in the governing phase's `Success criteria` + `Bug-finding cases`.

Isolation rules are mandatory across all tiers — every test generates its own IDs via `crypto.randomUUID()`, tracks its own docs for cleanup, and runs safely in parallel. See [`.claude/agents/test-writer.md`](../agents/test-writer.md).

## Checklist

- [ ] Route path passes Step 0 convention check
- [ ] Path verb and shape match the governing phase's `Scope` in the plan
- [ ] `api/routes/<name>.ts` is thin — no business logic
- [ ] Route handler uses `(req as AuthenticatedRequest).actor` and passes it as the first field of the command/query
- [ ] Specific id naming (`fooId`) — never generic `targetId`
- [ ] Request body validated with Zod from `api/schemas/` before use
- [ ] Command carries business intent only; transport metadata (`expectedVersion`) lives on `cmd.metadata`
- [ ] Handler is a **class** with flat constructor-injected deps + single `handle(cmd)` method
- [ ] Commands return `{ id }` only; GETs use a query handler
- [ ] Handler calls aggregate mutation methods; doesn't mutate `user.studentProfile` or similar directly
- [ ] Handler runs all reads/writes through `uow.execute`
- [ ] Domain classes use `#props` + getters + private ctor + `create` / `rehydrate` + appropriate `with*` (VO) or `change*`/`set*`/`clear*` (aggregate)
- [ ] Repository extends `UserRepository`-style contract: `findById` / `create(agg)` / `save(agg)`
- [ ] No `adminDb` / `firebase-admin` imports in `api/routes/` or `application/`
- [ ] No `zod` imports in `domain/` or `application/`
- [ ] Errors propagated via `next(err)` — never inline `res.status(500)`
- [ ] Domain errors preferred over raw `ApiError` where equivalent
- [ ] Documents include `_schemaVersion: 1` on creation (via the repository, not the route)
- [ ] OpenAPI operation registered in `api/openapi/operations/<resource>.ts` + `spec.ts`
- [ ] `pnpm --filter backend run openapi:generate` run and `backend/openapi.json` committed
- [ ] Tests at all tiers — one `it(...)` per Success criteria / Bug-finding bullet of the governing phase
