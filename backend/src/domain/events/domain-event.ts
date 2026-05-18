/**
 * Marker interface for typed domain events emitted by aggregates.
 *
 * Aggregates expose `pendingEvents: readonly DomainEvent[]`; the corresponding
 * repository drains the list inside `save()` and translates each event to
 * Firestore writes inside the same transaction. The same shape can later feed
 * a transactional outbox without changing the aggregate API.
 *
 * `kind` is a string-literal discriminator used to switch in the repo. Each
 * aggregate exports a per-aggregate union of its events (e.g.
 * `SemesterDomainEvent`, `OpportunityDomainEvent`) so handlers get exhaustive
 * checks for free.
 *
 * `occurredAt` is the wall-clock time the domain considered the event to have
 * happened — usually the same `now` the command handler passed in. The repo
 * still uses `FieldValue.serverTimestamp()` for the persisted `createdAt`;
 * `occurredAt` exists so the outbox writer can sort/age events without having
 * to inspect each payload.
 */
export interface DomainEvent {
  readonly kind: string
  readonly occurredAt: Date
}
