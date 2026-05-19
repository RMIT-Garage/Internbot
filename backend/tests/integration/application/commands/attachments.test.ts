import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { CreateInternshipAttachmentUploadIntentCommandHandler } from '../../../../src/application/commands/create-internship-attachment-upload-intent'
import { CreateOpportunityAttachmentUploadIntentCommandHandler } from '../../../../src/application/commands/create-opportunity-attachment-upload-intent'
import { FinalizeStorageAttachmentCommandHandler } from '../../../../src/application/commands/finalize-storage-attachment'
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
  readonly uploads: Array<{ filePath: string; contentType: string; expiresAt: Date }> = []
  shouldThrowPreconditionFailed = false

  async createReadUrl(filePath: string, expiresAt: Date): Promise<string> {
    this.signed.push({ filePath, expiresAt })
    return `https://storage.example.test/${encodeURIComponent(filePath)}?expires=${expiresAt.getTime()}`
  }

  async createUploadUrl(filePath: string, contentType: string, expiresAt: Date): Promise<string> {
    this.uploads.push({ filePath, contentType, expiresAt })
    return `https://storage.example.test/upload/${encodeURIComponent(filePath)}?expires=${expiresAt.getTime()}`
  }

  async deleteObject(filePath: string): Promise<void> {
    if (this.shouldThrowPreconditionFailed) return
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

async function listAttachments(
  parentCollection: 'opportunities' | 'internships',
  parentId: string
): Promise<Array<{ id: string; filePath: string; uploadStatus: string }>> {
  const snap = await adminDb
    .collection(parentCollection)
    .doc(parentId)
    .collection('attachments')
    .get()
  return snap.docs.map((doc) => ({
    id: doc.id,
    filePath: doc.data()['filePath'] as string,
    uploadStatus: (doc.data()['uploadStatus'] as string) ?? 'finalized',
  }))
}

async function listPurgeQueueRows(
  parentCollection: 'opportunities' | 'internships',
  parentId: string,
  attachmentId: string
): Promise<Array<Record<string, unknown>>> {
  const snap = await adminDb
    .collection('attachmentPurgeQueue')
    .where('parentCollection', '==', parentCollection)
    .where('parentId', '==', parentId)
    .where('attachmentId', '==', attachmentId)
    .get()
  snap.docs.forEach((doc) => trackDoc('attachmentPurgeQueue', doc.id))
  return snap.docs.map((doc) => doc.data())
}

async function issueInternshipUploadIntent(
  storage: AttachmentStorage,
  actor: RequestActor,
  internshipId: string,
  fileName = 'offer.pdf'
): Promise<{ attachmentId: string; filePath: string }> {
  const result = await new CreateInternshipAttachmentUploadIntentCommandHandler(
    new FirestoreUnitOfWork(),
    defaultAuthorizationService,
    firestoreIdGenerator,
    storage
  ).handle({
    actor,
    internshipId,
    fileName,
    contentType: 'application/pdf',
  })
  return { attachmentId: result.attachmentId, filePath: result.filePath }
}

async function issueOpportunityUploadIntent(
  storage: AttachmentStorage,
  actor: RequestActor,
  opportunityId: string,
  fileName = 'jd.pdf'
): Promise<{ attachmentId: string; filePath: string }> {
  const result = await new CreateOpportunityAttachmentUploadIntentCommandHandler(
    new FirestoreUnitOfWork(),
    defaultAuthorizationService,
    firestoreIdGenerator,
    storage
  ).handle({
    actor,
    opportunityId,
    fileName,
    contentType: 'application/pdf',
  })
  return { attachmentId: result.attachmentId, filePath: result.filePath }
}

async function finalize(
  filePath: string,
  generation = '1700000000000000'
): Promise<ReturnType<FinalizeStorageAttachmentCommandHandler['handle']>> {
  return new FinalizeStorageAttachmentCommandHandler(new FirestoreUnitOfWork()).handle({
    filePath,
    finalizedAt: new Date('2026-04-04T00:00:00Z'),
    generation,
  })
}

describe('Attachments — integration', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
  })

  it('Intent pre-writes attachment subdoc in uploading state and mints a signed PUT URL', async () => {
    const storage = new FakeAttachmentStorage()
    const ownerId = `usr_owner_${randomUUID()}`
    const opportunityId = `opp_${randomUUID()}`
    const internshipId = `int_${randomUUID()}`
    await seedStudent(ownerId, `sem_${randomUUID()}`)
    await seedOpportunity(opportunityId)
    await seedInternship(internshipId, ownerId, opportunityId)

    const intent = await issueInternshipUploadIntent(
      storage,
      actorFor('student', ownerId),
      internshipId
    )

    const rows = await listAttachments('internships', internshipId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: intent.attachmentId, uploadStatus: 'uploading' })
    expect(storage.uploads).toHaveLength(1)
    expect(storage.uploads[0]!.filePath).toBe(intent.filePath)
  })

  it('Finalize transitions uploading → finalized and records the GCS generation', async () => {
    const storage = new FakeAttachmentStorage()
    const ownerId = `usr_owner_${randomUUID()}`
    const opportunityId = `opp_${randomUUID()}`
    const internshipId = `int_${randomUUID()}`
    await seedStudent(ownerId, `sem_${randomUUID()}`)
    await seedOpportunity(opportunityId)
    await seedInternship(internshipId, ownerId, opportunityId)
    const intent = await issueInternshipUploadIntent(
      storage,
      actorFor('student', ownerId),
      internshipId
    )

    const result = await finalize(intent.filePath, '1700000000000010')

    expect(result).toEqual({ finalized: true, reason: 'finalized' })
    const rows = await listAttachments('internships', internshipId)
    expect(rows[0]).toMatchObject({ uploadStatus: 'finalized' })
    const snap = await adminDb
      .collection('internships')
      .doc(internshipId)
      .collection('attachments')
      .doc(intent.attachmentId)
      .get()
    expect(snap.data()?.['storageGeneration']).toBe('1700000000000010')
  })

  it('Finalize is idempotent under event redelivery (second event is a no-op)', async () => {
    const storage = new FakeAttachmentStorage()
    const ownerId = `usr_owner_${randomUUID()}`
    const opportunityId = `opp_${randomUUID()}`
    const internshipId = `int_${randomUUID()}`
    await seedStudent(ownerId, `sem_${randomUUID()}`)
    await seedOpportunity(opportunityId)
    await seedInternship(internshipId, ownerId, opportunityId)
    const intent = await issueInternshipUploadIntent(
      storage,
      actorFor('student', ownerId),
      internshipId
    )

    await finalize(intent.filePath)
    const second = await finalize(intent.filePath)

    expect(second).toEqual({ finalized: false, reason: 'already_finalized' })
  })

  it('Finalize rejects an event whose path attachmentId is unknown', async () => {
    const ownerId = `usr_owner_${randomUUID()}`
    const opportunityId = `opp_${randomUUID()}`
    const internshipId = `int_${randomUUID()}`
    await seedStudent(ownerId, `sem_${randomUUID()}`)
    await seedOpportunity(opportunityId)
    await seedInternship(internshipId, ownerId, opportunityId)

    const stalePath = `users/${ownerId}/internships/${internshipId}/attachments/att_ghost-offer.pdf`
    const result = await finalize(stalePath)

    expect(result).toEqual({ finalized: false, reason: 'attachment_not_found' })
  })

  it('Finalize rejects an internship path whose user prefix is not the parent owner', async () => {
    const storage = new FakeAttachmentStorage()
    const ownerId = `usr_owner_${randomUUID()}`
    const opportunityId = `opp_${randomUUID()}`
    const internshipId = `int_${randomUUID()}`
    await seedStudent(ownerId, `sem_${randomUUID()}`)
    await seedOpportunity(opportunityId)
    await seedInternship(internshipId, ownerId, opportunityId)
    const intent = await issueInternshipUploadIntent(
      storage,
      actorFor('student', ownerId),
      internshipId
    )
    const tampered = intent.filePath.replace(`users/${ownerId}/`, 'users/usr_other/')

    const result = await finalize(tampered)

    expect(result).toEqual({ finalized: false, reason: 'prefix_owner_mismatch' })
  })

  it('Offer submission blocks until at least one attachment is finalized', async () => {
    const storage = new FakeAttachmentStorage()
    const ownerId = `usr_owner_${randomUUID()}`
    const semesterId = `sem_${randomUUID()}`
    const opportunityId = `opp_${randomUUID()}`
    const internshipId = `int_${randomUUID()}`
    await seedStudent(ownerId, semesterId)
    await seedOpportunity(opportunityId, { semesterId, status: 'published' })
    await seedInternship(internshipId, ownerId, opportunityId)
    const intent = await issueInternshipUploadIntent(
      storage,
      actorFor('student', ownerId),
      internshipId
    )

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

    await finalize(intent.filePath)

    await expect(
      submit.handle({ actor: actorFor('student', ownerId), internshipId, payload })
    ).resolves.toEqual({ id: internshipId })
  })

  it('Signed download URL is minted only after the attachment is finalized', async () => {
    const storage = new FakeAttachmentStorage()
    const coordinatorId = `usr_coord_${randomUUID()}`
    const studentId = `usr_student_${randomUUID()}`
    const semesterId = `sem_${randomUUID()}`
    const opportunityId = `opp_${randomUUID()}`
    await seedStudent(studentId, semesterId)
    await seedOpportunity(opportunityId, { semesterId, status: 'published' })
    const intent = await issueOpportunityUploadIntent(
      storage,
      actorFor('coordinator', coordinatorId),
      opportunityId
    )

    const fixedNow = new Date('2026-04-05T00:00:00Z')
    const query = new GetOpportunityAttachmentQueryHandler(
      firestoreOpportunityQueryService,
      firestoreUserQueryService,
      defaultAuthorizationService,
      storage,
      { ttlMs: 5_000, now: () => fixedNow }
    )

    await expect(
      query.handle({
        actor: actorFor('student', studentId),
        opportunityId,
        attachmentId: intent.attachmentId,
      })
    ).rejects.toThrow(/not found/)

    await finalize(intent.filePath)

    const result = await query.handle({
      actor: actorFor('student', studentId),
      opportunityId,
      attachmentId: intent.attachmentId,
    })
    expect(result.downloadUrlExpiresAt.toISOString()).toBe('2026-04-05T00:00:05.000Z')
    expect(storage.signed).toHaveLength(1)
  })

  it('Owner can delete a finalized internship attachment; subdoc is removed and a purge-queue row is enqueued', async () => {
    const storage = new FakeAttachmentStorage()
    const ownerId = `usr_owner_${randomUUID()}`
    const opportunityId = `opp_${randomUUID()}`
    const internshipId = `int_${randomUUID()}`
    await seedStudent(ownerId, `sem_${randomUUID()}`)
    await seedOpportunity(opportunityId)
    await seedInternship(internshipId, ownerId, opportunityId)
    const intent = await issueInternshipUploadIntent(
      storage,
      actorFor('student', ownerId),
      internshipId
    )
    await finalize(intent.filePath, '1700000000001000')

    await new DeleteInternshipAttachmentCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService
    ).handle({
      actor: actorFor('student', ownerId),
      internshipId,
      attachmentId: intent.attachmentId,
    })

    expect(await listAttachments('internships', internshipId)).toEqual([])
    expect(storage.deleted).toEqual([])
    const purgeRows = await listPurgeQueueRows('internships', internshipId, intent.attachmentId)
    expect(purgeRows).toHaveLength(1)
    expect(purgeRows[0]).toMatchObject({
      parentCollection: 'internships',
      parentId: internshipId,
      attachmentId: intent.attachmentId,
      filePath: intent.filePath,
      storageGeneration: '1700000000001000',
      requestedByUserId: ownerId,
      status: 'pending',
    })
  })

  it('Non-owner student cannot delete another student internship attachment', async () => {
    const storage = new FakeAttachmentStorage()
    const ownerId = `usr_owner_${randomUUID()}`
    const intruderId = `usr_other_${randomUUID()}`
    const opportunityId = `opp_${randomUUID()}`
    const internshipId = `int_${randomUUID()}`
    await seedStudent(ownerId, `sem_${randomUUID()}`)
    await seedOpportunity(opportunityId)
    await seedInternship(internshipId, ownerId, opportunityId)
    const intent = await issueInternshipUploadIntent(
      storage,
      actorFor('student', ownerId),
      internshipId
    )
    await finalize(intent.filePath, '1700000000002000')

    await expect(
      new DeleteInternshipAttachmentCommandHandler(
        new FirestoreUnitOfWork(),
        defaultAuthorizationService
      ).handle({
        actor: actorFor('student', intruderId),
        internshipId,
        attachmentId: intent.attachmentId,
      })
    ).rejects.toThrow(expect.objectContaining({ reason: 'student_not_owner' }))

    expect((await listAttachments('internships', internshipId))[0]).toMatchObject({
      id: intent.attachmentId,
    })
    expect(storage.deleted).toEqual([])
  })

  it('Attachment delete is blocked once the offer is under review', async () => {
    const storage = new FakeAttachmentStorage()
    const ownerId = `usr_owner_${randomUUID()}`
    const opportunityId = `opp_${randomUUID()}`
    const internshipId = `int_${randomUUID()}`
    await seedStudent(ownerId, `sem_${randomUUID()}`)
    await seedOpportunity(opportunityId)
    await seedInternship(internshipId, ownerId, opportunityId)
    const intent = await issueInternshipUploadIntent(
      storage,
      actorFor('student', ownerId),
      internshipId
    )
    await finalize(intent.filePath, '1700000000003000')
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
        attachmentId: intent.attachmentId,
      })
    ).rejects.toThrow(expect.objectContaining({ reason: 'attachment_locked_in_status' }))
  })

  it('Coordinator can delete an opportunity attachment; student attempt is rejected', async () => {
    const storage = new FakeAttachmentStorage()
    const coordinatorId = `usr_coord_${randomUUID()}`
    const studentId = `usr_student_${randomUUID()}`
    const semesterId = `sem_${randomUUID()}`
    const opportunityId = `opp_${randomUUID()}`
    await seedStudent(studentId, semesterId)
    await seedOpportunity(opportunityId, { semesterId, status: 'published' })
    const intent = await issueOpportunityUploadIntent(
      storage,
      actorFor('coordinator', coordinatorId),
      opportunityId
    )
    await finalize(intent.filePath, '1700000000005000')

    await expect(
      new DeleteOpportunityAttachmentCommandHandler(
        new FirestoreUnitOfWork(),
        defaultAuthorizationService
      ).handle({
        actor: actorFor('student', studentId),
        opportunityId,
        attachmentId: intent.attachmentId,
      })
    ).rejects.toThrow(expect.objectContaining({ reason: 'role_restricted_action' }))

    await new DeleteOpportunityAttachmentCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService
    ).handle({
      actor: actorFor('coordinator', coordinatorId),
      opportunityId,
      attachmentId: intent.attachmentId,
    })

    expect(await listAttachments('opportunities', opportunityId)).toEqual([])
    expect(storage.deleted).toEqual([])
    const purgeRows = await listPurgeQueueRows('opportunities', opportunityId, intent.attachmentId)
    expect(purgeRows).toHaveLength(1)
    expect(purgeRows[0]).toMatchObject({
      parentCollection: 'opportunities',
      parentId: opportunityId,
      attachmentId: intent.attachmentId,
      filePath: intent.filePath,
      requestedByUserId: coordinatorId,
      status: 'pending',
    })
  })

  it('Deleting a missing internship attachment returns NotFoundError', async () => {
    const ownerId = `usr_owner_${randomUUID()}`
    const opportunityId = `opp_${randomUUID()}`
    const internshipId = `int_${randomUUID()}`
    await seedStudent(ownerId, `sem_${randomUUID()}`)
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
  })
})
