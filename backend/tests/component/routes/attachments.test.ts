/**
 * Component — attachment download routes + Phase 10 route-visible outcomes.
 *
 * One `it(...)` per route-facing Phase 10 Success/Bug bullet. Storage-trigger
 * internals that are not HTTP-visible are covered in integration tests.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { randomUUID } from 'node:crypto'
import { createApp } from '../../../src/api/app'
import { FinalizeStorageAttachmentCommandHandler } from '../../../src/application/commands/finalize-storage-attachment'
import { FirestoreUnitOfWork } from '../../../src/infrastructure/firestore/firestore-unit-of-work'
import { adminDb, Timestamp } from '../../../src/infrastructure/config/firebase-admin'
import { User } from '../../../src/domain/entities/user'
import { UserIdentity } from '../../../src/domain/value-objects/user-identity'
import { StudentProfile } from '../../../src/domain/value-objects/student-profile'
import {
  clearAuthUsers,
  clearDocs,
  initEmulator,
  mintEmulatorIdToken,
  trackDoc,
} from '../../setup.emulator'

type TestUser = {
  firebaseUid: string
  email: string
  platformUserId: string
  idToken: string
}

async function provisionUser(
  role: 'student' | 'coordinator',
  email: string,
  platformUserId: string,
  firebaseUid: string,
  semesterId?: string
): Promise<void> {
  const now = new Date()
  await new FirestoreUnitOfWork().execute(async (ctx) => {
    await ctx.users.save(
      User.create({
        id: platformUserId,
        version: 0,
        email,
        role,
        status: 'active',
        onboardingStage: 'profile_complete',
        identity: UserIdentity.create({
          provider: 'firebase',
          providerUserId: firebaseUid,
          emailSnapshot: email,
        }),
        createdAt: now,
        updatedAt: now,
        displayName: undefined,
        studentProfile:
          role === 'student'
            ? StudentProfile.rehydrate({
                studentNumber: `s${randomUUID().slice(0, 8)}`,
                profileStatus: 'complete',
                programCode: 'BP096',
                phone: undefined,
                academicInfo: undefined,
                semesterId,
                semesterSelectedAt: semesterId ? now : undefined,
              })
            : undefined,
      })
    )
  })
  trackDoc('users', platformUserId)
}

async function makeStudent(semesterId?: string): Promise<TestUser> {
  const firebaseUid = `fb_${randomUUID()}`
  const email = `student_${randomUUID().slice(0, 6)}@student.rmit.edu.au`
  const platformUserId = `usr_student_${randomUUID()}`
  const idToken = await mintEmulatorIdToken(firebaseUid, email)
  await provisionUser('student', email, platformUserId, firebaseUid, semesterId)
  return { firebaseUid, email, platformUserId, idToken }
}

async function makeCoordinator(): Promise<TestUser> {
  const firebaseUid = `fb_${randomUUID()}`
  const email = `coord_${randomUUID().slice(0, 6)}@rmit.edu.au`
  const platformUserId = `usr_coord_${randomUUID()}`
  const idToken = await mintEmulatorIdToken(firebaseUid, email)
  await provisionUser('coordinator', email, platformUserId, firebaseUid)
  return { firebaseUid, email, platformUserId, idToken }
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
  filePath: string,
  uploadStatus: 'uploading' | 'finalized' = 'finalized'
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
      uploadStatus,
      _schemaVersion: 1,
    })
}

async function issueIntent(
  app: ReturnType<typeof createApp>,
  scope: 'internships' | 'opportunities',
  parentId: string,
  idToken: string,
  fileName: string
): Promise<{ attachmentId: string; filePath: string; uploadUrl: string }> {
  const res = await request(app)
    .post(`/api/v1/${scope}/${parentId}/attachments/upload-intents`)
    .set('Authorization', `Bearer ${idToken}`)
    .send({ fileName, contentType: 'application/pdf' })
  expect(res.status).toBe(201)
  return res.body
}

async function finalize(filePath: string, generation = '1700000000000001'): Promise<void> {
  await new FinalizeStorageAttachmentCommandHandler(new FirestoreUnitOfWork()).handle({
    filePath,
    finalizedAt: new Date('2026-04-04T00:00:00Z'),
    generation,
  })
}

const offerBody = {
  offerDate: '2026-05-01T00:00:00.000Z',
  startDate: '2026-06-01T00:00:00.000Z',
  endDate: '2026-07-01T00:00:00.000Z',
}

describe('/api/v1 attachments — component', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
    await clearAuthUsers()
  })

  it('Intent endpoint pre-writes attachment in uploading state and returns a signed PUT URL', async () => {
    const semesterId = `sem_${randomUUID()}`
    const student = await makeStudent(semesterId)
    const opportunityId = `opp_${randomUUID()}`
    const internshipId = `int_${randomUUID()}`
    await seedOpportunity(opportunityId, { semesterId, status: 'published' })
    await seedInternship(internshipId, student.platformUserId, opportunityId)
    const app = createApp()

    const intent = await issueIntent(app, 'internships', internshipId, student.idToken, 'offer.pdf')

    expect(intent.uploadUrl).toContain(encodeURIComponent(intent.filePath))
    const snap = await adminDb
      .collection('internships')
      .doc(internshipId)
      .collection('attachments')
      .doc(intent.attachmentId)
      .get()
    expect(snap.data()?.['uploadStatus']).toBe('uploading')
  })

  it('GET on a finalized attachment returns metadata + downloadUrl; uploading attachment returns 404', async () => {
    const semesterId = `sem_${randomUUID()}`
    const student = await makeStudent(semesterId)
    const opportunityId = `opp_${randomUUID()}`
    const attachmentId = 'att_001'
    const filePath = `opportunities/${opportunityId}/attachments/${attachmentId}-position.pdf`
    await seedOpportunity(opportunityId, { semesterId, status: 'published' })
    await seedAttachment('opportunities', opportunityId, attachmentId, filePath, 'uploading')
    const app = createApp()

    const uploading = await request(app)
      .get(`/api/v1/opportunities/${opportunityId}/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${student.idToken}`)
    expect(uploading.status).toBe(404)

    await adminDb
      .collection('opportunities')
      .doc(opportunityId)
      .collection('attachments')
      .doc(attachmentId)
      .update({ uploadStatus: 'finalized' })

    const finalized = await request(app)
      .get(`/api/v1/opportunities/${opportunityId}/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${student.idToken}`)
    expect(finalized.status).toBe(200)
    expect(finalized.body.downloadUrl).toContain(encodeURIComponent(filePath))
  })

  it('Student cannot GET an attachment on an unpublished or other-semester opportunity', async () => {
    const semesterId = `sem_${randomUUID()}`
    const otherSemesterId = `sem_${randomUUID()}`
    const student = await makeStudent(semesterId)
    const draftId = `opp_${randomUUID()}`
    const otherSemesterIdOpportunity = `opp_${randomUUID()}`
    await seedOpportunity(draftId, { semesterId, status: 'draft' })
    await seedOpportunity(otherSemesterIdOpportunity, {
      semesterId: otherSemesterId,
      status: 'published',
    })
    await seedAttachment(
      'opportunities',
      draftId,
      'att_draft',
      `opportunities/${draftId}/attachments/att_draft-position.pdf`
    )
    await seedAttachment(
      'opportunities',
      otherSemesterIdOpportunity,
      'att_other',
      `opportunities/${otherSemesterIdOpportunity}/attachments/att_other-position.pdf`
    )

    const app = createApp()
    const draft = await request(app)
      .get(`/api/v1/opportunities/${draftId}/attachments/att_draft`)
      .set('Authorization', `Bearer ${student.idToken}`)
    const other = await request(app)
      .get(`/api/v1/opportunities/${otherSemesterIdOpportunity}/attachments/att_other`)
      .set('Authorization', `Bearer ${student.idToken}`)

    expect(draft.status).toBe(403)
    expect(other.status).toBe(403)
    expect(draft.body.error.reason).toBe('opportunity_not_visible')
  })

  it("Student cannot GET another student's internship attachment", async () => {
    const semesterId = `sem_${randomUUID()}`
    const owner = await makeStudent(semesterId)
    const other = await makeStudent(semesterId)
    const opportunityId = `opp_${randomUUID()}`
    const internshipId = `int_${randomUUID()}`
    await seedOpportunity(opportunityId, { semesterId, status: 'published' })
    await seedInternship(internshipId, owner.platformUserId, opportunityId)
    await seedAttachment(
      'internships',
      internshipId,
      'att_offer',
      `users/${owner.platformUserId}/internships/${internshipId}/attachments/att_offer-letter.pdf`
    )

    const res = await request(createApp())
      .get(`/api/v1/internships/${internshipId}/attachments/att_offer`)
      .set('Authorization', `Bearer ${other.idToken}`)

    expect(res.status).toBe(403)
    expect(res.body.error.reason).toBe('student_not_owner')
  })

  it('GET for a non-existent attachment id returns 404', async () => {
    const semesterId = `sem_${randomUUID()}`
    const student = await makeStudent(semesterId)
    const opportunityId = `opp_${randomUUID()}`
    await seedOpportunity(opportunityId, { semesterId, status: 'published' })

    const res = await request(createApp())
      .get(`/api/v1/opportunities/${opportunityId}/attachments/att_missing`)
      .set('Authorization', `Bearer ${student.idToken}`)

    expect(res.status).toBe(404)
  })

  it('Offer submission returns 422 until at least one attachment is finalized by the storage trigger', async () => {
    const semesterId = `sem_${randomUUID()}`
    const student = await makeStudent(semesterId)
    const opportunityId = `opp_${randomUUID()}`
    const internshipId = `int_${randomUUID()}`
    await seedOpportunity(opportunityId, { semesterId, status: 'published' })
    await seedInternship(internshipId, student.platformUserId, opportunityId)
    const app = createApp()
    const intent = await issueIntent(app, 'internships', internshipId, student.idToken, 'offer.pdf')

    const stillUploading = await request(app)
      .post(`/api/v1/internships/${internshipId}/offer-submissions`)
      .set('Authorization', `Bearer ${student.idToken}`)
      .send(offerBody)

    await finalize(intent.filePath)

    const submitted = await request(app)
      .post(`/api/v1/internships/${internshipId}/offer-submissions`)
      .set('Authorization', `Bearer ${student.idToken}`)
      .send(offerBody)

    expect(stillUploading.status).toBe(422)
    expect(stillUploading.body.error.reason).toBe('offer_attachment_missing')
    expect(submitted.status).toBe(201)
    expect(submitted.body.attachments).toHaveLength(1)
    expect(submitted.body.attachments[0]).toMatchObject({ uploadStatus: 'finalized' })
  })

  it('Owner can DELETE an internship attachment while applied; backend then returns 404 on a follow-up GET', async () => {
    const semesterId = `sem_${randomUUID()}`
    const student = await makeStudent(semesterId)
    const opportunityId = `opp_${randomUUID()}`
    const internshipId = `int_${randomUUID()}`
    const attachmentId = 'att_offer'
    const filePath = `users/${student.platformUserId}/internships/${internshipId}/attachments/${attachmentId}-letter.pdf`
    await seedOpportunity(opportunityId, { semesterId, status: 'published' })
    await seedInternship(internshipId, student.platformUserId, opportunityId)
    await seedAttachment('internships', internshipId, attachmentId, filePath)
    const app = createApp()

    const deleted = await request(app)
      .delete(`/api/v1/internships/${internshipId}/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${student.idToken}`)
    const fetched = await request(app)
      .get(`/api/v1/internships/${internshipId}/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${student.idToken}`)

    expect(deleted.status).toBe(204)
    expect(fetched.status).toBe(404)
  })

  it("Non-owner student cannot DELETE another student's internship attachment", async () => {
    const semesterId = `sem_${randomUUID()}`
    const owner = await makeStudent(semesterId)
    const intruder = await makeStudent(semesterId)
    const opportunityId = `opp_${randomUUID()}`
    const internshipId = `int_${randomUUID()}`
    const attachmentId = 'att_offer'
    const filePath = `users/${owner.platformUserId}/internships/${internshipId}/attachments/${attachmentId}-letter.pdf`
    await seedOpportunity(opportunityId, { semesterId, status: 'published' })
    await seedInternship(internshipId, owner.platformUserId, opportunityId)
    await seedAttachment('internships', internshipId, attachmentId, filePath)

    const res = await request(createApp())
      .delete(`/api/v1/internships/${internshipId}/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${intruder.idToken}`)

    expect(res.status).toBe(403)
    expect(res.body.error.reason).toBe('student_not_owner')
  })

  it('Coordinator can DELETE an opportunity attachment; student attempt returns 403', async () => {
    const semesterId = `sem_${randomUUID()}`
    const coordinator = await makeCoordinator()
    const student = await makeStudent(semesterId)
    const opportunityId = `opp_${randomUUID()}`
    const attachmentId = 'att_jd'
    const filePath = `opportunities/${opportunityId}/attachments/${attachmentId}-position.pdf`
    await seedOpportunity(opportunityId, { semesterId, status: 'published' })
    await seedAttachment('opportunities', opportunityId, attachmentId, filePath)
    const app = createApp()

    const studentAttempt = await request(app)
      .delete(`/api/v1/opportunities/${opportunityId}/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${student.idToken}`)
    const coordinatorDelete = await request(app)
      .delete(`/api/v1/opportunities/${opportunityId}/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)

    expect(studentAttempt.status).toBe(403)
    expect(studentAttempt.body.error.reason).toBe('role_restricted_action')
    expect(coordinatorDelete.status).toBe(204)
  })

  it('Coordinator cannot write attachments directly because v1 exposes no POST or PUT attachment route', async () => {
    const coordinator = await makeCoordinator()
    const opportunityId = `opp_${randomUUID()}`
    const internshipId = `int_${randomUUID()}`
    const app = createApp()

    const opportunityPost = await request(app)
      .post(`/api/v1/opportunities/${opportunityId}/attachments/att_001`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send({ fileName: 'position.pdf' })
    const internshipPut = await request(app)
      .put(`/api/v1/internships/${internshipId}/attachments/att_001`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send({ fileName: 'offer.pdf' })

    expect(opportunityPost.status).toBe(404)
    expect(internshipPut.status).toBe(404)
  })
})
