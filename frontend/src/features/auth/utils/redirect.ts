import { isCoordinatorLoginPath, isCoordinatorRole } from '@/lib/coordinator/auth'

const STUDENT_DEFAULT_REDIRECT = '/student/dashboard'
const COORDINATOR_DEFAULT_REDIRECT = '/coordinator/dashboard'

export function getDefaultRedirectPath(role: string | undefined): string {
  return isCoordinatorRole(role) ? COORDINATOR_DEFAULT_REDIRECT : STUDENT_DEFAULT_REDIRECT
}

export function getRedirectPath(search?: string, role?: string): string {
  const defaultRedirect = getDefaultRedirectPath(role)
  const raw = search ?? (typeof window !== 'undefined' ? window.location.search : '')
  if (!raw) return defaultRedirect

  const params = new URLSearchParams(raw)
  const target = params.get('redirect')
  if (!isSafeRedirect(target)) return defaultRedirect
  if (isCoordinatorLoginPath(target)) return defaultRedirect
  if (target.startsWith('/coordinator') && !isCoordinatorRole(role)) return defaultRedirect
  return target
}

function isSafeRedirect(value: string | null): value is string {
  if (!value) return false
  if (!value.startsWith('/')) return false
  if (value.startsWith('//')) return false
  if (value.startsWith('/\\')) return false
  return true
}
