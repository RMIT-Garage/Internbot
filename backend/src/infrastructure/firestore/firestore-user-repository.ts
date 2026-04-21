import type { Transaction } from 'firebase-admin/firestore'
import { FieldValue, adminDb } from '../config/firebase-admin'
import type { UserRepository } from '../../domain/repositories/user-repository'
import type { User } from '../../domain/entities/user'
import { USER_SCHEMA_VERSION } from '../../domain/entities/user'
import { NotFoundError, PreconditionFailedError } from '../../domain/errors'
import { userStorageSchema } from './schemas/user'
import { mapStorageToUser, studentProfileToStorage } from './mappers/user'
import { translateFirestoreErrors } from './translate-firestore-errors'

/**
 * Session-scoped Firestore implementation of `UserRepository`.
 *
 * Constructed by `FirestoreUnitOfWork.execute` with a live `Transaction`.
 * All reads/writes run inside the transaction; there is no public
 * constructor path that bypasses it.
 *
 * Reads return `User | null` (the aggregate root directly) — HTTP-specific
 * concerns like ETag formatting live at the api boundary. The domain-level
 * concurrency token is `User.version`, derived from Firestore's
 * `updateTime.toMillis()`.
 */
export class FirestoreUserRepository implements UserRepository {
  constructor(private readonly txn: Transaction) {}

  async findById(id: string): Promise<User | null> {
    return translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection('users').doc(id)
        const snap = await this.txn.get(ref)
        if (!snap.exists) return null
        return parseUser(snap.id, snap.data(), snap.updateTime!.toMillis())
      },
      { op: 'users.findById', id }
    )
  }

  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return translateFirestoreErrors(
      async () => {
        const query = adminDb.collection('users').where('firebaseUid', '==', firebaseUid).limit(1)
        const result = await this.txn.get(query)
        if (result.empty) return null
        const doc = result.docs[0]!
        return parseUser(doc.id, doc.data(), doc.updateTime.toMillis())
      },
      { op: 'users.findByFirebaseUid' }
    )
  }

  /**
   * Insert a freshly-created aggregate. Called by `POST /auth/sync` on
   * first-sync after `User.create(...)`. The passed-in `user.id` may be
   * an empty string — we auto-assign a Firestore doc id and return it.
   * No concurrency check (new doc; nothing to race against).
   */
  async create(user: User): Promise<{ id: string }> {
    return translateFirestoreErrors(
      async () => {
        const ref = user.id && user.id.length > 0
          ? adminDb.collection('users').doc(user.id)
          : adminDb.collection('users').doc()

        const doc: Record<string, unknown> = {
          firebaseUid: user.firebaseUid,
          email: user.email,
          role: user.role,
          status: user.status,
          onboardingStage: user.onboardingStage,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          _schemaVersion: USER_SCHEMA_VERSION,
        }
        if (user.displayName !== undefined) doc['displayName'] = user.displayName
        if (user.studentProfile !== undefined) {
          doc['studentProfile'] = studentProfileToStorage(user.studentProfile)
        }
        this.txn.set(ref, doc)
        return { id: ref.id }
      },
      { op: 'users.create' }
    )
  }

  /**
   * Persist mutations on an existing aggregate with optimistic concurrency.
   *
   * Reads the current doc version inside the transaction and rejects with
   * `PreconditionFailedError` if it doesn't match `user.version`. We
   * compare via `updateTime.toMillis()` rather than Firestore's
   * `lastUpdateTime` precondition because the domain-level version is a
   * millis number and cannot losslessly roundtrip to a Timestamp.
   *
   * On success, writes only the mutable fields — identity fields
   * (`firebaseUid`, `email`, `role`) stay put. `updatedAt` is rewritten
   * to server time on every save.
   */
  async save(user: User): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection('users').doc(user.id)
        const snap = await this.txn.get(ref)
        if (!snap.exists) throw new NotFoundError('User', user.id)

        const currentVersion = snap.updateTime!.toMillis()
        if (currentVersion !== user.version) {
          throw new PreconditionFailedError('Resource version does not match')
        }

        const update: Record<string, unknown> = {
          status: user.status,
          onboardingStage: user.onboardingStage,
          updatedAt: FieldValue.serverTimestamp(),
        }
        if (user.displayName !== undefined) update['displayName'] = user.displayName
        if (user.studentProfile !== undefined) {
          update['studentProfile'] = studentProfileToStorage(user.studentProfile)
        }
        this.txn.update(ref, update)
      },
      { op: 'users.save', id: user.id }
    )
  }
}

function parseUser(id: string, raw: unknown, version: number): User {
  const parsed = userStorageSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`users/${id} storage-shape validation failed: ${parsed.error.message}`)
  }
  return mapStorageToUser(id, version, parsed.data)
}
