/**
 * Derive an RMIT student number from the IdP-attested email's local part.
 *
 * The format is fixed: `s` + digits + `@student.rmit.edu.au`. Returns the
 * student number (e.g. `s1234567`) or null if the email isn't a valid RMIT
 * student email.
 *
 * Domain helper rather than an api-layer regex because the `studentNumber`
 * VO invariant ("derived from RMIT student email, immutable thereafter")
 * is a domain concept. Email-domain *policy* (only RMIT student emails may
 * sign up) is enforced at the IdP boundary by the `enforceStudentEmail`
 * blocking function (see `backend/src/index.ts`); by the time this runs,
 * the email is already known-good. A null return therefore means "auth
 * provider config has drifted", a system invariant violation.
 */
const STUDENT_EMAIL_REGEX = /^(s\d+)@student\.rmit\.edu\.au$/i

export function parseStudentNumberFromEmail(email: string | undefined): string | null {
  if (typeof email !== 'string') return null
  const match = email.toLowerCase().match(STUDENT_EMAIL_REGEX)
  return match ? match[1]! : null
}
