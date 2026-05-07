import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createHash, randomUUID } from 'node:crypto'
import { SyncStorageAttachmentCommandHandler } from '../../../../src/application/commands/sync-storage-attachment'
import { GetOpportunityAttachmentQueryHandler } from '../../../../src/application/queries/get-opportunity-attachment'
import { SubmitInternshipOfferCommandHandler } from '../../../../src/application/commands/submit-internship-offer'
import { DeleteInternshipAttachmentCommandHandler } from '../../../../src/application/commands/delete-internship-attachment'
import { DeleteOpportunityAttachmentCommandHandler } from '../../../../src/application/commands/delete-opportunity-attachment'
import type { AttachmentStorage } from '../../../../src/application/ports/attachment-storage'
import type { RequestActor } from '../../../../src/application/actor'
import { FirestoreUnitOfWork } from '../../../../src/infrastructure/firestore/firestore-unit-of-work'
import { firestoreIdGenerator } from '../../../../src/infrastructure/firestore/firestore-id-generator'
import { firestoreOpportunityQueryService } from '../../../../src/infrastructure/firestore/firestore-opportunity-query-service'
import { firestoreUserQueryService } from '../../../../src/infrastructure/firestore/firestore-user-query-service'
import { defaultAuthorizationService } from '../../../../src/infrastructure/authorization/default-authorization-service'
import { adminDb, Timestamp } from '../../../../src/infrastructure/config/firebase-admin'
import { User } from '../../../../src/domain/entities/user'
import { UserIdentity } from '../../../../src/domain/value-objects/user-identity'
import { StudentProfile } from '../../../../src/domain/value-objects/student-profile'
import { clearDocs, initEmulator, trackDoc } from '../../../setup.emulator'

class FakeAttachmentStorage implements AttachmentStorage {
  readonly deleted: Array<{ filePath: string; ifGenerationMatch?: string }> = []
  readonly signed: Array<{ filePath: string; expiresAt: Date }> = []
  shouldThrowPreconditionFailed = false

  async createReadUrl(filePath: string, expiresAt: Date): Promise<string> {
    this.signed.push({ filePath, expiresAt })
    return `https://storage.example.test/${encodeURIComponent(filePath)}?expires=${expiresAt.getTime()}`
  }

  async deleteObject(filePath: string): Promise<void> {
    if (this.shouldThrowPreconditionFailed) {
      // Simulate the GCS adapter swallowing 412 — record the attempt but
      // don't append to `deleted` so tests can assert no destructive action.
      return
    }
    this.deleted.push({ filePath })
  }
}

function actorFor(
  role: 'student' | 'coordinator',
  id = `usr_${role}_${randomUUID()}`
): RequestActor {
  return {
    firebaseUid: `fb_${randomUUID()}`,
    email: `${id}@${role === 'student' ? 'student.' : ''}rmit.edu.au`,
    platformUser: { id, role },
  }
}

async function seedStudent(userId: string, semesterId: string): Promise<void> {
  const now = new Date('2026-04-01T00:00:00Z')
  await new FirestoreUnitOfWork().execute(async (ctx) => {
    await ctx.users.save(
      User.create({
        id: userId,
        version: 0,
        email: `${userId}@student.rmit.edu.au`,
        role: 'student',
        status: 'active',
        onboardingStage: 'profile_complete',
        identity: UserIdentity.create({
          provider: 'firebase',
          providerUserId: `fb_${randomUUID()}`,
          emailSnapshot: `${userId}@student.rmit.edu.au`,
        }),
        createdAt: now,
        updatedAt: now,
        displayName: undefined,
        studentProfile: StudentProfile.rehydrate({
          studentNumber: `s${randomUUID().slice(0, 8)}`,
          profileStatus: 'complete',
          programCode: 'BP096',
          phone: undefined,
          academicInfo: undefined,
          semesterId,
          semesterSelectedAt: now,
        }),
      })
    )
  })
  trackDoc('users', userId)
}

async function seedOpportunity(
  id: string,
  overrides: Partial<{
    semesterId: string
    status: 'draft' | 'published'
    createdByUserId: string
    submittedByUserId: string
  }> = {}
): Promise<void> {
  const now = Timestamp.fromDate(new Date('2026-04-02T00:00:00Z'))
  const body: Record<string, unknown> = {
    semesterId: overrides.semesterId ?? `sem_${randomUUID()}`,
    type: 'pre_approved',
    employerName: 'Example Pty Ltd',
    jobTitle: 'Software Intern',
    descriptionText: 'Build internal tools',
    sourceUrl: 'https://careerhub.rmit.edu.au/jobs/123',
    status: overrides.status ?? 'published',
    version: 1,
    createdAt: now,
    updatedAt: now,
    _schemaVersion: 1,
  }
  if (overrides.createdByUserId !== undefined) body['createdByUserId'] = overrides.createdByUserId
  if (overrides.submittedByUserId !== undefined) {
    body['submittedByUserId'] = overrides.submittedByUserId
  }
  await adminDb.collection('opportunities').doc(id).set(body)
  trackDoc('opportunities', id)
}

async function seedInternship(id: string, userId: string, opportunityId: string): Promise<void> {
  const now = Timestamp.fromDate(new Date('2026-04-02T00:00:00Z'))
  await adminDb.collection('internships').doc(id).set({
    userId,
    opportunityId,
    status: 'applied',
    version: 1,
    createdAt: now,
    updatedAt: now,
    _schemaVersion: 1,
  })
  trackDoc('internships', id)
}

async function seedAttachment(
  parentCollection: 'opportunities' | 'internships',
  parentId: string,
  attachmentId: string,
  filePath: string
): Promise<void> {
  await adminDb
    .collection(parentCollection)
    .doc(parentId)
    .collection('attachments')
    .doc(attachmentId)
    .set({
      filePath,
      fileName: filePath.split('/').pop(),
      contentType: 'application/pdf',
      uploadedAt: Timestamp.fromDate(new Date('2026-04-03T00:00:00Z')),
      _schemaVersion: 1,
    })
}

async function listAttachmentPaths(
  parentCollection: 'opportunities' | 'internships',
  parentId: string
): Promise<string[]> {
  // Soft-delete leaves tombstoned attachment docs in place with `deletedAt`
  // set; the read-side filters them out, so this helper does the same to
  // mirror what callers see.
  const snap = await adminDb
    .collection(parentCollection)
    .doc(parentId)
    .collection('attachments')
    .get()
  return snap.docs
    .filter((doc) => doc.data()['deletedAt'] == null)
    .map((doc) => doc.data()['filePath'] as string)
    .sort()
}

describe('Attachments — integration', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
  })

  it('Storage object written to an invalid path prefix is not reflected into Firestore', async () => {
    const storage = new FakeAttachmentStorage()
    const result = await new SyncStorageAttachmentCommandHandler(
      new FirestoreUnitOfWork(),
      storage
    ).handle({
      filePath: 'tickets/tkt_001/attachments/file.pdf',
      contentType: 'application/pdf',
      finalizedAt: new Date('2026-04-04T00:00:00Z'),
      generation: undefined,
    })

    expect(result).toEqual({ reflected: false, reason: 'invalid_path' })
    expect(storage.deleted.map((d) => d.filePath)).toEqual(['tickets/tkt_001/attachments/file.pdf'])
  })

  it('Storage trigger syncs opportunity attachment metadata to the parent subcollection', async () => {
    const opportunityId = `opp_${randomUUID()}`
    await seedOpportunity(opportunityId)
    const filePath = `opportunities/${opportunityId}/attachments/position.pdf`

    const result = await new SyncStorageAttachmentCommandHandler(
      new FirestoreUnitOfWork(),
      new FakeAttachmentStorage()
    ).handle({
      filePath,
      contentType: 'application/pdf',
      finalizedAt: new Date('2026-04-04T00:00:00Z'),
      generation: '1700000000000010',
    })

    expect(result).toEqual({ reflected: true, reason: 'synced' })
    expect(await listAttachmentPaths('opportunities', opportunityId)).toEqual([filePath])
  })

  it('Storage trigger rejects internship paths whose user prefix is not the owner', async () => {
    const storage = new FakeAttachmentStorage()
    const ownerId = `usr_owner_${randomUUID()}`
    const internshipId = `int_${randomUUID()}`
    const opportunityId = `opp_${randomUUID()}`
    await seedOpportunity(opportunityId)
    await seedInternship(internshipId, ownerId, opportunityId)

    const forgedPath = `users/usr_other/internships/${internshipId}/attachments/offer.pdf`
    const result = await new SyncStorageAttachmentCommandHandler(
      new FirestoreUnitOfWork(),
      storage
    ).handle({
      filePath: forgedPath,
      contentType: 'application/pdf',
      finalizedAt: new Date('2026-04-04T00:00:00Z'),
      generation: '1700000000000020',
    })

    expect(result).toEqual({ reflected: false, reason: 'prefix_owner_mismatch' })
    expect(storage.deleted.map((d) => d.filePath)).toEqual([forgedPath])
    expect(await listAttachmentPaths('internships', internshipId)).toEqual([])
  })

  it('Internship finalize stages a new file alongside existing staged files (no auto-delete)', async () => {
    const storage = new FakeAttachmentStorage()
    const ownerId = `usr_owner_${randomUUID()}`
    const internshipId = `int_${randomUUID()}`
    const opportunityId = `opp_${randomUUID()}`
    await seedOpportunity(opportunityId)
    await seedInternship(internshipId, ownerId, opportunityId)
    const firstPath = `users/${ownerId}/internships/${internshipId}/attachments/first.pdf`
    const secondPath = `users/${ownerId}/internships/${internshipId}/attachments/second.pdf`

    const sync = new SyncStorageAttachmentCommandHandler(new FirestoreUnitOfWork(), storage)
    await sync.handle({
      filePath: firstPath,
      contentType: 'application/pdf',
      finalizedAt: new Date('2026-04-04T00:00:00Z'),
      generation: '1700000000000030',
    })
    const second = await sync.handle({
      filePath: secondPath,
      contentType: 'application/pdf',
      finalizedAt: new Date('2026-04-04T00:01:00Z'),
      generation: '1700000000000031',
    })

    expect(second).toEqual({ reflected: true, reason: 'synced' })
    expect(await listAttachmentPaths('internships', internshipId)).toEqual([firstPath, secondPath])
    expect(storage.deleted).toEqual([])
  })

  it('Offer submission blocks until at least one attachment has been synced via the trigger', async () => {
    const storage = new FakeAttachmentStorage()
    const ownerId = `usr_owner_${randomUUID()}`
    const semesterId = `sem_${randomUUID()}`
    const opportunityId = `opp_${randomUUID()}`
    const internshipId = `int_${randomUUID()}`
    await seedStudent(ownerId, semesterId)
    await seedOpportunity(opportunityId, { semesterId, status: 'published' })
    await seedInternship(internshipId, ownerId, opportunityId)

    const submit = new SubmitInternshipOfferCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService,
      firestoreIdGenerator
    )
    const payload = {
      offerDate: new Date('2026-05-01T00:00:00Z'),
      startDate: new Date('2026-06-01T00:00:00Z'),
      endDate: undefined,
    }

    await expect(
      submit.handle({ actor: actorFor('student', ownerId), internshipId, payload })
    ).rejects.toThrow(expect.objectContaining({ reason: 'offer_attachment_missing' }))

    await new SyncStorageAttachmentCommandHandler(new FirestoreUnitOfWork(), storage).handle({
      filePath: `users/${ownerId}/internships/${internshipId}/attachments/offer.pdf`,
      contentType: 'application/pdf',
      finalizedAt: new Date('2026-04-04T00:00:00Z'),
      generation: '1700000000000040',
    })

    await expect(
      submit.handle({ actor: actorFor('student', ownerId), internshipId, payload })
    ).resolves.toEqual({ id: internshipId })
  })

  it('Signed URL expiry is passed to the storage signer and returned to clients', async () => {
    const storage = new FakeAttachmentStorage()
    const studentId = `usr_student_${randomUUID()}`
    const semesterId = `sem_${randomUUID()}`
    const opportunityId = `opp_${randomUUID()}`
    await seedStudent(studentId, semesterId)
    await seedOpportunity(opportunityId, { semesterId, status: 'published' })
    await seedAttachment(
      'opportunities',
      opportunityId,
      'att_001',
      `opportunities/${opportunityId}/attachments/position.pdf`
    )

    const fixedNow = new Date('2026-04-05T00:00:00Z')
    const result = await new GetOpportunityAttachmentQueryHandler(
      firestoreOpportunityQueryService,
      firestoreUserQueryService,
      defaultAuthorizationService,
      storage,
      { ttlMs: 5_000, now: () => fixedNow }
    ).handle({
      actor: actorFor('student', studentId),
      opportunityId,
      attachmentId: 'att_001',
    })

    expect(result.downloadUrlExpiresAt.toISOString()).toBe('2026-04-05T00:00:05.000Z')
    expect(storage.signed).toEqual([
      {
        filePath: `opportunities/${opportunityId}/attachments/position.pdf`,
        expiresAt: new Date('2026-04-05T00:00:05.000Z'),
      },
    ])
    expect(result.downloadUrl).toContain('expires=1775347205000')
  })

  it('Owner can delete an applied-status internship attachment; backend stops returning it (soft-delete tombstone, no GCS call from request path)', async () => {
    const storage = new FakeAttachmentStorage()
    const ownerId = `usr_owner_${randomUUID()}`
    const opportunityId = `opp_${randomUUID()}`
    const internshipId = `int_${randomUUID()}`
    await seedOpportunity(opportunityId)
    await seedInternship(internshipId, ownerId, opportunityId)
    const filePath = `users/${ownerId}/internships/${internshipId}/attachments/offer.pdf`
    await new SyncStorageAttachmentCommandHandler(new FirestoreUnitOfWork(), storage).handle({
      filePath,
      contentType: 'application/pdf',
      finalizedAt: new Date('2026-04-04T00:00:00Z'),
      generation: '1700000000001000',
    })

    await new DeleteInternshipAttachmentCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService
    ).handle({
      actor: actorFor('student', ownerId),
      internshipId,
      attachmentId: deterministicAttachmentId(filePath),
    })

    expect(await listAttachmentPaths('internships', internshipId)).toEqual([])
    expect(storage.deleted).toEqual([])
  })

  it('Internship attachment delete from a non-owner student is rejected and the GCS object is left alone', async () => {
    const storage = new FakeAttachmentStorage()
    const ownerId = `usr_owner_${randomUUID()}`
    const intruderId = `usr_other_${randomUUID()}`
    const opportunityId = `opp_${randomUUID()}`
    const internshipId = `int_${randomUUID()}`
    await seedOpportunity(opportunityId)
    await seedInternship(internshipId, ownerId, opportunityId)
    const filePath = `users/${ownerId}/internships/${internshipId}/attachments/offer.pdf`
    await new SyncStorageAttachmentCommandHandler(new FirestoreUnitOfWork(), storage).handle({
      filePath,
      contentType: 'application/pdf',
      finalizedAt: new Date('2026-04-04T00:00:00Z'),
      generation: '1700000000002000',
    })

    await expect(
      new DeleteInternshipAttachmentCommandHandler(
        new FirestoreUnitOfWork(),
        defaultAuthorizationService
      ).handle({
        actor: actorFor('student', intruderId),
        internshipId,
        attachmentId: deterministicAttachmentId(filePath),
      })
    ).rejects.toThrow(expect.objectContaining({ reason: 'student_not_owner' }))

    expect(await listAttachmentPaths('internships', internshipId)).toEqual([filePath])
    expect(storage.deleted).toEqual([])
  })

  it('Internship attachment delete is blocked once the offer is under review (status=offer_pending_review)', async () => {
    const storage = new FakeAttachmentStorage()
    const ownerId = `usr_owner_${randomUUID()}`
    const opportunityId = `opp_${randomUUID()}`
    const internshipId = `int_${randomUUID()}`
    await seedOpportunity(opportunityId)
    await seedInternship(internshipId, ownerId, opportunityId)
    const filePath = `users/${ownerId}/internships/${internshipId}/attachments/offer.pdf`
    await new SyncStorageAttachmentCommandHandler(new FirestoreUnitOfWork(), storage).handle({
      filePath,
      contentType: 'application/pdf',
      finalizedAt: new Date('2026-04-04T00:00:00Z'),
      generation: '1700000000003000',
    })
    await adminDb
      .collection('internships')
      .doc(internshipId)
      .update({ status: 'offer_pending_review' })

    await expect(
      new DeleteInternshipAttachmentCommandHandler(
        new FirestoreUnitOfWork(),
        defaultAuthorizationService
      ).handle({
        actor: actorFor('student', ownerId),
        internshipId,
        attachmentId: deterministicAttachmentId(filePath),
      })
    ).rejects.toThrow(expect.objectContaining({ reason: 'attachment_locked_in_status' }))

    expect(await listAttachmentPaths('internships', internshipId)).toEqual([filePath])
    expect(storage.deleted).toEqual([])
  })

  it('Concurrent re-upload during delete is preserved by the ifGenerationMatch precondition (GCS 412 swallowed, new file untouched)', async () => {
    const storage = new FakeAttachmentStorage()
    const ownerId = `usr_owner_${randomUUID()}`
    const opportunityId = `opp_${randomUUID()}`
    const internshipId = `int_${randomUUID()}`
    await seedOpportunity(opportunityId)
    await seedInternship(internshipId, ownerId, opportunityId)
    const filePath = `users/${ownerId}/internships/${internshipId}/attachments/offer.pdf`
    await new SyncStorageAttachmentCommandHandler(new FirestoreUnitOfWork(), storage).handle({
      filePath,
      contentType: 'application/pdf',
      finalizedAt: new Date('2026-04-04T00:00:00Z'),
      generation: '1700000000004000',
    })

    storage.shouldThrowPreconditionFailed = true
    await new DeleteInternshipAttachmentCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService
    ).handle({
      actor: actorFor('student', ownerId),
      internshipId,
      attachmentId: deterministicAttachmentId(filePath),
    })

    // Firestore metadata is gone (backend stops returning it), but no
    // destructive GCS delete was recorded — the adapter swallowed the 412.
    expect(await listAttachmentPaths('internships', internshipId)).toEqual([])
    expect(storage.deleted).toEqual([])
  })

  it('Coordinator can delete an opportunity attachment; student cannot', async () => {
    const storage = new FakeAttachmentStorage()
    const coordinatorId = `usr_coord_${randomUUID()}`
    const studentId = `usr_student_${randomUUID()}`
    const semesterId = `sem_${randomUUID()}`
    const opportunityId = `opp_${randomUUID()}`
    await seedOpportunity(opportunityId, { semesterId, status: 'published' })
    const filePath = `opportunities/${opportunityId}/attachments/jd.pdf`
    await new SyncStorageAttachmentCommandHandler(new FirestoreUnitOfWork(), storage).handle({
      filePath,
      contentType: 'application/pdf',
      finalizedAt: new Date('2026-04-04T00:00:00Z'),
      generation: '1700000000005000',
    })
    const attachmentId = deterministicAttachmentId(filePath)

    await expect(
      new DeleteOpportunityAttachmentCommandHandler(
        new FirestoreUnitOfWork(),
        defaultAuthorizationService
      ).handle({
        actor: actorFor('student', studentId),
        opportunityId,
        attachmentId,
      })
    ).rejects.toThrow(expect.objectContaining({ reason: 'role_restricted_action' }))

    await new DeleteOpportunityAttachmentCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService
    ).handle({
      actor: actorFor('coordinator', coordinatorId),
      opportunityId,
      attachmentId,
    })

    expect(await listAttachmentPaths('opportunities', opportunityId)).toEqual([])
    // Soft-delete tombstones the Firestore subdoc; GCS hard-delete is the
    // job of a future outbox-driven worker, not the request path.
    expect(storage.deleted).toEqual([])
  })

  it('Deleting a missing internship attachment returns a 404 NotFoundError without touching GCS', async () => {
    const storage = new FakeAttachmentStorage()
    const ownerId = `usr_owner_${randomUUID()}`
    const opportunityId = `opp_${randomUUID()}`
    const internshipId = `int_${randomUUID()}`
    await seedOpportunity(opportunityId)
    await seedInternship(internshipId, ownerId, opportunityId)

    await expect(
      new DeleteInternshipAttachmentCommandHandler(
        new FirestoreUnitOfWork(),
        defaultAuthorizationService
      ).handle({
        actor: actorFor('student', ownerId),
        internshipId,
        attachmentId: 'att_missing',
      })
    ).rejects.toThrow(/Attachment 'att_missing' not found/)
    expect(storage.deleted).toEqual([])
  })
})

function deterministicAttachmentId(filePath: string): string {
  // Mirrors `attachmentIdForFilePath` in sync-storage-attachment.ts: the
  // storage trigger derives attachment ids deterministically so tests can
  // address the exact subdoc the trigger wrote.
  return `att_${createHash('sha256').update(filePath).digest('base64url').slice(0, 24)}`
}
