/**
 * Component — workers/sync-attachment-metadata.
 *
 * Verifies the worker correctly consumes Cloud Storage `OBJECT_FINALIZE`
 * events and dispatches them through the CQRS layer. We do not exercise the
 * full media pipeline (no actual upload to the Storage emulator) — the
 * worker's responsibility is event-payload translation; the underlying
 * SyncStorageAttachment command behaviour is covered by integration tests.
 *
 * Each test mints its own random ids and tracks them via `trackDoc(...)` so
 * the suite is parallel-safe.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { SyncAttachmentMetadataWorker } from '../../../src/workers/sync-attachment-metadata'
import { SyncStorageAttachmentCommandHandler } from '../../../src/application/commands/sync-storage-attachment'
import { FirestoreUnitOfWork } from '../../../src/infrastructure/firestore/firestore-unit-of-work'
import { adminDb, Timestamp } from '../../../src/infrastructure/config/firebase-admin'
import type { AttachmentStorage } from '../../../src/application/ports/attachment-storage'
import { clearDocs, initEmulator, trackDoc } from '../../setup.emulator'

class RecordingAttachmentStorage implements AttachmentStorage {
  readonly deleted: string[] = []

  async createReadUrl(): Promise<string> {
    return 'unused'
  }

  async deleteObject(filePath: string): Promise<void> {
    this.deleted.push(filePath)
  }
}

function buildWorker(storage: AttachmentStorage = new RecordingAttachmentStorage()) {
  return new SyncAttachmentMetadataWorker(
    new SyncStorageAttachmentCommandHandler(new FirestoreUnitOfWork(), storage)
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
      createdByUserId: null,
      submittedByUserId: null,
      verifiedByUserId: null,
      verifiedAt: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
      _schemaVersion: 1,
    })
  trackDoc('opportunities', opportunityId)
}

async function seedInternship(
  internshipId: string,
  userId: string,
  opportunityId: string
): Promise<void> {
  const now = Timestamp.fromDate(new Date('2026-04-01T00:00:00Z'))
  await adminDb.collection('internships').doc(internshipId).set({
    userId,
    opportunityId,
    studentProgramCode: 'BP096',
    opportunityEmployerName: 'Example Pty Ltd',
    opportunityJobTitle: 'Software Intern',
    opportunityType: 'pre_approved',
    status: 'applied',
    version: 1,
    createdAt: now,
    updatedAt: now,
    _schemaVersion: 1,
  })
  trackDoc('internships', internshipId)
}

async function listAttachmentPaths(parent: string, parentId: string): Promise<string[]> {
  const snap = await adminDb.collection(parent).doc(parentId).collection('attachments').get()
  return snap.docs.map((doc) => String(doc.data()['filePath']))
}

describe('SyncAttachmentMetadataWorker — component', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
  })

  it('consumes a finalize event and writes the opportunity attachment subdoc', async () => {
    const opportunityId = `opp_${randomUUID()}`
    await seedOpportunity(opportunityId)
    const filePath = `opportunities/${opportunityId}/attachments/jd-${randomUUID().slice(0, 6)}.pdf`
    const worker = buildWorker()

    await worker.handle({
      data: {
        name: filePath,
        contentType: 'application/pdf',
        timeCreated: '2026-04-04T09:05:00Z',
      },
    })

    expect(await listAttachmentPaths('opportunities', opportunityId)).toEqual([filePath])
  })

  it('passes a Date-shaped timeCreated through to the command handler', async () => {
    const opportunityId = `opp_${randomUUID()}`
    await seedOpportunity(opportunityId)
    const filePath = `opportunities/${opportunityId}/attachments/jd-${randomUUID().slice(0, 6)}.pdf`
    const worker = buildWorker()

    await worker.handle({
      data: {
        name: filePath,
        contentType: 'application/pdf',
        timeCreated: new Date('2026-04-04T09:05:00Z'),
      },
    })

    expect(await listAttachmentPaths('opportunities', opportunityId)).toEqual([filePath])
  })

  it('replaces a previous internship attachment when a new finalize event arrives', async () => {
    const ownerId = `usr_owner_${randomUUID()}`
    const opportunityId = `opp_${randomUUID()}`
    const internshipId = `int_${randomUUID()}`
    await seedOpportunity(opportunityId)
    await seedInternship(internshipId, ownerId, opportunityId)
    const oldPath = `users/${ownerId}/internships/${internshipId}/attachments/old.pdf`
    const newPath = `users/${ownerId}/internships/${internshipId}/attachments/new-${randomUUID().slice(0, 6)}.pdf`
    const storage = new RecordingAttachmentStorage()
    const worker = buildWorker(storage)

    await worker.handle({
      data: { name: oldPath, contentType: 'application/pdf' },
    })
    await worker.handle({
      data: { name: newPath, contentType: 'application/pdf' },
    })

    expect(await listAttachmentPaths('internships', internshipId)).toEqual([newPath])
    expect(storage.deleted).toEqual([oldPath])
  })

  it('does nothing when the event has no object name', async () => {
    const storage = new RecordingAttachmentStorage()
    const worker = buildWorker(storage)

    await worker.handle({ data: { contentType: 'application/pdf' } })

    expect(storage.deleted).toEqual([])
  })

  it('removes a finalized object that lives outside the recognised attachment path conventions', async () => {
    const storage = new RecordingAttachmentStorage()
    const worker = buildWorker(storage)
    const stray = `users/${randomUUID()}/avatar/photo.png`

    await worker.handle({ data: { name: stray, contentType: 'image/png' } })

    expect(storage.deleted).toEqual([stray])
  })
})
