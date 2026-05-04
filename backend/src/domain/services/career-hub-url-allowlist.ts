/**
 * Weak trust signal for coordinator-created pre-approved opportunities.
 *
 * The platform only asserts that the URL points at RMIT Career Hub. It does
 * not verify that the listing exists, is still open, or matches the submitted
 * role fields; those checks happen later during coordinator review.
 */
export function isCareerHubUrlAllowed(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl)
    return parsed.protocol === 'https:' && parsed.hostname === 'careerhub.rmit.edu.au'
  } catch {
    return false
  }
}
