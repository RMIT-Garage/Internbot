import type { FinalizeStorageAttachmentCommandHandler } from '../application/commands/finalize-storage-attachment'

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
    readonly generation?: string | number
  }
}

/**
 * Worker — consumes Cloud Storage `OBJECT_FINALIZE` events.
 *
 * Pairs with the `POST /:parent/:id/attachments/upload-intents` endpoints,
 * which pre-write attachment subdocs in `uploading` state and return signed
 * PUT URLs. This worker flips those subdocs to `finalized` after the upload
 * lands.
 *
 * Retry semantics: transient errors from the command handler propagate so the
 * Eventarc/Pub/Sub subscription redelivers (the finalize transition is
 * idempotent — a second delivery for an already-finalized attachment is a
 * no-op). Logical failures (parent missing, prefix mismatch, invalid path,
 * unknown attachment) are absorbed by the command handler and therefore never
 * trigger a retry.
 */
export class SyncAttachmentMetadataWorker {
  constructor(private readonly finalizeAttachment: FinalizeStorageAttachmentCommandHandler) {}

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

    const rawGeneration = event.data.generation
    const generation =
      typeof rawGeneration === 'string'
        ? rawGeneration
        : typeof rawGeneration === 'number'
          ? String(rawGeneration)
          : undefined

    await this.finalizeAttachment.handle({
      filePath,
      finalizedAt,
      generation,
    })
  }
}
