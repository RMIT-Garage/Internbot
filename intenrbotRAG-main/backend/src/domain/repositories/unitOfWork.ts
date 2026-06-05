/**
 * Domain repository interfaces.
 * Implement these in infrastructure/firestore/ per collection.
 * Dependency rule: domain knows nothing about Firestore or any other infrastructure.
 */

export interface IRepository<T, ID = string> {
  findById(id: ID): Promise<T | null>
  save(entity: T): Promise<void>
  delete(id: ID): Promise<void>
}

/**
 * Unit of Work — groups multiple repository operations into a single atomic transaction.
 * Use FirestoreUnitOfWork from infrastructure/ for the Firestore implementation.
 *
 * Example:
 *   const uow = new FirestoreUnitOfWork()
 *   await uow.runInTransaction(async () => {
 *     await uow.users.save(user)
 *     await uow.posts.save(post)
 *   })
 */
export interface IUnitOfWork {
  commit(): Promise<void>
  rollback(): Promise<void>
}
