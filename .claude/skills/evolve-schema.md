---
description: Safely evolve a Firestore collection schema — bumps the storage schema version, updates domain types, Zod storage schema, mapper, repository, and wires a lazy migrate() callback. Use when adding, renaming, removing, or retyping fields on an existing aggregate.
argument-hint: "[AggregateName] [add|rename|remove|retype] [fieldName]"
---

# Skill: /evolve-schema

Evolve a Firestore aggregate's schema using the repo's layered model + lazy-migration infrastructure.

## Prerequisite

The codebase uses a four-layer Clean Architecture with per-layer data models — see [backend/CLAUDE.md](../../backend/CLAUDE.md) for the canonical layout. You must update each layer in the correct order or the architecture tests will fail.

## Step 0 — Classify the change

| Change type                          | Backwards-compatible? | Migration path                                                                 |
| ------------------------------------ | --------------------- | ------------------------------------------------------------------------------ |
| `add` optional field                 | Yes                   | No migration — writes start including it, old reads succeed without it         |
| `add` required field                 | No                    | Bump `_schemaVersion` + add `migrate()` callback that supplies a default       |
| `rename` field                       | No                    | Dual-write phase → backfill via `migrate()` → drop old after all readers gone  |
| `remove` field                       | Case-by-case          | Bump `_schemaVersion` + `migrate()` strips it. Reads must not rely on it first |
| `retype` (string→number, widen enum) | No                    | Bump `_schemaVersion` + `migrate()` converts per document                      |

**Rule:** any change that is not backwards-compatible **must** bump `_schemaVersion` and add a `migrate()` callback to the aggregate's `createZodConverter(...)` call. This lets existing documents self-heal on next read without a bulk script.

## Step 1 — Files to update (in order)

For aggregate `Foo`, update **all** of these in a single PR:

1. **Domain entity** — [`backend/src/domain/entities/foo.ts`](../../backend/src/domain/entities/foo.ts)
   Update the pure-TS interface. Timestamps stay `Date`.

2. **Domain value objects** — [`backend/src/domain/valueObjects/*.ts`](../../backend/src/domain/valueObjects/)
   If the change touches an embedded VO (e.g. `studentProfile`), update its file. Colocated domain rules (like `isProfileComplete`) update here too.

3. **Domain repository port** — [`backend/src/domain/repositories/fooRepository.ts`](../../backend/src/domain/repositories/)
   If the change adds a new required input or alters the patch shape, update `NewFooInput`/`FooUpdatePatch`.

4. **Infra Zod storage schema** — [`backend/src/infrastructure/firestore/schemas/foo.ts`](../../backend/src/infrastructure/firestore/schemas/)
   Update the Zod schema matching the **new** storage shape. Firestore values are still `Timestamp`.

5. **Infra storage schema version** — bump `FOO_SCHEMA_VERSION` in the same file (or `domain/entities/foo.ts` if that's where the constant lives). Increment from `N` to `N+1`.

6. **Infra lazy migration** — pass a `migrate(raw, fromVersion)` callback into `createZodConverter(fooStorageSchema, FOO_SCHEMA_VERSION, migrate)`. The callback receives the stored raw object and the version it was written at; returns a plain object matching the latest schema.

   ```typescript
   // infrastructure/firestore/firestoreFooRepository.ts
   const fooConverter = createZodConverter(
     fooStorageSchema,
     FOO_SCHEMA_VERSION,
     (raw, fromVersion) => {
       if (fromVersion < 2) {
         // v1 → v2: split `name` into `firstName` + `lastName`
         const [firstName, ...rest] = (raw.name as string).split(" ");
         return { ...raw, firstName, lastName: rest.join(" ") };
       }
       return raw;
     },
   );
   ```

   The converter re-reads `_schemaVersion` on every fetch; existing docs self-upgrade on next write (or stay v1 on disk and are translated in-memory until rewritten).

7. **Infra mapper** — [`backend/src/infrastructure/firestore/mappers/foo.ts`](../../backend/src/infrastructure/firestore/mappers/)
   Update `mapStorageToFoo` / `mapFooToStorage` for the new field.

8. **Infra repository** — [`backend/src/infrastructure/firestore/firestoreFooRepository.ts`](../../backend/src/infrastructure/firestore/)
   If `create`/`update` signatures changed, update the methods.

9. **Application models** — [`backend/src/application/models/foo.ts`](../../backend/src/application/models/)
   Update `FooResult` if the new field surfaces through query handlers.

10. **API schemas + DTOs** — [`backend/src/api/schemas/foo.ts`](../../backend/src/api/schemas/) and [`backend/src/api/dto/foo.ts`](../../backend/src/api/dto/)
    Update request Zod + response DTO. If the field is client-writable, add to the request schema. If readable, add to the DTO.

11. **API mappers** — [`backend/src/api/mappers/foo.ts`](../../backend/src/api/mappers/)
    Update request→command and result→response mappers.

12. **Firestore indexes** — if the new field is queried or sorted, add to [`docker/firebase-emulator/firebase/firestore.indexes.json`](../../docker/firebase-emulator/firebase/firestore.indexes.json).

13. **Firestore security rules** — if the field is client-writable, update [`docker/firebase-emulator/firebase/firestore.rules`](../../docker/firebase-emulator/firebase/firestore.rules).

14. **Schema documentation** — [`docs/FIRESTORE-SCHEMA.md`](../../docs/FIRESTORE-SCHEMA.md) and [`docs/WORKFLOW-API-SPEC.md`](../../docs/WORKFLOW-API-SPEC.md) §8.X.

15. **Tests** — add unit tests for the new field path: domain rule changes, mapper round-trip, repository behaviour, route contract. If the change is behind a phase in `docs/WORKFLOW-API-IMPLEMENTATION-PLAN.md`, update the phase's Success criteria (human confirmation required per the plan file's editing rule).

## Step 2 — When a lazy migration is not enough

Lazy migration handles 95% of changes. Fall back to a bulk script only when:

- A new field needs a **computed value** that depends on a **collection-group query** (lazy migrate sees one doc at a time).
- A **required index** needs populating before a query can execute.
- You need to know that migration is **complete** before dropping the old field.

For those cases, add `scripts/migrate-<collection>-<description>.ts` that:

1. Opens a Firestore admin connection.
2. Runs a paginated query over the target collection.
3. For each doc, applies the transform and writes back via a `WriteBatch` (≤500 ops per commit).
4. Prints a progress counter.

Keep the lazy `migrate()` callback in the converter anyway — bulk scripts can be interrupted, and lazy migration catches stragglers.

## Step 3 — Checklist

- [ ] `_schemaVersion` bumped (for non-additive changes)
- [ ] `migrate()` callback wired into `createZodConverter(...)` in the repository
- [ ] Domain entity / value objects updated
- [ ] Infra Zod schema + mapper updated
- [ ] Application models updated
- [ ] API request schema + response DTO + mappers updated
- [ ] Firestore indexes updated if field is queryable
- [ ] Firestore security rules updated if field is client-writable
- [ ] `docs/FIRESTORE-SCHEMA.md` updated
- [ ] `docs/WORKFLOW-API-SPEC.md` §8 updated
- [ ] Unit tests cover: mapper round-trip, migrate() behaviour for a v<N-1> document, repository read/write
- [ ] Architecture test still passes (no new cross-layer imports)
