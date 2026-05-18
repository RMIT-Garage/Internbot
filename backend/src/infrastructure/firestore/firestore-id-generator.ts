import { adminDb } from '../config/firebase-admin'
import type { IdGenerator } from '../../application/ports/id-generator'

/**
 * Firestore-backed `IdGenerator` — mints auto-ids without I/O.
 *
 * `collection.doc()` (no argument) synchronously returns a fresh 20-char
 * base64 doc id; no RPC is performed. Firestore auto-ids are
 * lexicographically time-ordered (loosely sortable by creation), which
 * gives us free locality for cursor pagination without paying for UUIDv7.
 *
 * The id format is collection-independent — Firestore does not encode the
 * collection path into the id — so a single generator works for every
 * aggregate type. We use `users` as the bookkeeping collection; the
 * generated id is never written to the doc the bookkeeping ref points
 * at (we only read the `.id` property).
 */
export class FirestoreIdGenerator implements IdGenerator {
  next(): string {
    return adminDb.collection('_id_pool').doc().id
  }
}

/** Singleton instance — stateless; safe to share across requests. */
export const firestoreIdGenerator: IdGenerator = new FirestoreIdGenerator()
