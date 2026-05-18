/**
 * IdGenerator — application-layer port for minting fresh aggregate ids.
 *
 * Why a dedicated port (not `Repository.nextIdentity()`):
 *   - Identity generation is an application-layer orchestration concern,
 *     not a persistence operation. Keeping it on the repository would
 *     blur the repo's single responsibility (find/save aggregates) and
 *     hide id allocation behind a wider surface.
 *   - The application service explicitly orchestrates: mint id → build
 *     aggregate (whole at construction) → persist via repository. The id
 *     is available before the transaction opens, so domain events,
 *     logging, and validation can all reference it.
 *   - Infrastructure-specific generation (Firestore auto-id, UUIDv7,
 *     etc.) sits in `infrastructure/`; the application stays decoupled.
 *
 * Synchronous + I/O-free. Implementations must not perform RPCs — the
 * id is allocated in-process. Burning an id (calling `next()` without a
 * follow-up persist) is harmless.
 */
export interface IdGenerator {
  next(): string
}
