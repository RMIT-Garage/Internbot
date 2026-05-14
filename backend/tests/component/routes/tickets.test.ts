/**
 * Component — `/api/v1/tickets` routes.
 *
 * One `it(...)` per Phase 9 Success-criteria + Bug-finding bullet in
 * WORKFLOW-API-IMPLEMENTATION-PLAN.md.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { randomUUID } from 'node:crypto'
import { createApp } from '../../../src/api/app'
import { FirestoreUnitOfWork } from '../../../src/infrastructure/firestore/firestore-unit-of-work'
import { adminDb } from '../../../src/infrastructure/config/firebase-admin'
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
  firebaseUid: string
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
                semesterId: undefined,
                semesterSelectedAt: undefined,
              })
            : undefined,
      })
    )
  })
  trackDoc('users', platformUserId)
}

async function makeStudent(): Promise<TestUser> {
  const firebaseUid = `fb_${randomUUID()}`
  const email = `student_${randomUUID().slice(0, 6)}@student.rmit.edu.au`
  const platformUserId = `usr_student_${randomUUID()}`
  const idToken = await mintEmulatorIdToken(firebaseUid, email)
  await provisionUser('student', email, platformUserId, firebaseUid)
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

async function postTicket(token: string, overrides: Record<string, unknown> = {}) {
  return request(createApp())
    .post('/api/v1/tickets')
    .set('Authorization', `Bearer ${token}`)
    .send({ subject: 'Subject', body: 'Body', category: 'general', ...overrides })
}

async function readActivity(ticketId: string): Promise<readonly Record<string, unknown>[]> {
  const snap = await adminDb.collection('tickets').doc(ticketId).collection('activity').get()
  return snap.docs.map((d) => d.data())
}

async function readReplies(ticketId: string): Promise<readonly Record<string, unknown>[]> {
  const snap = await adminDb.collection('tickets').doc(ticketId).collection('replies').get()
  return snap.docs.map((d) => d.data())
}

async function trackNotificationsFor(userId: string): Promise<readonly string[]> {
  const snap = await adminDb.collection('notifications').where('userId', '==', userId).get()
  for (const doc of snap.docs) trackDoc('notifications', doc.id)
  return snap.docs.map((d) => d.data()['type'] as string)
}

describe('/api/v1/tickets — component', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
    await clearAuthUsers()
  })

  it('Student POST /tickets returns 201 with status: open', async () => {
    const student = await makeStudent()

    const res = await postTicket(student.idToken)
    if (res.body?.id) trackDoc('tickets', res.body.id)

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('open')
    expect(res.body.userId).toBe(student.platformUserId)
    expect(res.headers['location']).toBe(`/api/v1/tickets/${res.body.id}`)
    expect(res.headers['etag']).toBeDefined()
  })

  it('Coordinator POST /tickets returns 403', async () => {
    const coord = await makeCoordinator()

    const res = await postTicket(coord.idToken)

    expect(res.status).toBe(403)
    expect(res.body.error.reason).toBe('role_restricted_action')
  })

  it('POST missing subject or body returns 422', async () => {
    const student = await makeStudent()
    const app = createApp()

    const missingSubject = await request(app)
      .post('/api/v1/tickets')
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({ body: 'Body' })
    const missingBody = await request(app)
      .post('/api/v1/tickets')
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({ subject: 'Subject' })

    expect(missingSubject.status).toBe(422)
    expect(missingBody.status).toBe(422)
    expect(missingSubject.body.error.reason).toBe('missing_required_field')
  })

  it('GET list scopes student to own tickets; coordinator sees all', async () => {
    const studentA = await makeStudent()
    const studentB = await makeStudent()
    const coord = await makeCoordinator()
    const a = await postTicket(studentA.idToken, { subject: 'A' })
    const b = await postTicket(studentB.idToken, { subject: 'B' })
    trackDoc('tickets', a.body.id)
    trackDoc('tickets', b.body.id)

    const studentList = await request(createApp())
      .get('/api/v1/tickets')
      .set('Authorization', `Bearer ${studentA.idToken}`)
    const coordList = await request(createApp())
      .get('/api/v1/tickets')
      .set('Authorization', `Bearer ${coord.idToken}`)

    expect(studentList.status).toBe(200)
    expect(studentList.body.items.map((t: { id: string }) => t.id)).toEqual([a.body.id])
    expect(coordList.status).toBe(200)
    expect(coordList.body.items.map((t: { id: string }) => t.id).sort()).toEqual(
      [a.body.id, b.body.id].sort()
    )
  })

  it('GET /:id by non-owner student returns 403', async () => {
    const owner = await makeStudent()
    const other = await makeStudent()
    const ticket = await postTicket(owner.idToken)
    trackDoc('tickets', ticket.body.id)

    const res = await request(createApp())
      .get(`/api/v1/tickets/${ticket.body.id}`)
      .set('Authorization', `Bearer ${other.idToken}`)

    expect(res.status).toBe(403)
    expect(res.body.error.reason).toBe('ticket_not_owner')
  })

  it('POST /:id/replies bumps parent updatedAt and notifies the counterparty', async () => {
    const student = await makeStudent()
    const coord = await makeCoordinator()
    const ticket = await postTicket(student.idToken)
    trackDoc('tickets', ticket.body.id)
    await trackNotificationsFor(coord.platformUserId) // drain new_ticket noise

    const before = ticket.body.updatedAt as string

    const studentReply = await request(createApp())
      .post(`/api/v1/tickets/${ticket.body.id}/replies`)
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({ text: 'thanks' })
    const coordReply = await request(createApp())
      .post(`/api/v1/tickets/${ticket.body.id}/replies`)
      .set('Authorization', `Bearer ${coord.idToken}`)
      .send({ text: 'no worries' })

    const after = await request(createApp())
      .get(`/api/v1/tickets/${ticket.body.id}`)
      .set('Authorization', `Bearer ${student.idToken}`)
    const replies = await readReplies(ticket.body.id)
    const coordTypes = await trackNotificationsFor(coord.platformUserId)
    const studentTypes = await trackNotificationsFor(student.platformUserId)

    expect(studentReply.status).toBe(201)
    expect(studentReply.body.authorRole).toBe('student')
    expect(studentReply.headers['location']).toBe(
      `/api/v1/tickets/${ticket.body.id}/replies/${studentReply.body.id}`
    )
    expect(coordReply.status).toBe(201)
    expect(coordReply.body.authorRole).toBe('coordinator')
    expect(replies).toHaveLength(2)
    expect(after.body.updatedAt > before).toBe(true)
    expect(coordTypes).toContain('ticket_reply')
    expect(studentTypes).toContain('ticket_reply')
  })

  it('Coordinator open → in_progress returns 201 and writes activity with actorRole', async () => {
    const student = await makeStudent()
    const coord = await makeCoordinator()
    const ticket = await postTicket(student.idToken)
    trackDoc('tickets', ticket.body.id)

    const res = await request(createApp())
      .post(`/api/v1/tickets/${ticket.body.id}/transitions`)
      .set('Authorization', `Bearer ${coord.idToken}`)
      .send({ to: 'in_progress', comment: 'on it' })
    const activity = await readActivity(ticket.body.id)
    await trackNotificationsFor(student.platformUserId)

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('in_progress')
    expect(activity).toHaveLength(1)
    expect(activity[0]?.['actorRole']).toBe('coordinator')
    expect(activity[0]?.['from']).toBe('open')
    expect(activity[0]?.['to']).toBe('in_progress')
    expect(activity[0]?.['comment']).toBe('on it')
  })

  it('Student owner can close their own open ticket (open → closed)', async () => {
    const student = await makeStudent()
    const coord = await makeCoordinator()
    const ticket = await postTicket(student.idToken)
    trackDoc('tickets', ticket.body.id)
    await trackNotificationsFor(coord.platformUserId)

    const res = await request(createApp())
      .post(`/api/v1/tickets/${ticket.body.id}/transitions`)
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({ to: 'closed' })
    await trackNotificationsFor(coord.platformUserId)

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('closed')
  })

  it('Student owner cannot move open → in_progress (role_restricted_action)', async () => {
    const student = await makeStudent()
    const ticket = await postTicket(student.idToken)
    trackDoc('tickets', ticket.body.id)

    const res = await request(createApp())
      .post(`/api/v1/tickets/${ticket.body.id}/transitions`)
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({ to: 'in_progress' })

    expect(res.status).toBe(403)
    expect(res.body.error.reason).toBe('role_restricted_action')
  })

  it('Student owner can reopen a resolved ticket (resolved → open)', async () => {
    const student = await makeStudent()
    const coord = await makeCoordinator()
    const ticket = await postTicket(student.idToken)
    trackDoc('tickets', ticket.body.id)

    await request(createApp())
      .post(`/api/v1/tickets/${ticket.body.id}/transitions`)
      .set('Authorization', `Bearer ${coord.idToken}`)
      .send({ to: 'in_progress' })
    await request(createApp())
      .post(`/api/v1/tickets/${ticket.body.id}/transitions`)
      .set('Authorization', `Bearer ${coord.idToken}`)
      .send({ to: 'resolved' })

    const reopen = await request(createApp())
      .post(`/api/v1/tickets/${ticket.body.id}/transitions`)
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({ to: 'open' })
    await trackNotificationsFor(coord.platformUserId)
    await trackNotificationsFor(student.platformUserId)

    expect(reopen.status).toBe(201)
    expect(reopen.body.status).toBe('open')
  })

  it('Coordinator cannot reopen a closed ticket (role_restricted_action)', async () => {
    const student = await makeStudent()
    const coord = await makeCoordinator()
    const ticket = await postTicket(student.idToken)
    trackDoc('tickets', ticket.body.id)

    await request(createApp())
      .post(`/api/v1/tickets/${ticket.body.id}/transitions`)
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({ to: 'closed' })

    const res = await request(createApp())
      .post(`/api/v1/tickets/${ticket.body.id}/transitions`)
      .set('Authorization', `Bearer ${coord.idToken}`)
      .send({ to: 'open' })
    await trackNotificationsFor(coord.platformUserId)
    await trackNotificationsFor(student.platformUserId)

    expect(res.status).toBe(403)
    expect(res.body.error.reason).toBe('role_restricted_action')
  })

  it('Invalid state pair returns 409 invalid_state_transition', async () => {
    const student = await makeStudent()
    const coord = await makeCoordinator()
    const ticket = await postTicket(student.idToken)
    trackDoc('tickets', ticket.body.id)

    const res = await request(createApp())
      .post(`/api/v1/tickets/${ticket.body.id}/transitions`)
      .set('Authorization', `Bearer ${coord.idToken}`)
      .send({ to: 'resolved' })

    expect(res.status).toBe(409)
    expect(res.body.error.reason).toBe('invalid_state_transition')
  })

  it('Stale If-Match returns 412', async () => {
    const student = await makeStudent()
    const coord = await makeCoordinator()
    const ticket = await postTicket(student.idToken)
    trackDoc('tickets', ticket.body.id)

    const res = await request(createApp())
      .post(`/api/v1/tickets/${ticket.body.id}/transitions`)
      .set('Authorization', `Bearer ${coord.idToken}`)
      .set('If-Match', 'W/"99"')
      .send({ to: 'in_progress' })

    expect(res.status).toBe(412)
  })

  it('GET /:id with non-existent id returns 404', async () => {
    const student = await makeStudent()

    const res = await request(createApp())
      .get(`/api/v1/tickets/tkt_${randomUUID()}`)
      .set('Authorization', `Bearer ${student.idToken}`)

    expect(res.status).toBe(404)
  })

  it('POST /tickets with a forbidden field (id) returns 400 immutable_field', async () => {
    const student = await makeStudent()

    const res = await postTicket(student.idToken, { id: 'tkt_injected' })

    expect(res.status).toBe(400)
    expect(res.body.error.reason).toBe('immutable_field')
  })

  it('POST /:id/replies with empty body returns 422 missing_required_field', async () => {
    const student = await makeStudent()
    await makeCoordinator()
    const ticket = await postTicket(student.idToken)
    trackDoc('tickets', ticket.body.id)

    const res = await request(createApp())
      .post(`/api/v1/tickets/${ticket.body.id}/replies`)
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({})

    expect(res.status).toBe(422)
    expect(res.body.error.reason).toBe('missing_required_field')
  })

  it('POST /:id/transitions without `to` returns 400 invalid_body', async () => {
    const student = await makeStudent()
    const coord = await makeCoordinator()
    const ticket = await postTicket(student.idToken)
    trackDoc('tickets', ticket.body.id)

    const res = await request(createApp())
      .post(`/api/v1/tickets/${ticket.body.id}/transitions`)
      .set('Authorization', `Bearer ${coord.idToken}`)
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error.reason).toBe('invalid_body')
  })

  it('GET /tickets with malformed status query returns 400 invalid_query', async () => {
    const student = await makeStudent()

    const res = await request(createApp())
      .get('/api/v1/tickets?status=garbage')
      .set('Authorization', `Bearer ${student.idToken}`)

    expect(res.status).toBe(400)
    expect(res.body.error.reason).toBe('invalid_query')
  })
})
