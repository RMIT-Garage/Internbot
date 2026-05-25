/**
 * Component — GET /api/v1/users/:id/activity and /users/me/activity.
 *
 * One `it(...)` per Phase 7 success / bug-finding surface, with real
 * Firestore collection-group reads through the emulator.
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
  await transition.handle({ actor, semesterId: id, to: 'enrollment_open', comment: undefined })
  return id
}

function opportunityBody(semesterId: string) {
  return {
    semesterId,
    type: 'pre_approved',
    employerName: 'Example Pty Ltd',
    jobTitle: 'Software Intern',
    descriptionText: 'Build internal tools',
    workMode: 'hybrid',
    location: 'Melbourne',
    sourceUrl: 'https://careerhub.rmit.edu.au/jobs/123',
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

async function submitOfferForReview(
  app: ReturnType<typeof createApp>,
  token: string,
  internshipId: string,
  etag: string
): Promise<{ etag: string }> {
  await addAttachment(internshipId)
  const res = await request(app)
    .post(`/api/v1/internships/${internshipId}/offer-submissions`)
    .set('Authorization', `Bearer ${token}`)
    .set('If-Match', etag)
    .send({
      offerDate: '2026-05-01T00:00:00.000Z',
      startDate: '2026-06-01T00:00:00.000Z',
      endDate: '2026-07-01T00:00:00.000Z',
    })
  expect(res.status).toBe(201)
  return { etag: res.headers['etag'] as string }
}

async function seedActivity(props: {
  internshipId: string
  activityId: string
  authorUserId: string
  createdAt: Date
  text: string
}): Promise<void> {
  trackDoc('internships', props.internshipId)
  await adminDb
    .collection('internships')
    .doc(props.internshipId)
    .collection('activity')
    .doc(props.activityId)
    .set({
      type: 'comment',
      authorUserId: props.authorUserId,
      authorRole: 'student',
      text: props.text,
      createdAt: Timestamp.fromDate(props.createdAt),
      _schemaVersion: 1,
    })
}

describe('/api/v1/users/:id/activity — component', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
    await clearAuthUsers()
  })

  it('GET /users/me/activity returns only caller entries, default-sorted newest first, with internshipId from parent path', async () => {
    const app = createApp()
    const student = await makeStudent()
    const other = await makeStudent()
    const newest = {
      internshipId: `int_${randomUUID()}`,
      activityId: `act_${randomUUID()}`,
    }
    await seedActivity({
      ...newest,
      authorUserId: student.platformUserId,
      createdAt: new Date('2026-04-05T11:00:00Z'),
      text: 'Newest',
    })
    await seedActivity({
      internshipId: `int_${randomUUID()}`,
      activityId: `act_${randomUUID()}`,
      authorUserId: student.platformUserId,
      createdAt: new Date('2026-04-05T10:00:00Z'),
      text: 'Older',
    })
    await seedActivity({
      internshipId: `int_${randomUUID()}`,
      activityId: `act_${randomUUID()}`,
      authorUserId: other.platformUserId,
      createdAt: new Date('2026-04-05T12:00:00Z'),
      text: 'Other user',
    })

    const res = await request(app)
      .get('/api/v1/users/me/activity')
      .set('Authorization', `Bearer ${student.idToken}`)

    expect(res.status).toBe(200)
    expect(res.body.nextPageToken).toBeNull()
    expect(res.body.items.map((item: { text: string }) => item.text)).toEqual(['Newest', 'Older'])
    expect(res.body.items[0]).toMatchObject({
      id: newest.activityId,
      resourceType: 'internship',
      internshipId: newest.internshipId,
      opportunityId: null,
      authorUserId: student.platformUserId,
    })
  })

  it('sort=createdAt paginates with nextPageToken, then null on the last page', async () => {
    const app = createApp()
    const student = await makeStudent()
    await seedActivity({
      internshipId: `int_${randomUUID()}`,
      activityId: `act_${randomUUID()}`,
      authorUserId: student.platformUserId,
      createdAt: new Date('2026-04-05T10:00:00Z'),
      text: 'First',
    })
    await seedActivity({
      internshipId: `int_${randomUUID()}`,
      activityId: `act_${randomUUID()}`,
      authorUserId: student.platformUserId,
      createdAt: new Date('2026-04-05T11:00:00Z'),
      text: 'Second',
    })

    const first = await request(app)
      .get('/api/v1/users/me/activity?limit=1&sort=createdAt')
      .set('Authorization', `Bearer ${student.idToken}`)
    const second = await request(app)
      .get(
        `/api/v1/users/me/activity?limit=1&sort=createdAt&pageToken=${encodeURIComponent(
          first.body.nextPageToken
        )}`
      )
      .set('Authorization', `Bearer ${student.idToken}`)

    expect(first.status).toBe(200)
    expect(first.body.items[0].text).toBe('First')
    expect(first.body.nextPageToken).toEqual(expect.any(String))
    expect(second.status).toBe(200)
    expect(second.body.items[0].text).toBe('Second')
    expect(second.body.nextPageToken).toBeNull()
  })

  it('GET /users/:otherId/activity returns 403 user_not_owner', async () => {
    const app = createApp()
    const caller = await makeCoordinator()
    const other = await makeCoordinator()

    const res = await request(app)
      .get(`/api/v1/users/${other.platformUserId}/activity`)
      .set('Authorization', `Bearer ${caller.idToken}`)

    expect(res.status).toBe(403)
    expect(res.body.error.reason).toBe('user_not_owner')
  })

  it('student and coordinator feeds include Phase 4/5/6 side-effect activity immediately', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const semesterId = await createActiveSemester()
    const student = await makeStudent(semesterId)
    const opportunity = await createOpportunity(app, coordinator.idToken, semesterId)
    await publishOpportunity(app, coordinator.idToken, opportunity.id)
    const internship = await applyToOpportunity(app, student.idToken, opportunity.id)
    const submitted = await submitOfferForReview(
      app,
      student.idToken,
      internship.id,
      internship.etag
    )
    const decision = await request(app)
      .post(`/api/v1/internships/${internship.id}/decisions`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .set('If-Match', submitted.etag)
      .send({ decision: 'approved' })
    expect(decision.status).toBe(201)

    const [studentFeed, coordinatorFeed] = await Promise.all([
      request(app)
        .get('/api/v1/users/me/activity')
        .set('Authorization', `Bearer ${student.idToken}`),
      request(app)
        .get('/api/v1/users/me/activity')
        .set('Authorization', `Bearer ${coordinator.idToken}`),
    ])

    expect(studentFeed.status).toBe(200)
    expect(studentFeed.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ internshipId: internship.id, type: 'apply' }),
        expect.objectContaining({ internshipId: internship.id, type: 'submit_offer' }),
      ])
    )
    expect(coordinatorFeed.status).toBe(200)
    expect(coordinatorFeed.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ opportunityId: opportunity.id, type: 'transition' }),
        expect.objectContaining({ internshipId: internship.id, type: 'approve_offer' }),
      ])
    )
  })

  it('invalid sort is rejected as a query error', async () => {
    const app = createApp()
    const student = await makeStudent()

    const res = await request(app)
      .get('/api/v1/users/me/activity?sort=updatedAt')
      .set('Authorization', `Bearer ${student.idToken}`)

    expect(res.status).toBe(400)
    expect(res.body.error.reason).toBe('invalid_query')
  })
})
