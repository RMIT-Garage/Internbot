const DEFAULT_REDIRECT = '/dashboard'

export function getRedirectPath(search?: string): string {
  const raw = search ?? (typeof window !== 'undefined' ? window.location.search : '')
  if (!raw) return DEFAULT_REDIRECT

  const params = new URLSearchParams(raw)
  const target = params.get('redirect')
  return isSafeRedirect(target) ? target : DEFAULT_REDIRECT
}

function isSafeRedirect(value: string | null): value is string {
  if (!value) return false
  if (!value.startsWith('/')) return false
  if (value.startsWith('//')) return false
  if (value.startsWith('/\\')) return false
  return true
}
