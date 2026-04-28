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

2. **Domain value objects** — [`backend/src/domain/value-objects/*.ts`](../../backend/src/domain/value-objects/)
   If the change touches an embedded VO (e.g. `studentProfile`), update its file. Colocated domain rules (like `isProfileComplete`) update here too.

3. **Domain repository port** — [`backend/src/domain/repositories/foo-repository.ts`](../../backend/src/domain/repositories/)
   If the change adds a new required input or alters the patch shape, update `NewFooInput`/`FooUpdatePatch`.

4. **Infra Zod storage schema** — [`backend/src/infrastructure/firestore/schemas/foo.ts`](../../backend/src/infrastructure/firestore/schemas/)
   Update the Zod schema matching the **new** storage shape. Firestore values are still `Timestamp`.

5. **Infra storage schema version** — bump `FOO_SCHEMA_VERSION` in the same file (or `domain/entities/foo.ts` if that's where the constant lives). Increment from `N` to `N+1`.

6. **Infra lazy migration** — pass a `migrate(raw, fromVersion)` callback into `createZodConverter(fooStorageSchema, FOO_SCHEMA_VERSION, migrate)` (see [`backend/src/infrastructure/firestore/zod-converter.ts`](../../backend/src/infrastructure/firestore/zod-converter.ts)). The callback receives the stored raw object and the version it was written at; returns a plain object matching the latest schema. **The returned object must include `_schemaVersion: FOO_SCHEMA_VERSION`** — the Zod schema validates this as a literal, so without it the migrated doc fails parse. The converter treats a missing `_schemaVersion` field as `0`, so legacy pre-versioning docs are routed through `migrate()` automatically.

   ```typescript
   // infrastructure/firestore/firestore-foo-repository.ts
   const fooConverter = createZodConverter(
     fooStorageSchema,
     FOO_SCHEMA_VERSION,
     (raw, fromVersion) => {
       let next = raw;
       if (fromVersion < 2) {
         // v1 → v2: split `name` into `firstName` + `lastName`
         const [firstName, ...rest] = (next["name"] as string).split(" ");
         const { name: _drop, ...without } = next; // strip the old key
         next = { ...without, firstName, lastName: rest.join(" ") };
       }
       // Subsequent migrations chain off `next`, e.g. `if (fromVersion < 3) { ... }`
       return { ...next, _schemaVersion: FOO_SCHEMA_VERSION };
     },
   );
   ```

   **Drop renamed/removed keys explicitly.** Spreading `...raw` keeps the old field alongside the new one, which then either fails a strict Zod schema or silently bloats the doc. Always strip the source field of a rename and the field of a remove before returning.

   Lazy migration provides **read-time schema compatibility** — old docs are translated in memory on every fetch. It does **not** rewrite the document on disk; the upgraded shape is only persisted when the application performs a normal write (PATCH, transition, etc.). Until then the doc remains at its original `_schemaVersion` in Firestore.

   **Migration chain rule:** never hard-code "migrate from v1 to current". Write each step as `if (fromVersion < N)` so a v1 doc walks v1→v2→v3→… in order. Removing an old branch is a breaking change that abandons docs still on disk at that version.

7. **Infra mapper** — [`backend/src/infrastructure/firestore/mappers/foo.ts`](../../backend/src/infrastructure/firestore/mappers/)
   Update `mapStorageToFoo` / `mapFooToStorage` for the new field.

8. **Infra repository** — [`backend/src/infrastructure/firestore/firestore-foo-repository.ts`](../../backend/src/infrastructure/firestore/)
   If `create`/`update` signatures changed, update the methods.

9. **Application models** — [`backend/src/application/models/foo.ts`](../../backend/src/application/models/)
   Update `FooResult` if the new field surfaces through query handlers.

10. **API schemas + DTOs** — [`backend/src/api/schemas/foo.ts`](../../backend/src/api/schemas/) and [`backend/src/api/dto/foo.ts`](../../backend/src/api/dto/)
    Update request Zod + response DTO. If the field is client-writable, add to the request schema. If readable, add to the DTO.

11. **API mappers** — [`backend/src/api/mappers/foo.ts`](../../backend/src/api/mappers/)
    Update request→command and result→response mappers.

12. **Firestore indexes** — if the new field is queried or sorted, add to [`docker/firebase-emulator/firebase/firestore.indexes.json`](../../docker/firebase-emulator/firebase/firestore.indexes.json). Production picks the same JSON up through Terraform ([`infrastructure/modules/firestore/main.tf`](../../infrastructure/modules/firestore/main.tf)), so emulator + prod stay in lockstep on the next `terraform apply`. Single-field indexes are auto-managed; only composite indexes need an entry. Provision before deploying the read path that depends on them — Firestore returns `failed-precondition` on any query that needs a missing composite.

13. **Firestore security rules** — if the field is client-writable, update [`docker/firebase-emulator/firebase/firestore.rules`](../../docker/firebase-emulator/firebase/firestore.rules).

14. **Schema documentation** — [`docs/FIRESTORE-SCHEMA.md`](../../docs/FIRESTORE-SCHEMA.md) and [`docs/WORKFLOW-API-SPEC.md`](../../docs/WORKFLOW-API-SPEC.md) §8.X.

15. **Tests** — add unit tests for the new field path: domain rule changes, mapper round-trip, repository behaviour, route contract. If the change is behind a phase in `docs/WORKFLOW-API-IMPLEMENTATION-PLAN.md`, update the phase's Success criteria (human confirmation required per the plan file's editing rule).

## Step 2 — When a lazy migration is not enough

Lazy migration handles 95% of changes. Fall back to a bulk script only when:

- A new field needs a **computed value** that depends on a **collection-group query** (lazy migrate sees one doc at a time).
- A **required index** needs populating before a query can execute.
- You need to know that migration is **complete** before dropping the old field.

### Bulk script template

Add `scripts/migrate-<collection>-<description>.ts`. Use **`adminDb.bulkWriter()`** as the default writer — it handles parallel writes, automatic retries with exponential backoff, and built-in throttling that ramps following the [500/50/5 rule](https://cloud.google.com/firestore/docs/best-practices#ramping_up_traffic) (start at 500 ops/sec, +50% every 5 min). Don't disable the throttle without a reason. Wire `bulkWriter.onWriteError(err => err.failedAttempts < 5)` to keep retrying transient `RESOURCE_EXHAUSTED` / `UNAVAILABLE` errors and let permanent ones (`INVALID_ARGUMENT`, `PERMISSION_DENIED`) bubble out. Always `await bulkWriter.close()` at the end so the script doesn't exit before in-flight writes drain.

Reach for `WriteBatch` only when a tight group of writes must commit atomically (it doesn't auto-retry and it's bounded by request size, not a hard 500-op cap — that limit was removed in March 2023; what still matters is request payload size, transaction duration, index fan-out, and hotspot avoidance).

**Concurrency safety against live writers** — the application writes to the same docs the script is rewriting. `set()` (whether on `DocumentReference` or `BulkWriter`) only accepts `SetOptions` (`merge` / `mergeFields`); it **does not** accept a `Precondition`, so it cannot be guarded by `lastUpdateTime`. Two write shapes are safe; pick the one that fits the migration:

- **Additive / per-field migration → `bulkWriter.update(ref, fields, { lastUpdateTime })`.** `update()` is the only `BulkWriter` write that takes a `Precondition`. It only touches the fields you pass, and on mismatch the SDK surfaces `failed-precondition`. To remove a field as part of the migration, use `FieldValue.delete()` in the update payload.

  ```typescript
  const snap = await ref.get();
  const stored = snap.data()?.["_schemaVersion"] as number | undefined;
  if (stored !== undefined && stored >= TARGET) return; // version guard
  const migrated = migrate(snap.data()!, stored ?? 0);
  bulkWriter.update(
    ref,
    { ...migrated, oldField: FieldValue.delete() },
    { lastUpdateTime: snap.updateTime! },
  );
  // onWriteError(err): if err.code === 9 (gRPC FAILED_PRECONDITION), re-read
  // and retry — a live writer beat us, but their newer payload still needs
  // migrating. `BulkWriterError.code` from `@google-cloud/firestore` is a
  // numeric gRPC status; treat 9 as the precondition mismatch and let other
  // codes fall through to your retry/abort policy.
  ```

- **Full-doc replacement → `db.runTransaction(...)`, not `BulkWriter`.** When the migration restructures the doc (rename + remove + retype together) and field-level `update()` is awkward, do the read+rewrite inside a transaction. The transaction's read-set already serialises against concurrent writers — no manual precondition needed. `BulkWriter.set()` cannot carry one and would clobber.

  ```typescript
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const stored = snap.data()?.["_schemaVersion"] as number | undefined;
    if (stored !== undefined && stored >= TARGET) return;
    const migrated = migrate(snap.data()!, stored ?? 0);
    tx.set(ref, migrated); // safe: the txn's read-set already locks `ref`
  });
  ```

  Run transactions through a bounded concurrency pool (e.g. `p-limit(20)`) so the script doesn't become its own hotspot.

The script must implement, in order:

1. **`--dry-run` flag** — default ON. Logs intended writes without committing. Required before any production run.
2. **Cursor-based pagination** with `orderBy(__name__).startAfter(lastId).limit(N)` — never load the whole collection into memory.
3. **Idempotent version guard** — read `_schemaVersion` per doc and only transform docs strictly below the target. Decision table:

   | Stored `_schemaVersion` | Action     | Reason                                                                                  |
   | ----------------------- | ---------- | --------------------------------------------------------------------------------------- |
   | missing (undefined)     | migrate    | Legacy pre-versioning doc — `==`/`<` predicates skip it, but it does need migrating     |
   | `< NEW`                 | migrate    | Older shape, this script's job to upgrade                                               |
   | `== NEW`                | skip       | Already at target — re-running the script is a no-op                                    |
   | `> NEW`                 | skip + log | Written by a newer service during a phased rollout. **Never downgrade.** Log for review |

   The `> NEW` row matters during dual-deploy windows: a partially-rolled-out next version can land docs ahead of the current bulk script. Treating them as "needs migration" would silently rewrite them at the older shape and corrupt the rollout.

4. **Resumable checkpoint** — persist the last-processed doc id (file or Firestore meta doc) so an interrupted run resumes without re-scanning.
5. **Failure recording** — on per-doc transform/write error, log the doc id + error to a failures file; continue. Do not abort the whole run on one bad doc.
6. **Canary slice** — first non-dry run targets ≤1% of the collection (e.g. by id-prefix or date range); verify before running on the full set.
7. **Post-run verification** — assert the count of docs **below** the target version is zero (or matches the failures file). Query for `_schemaVersion < NEW` **and** separately scan for docs missing `_schemaVersion` entirely (Firestore `==`/`<` predicates exclude documents where the field is absent, so legacy pre-versioning docs never appear in a `_schemaVersion == OLD` query — paginate the collection and check `data._schemaVersion === undefined`). Both populations must be empty before declaring the migration complete. Docs at `> NEW` (skipped per the version guard, written by a newer service in a phased rollout) are out of scope for this script's verification — they're the next migration's responsibility.
8. **Progress counter** — emit every N docs.

### Rollback plan (mandatory before destructive backfills)

Before running anything that drops or retypes a field in production, confirm at least one of:

- A fresh **managed Firestore export** to GCS taken within the last hour (`gcloud firestore export gs://<bucket>/<path>`) — or **Point-in-Time Recovery (PITR)** is enabled and within retention. PITR has a 7-day window for fine-grained recovery and is restored via `gcloud firestore databases restore --source-database <db> --destination-database <db-restored> --snapshot-time <RFC3339>`.
- A **reverse migration script** that can re-derive the old shape from the new one.
- An accepted **restore plan** that documents acceptable RPO and the procedure to import an export back into the project.

Drop fields only **after** the lazy `migrate()` has been deployed long enough that all readers tolerate the absence, and the bulk script has verified zero remaining old-shape docs.

Keep the lazy `migrate()` callback in the converter even when running a bulk script — scripts can be interrupted, and lazy migration catches stragglers on subsequent reads.

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
