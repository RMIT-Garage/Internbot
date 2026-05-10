import { FirebaseError } from 'firebase/app'

const MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'That email address looks invalid.',
  'auth/user-disabled': 'This account has been disabled. Contact your administrator.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password':
    'That password is too weak. Use at least 8 characters with letters and numbers.',
  'auth/too-many-requests': 'Too many attempts. Please try again in a few minutes.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/popup-closed-by-user': 'Sign-in window was closed. Try again.',
  'auth/popup-blocked': 'Your browser blocked the sign-in popup. Allow popups and try again.',
  'auth/cancelled-popup-request': 'Sign-in cancelled.',
  'auth/account-exists-with-different-credential':
    'An account with this email exists using a different sign-in method.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled. Contact support.',
  'auth/unauthorized-domain':
    'This domain is not authorized for sign-in. Add it to Firebase Console → Authentication → Settings → Authorized domains.',
  'auth/configuration-not-found':
    'Firebase Auth is not configured for this project. Enable the sign-in method in Firebase Console.',
  'auth/admin-restricted-operation': 'This operation is restricted. Contact your administrator.',
  'auth/requires-recent-login': 'Please sign in again to continue.',
  'auth/id-token-expired': 'Your session expired. Please sign in again.',
  'auth/id-token-revoked': 'Your session has been revoked. Please sign in again.',
}

export function getAuthErrorMessage(
  error: unknown,
  fallback = 'Sign-in failed. Please try again.'
): string {
  const code = getFirebaseErrorCode(error)
  if (code === 'auth/password-does-not-meet-requirements') {
    return formatPasswordPolicyError(error)
  }
  if (code && MESSAGES[code]) return MESSAGES[code]
  return fallback
}

function formatPasswordPolicyError(error: unknown): string {
  const msg =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message ?? '')
      : ''
  // Firebase phrases this as: "Firebase: Missing password requirements: [<reason>] (auth/...)"
  const match = msg.match(/\[([^\]]+)\]/)
  if (match?.[1]) return `Password doesn't meet requirements: ${match[1].toLowerCase()}.`
  return "Password doesn't meet the project's security requirements."
}

export function getFirebaseErrorCode(error: unknown): string | null {
  if (error instanceof FirebaseError) return error.code
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code
    if (typeof code === 'string') return code
  }
  return null
}
