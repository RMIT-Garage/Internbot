import { adminDb } from '../config/firebaseAdmin'
import type { IUnitOfWork } from '../../domain/repositories/unitOfWork'

/**
 * Firestore implementation of UnitOfWork.
 * Wrap multi-step writes in runInTransaction() for atomicity.
 *
 * Example:
 *   const uow = new FirestoreUnitOfWork()
 *   await uow.runInTransaction(async () => {
 *     // all reads/writes here run in a single Firestore transaction
 *   })
 */
export class FirestoreUnitOfWork implements IUnitOfWork {
  async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    return adminDb.runTransaction(async () => {
      return fn()
    })
  }

  async commit(): Promise<void> {
    // Firestore transactions auto-commit when runTransaction resolves
  }

  async rollback(): Promise<void> {
    // Throw inside runInTransaction to trigger an automatic rollback
    throw new Error('Explicit rollback — throw inside runInTransaction instead')
  }
}
