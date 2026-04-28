/**
 * Opaque cursor-based pagination helpers per WORKFLOW-API-SPEC.md §7.0 Pagination.
 *
 * Tokens are base64url-encoded JSON so clients treat them as opaque.
 * The contents carry the last seen document path plus the sort-field values
 * needed to resume the Firestore query with `.startAfter(...)`.
 *
 * v1 helpers: encode/decode only. Per-endpoint query wiring lands in the
 * phases that introduce list endpoints (Phase 2 onward).
 */

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

export interface PageToken {
  path: string
  values: unknown[]
  /**
   * Sort binding — `"<field>:<direction>"` (e.g. `"createdAt:desc"`).
   *
   * Optional at the token level so the helpers stay endpoint-agnostic, but
   * list endpoints SHOULD set it. On resume, the request's sort param must
   * match this value or the call is rejected with 400 — silently using a
   * cursor against a different sort produces undefined ordering and
   * "missing data" bugs that are extremely hard to repro.
   */
  sort?: string
}

export function encodePageToken(token: PageToken): string {
  const json = JSON.stringify(token)
  return Buffer.from(json, 'utf8').toString('base64url')
}

export function decodePageToken(raw: string): PageToken {
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8')
    const parsed = JSON.parse(json) as unknown
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof (parsed as PageToken).path !== 'string' ||
      !Array.isArray((parsed as PageToken).values)
    ) {
      throw new Error('Malformed page token')
    }
    const sort = (parsed as PageToken).sort
    if (sort !== undefined && typeof sort !== 'string') {
      throw new Error('Malformed page token')
    }
    return parsed as PageToken
  } catch {
    throw new Error('Malformed page token')
  }
}

/**
 * Clamp a caller-supplied `limit` to the spec bounds. Returns the effective
 * page size to use for the Firestore query.
 */
export function clampLimit(raw: unknown): number {
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : raw
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT
  return Math.min(Math.floor(n), MAX_LIMIT)
}
