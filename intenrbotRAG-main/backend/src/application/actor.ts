/**
 * Actor — the authenticated user performing an action.
 * Passed to commands and queries instead of a raw token or uid string.
 */
export interface Actor {
  uid: string
  email: string | undefined
  claims?: Record<string, unknown>
}
