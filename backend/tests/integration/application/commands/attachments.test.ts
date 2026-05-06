import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { SyncStorageAttachmentCommandHandler } from '../../../../src/application/commands/sync-storage-attachment'
import { GetOpportunityAttachmentQueryHandler } from '../../../../src/application/queries/get-opportunity-attachment'
import { SubmitInternshipOfferCommandHandler } from '../../../../src/application/commands/submit-internship-offer'
import type { AttachmentStorage } from '../../../../src/application/ports/attachment-storage'
import type { RequestActor } from '../../../../src/application/actor'
import { FirestoreUnitOfWork } from '../../../../src/infrastructure/firestore/firestore-unit-of-work'
import { firestoreIdGenerator } from '../../../../src/infrastructure/firestore/firestore-id-generator'
import { adminDb, Timestamp } from '../../../../src/infrastructure/config/firebase-admin'
import { User } from '../../../../src/domain/entities/user'
import { UserIdentity } from '../../../../src/domain/value-objects/user-identity'
import { StudentProfile } from '../../../../src/domain/value-objects/student-profile'
import { clearDocs, initEmulator, trackDoc } from '../../../setup.emulator'

class FakeAttachmentStorage implements AttachmentStorage {
  readonly deleted: string[] = []
  readonly signed: Array<{ filePath: string; expiresAt: Date }> = []

  async createReadUrl(filePath: string, expiresAt: Date): Promise<string> {
    this.signed.push({ filePath, expiresAt })
    return `https://storage.example.test/${encodeURIComponent(filePath)}?expires=${expiresAt.getTime()}`
  }

  async deleteObject(filePath: string): Promise<void> {
    this.deleted.push(filePath)
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
    await ctx.users.create(
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
  const snap = await adminDb
    .collection(parentCollection)
    .doc(parentId)
    .collection('attachments')
    .get()
  return snap.docs.map((doc) => doc.data()['filePath'] as string).sort()
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
    })

    expect(result).toEqual({ reflected: false, reason: 'invalid_path' })
    expect(storage.deleted).toEqual(['tickets/tkt_001/attachments/file.pdf'])
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
    })

    expect(result).toEqual({ reflected: false, reason: 'prefix_owner_mismatch' })
    expect(storage.deleted).toEqual([forgedPath])
    expect(await listAttachmentPaths('internships', internshipId)).toEqual([])
  })

  it('Internship re-submit replaces old attachment records and files', async () => {
    const storage = new FakeAttachmentStorage()
    const ownerId = `usr_owner_${randomUUID()}`
    const internshipId = `int_${randomUUID()}`
    const opportunityId = `opp_${randomUUID()}`
    await seedOpportunity(opportunityId)
    await seedInternship(internshipId, ownerId, opportunityId)
    await seedAttachment(
      'internships',
      internshipId,
      'att_old_a',
      `users/${ownerId}/internships/${internshipId}/attachments/old-a.pdf`
    )
    await seedAttachment(
      'internships',
      internshipId,
      'att_old_b',
      `users/${ownerId}/internships/${internshipId}/attachments/old-b.pdf`
    )

    const latestPath = `users/${ownerId}/internships/${internshipId}/attachments/latest.pdf`
    const result = await new SyncStorageAttachmentCommandHandler(
      new FirestoreUnitOfWork(),
      storage
    ).handle({
      filePath: latestPath,
      contentType: 'application/pdf',
      finalizedAt: new Date('2026-04-04T00:00:00Z'),
    })

    expect(result).toEqual({ reflected: true, reason: 'synced' })
    expect(await listAttachmentPaths('internships', internshipId)).toEqual([latestPath])
    expect(storage.deleted.sort()).toEqual([
      `users/${ownerId}/internships/${internshipId}/attachments/old-a.pdf`,
      `users/${ownerId}/internships/${internshipId}/attachments/old-b.pdf`,
    ])
  })

  it('Offer submission blocks until an attachment has been synced via the trigger', async () => {
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
      new FirestoreUnitOfWork(),
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
})
