/**
 * Component — `/api/v1/notifications` routes.
 *
 * One `it(...)` per Phase 8 Success criteria + Bug-finding bullet in
 * WORKFLOW-API-IMPLEMENTATION-PLAN.md.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { randomUUID } from 'node:crypto'
import { createApp } from '../../../src/api/app'
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
import type { NotificationType } from '../../../src/domain/value-objects/notification-enums'

type TestUser = {
  firebaseUid: string
  email: string
  platformUserId: string
  idToken: string
}

type NotificationWire = {
  id: string
  title: string
  readAt: string | null
  emailDeliveryStatus: string | null
  emailDeliveredAt: string | null
}

async function provisionUser(user: TestUser): Promise<void> {
  const now = new Date()
  await new FirestoreUnitOfWork().execute(async (ctx) => {
    await ctx.users.create(
      User.create({
        id: user.platformUserId,
        version: 0,
        email: user.email,
        role: 'student',
        status: 'active',
        onboardingStage: 'profile_complete',
        identity: UserIdentity.create({
          provider: 'firebase',
          providerUserId: user.firebaseUid,
          emailSnapshot: user.email,
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
          semesterId: undefined,
          semesterSelectedAt: undefined,
        }),
      })
    )
  })
  trackDoc('users', user.platformUserId)
}

async function makeStudent(): Promise<TestUser> {
  const firebaseUid = `fb_${randomUUID()}`
  const email = `student_${randomUUID().slice(0, 6)}@student.rmit.edu.au`
  const platformUserId = `usr_student_${randomUUID()}`
  const idToken = await mintEmulatorIdToken(firebaseUid, email)
  const user = { firebaseUid, email, platformUserId, idToken }
  await provisionUser(user)
  return user
}

async function seedNotification(props: {
  id?: string
  userId: string
  type?: NotificationType
  title?: string
  createdAt: Date
  readAt?: Date | null
  emailFields?: 'absent' | 'null' | 'pending'
}): Promise<string> {
  const id = props.id ?? `nt_${randomUUID()}`
  const doc: Record<string, unknown> = {
    userId: props.userId,
    type: props.type ?? 'offer_decision',
    title: props.title ?? `Notification ${id}`,
    body: 'Body',
    relatedInternshipId: `int_${randomUUID()}`,
    readAt: props.readAt === undefined ? null : props.readAt && Timestamp.fromDate(props.readAt),
    version: 1,
    createdAt: Timestamp.fromDate(props.createdAt),
    updatedAt: Timestamp.fromDate(props.createdAt),
    _schemaVersion: 1,
  }
  if (props.emailFields === 'pending') {
    doc['emailDeliveryStatus'] = 'pending'
    doc['emailDeliveredAt'] = null
  } else if (props.emailFields !== 'absent') {
    doc['emailDeliveryStatus'] = null
    doc['emailDeliveredAt'] = null
  }
  await adminDb.collection('notifications').doc(id).set(doc)
  trackDoc('notifications', id)
  return id
}

async function readNotification(id: string): Promise<Record<string, unknown>> {
  const snap = await adminDb.collection('notifications').doc(id).get()
  return snap.data() ?? {}
}

describe('/api/v1/notifications — component', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
    await clearAuthUsers()
  })

  it('GET returns only caller-owned notifications and unreadCount is total across pages', async () => {
    const app = createApp()
    const caller = await makeStudent()
    const other = await makeStudent()
    const newest = await seedNotification({
      userId: caller.platformUserId,
      title: 'Newest unread',
      createdAt: new Date('2026-04-05T12:00:00Z'),
    })
    await seedNotification({
      userId: caller.platformUserId,
      title: 'Read',
      createdAt: new Date('2026-04-05T11:00:00Z'),
      readAt: new Date('2026-04-05T11:05:00Z'),
    })
    await seedNotification({
      userId: caller.platformUserId,
      title: 'Older unread',
      createdAt: new Date('2026-04-05T10:00:00Z'),
    })
    await seedNotification({
      userId: other.platformUserId,
      title: 'Other user',
      createdAt: new Date('2026-04-05T13:00:00Z'),
    })

    const res = await request(app)
      .get('/api/v1/notifications?limit=1')
      .set('Authorization', `Bearer ${caller.idToken}`)

    expect(res.status).toBe(200)
    expect((res.body.items as NotificationWire[]).map((n) => n.id)).toEqual([newest])
    expect(res.body.nextPageToken).toEqual(expect.any(String))
    expect(res.body.unreadCount).toBe(2)
  })

  it('GET unreadOnly=true returns only unread notifications', async () => {
    const app = createApp()
    const caller = await makeStudent()
    await seedNotification({
      userId: caller.platformUserId,
      title: 'Unread',
      createdAt: new Date('2026-04-05T12:00:00Z'),
    })
    await seedNotification({
      userId: caller.platformUserId,
      title: 'Read',
      createdAt: new Date('2026-04-05T11:00:00Z'),
      readAt: new Date('2026-04-05T11:05:00Z'),
    })

    const res = await request(app)
      .get('/api/v1/notifications?unreadOnly=true')
      .set('Authorization', `Bearer ${caller.idToken}`)

    expect(res.status).toBe(200)
    expect((res.body.items as NotificationWire[]).map((n) => n.title)).toEqual(['Unread'])
    expect(res.body.unreadCount).toBe(1)
  })

  it('PATCH { read: true } sets readAt server-side and repeat calls preserve readAt', async () => {
    const app = createApp()
    const caller = await makeStudent()
    const notificationId = await seedNotification({
      userId: caller.platformUserId,
      createdAt: new Date('2026-04-05T12:00:00Z'),
    })
    const before = Date.now()

    const first = await request(app)
      .patch(`/api/v1/notifications/${notificationId}`)
      .set('Authorization', `Bearer ${caller.idToken}`)
      .send({ read: true })
    const second = await request(app)
      .patch(`/api/v1/notifications/${notificationId}`)
      .set('Authorization', `Bearer ${caller.idToken}`)
      .send({ read: true })

    expect(first.status).toBe(200)
    expect(
      new Date((first.body as NotificationWire).readAt ?? '').getTime()
    ).toBeGreaterThanOrEqual(before - 1000)
    expect(second.status).toBe(200)
    expect((second.body as NotificationWire).readAt).toBe((first.body as NotificationWire).readAt)
  })

  it('PATCH { read: false } returns 400', async () => {
    const app = createApp()
    const caller = await makeStudent()
    const notificationId = await seedNotification({
      userId: caller.platformUserId,
      createdAt: new Date('2026-04-05T12:00:00Z'),
    })

    const res = await request(app)
      .patch(`/api/v1/notifications/${notificationId}`)
      .set('Authorization', `Bearer ${caller.idToken}`)
      .send({ read: false })

    expect(res.status).toBe(400)
    expect(res.body.error.reason).toBe('invalid_body')
  })

  it('PATCH with any field other than read returns 400', async () => {
    const app = createApp()
    const caller = await makeStudent()
    const notificationId = await seedNotification({
      userId: caller.platformUserId,
      createdAt: new Date('2026-04-05T12:00:00Z'),
    })

    const res = await request(app)
      .patch(`/api/v1/notifications/${notificationId}`)
      .set('Authorization', `Bearer ${caller.idToken}`)
      .send({ read: true, readAt: '2026-04-05T12:00:00.000Z' })

    expect(res.status).toBe(400)
    expect(res.body.error.reason).toBe('invalid_body')
  })

  it("PATCH on another user's notification returns 403", async () => {
    const app = createApp()
    const caller = await makeStudent()
    const owner = await makeStudent()
    const notificationId = await seedNotification({
      userId: owner.platformUserId,
      createdAt: new Date('2026-04-05T12:00:00Z'),
    })

    const res = await request(app)
      .patch(`/api/v1/notifications/${notificationId}`)
      .set('Authorization', `Bearer ${caller.idToken}`)
      .send({ read: true })
    const stored = await readNotification(notificationId)

    expect(res.status).toBe(403)
    expect(res.body.error.reason).toBe('notification_not_owner')
    expect(stored['readAt']).toBeNull()
  })

  it('PUT { read: true } marks all caller unread notifications and returns the transitioned count', async () => {
    const app = createApp()
    const caller = await makeStudent()
    const first = await seedNotification({
      userId: caller.platformUserId,
      createdAt: new Date('2026-04-05T12:00:00Z'),
    })
    const second = await seedNotification({
      userId: caller.platformUserId,
      createdAt: new Date('2026-04-05T11:00:00Z'),
    })

    const res = await request(app)
      .put('/api/v1/notifications')
      .set('Authorization', `Bearer ${caller.idToken}`)
      .send({ read: true })
    const [firstStored, secondStored] = await Promise.all([
      readNotification(first),
      readNotification(second),
    ])

    expect(res.status).toBe(200)
    expect(res.body.markedReadCount).toBe(2)
    expect(firstStored['readAt']).toBeInstanceOf(Timestamp)
    expect(secondStored['readAt']).toBeInstanceOf(Timestamp)
  })

  it('PUT on an empty unread set returns markedReadCount 0', async () => {
    const app = createApp()
    const caller = await makeStudent()
    await seedNotification({
      userId: caller.platformUserId,
      createdAt: new Date('2026-04-05T12:00:00Z'),
      readAt: new Date('2026-04-05T12:05:00Z'),
    })

    const res = await request(app)
      .put('/api/v1/notifications')
      .set('Authorization', `Bearer ${caller.idToken}`)
      .send({ read: true })

    expect(res.status).toBe(200)
    expect(res.body.markedReadCount).toBe(0)
  })

  it('emailDeliveryStatus and emailDeliveredAt may be null or absent on notification writes', async () => {
    const app = createApp()
    const caller = await makeStudent()
    const absent = await seedNotification({
      userId: caller.platformUserId,
      createdAt: new Date('2026-04-05T12:00:00Z'),
      emailFields: 'absent',
    })
    const nullable = await seedNotification({
      userId: caller.platformUserId,
      createdAt: new Date('2026-04-05T11:00:00Z'),
      emailFields: 'null',
    })

    const list = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${caller.idToken}`)
    const patched = await request(app)
      .patch(`/api/v1/notifications/${absent}`)
      .set('Authorization', `Bearer ${caller.idToken}`)
      .send({ read: true })
    const bulk = await request(app)
      .put('/api/v1/notifications')
      .set('Authorization', `Bearer ${caller.idToken}`)
      .send({ read: true })
    const nullableStored = await readNotification(nullable)

    expect(list.status).toBe(200)
    expect(
      (list.body.items as NotificationWire[]).every(
        (item) => item.emailDeliveryStatus === null && item.emailDeliveredAt === null
      )
    ).toBe(true)
    expect(patched.status).toBe(200)
    expect((patched.body as NotificationWire).emailDeliveryStatus).toBeNull()
    expect((patched.body as NotificationWire).emailDeliveredAt).toBeNull()
    expect(bulk.status).toBe(200)
    expect(bulk.body.markedReadCount).toBe(1)
    expect(nullableStored['readAt']).toBeInstanceOf(Timestamp)
  })

  it('PUT markedReadCount counts only unread-to-read transitions', async () => {
    const app = createApp()
    const caller = await makeStudent()
    await seedNotification({
      userId: caller.platformUserId,
      createdAt: new Date('2026-04-05T12:00:00Z'),
      readAt: new Date('2026-04-05T12:05:00Z'),
    })
    await seedNotification({
      userId: caller.platformUserId,
      createdAt: new Date('2026-04-05T11:00:00Z'),
    })

    const res = await request(app)
      .put('/api/v1/notifications')
      .set('Authorization', `Bearer ${caller.idToken}`)
      .send({ read: true })

    expect(res.status).toBe(200)
    expect(res.body.markedReadCount).toBe(1)
  })

  it("PUT cannot mark another user's notifications read", async () => {
    const app = createApp()
    const caller = await makeStudent()
    const other = await makeStudent()
    await seedNotification({
      userId: caller.platformUserId,
      createdAt: new Date('2026-04-05T12:00:00Z'),
    })
    const otherNotification = await seedNotification({
      userId: other.platformUserId,
      createdAt: new Date('2026-04-05T11:00:00Z'),
    })

    const res = await request(app)
      .put('/api/v1/notifications')
      .set('Authorization', `Bearer ${caller.idToken}`)
      .send({ read: true })
    const otherStored = await readNotification(otherNotification)

    expect(res.status).toBe(200)
    expect(res.body.markedReadCount).toBe(1)
    expect(otherStored['readAt']).toBeNull()
  })
})
