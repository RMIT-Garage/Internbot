import { NotFoundError, ConflictError, PreconditionFailedError } from '../../domain/errors'

/**
 * Wrap a Firestore operation with driver-error translation.
 *
 * The infrastructure layer is the **only** place that catches raw driver
 * errors. Known Firestore codes are translated into `DomainError` subclasses
 * so the domain/application layers never see `grpc.Status` or `FirebaseError`.
 * Unknown errors are logged with operation context and rethrown — the api
 * error-handler catches them and renders 500.
 *
 * Usage:
 *   return translateFirestoreErrors(async () => {
 *     const snap = await txn.get(ref)
 *     // ...
 *   }, { op: 'users.findById', id })
 */
export async function translateFirestoreErrors<T>(
  fn: () => Promise<T>,
  ctx: { op: string; id?: string }
): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (isFirestoreErrorCode(err, 'not-found')) {
      const resource = ctx.op.split('.')[0] ?? 'Resource'
      throw new NotFoundError(capitalize(resource), ctx.id)
    }
    if (isFirestoreErrorCode(err, 'already-exists')) {
      throw new ConflictError('Resource already exists', 'natural_key_exists')
    }
    if (isFirestoreErrorCode(err, 'failed-precondition')) {
      throw new PreconditionFailedError()
    }
    // Unknown — log operation context and rethrow. The api error-handler
    // converts this to 500 Internal Server Error with a safe message.
    console.error(`[infra] ${ctx.op} failed`, {
      id: ctx.id,
      code: readErrorCode(err),
      message: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

function isFirestoreErrorCode(err: unknown, code: string): boolean {
  return readErrorCode(err) === code
}

function readErrorCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: unknown }).code
    if (typeof code === 'string') return code
    if (typeof code === 'number') return String(code)
  }
  return undefined
}

function capitalize(s: string): string {
  if (s.length === 0) return s
  // "users" → "User", "opportunities" → "Opportunitie" (OK — callers typically
  // pass singular resource names anyway). Best-effort conversion for NotFound
  // messages; exact pluralisation is not worth a dictionary here.
  return s[0]!.toUpperCase() + s.slice(1).replace(/s$/, '')
}
