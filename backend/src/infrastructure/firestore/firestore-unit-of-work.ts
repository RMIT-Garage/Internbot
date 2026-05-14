import type { UnitOfWork, UnitOfWorkContext } from '../../application/ports/unit-of-work'
import { adminDb } from '../config/firebase-admin'
import { FirestoreUserRepository } from './firestore-user-repository'
import { FirestoreSemesterRepository } from './firestore-semester-repository'
import { FirestoreOpportunityRepository } from './firestore-opportunity-repository'
import { FirestoreInternshipRepository } from './firestore-internship-repository'
import { FirestoreNotificationRepository } from './firestore-notification-repository'
import { FirestoreTicketRepository } from './firestore-ticket-repository'

/**
 * Firestore implementation of `UnitOfWork`.
 *
 * Every `execute(work)` call opens a Firestore transaction, constructs
 * session-scoped **write-side** repositories bound to that transaction,
 * runs the caller's work function, and commits on return. Throwing inside
 * `work` rolls back.
 *
 * Read-side query services are **not** on the UoW — they're singletons
 * injected directly into query handlers (see `firestore-*-query-service.ts`).
 *
 * Firestore transactions **cannot re-read a document after a write in the
 * same transaction** — command handlers therefore call `uow.execute(...)`
 * again for the post-write read used to hydrate response DTOs.
 */
export class FirestoreUnitOfWork implements UnitOfWork {
  async execute<T>(work: (ctx: UnitOfWorkContext) => Promise<T>): Promise<T> {
    return adminDb.runTransaction(async (txn) => {
      const ctx: UnitOfWorkContext = {
        users: new FirestoreUserRepository(txn),
        semesters: new FirestoreSemesterRepository(txn),
        opportunities: new FirestoreOpportunityRepository(txn),
        internships: new FirestoreInternshipRepository(txn),
        notifications: new FirestoreNotificationRepository(txn),
        tickets: new FirestoreTicketRepository(txn),
      }
      return work(ctx)
    })
  }
}

/** Production singleton — wired into `createApp()` as the default UoW. */
export const firestoreUnitOfWork: UnitOfWork = new FirestoreUnitOfWork()
