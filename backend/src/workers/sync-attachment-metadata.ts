import type { SyncStorageAttachmentCommandHandler } from '../application/commands/sync-storage-attachment'

/**
 * Minimal shape of the Cloud Storage `OBJECT_FINALIZE` event payload that the
 * worker actually inspects. Typed locally so tests do not need to import
 * `firebase-functions` typings; vendor SDK types only enter at the Cloud
 * Functions trigger entry point in `index.ts`.
 */
export interface StorageObjectFinalizedEvent {
  readonly data: {
    readonly name?: string
    readonly contentType?: string
    readonly timeCreated?: string | Date
  }
}

/**
 * Worker — consumes Cloud Storage `OBJECT_FINALIZE` events.
 *
 * Lives in the `workers/` layer (peer to `api/`, both outermost transports):
 * `api/` adapts HTTP requests, `workers/` adapts event-bus deliveries. Both
 * translate transport input → CQRS command and dispatch into the application
 * layer. Neither imports the other.
 *
 * Retry semantics: transient errors from the command handler propagate so the
 * Eventarc/Pub/Sub subscription redelivers (the command is idempotent — the
 * attachment id is derived deterministically from the file path). Logical
 * failures (parent missing, prefix mismatch, invalid path) are absorbed by
 * the command handler and therefore never trigger a retry.
 */
export class SyncAttachmentMetadataWorker {
  constructor(private readonly syncAttachments: SyncStorageAttachmentCommandHandler) {}

  async handle(event: StorageObjectFinalizedEvent): Promise<void> {
    const filePath = event.data.name
    if (!filePath) return

    const timeCreated = event.data.timeCreated
    const finalizedAt =
      timeCreated instanceof Date
        ? timeCreated
        : typeof timeCreated === 'string'
          ? new Date(timeCreated)
          : undefined

    await this.syncAttachments.handle({
      filePath,
      contentType: event.data.contentType,
      finalizedAt,
    })
  }
}
