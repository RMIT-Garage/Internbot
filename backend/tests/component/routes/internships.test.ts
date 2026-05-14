/**
 * Component — `/api/v1/internships` routes.
 *
 * One `it(...)` per bullet in Phase 5/6 Success criteria + Bug-finding cases
 * in WORKFLOW-API-IMPLEMENTATION-PLAN.md.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { randomUUID } from 'node:crypto'
import { createApp } from '../../../src/api/app'
import { CreateSemesterCommandHandler } from '../../../src/application/commands/create-semester'
import { TransitionSemesterCommandHandler } from '../../../src/application/commands/transition-semester'
import { FirestoreUnitOfWork } from '../../../src/infrastructure/firestore/firestore-unit-of-work'
import { firestoreIdGenerator } from '../../../src/infrastructure/firestore/firestore-id-generator'
import { defaultAuthorizationService } from '../../../src/infrastructure/authorization/default-authorization-service'
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

async function makeCoordinator() {
  const firebaseUid = `fb_${randomUUID()}`
  const email = `coord_${randomUUID().slice(0, 6)}@rmit.edu.au`
  const platformUserId = `usr_coord_${randomUUID()}`
  const idToken = await mintEmulatorIdToken(firebaseUid, email)
  await provisionUser('coordinator', email, platformUserId, firebaseUid)
  return { firebaseUid, email, platformUserId, idToken }
}

async function makeStudent(semesterId?: string) {
  const firebaseUid = `fb_${randomUUID()}`
  const email = `student_${randomUUID().slice(0, 6)}@student.rmit.edu.au`
  const platformUserId = `usr_student_${randomUUID()}`
  const idToken = await mintEmulatorIdToken(firebaseUid, email)
  await provisionUser('student', email, platformUserId, firebaseUid, semesterId)
  return { firebaseUid, email, platformUserId, idToken }
}

async function createActiveSemester(): Promise<string> {
  const uow = new FirestoreUnitOfWork()
  const create = new CreateSemesterCommandHandler(
    uow,
    defaultAuthorizationService,
    firestoreIdGenerator
  )
  const transition = new TransitionSemesterCommandHandler(uow, defaultAuthorizationService)
  const actor = {
    firebaseUid: `fb_${randomUUID()}`,
    email: 'coord@rmit.edu.au',
    platformUser: { id: `usr_coord_${randomUUID()}`, role: 'coordinator' as const },
  }
  const { id } = await create.handle({
    actor,
    payload: {
      semesterCode: `2026-S${randomUUID()
        .slice(0, 8)
        .replace(/[^A-Za-z0-9]/g, 'a')}`,
      courseCode: `INTE${Math.floor(Math.random() * 9000 + 1000)}`,
      displayName: 'Semester',
      status: 'draft',
      enrolmentOpenAt: undefined,
      enrolmentCloseAt: undefined,
    },
  })
  trackDoc('semesters', id)
  await transition.handle({ actor, semesterId: id, to: 'active', comment: undefined })
  return id
}

function opportunityBody(semesterId: string, overrides: Record<string, unknown> = {}) {
  return {
    semesterId,
    type: 'pre_approved',
    employerName: 'Example Pty Ltd',
    jobTitle: 'Software Intern',
    descriptionText: 'Build internal tools',
    workMode: 'hybrid',
    location: 'Melbourne',
    sourceUrl: 'https://careerhub.rmit.edu.au/jobs/123',
    ...overrides,
  }
}

async function createOpportunity(
  app: ReturnType<typeof createApp>,
  token: string,
  semesterId: string
): Promise<{ id: string; etag: string }> {
  const res = await request(app)
    .post('/api/v1/opportunities')
    .set('Authorization', `Bearer ${token}`)
    .send(opportunityBody(semesterId))
  expect(res.status).toBe(201)
  trackDoc('opportunities', res.body.id)
  return { id: res.body.id, etag: res.headers['etag'] as string }
}

async function publishOpportunity(
  app: ReturnType<typeof createApp>,
  token: string,
  id: string
): Promise<void> {
  const res = await request(app)
    .post(`/api/v1/opportunities/${id}/transitions`)
    .set('Authorization', `Bearer ${token}`)
    .send({ to: 'published' })
  expect(res.status).toBe(201)
}

async function createPublishedOpportunity(
  app: ReturnType<typeof createApp>,
  coordinatorToken: string,
  semesterId: string
): Promise<string> {
  const opportunity = await createOpportunity(app, coordinatorToken, semesterId)
  await publishOpportunity(app, coordinatorToken, opportunity.id)
  return opportunity.id
}

async function applyToOpportunity(
  app: ReturnType<typeof createApp>,
  studentToken: string,
  opportunityId: string
): Promise<{ id: string; etag: string }> {
  const res = await request(app)
    .post('/api/v1/internships')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({ opportunityId })
  expect(res.status).toBe(201)
  trackDoc('internships', res.body.id)
  return { id: res.body.id, etag: res.headers['etag'] as string }
}

async function addAttachment(internshipId: string): Promise<void> {
  await adminDb
    .collection('internships')
    .doc(internshipId)
    .collection('attachments')
    .doc(`att_${randomUUID()}`)
    .set({
      filePath: `users/usr_student/internships/${internshipId}/attachments/offer.pdf`,
      fileName: 'offer.pdf',
      contentType: 'application/pdf',
      uploadedAt: Timestamp.fromDate(new Date()),
      _schemaVersion: 1,
    })
}

const offerBody = {
  offerDate: '2026-05-01T00:00:00.000Z',
  startDate: '2026-06-01T00:00:00.000Z',
  endDate: '2026-07-01T00:00:00.000Z',
}

async function submitOfferForReview(
  app: ReturnType<typeof createApp>,
  studentToken: string,
  internshipId: string,
  ifMatch: string
): Promise<{ etag: string }> {
  await addAttachment(internshipId)
  const res = await request(app)
    .post(`/api/v1/internships/${internshipId}/offer-submissions`)
    .set('Authorization', `Bearer ${studentToken}`)
    .set('If-Match', ifMatch)
    .send(offerBody)
  expect(res.status).toBe(201)
  return { etag: res.headers['etag'] as string }
}

async function setupReviewableInternship(app: ReturnType<typeof createApp>) {
  const coordinator = await makeCoordinator()
  const semesterId = await createActiveSemester()
  const student = await makeStudent(semesterId)
  const opportunityId = await createPublishedOpportunity(app, coordinator.idToken, semesterId)
  const internship = await applyToOpportunity(app, student.idToken, opportunityId)
  const submitted = await submitOfferForReview(app, student.idToken, internship.id, internship.etag)
  return { coordinator, student, internship: { id: internship.id, etag: submitted.etag } }
}

describe('/api/v1/internships — component', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
    await clearAuthUsers()
  })

  it('student POST with published opportunity in their semester → 201 applied + activity + coordinator notification', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const semesterId = await createActiveSemester()
    const student = await makeStudent(semesterId)
    const opportunityId = await createPublishedOpportunity(app, coordinator.idToken, semesterId)

    const res = await request(app)
      .post('/api/v1/internships')
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({ opportunityId })

    expect(res.status).toBe(201)
    trackDoc('internships', res.body.id)
    expect(res.headers['location']).toBe(`/api/v1/internships/${res.body.id}`)
    expect(res.headers['etag']).toBe('W/"1"')
    expect(res.body.status).toBe('applied')
    expect(res.body.version).toBe(1)
    expect(res.body.attachmentUploadPathPrefix).toBe(
      `users/${student.platformUserId}/internships/${res.body.id}/attachments/`
    )

    const [activity, notifications] = await Promise.all([
      adminDb.collection('internships').doc(res.body.id).collection('activity').get(),
      adminDb.collection('notifications').where('relatedInternshipId', '==', res.body.id).get(),
    ])
    expect(activity.docs.map((doc) => doc.data()['type'])).toContain('apply')
    expect(
      notifications.docs.some((doc) => doc.data()['userId'] === coordinator.platformUserId)
    ).toBe(true)
  })

  it('student POST duplicate application for same opportunity → 409 duplicate_application', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const semesterId = await createActiveSemester()
    const student = await makeStudent(semesterId)
    const opportunityId = await createPublishedOpportunity(app, coordinator.idToken, semesterId)
    await applyToOpportunity(app, student.idToken, opportunityId)

    const res = await request(app)
      .post('/api/v1/internships')
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({ opportunityId })

    expect(res.status).toBe(409)
    expect(res.body.error.reason).toBe('duplicate_application')
  })

  it('student POST for unpublished opportunity → 409 opportunity_not_published', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const semesterId = await createActiveSemester()
    const student = await makeStudent(semesterId)
    const opportunity = await createOpportunity(app, coordinator.idToken, semesterId)

    const res = await request(app)
      .post('/api/v1/internships')
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({ opportunityId: opportunity.id })

    expect(res.status).toBe(409)
    expect(res.body.error.reason).toBe('opportunity_not_published')
  })

  it('student POST without selected semester → 409 student_has_no_selected_semester', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const semesterId = await createActiveSemester()
    const student = await makeStudent()
    const opportunityId = await createPublishedOpportunity(app, coordinator.idToken, semesterId)

    const res = await request(app)
      .post('/api/v1/internships')
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({ opportunityId })

    expect(res.status).toBe(409)
    expect(res.body.error.reason).toBe('student_has_no_selected_semester')
  })

  it('coordinator POST → 403 role_restricted_action', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const semesterId = await createActiveSemester()
    const opportunityId = await createPublishedOpportunity(app, coordinator.idToken, semesterId)

    const res = await request(app)
      .post('/api/v1/internships')
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send({ opportunityId })

    expect(res.status).toBe(403)
    expect(res.body.error.reason).toBe('role_restricted_action')
  })

  it('POST /:id/offer-submissions without any attachment → 422 offer_attachment_missing', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const semesterId = await createActiveSemester()
    const student = await makeStudent(semesterId)
    const opportunityId = await createPublishedOpportunity(app, coordinator.idToken, semesterId)
    const internship = await applyToOpportunity(app, student.idToken, opportunityId)

    const res = await request(app)
      .post(`/api/v1/internships/${internship.id}/offer-submissions`)
      .set('Authorization', `Bearer ${student.idToken}`)
      .send(offerBody)

    expect(res.status).toBe(422)
    expect(res.body.error.reason).toBe('offer_attachment_missing')
  })

  it('POST /:id/offer-submissions in non-applied/changes state → 409 invalid_state_transition', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const semesterId = await createActiveSemester()
    const student = await makeStudent(semesterId)
    const opportunityId = await createPublishedOpportunity(app, coordinator.idToken, semesterId)
    const internship = await applyToOpportunity(app, student.idToken, opportunityId)
    await addAttachment(internship.id)
    const first = await request(app)
      .post(`/api/v1/internships/${internship.id}/offer-submissions`)
      .set('Authorization', `Bearer ${student.idToken}`)
      .send(offerBody)
    expect(first.status).toBe(201)

    const res = await request(app)
      .post(`/api/v1/internships/${internship.id}/offer-submissions`)
      .set('Authorization', `Bearer ${student.idToken}`)
      .send(offerBody)

    expect(res.status).toBe(409)
    expect(res.body.error.reason).toBe('invalid_state_transition')
  })

  it('POST /:id/offer-submissions valid → 201 pending review + lastSubmittedAt + activity', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const semesterId = await createActiveSemester()
    const student = await makeStudent(semesterId)
    const opportunityId = await createPublishedOpportunity(app, coordinator.idToken, semesterId)
    const internship = await applyToOpportunity(app, student.idToken, opportunityId)
    await addAttachment(internship.id)

    const res = await request(app)
      .post(`/api/v1/internships/${internship.id}/offer-submissions`)
      .set('Authorization', `Bearer ${student.idToken}`)
      .set('If-Match', internship.etag)
      .send(offerBody)

    expect(res.status).toBe(201)
    expect(res.headers['location']).toBe(`/api/v1/internships/${internship.id}`)
    expect(res.headers['etag']).toBe('W/"2"')
    expect(res.body.status).toBe('offer_pending_review')
    expect(res.body.lastSubmittedAt).toBeTruthy()
    expect(res.body.offerDate).toBe(offerBody.offerDate)
    const activity = await adminDb
      .collection('internships')
      .doc(internship.id)
      .collection('activity')
      .get()
    expect(activity.docs.map((doc) => doc.data()['type'])).toContain('submit_offer')
  })

  it('PATCH /:id by coordinator → 405 with Allow: GET', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const semesterId = await createActiveSemester()
    const student = await makeStudent(semesterId)
    const opportunityId = await createPublishedOpportunity(app, coordinator.idToken, semesterId)
    const internship = await applyToOpportunity(app, student.idToken, opportunityId)

    const res = await request(app)
      .patch(`/api/v1/internships/${internship.id}`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send({ offerDate: offerBody.offerDate })

    expect(res.status).toBe(405)
    expect(res.headers['allow']).toBe('GET')
  })

  it('PATCH /:id in offer_approved or rejected → 409 internship_not_editable', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const semesterId = await createActiveSemester()
    const student = await makeStudent(semesterId)
    const opportunityId = await createPublishedOpportunity(app, coordinator.idToken, semesterId)
    const approved = await applyToOpportunity(app, student.idToken, opportunityId)
    await adminDb
      .collection('internships')
      .doc(approved.id)
      .update({
        status: 'offer_approved',
        version: 2,
        updatedAt: Timestamp.fromDate(new Date()),
      })

    const res = await request(app)
      .patch(`/api/v1/internships/${approved.id}`)
      .set('Authorization', `Bearer ${student.idToken}`)
      .set('If-Match', 'W/"2"')
      .send({ offerDate: offerBody.offerDate })

    expect(res.status).toBe(409)
    expect(res.body.error.reason).toBe('internship_not_editable')
  })

  it('POST /:id/comments by student owner or coordinator in terminal state → 201', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const semesterId = await createActiveSemester()
    const student = await makeStudent(semesterId)
    const opportunityId = await createPublishedOpportunity(app, coordinator.idToken, semesterId)
    const internship = await applyToOpportunity(app, student.idToken, opportunityId)
    await adminDb
      .collection('internships')
      .doc(internship.id)
      .update({
        status: 'rejected',
        version: 2,
        updatedAt: Timestamp.fromDate(new Date()),
      })

    const studentComment = await request(app)
      .post(`/api/v1/internships/${internship.id}/comments`)
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({ text: 'Thanks for the update.' })
    const coordComment = await request(app)
      .post(`/api/v1/internships/${internship.id}/comments`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send({ text: 'Happy to clarify.' })

    expect(studentComment.status).toBe(201)
    expect(coordComment.status).toBe(201)
    expect(coordComment.headers['location']).toMatch(
      new RegExp(`/api/v1/internships/${internship.id}/activity/`)
    )
  })

  it('POST /:id/comments empty text → 422 missing_required_field', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const semesterId = await createActiveSemester()
    const student = await makeStudent(semesterId)
    const opportunityId = await createPublishedOpportunity(app, coordinator.idToken, semesterId)
    const internship = await applyToOpportunity(app, student.idToken, opportunityId)

    const res = await request(app)
      .post(`/api/v1/internships/${internship.id}/comments`)
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({ text: ' ' })

    expect(res.status).toBe(422)
    expect(res.body.error.reason).toBe('missing_required_field')
  })

  it('denormalized opportunity fields appear on list and get responses', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const semesterId = await createActiveSemester()
    const student = await makeStudent(semesterId)
    const opportunityId = await createPublishedOpportunity(app, coordinator.idToken, semesterId)
    const internship = await applyToOpportunity(app, student.idToken, opportunityId)

    const [list, get] = await Promise.all([
      request(app).get('/api/v1/internships').set('Authorization', `Bearer ${student.idToken}`),
      request(app)
        .get(`/api/v1/internships/${internship.id}`)
        .set('Authorization', `Bearer ${student.idToken}`),
    ])

    expect(list.status).toBe(200)
    expect(get.status).toBe(200)
    expect(list.body.items[0].opportunityEmployerName).toBe('Example Pty Ltd')
    expect(list.body.items[0].opportunityJobTitle).toBe('Software Intern')
    expect(list.body.items[0].opportunityType).toBe('pre_approved')
    expect(list.body.items[0].opportunitySourceUrl).toBe('https://careerhub.rmit.edu.au/jobs/123')
    expect(get.body.studentProgramCode).toBe('BP096')
    expect(get.body.opportunityEmployerName).toBe('Example Pty Ltd')
  })

  it('resubmit path offer_changes_requested → offer_pending_review updates lastSubmittedAt and increments version', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const semesterId = await createActiveSemester()
    const student = await makeStudent(semesterId)
    const opportunityId = await createPublishedOpportunity(app, coordinator.idToken, semesterId)
    const internship = await applyToOpportunity(app, student.idToken, opportunityId)
    await addAttachment(internship.id)
    await adminDb
      .collection('internships')
      .doc(internship.id)
      .update({
        status: 'offer_changes_requested',
        version: 2,
        updatedAt: Timestamp.fromDate(new Date()),
      })

    const res = await request(app)
      .post(`/api/v1/internships/${internship.id}/offer-submissions`)
      .set('Authorization', `Bearer ${student.idToken}`)
      .set('If-Match', 'W/"2"')
      .send({ ...offerBody, endDate: null })

    expect(res.status).toBe(201)
    expect(res.headers['etag']).toBe('W/"3"')
    expect(res.body.status).toBe('offer_pending_review')
    expect(res.body.lastSubmittedAt).toBeTruthy()
    expect(res.body.endDate).toBeNull()
  })

  it("comments do NOT rotate the internship's ETag", async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const semesterId = await createActiveSemester()
    const student = await makeStudent(semesterId)
    const opportunityId = await createPublishedOpportunity(app, coordinator.idToken, semesterId)
    const internship = await applyToOpportunity(app, student.idToken, opportunityId)
    const before = await request(app)
      .get(`/api/v1/internships/${internship.id}`)
      .set('Authorization', `Bearer ${student.idToken}`)
    expect(before.status).toBe(200)

    const comment = await request(app)
      .post(`/api/v1/internships/${internship.id}/comments`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send({ text: 'Looks good.' })
    const after = await request(app)
      .get(`/api/v1/internships/${internship.id}`)
      .set('Authorization', `Bearer ${student.idToken}`)

    expect(comment.status).toBe(201)
    expect(after.headers['etag']).toBe(before.headers['etag'])
  })

  it("student cannot read another student's internship → 403 student_not_owner", async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const semesterId = await createActiveSemester()
    const owner = await makeStudent(semesterId)
    const other = await makeStudent(semesterId)
    const opportunityId = await createPublishedOpportunity(app, coordinator.idToken, semesterId)
    const internship = await applyToOpportunity(app, owner.idToken, opportunityId)

    const res = await request(app)
      .get(`/api/v1/internships/${internship.id}`)
      .set('Authorization', `Bearer ${other.idToken}`)

    expect(res.status).toBe(403)
    expect(res.body.error.reason).toBe('student_not_owner')
  })

  it('POST /:id/decisions approved from offer_pending_review → 201 approved + metadata + activity', async () => {
    const app = createApp()
    const { coordinator, student, internship } = await setupReviewableInternship(app)

    const res = await request(app)
      .post(`/api/v1/internships/${internship.id}/decisions`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .set('If-Match', internship.etag)
      .send({ decision: 'approved' })

    expect(res.status).toBe(201)
    expect(res.headers['location']).toBe(`/api/v1/internships/${internship.id}`)
    expect(res.headers['etag']).toBe('W/"3"')
    expect(res.body.status).toBe('offer_approved')
    expect(res.body.coordinatorDecision).toBe('approved')
    expect(res.body.reviewedByUserId).toBe(coordinator.platformUserId)
    expect(res.body.reviewedAt).toBeTruthy()

    const [doc, activity, notifications] = await Promise.all([
      adminDb.collection('internships').doc(internship.id).get(),
      adminDb.collection('internships').doc(internship.id).collection('activity').get(),
      adminDb.collection('notifications').where('relatedInternshipId', '==', internship.id).get(),
    ])
    expect(doc.data()?.['coordinatorDecision']).toBe('approved')
    expect(doc.data()?.['reviewedByUserId']).toBe(coordinator.platformUserId)
    expect(doc.data()?.['reviewedAt']).toBeDefined()
    expect(activity.docs.map((item) => item.data()['type'])).toContain('approve_offer')
    expect(
      notifications.docs.some(
        (item) =>
          item.data()['type'] === 'offer_decision' &&
          item.data()['userId'] === student.platformUserId
      )
    ).toBe(true)
  })

  it('POST /:id/decisions changes_requested without comment → 422', async () => {
    const app = createApp()
    const { coordinator, internship } = await setupReviewableInternship(app)

    const res = await request(app)
      .post(`/api/v1/internships/${internship.id}/decisions`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .set('If-Match', internship.etag)
      .send({ decision: 'changes_requested' })

    expect(res.status).toBe(422)
    expect(res.body.error.reason).toBe('comment_required_for_decision')
  })

  it('POST /:id/decisions rejected without comment → 422', async () => {
    const app = createApp()
    const { coordinator, internship } = await setupReviewableInternship(app)

    const res = await request(app)
      .post(`/api/v1/internships/${internship.id}/decisions`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .set('If-Match', internship.etag)
      .send({ decision: 'rejected' })

    expect(res.status).toBe(422)
    expect(res.body.error.reason).toBe('comment_required_for_decision')
  })

  it('POST /:id/decisions changes_requested from offer_pending_review → 201 request_changes', async () => {
    const app = createApp()
    const { coordinator, internship } = await setupReviewableInternship(app)

    const res = await request(app)
      .post(`/api/v1/internships/${internship.id}/decisions`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .set('If-Match', internship.etag)
      .send({ decision: 'changes_requested', comment: 'Add supervisor details.' })

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('offer_changes_requested')
    expect(res.body.coordinatorDecision).toBe('changes_requested')
    expect(res.body.coordinatorComment).toBe('Add supervisor details.')

    const activity = await adminDb
      .collection('internships')
      .doc(internship.id)
      .collection('activity')
      .get()
    const activities = activity.docs.map((item) => item.data())
    expect(activities.some((item) => item['type'] === 'request_changes')).toBe(true)
    expect(activities.some((item) => item['text'] === 'Add supervisor details.')).toBe(true)
  })

  it('POST /:id/decisions rejected → 201 rejected + reject activity', async () => {
    const app = createApp()
    const { coordinator, internship } = await setupReviewableInternship(app)

    const res = await request(app)
      .post(`/api/v1/internships/${internship.id}/decisions`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .set('If-Match', internship.etag)
      .send({ decision: 'rejected', comment: 'Program mismatch.' })

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('rejected')
    expect(res.body.coordinatorDecision).toBe('rejected')

    const activity = await adminDb
      .collection('internships')
      .doc(internship.id)
      .collection('activity')
      .get()
    expect(activity.docs.map((item) => item.data()['type'])).toContain('reject')
  })

  it('POST /:id/decisions on non-reviewable state → 409 invalid_state_transition', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const semesterId = await createActiveSemester()
    const student = await makeStudent(semesterId)
    const opportunityId = await createPublishedOpportunity(app, coordinator.idToken, semesterId)
    const internship = await applyToOpportunity(app, student.idToken, opportunityId)

    const res = await request(app)
      .post(`/api/v1/internships/${internship.id}/decisions`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .set('If-Match', internship.etag)
      .send({ decision: 'approved' })

    expect(res.status).toBe(409)
    expect(res.body.error.reason).toBe('invalid_state_transition')
  })

  it('POST /:id/decisions by student → 403 role_restricted_action', async () => {
    const app = createApp()
    const { student, internship } = await setupReviewableInternship(app)

    const res = await request(app)
      .post(`/api/v1/internships/${internship.id}/decisions`)
      .set('Authorization', `Bearer ${student.idToken}`)
      .set('If-Match', internship.etag)
      .send({ decision: 'approved' })

    expect(res.status).toBe(403)
    expect(res.body.error.reason).toBe('role_restricted_action')
  })

  it('POST /:id/decisions stale If-Match → 412', async () => {
    const app = createApp()
    const { coordinator, internship } = await setupReviewableInternship(app)

    const res = await request(app)
      .post(`/api/v1/internships/${internship.id}/decisions`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .set('If-Match', 'W/"1"')
      .send({ decision: 'approved' })

    expect(res.status).toBe(412)
    expect(res.body.error.reason).toBe('etag_mismatch')
  })

  it('two coordinators racing on the same offer: second decision with stale If-Match → 412', async () => {
    const app = createApp()
    const { coordinator, internship } = await setupReviewableInternship(app)
    const secondCoordinator = await makeCoordinator()

    const first = await request(app)
      .post(`/api/v1/internships/${internship.id}/decisions`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .set('If-Match', internship.etag)
      .send({ decision: 'approved' })
    const second = await request(app)
      .post(`/api/v1/internships/${internship.id}/decisions`)
      .set('Authorization', `Bearer ${secondCoordinator.idToken}`)
      .set('If-Match', internship.etag)
      .send({ decision: 'rejected', comment: 'Program mismatch.' })

    expect(first.status).toBe(201)
    expect(second.status).toBe(412)
    expect(second.body.error.reason).toBe('etag_mismatch')
  })
})
