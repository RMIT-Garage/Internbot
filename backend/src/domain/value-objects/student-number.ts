/**
 * Student number value helper.
 *
 * RMIT student numbers are derived from verified student email addresses and
 * then stored immutably on the student profile.
 */
const STUDENT_EMAIL_REGEX = /^(s\d+)@student\.rmit\.edu\.au$/i

export function parseStudentNumberFromEmail(email: string | undefined): string | null {
  if (typeof email !== 'string') return null
  const match = email.toLowerCase().match(STUDENT_EMAIL_REGEX)
  return match ? match[1]! : null
}
