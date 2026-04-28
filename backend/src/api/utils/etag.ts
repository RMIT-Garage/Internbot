import { ValidationError } from '../../domain/errors'

/**
 * ETag helpers — HTTP representation metadata (RFC 9110). Lives at the api
 * boundary so the domain stays HTTP-free. The domain-level concurrency token
 * is an app-managed monotonic integer (`aggregate.version`); we format it
 * here as a weak ETag and parse `If-Match` back to the same number.
 *
 * Opaque to clients per WORKFLOW-API-SPEC.md §7.0 Concurrency.
 */
export function formatETag(version: number): string {
  return `W/"${version}"`
}

/**
 * Parse an `If-Match` header into a domain version. Tri-state contract:
 *
 *   absent / empty     → returns `undefined` (no precondition; opt-in OCC).
 *   valid `W/"N"` or `"N"` → returns the integer N.
 *   malformed          → throws `ValidationError(reason='invalid_if_match')`.
 *
 * The malformed branch is critical: silently dropping a bad header would let
 * a buggy client keep sending unconditional writes against an aggregate it
 * thinks it is OCC-protecting, defeating the optimistic-concurrency guard on
 * every PATCH/PUT/transition. Surface it as a 400 so the client fixes the
 * header rather than corrupting state.
 */
export function parseIfMatch(header: string | undefined): number | undefined {
  if (header === undefined || header === '') return undefined
  const match = /^(?:W\/)?"(\d+)"$/.exec(header.trim())
  if (!match) {
    throw new ValidationError(
      'If-Match header is malformed; expected weak (`W/"N"`) or strong (`"N"`) ETag',
      'invalid_if_match',
      [{ field: 'If-Match', code: 'invalid', message: 'malformed ETag value' }]
    )
  }
  return Number(match[1])
}
