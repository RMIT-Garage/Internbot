/**
 * ETag helpers — HTTP representation metadata (RFC 9110). Lives at the api
 * boundary so the domain stays HTTP-free. The domain-level concurrency token
 * is `User.version` (a monotonically increasing number); we format it here
 * as a weak ETag and parse `If-Match` back to the same number.
 *
 * Opaque to clients per WORKFLOW-API-SPEC.md §7.0 Concurrency.
 */
export function formatETag(version: number): string {
  return `W/"${version}"`
}

/**
 * Parse an `If-Match` header into a domain version. Accepts both weak
 * (`W/"123"`) and strong (`"123"`) forms. Returns `undefined` when the header
 * is absent (opt-in concurrency) or when the token is malformed — the
 * handler treats the latter as "no precondition" rather than failing at
 * the api boundary, because version mismatch produces the same 412 either way.
 */
export function parseIfMatch(header: string | undefined): number | undefined {
  if (header === undefined || header === '') return undefined
  const match = /^(?:W\/)?"(\d+)"$/.exec(header.trim())
  if (!match) return undefined
  return Number(match[1])
}
