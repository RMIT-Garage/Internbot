/**
 * Component — workers/sync-attachment-metadata.
 *
 * Verifies the worker correctly consumes Cloud Storage `OBJECT_FINALIZE`
 * events and dispatches them through the CQRS layer. The worker's only job
 * is event-payload translation; the underlying FinalizeStorageAttachment
 * command behaviour is covered by integration tests.
 *
 * Each test mints its own random ids and tracks them via `trackDoc(...)` so
 * the suite is parallel-safe.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { SyncAttachmentMetadataWorker } from '../../../src/workers/sync-attachment-metadata'
import { FinalizeStorageAttachmentCommandHandler } from '../../../src/application/commands/finalize-storage-attachment'
import { FirestoreUnitOfWork } from '../../../src/infrastructure/firestore/firestore-unit-of-work'
import { adminDb, Timestamp } from '../../../src/infrastructure/config/firebase-admin'
import { clearDocs, initEmulator, trackDoc } from '../../setup.emulator'

function buildWorker() {
  return new SyncAttachmentMetadataWorker(
    new FinalizeStorageAttachmentCommandHandler(new FirestoreUnitOfWork())
  )
}

async function seedOpportunity(opportunityId: string): Promise<void> {
  const now = Timestamp.fromDate(new Date('2026-04-01T00:00:00Z'))
  await adminDb
    .collection('opportunities')
    .doc(opportunityId)
    .set({
      semesterId: `sem_${randomUUID()}`,
      type: 'pre_approved',
      employerName: 'Example Pty Ltd',
      jobTitle: 'Software Intern',
      descriptionText: 'Build software',
      status: 'published',
      applicationCount: 0,
      version: 1,
      createdAt: now,
      updatedAt: now,
      _schemaVersion: 1,
    })
  trackDoc('opportunities', opportunityId)
}

async function seedAttachment(
  parent: 'opportunities' | 'internships',
  parentId: string,
  attachmentId: string,
  filePath: string
): Promise<void> {
  await adminDb
    .collection(parent)
    .doc(parentId)
    .collection('attachments')
    .doc(attachmentId)
    .set({
      filePath,
      fileName: filePath.split('/').pop(),
      contentType: 'application/pdf',
      uploadedAt: Timestamp.fromDate(new Date('2026-04-03T00:00:00Z')),
      uploadStatus: 'uploading',
      _schemaVersion: 1,
    })
}

async function readAttachment(
  parent: 'opportunities' | 'internships',
  parentId: string,
  attachmentId: string
): Promise<Record<string, unknown> | undefined> {
  const snap = await adminDb
    .collection(parent)
    .doc(parentId)
    .collection('attachments')
    .doc(attachmentId)
    .get()
  return snap.data()
}

describe('SyncAttachmentMetadataWorker — component', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
  })

  it('flips a pre-written opportunity attachment to finalized when OBJECT_FINALIZE arrives', async () => {
    const opportunityId = `opp_${randomUUID()}`
    const attachmentId = `att_${randomUUID().slice(0, 12).replace(/-/g, '')}`
    const filePath = `opportunities/${opportunityId}/attachments/${attachmentId}-position.pdf`
    await seedOpportunity(opportunityId)
    await seedAttachment('opportunities', opportunityId, attachmentId, filePath)
    const worker = buildWorker()

    await worker.handle({
      data: {
        name: filePath,
        contentType: 'application/pdf',
        timeCreated: '2026-04-04T09:05:00Z',
        generation: '1700000000007777',
      },
    })

    const after = await readAttachment('opportunities', opportunityId, attachmentId)
    expect(after?.['uploadStatus']).toBe('finalized')
    expect(after?.['storageGeneration']).toBe('1700000000007777')
  })

  it('passes a Date-shaped timeCreated through to the finalize handler', async () => {
    const opportunityId = `opp_${randomUUID()}`
    const attachmentId = `att_${randomUUID().slice(0, 12).replace(/-/g, '')}`
    const filePath = `opportunities/${opportunityId}/attachments/${attachmentId}-position.pdf`
    await seedOpportunity(opportunityId)
    await seedAttachment('opportunities', opportunityId, attachmentId, filePath)
    const worker = buildWorker()

    await worker.handle({
      data: {
        name: filePath,
        contentType: 'application/pdf',
        timeCreated: new Date('2026-04-04T09:05:00Z'),
        generation: '1700000000008888',
      },
    })

    const after = await readAttachment('opportunities', opportunityId, attachmentId)
    expect(after?.['uploadStatus']).toBe('finalized')
  })

  it('does nothing when the event has no object name', async () => {
    const opportunityId = `opp_${randomUUID()}`
    const attachmentId = `att_${randomUUID().slice(0, 12).replace(/-/g, '')}`
    const filePath = `opportunities/${opportunityId}/attachments/${attachmentId}-position.pdf`
    await seedOpportunity(opportunityId)
    await seedAttachment('opportunities', opportunityId, attachmentId, filePath)
    const worker = buildWorker()

    await worker.handle({ data: { contentType: 'application/pdf' } })

    expect(
      (await readAttachment('opportunities', opportunityId, attachmentId))?.['uploadStatus']
    ).toBe('uploading')
  })

  it('silently ignores an event whose path does not match the attachment convention', async () => {
    const worker = buildWorker()
    const stray = `users/${randomUUID()}/avatar/photo.png`

    await expect(
      worker.handle({ data: { name: stray, contentType: 'image/png' } })
    ).resolves.toBeUndefined()
  })

  it('silently ignores an event whose attachmentId prefix is unknown to the parent', async () => {
    const opportunityId = `opp_${randomUUID()}`
    await seedOpportunity(opportunityId)
    const worker = buildWorker()
    const stale = `opportunities/${opportunityId}/attachments/att_ghost-position.pdf`

    await expect(
      worker.handle({ data: { name: stale, contentType: 'application/pdf' } })
    ).resolves.toBeUndefined()
  })
})
