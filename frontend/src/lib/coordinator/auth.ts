export function isCoordinatorRole(role: string | undefined): boolean {
  return role === 'coordinator' || role === 'staff' || role === 'admin'
}

export function isCoordinatorLoginPath(pathname: string | null): boolean {
  const path = pathname?.split(/[?#]/, 1)[0]
  return path === '/coordinator/login' || path === '/coordinator/login/'
}
