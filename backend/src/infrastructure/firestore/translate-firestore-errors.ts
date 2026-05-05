import { NotFoundError, ConflictError } from '../../domain/errors'

/**
 * Wrap a Firestore operation with driver-error translation.
 *
 * The infrastructure layer is the **only** place that catches raw driver
 * errors. Known Firestore codes are translated into `DomainError` subclasses
 * so the domain/application layers never see `grpc.Status` or `FirebaseError`.
 * The original driver error is preserved on `.cause` (ES2022) for diagnostics.
 * Unknown errors are logged with operation context and rethrown — the api
 * error-handler catches them and renders 500.
 *
 * Usage:
 *   return translateFirestoreErrors(async () => {
 *     const snap = await txn.get(ref)
 *     // ...
 *   }, { op: 'users.findById', resource: 'User', id })
 */

/**
 * Closed union of every wrapped Firestore operation. Strictly typed so a
 * typo (`'user.findById'`) fails at compile time and so log lines stay
 * grep-friendly. Extend when you add a new repository method.
 */
export type FirestoreOp =
  | 'users.findById'
  | 'users.findByIdentity'
  | 'users.listCoordinators'
  | 'users.create'
  | 'users.save'
  | 'semesters.findById'
  | 'semesters.findByNaturalKey'
  | 'semesters.list'
  | 'semesters.create'
  | 'semesters.save'
  | 'opportunities.findById'
  | 'opportunities.list'
  | 'opportunities.countApplications'
  | 'opportunities.listAttachments'
  | 'opportunities.create'
  | 'opportunities.save'
  | 'internships.findById'
  | 'internships.findByUserIdAndOpportunityId'
  | 'internships.list'
  | 'internships.listByUserId'
  | 'internships.listAttachments'
  | 'internships.hasAttachments'
  | 'internships.create'
  | 'internships.save'
  | 'internships.addActivity'
  | 'activityFeed.listByAuthor'
  | 'notifications.create'
  | 'notifications.save'

/**
 * Singular domain resource label used in `NotFoundError` messages
 * (`"${resource} '${id}' not found"`). Stays aligned with the names the
 * API surfaces in problem-detail responses.
 */
export type FirestoreResource =
  | 'User'
  | 'Semester'
  | 'Opportunity'
  | 'Internship'
  | 'Notification'
  | 'Activity'

export interface FirestoreOpContext {
  op: FirestoreOp
  resource: FirestoreResource
  id?: string
  /**
   * Reason to attach when the driver raises `already-exists`. The wrapper
   * does NOT infer this — pass the domain-meaningful reason explicitly
   * (`'natural_key_exists'`, `'identity_already_exists'`, …). When absent,
   * `already-exists` falls through to the unknown-error path: this is
   * deliberate, so a write that hits a guard the caller did not anticipate
   * surfaces loudly instead of being mislabelled as a generic conflict.
   */
  conflictReason?: string
}

/**
 * Kebab-case companion to the library's numeric `GrpcStatus` enum — these
 * are the strings the Firestore SDK actually puts on `err.code` at runtime.
 * The library types `BulkWriterError.code` as the numeric enum but leaves
 * generic thrown errors' `.code` field as untyped `string`, so we mirror
 * the gRPC code list here. Adding a new comparison? Pick from this union.
 */
export type FirestoreErrorCode =
  | 'cancelled'
  | 'unknown'
  | 'invalid-argument'
  | 'deadline-exceeded'
  | 'not-found'
  | 'already-exists'
  | 'permission-denied'
  | 'resource-exhausted'
  | 'failed-precondition'
  | 'aborted'
  | 'out-of-range'
  | 'unimplemented'
  | 'internal'
  | 'unavailable'
  | 'data-loss'
  | 'unauthenticated'

export async function translateFirestoreErrors<T>(
  fn: () => Promise<T>,
  ctx: FirestoreOpContext
): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (isFirestoreErrorCode(err, 'not-found')) {
      throw new NotFoundError(ctx.resource, ctx.id, { cause: err })
    }
    if (isFirestoreErrorCode(err, 'already-exists') && ctx.conflictReason) {
      throw new ConflictError(`${ctx.resource} already exists`, ctx.conflictReason, { cause: err })
    }
    // `failed-precondition` is intentionally NOT mapped to
    // `PreconditionFailedError`. Repositories enforce optimistic concurrency
    // by **explicitly** comparing the persisted `version` against
    // `aggregate.version` and throwing `PreconditionFailedError` themselves —
    // they never rely on Firestore-driver preconditions for the ETag path.
    // Firestore emits `failed-precondition` for unrelated reasons, most
    // notably **missing composite indexes** (the canonical "create the index
    // here" error). Translating that to a 412 etag_mismatch would be a
    // misleading client signal and would mask broken queries; let it fall
    // through to the unknown-error path so it surfaces as a 500 with the
    // raw Firestore message in the logs.
    //
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
    const { code } = err
    if (typeof code === 'string') return code
    if (typeof code === 'number') return String(code)
  }
  return undefined
}
