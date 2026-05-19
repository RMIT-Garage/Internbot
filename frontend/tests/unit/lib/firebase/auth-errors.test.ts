import { describe, it, expect } from 'vitest'
import { FirebaseError } from 'firebase/app'
import { getAuthErrorMessage, getFirebaseErrorCode } from '@/lib/firebase/auth-errors'

describe('getFirebaseErrorCode', () => {
  it('extracts code from a FirebaseError instance', () => {
    expect(getFirebaseErrorCode(new FirebaseError('auth/wrong-password', 'msg'))).toBe(
      'auth/wrong-password'
    )
  })

  it('extracts code from a duck-typed error object', () => {
    expect(getFirebaseErrorCode({ code: 'auth/invalid-email' })).toBe('auth/invalid-email')
  })

  it('returns null for non-error values', () => {
    expect(getFirebaseErrorCode('boom')).toBeNull()
    expect(getFirebaseErrorCode(null)).toBeNull()
    expect(getFirebaseErrorCode({})).toBeNull()
  })
})

describe('getAuthErrorMessage', () => {
  it('maps wrong-password to a generic credential-failure message', () => {
    expect(getAuthErrorMessage(new FirebaseError('auth/wrong-password', 'x'))).toBe(
      'Email or password is incorrect.'
    )
  })

  it('maps user-not-found to the same generic credential-failure message (no user enumeration)', () => {
    expect(getAuthErrorMessage(new FirebaseError('auth/user-not-found', 'x'))).toBe(
      'Email or password is incorrect.'
    )
  })

  it('maps email-already-in-use to a clear duplicate-account message', () => {
    expect(getAuthErrorMessage(new FirebaseError('auth/email-already-in-use', 'x'))).toBe(
      'An account with this email already exists.'
    )
  })

  it('maps too-many-requests to a throttle message', () => {
    expect(getAuthErrorMessage(new FirebaseError('auth/too-many-requests', 'x'))).toBe(
      'Too many attempts. Please try again in a few minutes.'
    )
  })

  it('maps unauthorized-domain to an actionable Firebase Console message', () => {
    expect(getAuthErrorMessage(new FirebaseError('auth/unauthorized-domain', 'x'))).toMatch(
      /authorized domains/i
    )
  })

  it('maps configuration-not-found to a config-needed message', () => {
    expect(getAuthErrorMessage(new FirebaseError('auth/configuration-not-found', 'x'))).toMatch(
      /not configured/i
    )
  })

  it('maps operation-not-allowed to a method-disabled message', () => {
    expect(getAuthErrorMessage(new FirebaseError('auth/operation-not-allowed', 'x'))).toMatch(
      /not enabled/i
    )
  })

  it('maps popup-blocked to a popup-blocker message', () => {
    expect(getAuthErrorMessage(new FirebaseError('auth/popup-blocked', 'x'))).toMatch(/popup/i)
  })

  it('maps weak-password to a password-strength message', () => {
    expect(getAuthErrorMessage(new FirebaseError('auth/weak-password', 'x'))).toMatch(
      /too weak|at least 8/i
    )
  })

  it('maps every documented Firebase error code to a non-empty, non-fallback message', () => {
    const codes = [
      'auth/invalid-email',
      'auth/user-disabled',
      'auth/user-not-found',
      'auth/wrong-password',
      'auth/invalid-credential',
      'auth/email-already-in-use',
      'auth/weak-password',
      'auth/too-many-requests',
      'auth/network-request-failed',
      'auth/popup-closed-by-user',
      'auth/popup-blocked',
      'auth/cancelled-popup-request',
      'auth/account-exists-with-different-credential',
      'auth/operation-not-allowed',
      'auth/requires-recent-login',
      'auth/id-token-expired',
      'auth/id-token-revoked',
      'auth/unauthorized-domain',
      'auth/configuration-not-found',
      'auth/admin-restricted-operation',
    ]
    const fallback = 'SHOULD_NOT_BE_USED'
    for (const code of codes) {
      const msg = getAuthErrorMessage(new FirebaseError(code, 'x'), fallback)
      expect(msg, `code ${code} fell back to default`).not.toBe(fallback)
      expect(msg.length, `code ${code} produced empty message`).toBeGreaterThan(0)
    }
  })

  it('extracts the specific reason from a Firebase password-policy error message', () => {
    const err = new FirebaseError(
      'auth/password-does-not-meet-requirements',
      'Firebase: Missing password requirements: [Password must contain a non-alphanumeric character] (auth/password-does-not-meet-requirements).'
    )
    expect(getAuthErrorMessage(err)).toBe(
      "Password doesn't meet requirements: password must contain a non-alphanumeric character."
    )
  })

  it('falls back to a generic policy message when the bracketed reason is missing', () => {
    const err = new FirebaseError(
      'auth/password-does-not-meet-requirements',
      'Firebase: weird format (auth/password-does-not-meet-requirements).'
    )
    expect(getAuthErrorMessage(err)).toMatch(/security requirements/i)
  })

  it('returns the supplied fallback for unknown codes', () => {
    expect(
      getAuthErrorMessage(new FirebaseError('auth/something-weird', 'x'), 'custom fallback')
    ).toBe('custom fallback')
  })

  it('returns the default fallback for non-Firebase errors', () => {
    expect(getAuthErrorMessage(new Error('plain'))).toBe('Sign-in failed. Please try again.')
  })
})
