export const coordinatorPreviewEmail = 'coordinator@internbot.local'
export const coordinatorPreviewPassword = 'admin123'
export const coordinatorPreviewStorageKey = 'internbot:dev-coordinator-preview'
const legacyCoordinatorPreviewStorageKey = 'internbot:coordinator-demo-auth'

export function isCoordinatorPreviewEnabled() {
  return process.env.NODE_ENV === 'development'
}

export function isCoordinatorPreviewCredentials(email: string, password: string) {
  return (
    isCoordinatorPreviewEnabled() &&
    email.trim().toLowerCase() === coordinatorPreviewEmail &&
    password === coordinatorPreviewPassword
  )
}

export function setCoordinatorPreviewSession() {
  if (isCoordinatorPreviewEnabled() && typeof window !== 'undefined') {
    window.localStorage.setItem(coordinatorPreviewStorageKey, 'true')
  }
}

export function clearCoordinatorPreviewSession() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(coordinatorPreviewStorageKey)
    window.localStorage.removeItem(legacyCoordinatorPreviewStorageKey)
  }
}

export function hasCoordinatorPreviewSession() {
  return (
    isCoordinatorPreviewEnabled() &&
    typeof window !== 'undefined' &&
    window.localStorage.getItem(coordinatorPreviewStorageKey) === 'true'
  )
}

export function isCoordinatorRole(role: string | undefined): boolean {
  return role === 'coordinator' || role === 'staff' || role === 'admin'
}

export function isCoordinatorLoginPath(pathname: string | null): boolean {
  return pathname === '/coordinator/login' || pathname === '/coordinator/login/'
}
