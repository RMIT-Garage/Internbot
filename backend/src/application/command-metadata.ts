/**
 * CommandMetadata — cross-cutting transport metadata carried alongside a
 * command's business intent.
 *
 * Lives as an optional `metadata?: CommandMetadata` field on command
 * payloads (not a second `handle(cmd, ctx)` argument) so the uniform
 * single-argument handler signature stays. API routes populate fields here
 * from transport-layer concerns; handlers forward the relevant bits to the
 * persistence layer without interpreting them.
 *
 * Current fields:
 *   - `expectedVersion`: from the caller's `If-Match` header, parsed at the
 *     api boundary. When set, the repository's `update(..., expectedVersion)`
 *     enforces optimistic concurrency atomically at save time.
 *
 * Future additions that match this pattern (add when infrastructure exists):
 *   - `correlationId` — request-trace id from observability middleware
 *   - `idempotencyKey` — from `Idempotency-Key` header; requires a dedup store
 */
export interface CommandMetadata {
  expectedVersion?: number
}
