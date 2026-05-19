export function getApiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function getApiErrorReason(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined

  const body = 'body' in error ? (error as { body?: unknown }).body : undefined
  if (typeof body !== 'object' || body === null) return undefined

  const apiError = 'error' in body ? (body as { error?: unknown }).error : undefined
  if (typeof apiError !== 'object' || apiError === null) return undefined

  const reason = 'reason' in apiError ? (apiError as { reason?: unknown }).reason : undefined
  return typeof reason === 'string' ? reason : undefined
}
