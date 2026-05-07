import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { ListNotificationsQueryHandler } from '../../../../src/application/queries/list-notifications'
import { GetNotificationQueryHandler } from '../../../../src/application/queries/get-notification'
import { MarkNotificationReadCommandHandler } from '../../../../src/application/commands/mark-notification-read'
import { MarkAllNotificationsReadCommandHandler } from '../../../../src/application/commands/mark-all-notifications-read'
import { FirestoreUnitOfWork } from '../../../../src/infrastructure/firestore/firestore-unit-of-work'
import { firestoreNotificationQueryService } from '../../../../src/infrastructure/firestore/firestore-notification-query-service'
import { defaultAuthorizationService } from '../../../../src/infrastructure/authorization/default-authorization-service'
import { adminDb, Timestamp } from '../../../../src/infrastructure/config/firebase-admin'
import { clearDocs, initEmulator, trackDoc } from '../../../setup.emulator'
import type { RequestActor } from '../../../../src/application/actor'
import type { NotificationType } from '../../../../src/domain/value-objects/notification-enums'

function actorFor(
  role: 'student' | 'coordinator',
  id = `usr_${role}_${randomUUID()}`
): RequestActor {
  return {
    firebaseUid: `fb_${randomUUID()}`,
    email: `${id}@rmit.edu.au`,
    platformUser: { id, role },
  }
}

async function seedNotification(props: {
  id?: string
  userId: string
  type?: NotificationType
  title?: string
  createdAt: Date
  readAt?: Date | null
  relatedInternshipId?: string
  relatedOpportunityId?: string
  omitEmailFields?: boolean
}): Promise<string> {
  const id = props.id ?? `nt_${randomUUID()}`
  const doc: Record<string, unknown> = {
    userId: props.userId,
    type: props.type ?? 'offer_decision',
    title: props.title ?? `Notification ${id}`,
    body: 'Body',
    readAt: props.readAt === undefined ? null : props.readAt && Timestamp.fromDate(props.readAt),
    version: 1,
    createdAt: Timestamp.fromDate(props.createdAt),
    updatedAt: Timestamp.fromDate(props.createdAt),
    _schemaVersion: 1,
  }
  if (props.relatedInternshipId !== undefined) {
    doc['relatedInternshipId'] = props.relatedInternshipId
  }
  if (props.relatedOpportunityId !== undefined) {
    doc['relatedOpportunityId'] = props.relatedOpportunityId
  }
  if (!props.omitEmailFields) {
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

describe('Notifications queries and commands — integration', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
  })

  it('lists only caller-owned notifications newest first and reports unreadCount across pages', async () => {
    const userId = `usr_student_${randomUUID()}`
    const otherId = `usr_student_${randomUUID()}`
    await seedNotification({
      userId,
      title: 'Newest unread',
      createdAt: new Date('2026-04-05T12:00:00Z'),
    })
    await seedNotification({
      userId,
      title: 'Read',
      createdAt: new Date('2026-04-05T11:00:00Z'),
      readAt: new Date('2026-04-05T11:05:00Z'),
    })
    await seedNotification({
      userId,
      title: 'Older unread',
      createdAt: new Date('2026-04-05T10:00:00Z'),
    })
    await seedNotification({
      userId: otherId,
      title: 'Other user',
      createdAt: new Date('2026-04-05T13:00:00Z'),
    })

    const handler = new ListNotificationsQueryHandler(
      firestoreNotificationQueryService,
      defaultAuthorizationService
    )
    const first = await handler.handle({
      actor: actorFor('student', userId),
      filter: { unreadOnly: false, limit: 1, cursor: undefined },
    })
    const second = await handler.handle({
      actor: actorFor('student', userId),
      filter: { unreadOnly: false, limit: 10, cursor: first.cursor ?? undefined },
    })

    expect(first.items.map((n) => n.title)).toEqual(['Newest unread'])
    expect(first.unreadCount).toBe(2)
    expect(first.cursor).not.toBeNull()
    expect(second.items.map((n) => n.title)).toEqual(['Read', 'Older unread'])
    expect(second.unreadCount).toBe(2)
    expect(second.cursor).toBeNull()
  })

  it('filters unreadOnly=true using the notification readAt state', async () => {
    const userId = `usr_student_${randomUUID()}`
    await seedNotification({
      userId,
      title: 'Unread',
      createdAt: new Date('2026-04-05T12:00:00Z'),
    })
    await seedNotification({
      userId,
      title: 'Read',
      createdAt: new Date('2026-04-05T11:00:00Z'),
      readAt: new Date('2026-04-05T11:05:00Z'),
    })

    const result = await new ListNotificationsQueryHandler(
      firestoreNotificationQueryService,
      defaultAuthorizationService
    ).handle({
      actor: actorFor('student', userId),
      filter: { unreadOnly: true, limit: 50, cursor: undefined },
    })

    expect(result.items.map((n) => n.title)).toEqual(['Unread'])
    expect(result.unreadCount).toBe(1)
  })

  it('marks a notification read once and preserves readAt on repeat calls', async () => {
    const userId = `usr_student_${randomUUID()}`
    const notificationId = await seedNotification({
      userId,
      createdAt: new Date('2026-04-05T12:00:00Z'),
      omitEmailFields: true,
    })
    const handler = new MarkNotificationReadCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService
    )
    const actor = actorFor('student', userId)

    await handler.handle({ actor, notificationId })
    const first = await readNotification(notificationId)
    await handler.handle({ actor, notificationId })
    const second = await readNotification(notificationId)

    expect(first['readAt']).toBeInstanceOf(Timestamp)
    expect((second['readAt'] as Timestamp).toDate().toISOString()).toBe(
      (first['readAt'] as Timestamp).toDate().toISOString()
    )
    expect(second['version']).toBe(2)
    expect(second['emailDeliveryStatus']).toBeNull()
    expect(second['emailDeliveredAt']).toBeNull()
  })

  it("rejects reads or writes against another user's notification", async () => {
    const ownerId = `usr_student_${randomUUID()}`
    const callerId = `usr_student_${randomUUID()}`
    const notificationId = await seedNotification({
      userId: ownerId,
      createdAt: new Date('2026-04-05T12:00:00Z'),
    })
    const actor = actorFor('student', callerId)

    await expect(
      new GetNotificationQueryHandler(
        firestoreNotificationQueryService,
        defaultAuthorizationService
      ).handle({ actor, notificationId })
    ).rejects.toMatchObject({ reason: 'notification_not_owner' })
    await expect(
      new MarkNotificationReadCommandHandler(
        new FirestoreUnitOfWork(),
        defaultAuthorizationService
      ).handle({
        actor,
        notificationId,
      })
    ).rejects.toMatchObject({ reason: 'notification_not_owner' })
  })

  it('bulk marks only caller unread notifications and reports transitioned count', async () => {
    const userId = `usr_student_${randomUUID()}`
    const otherId = `usr_student_${randomUUID()}`
    const readId = await seedNotification({
      userId,
      createdAt: new Date('2026-04-05T13:00:00Z'),
      readAt: new Date('2026-04-05T13:05:00Z'),
    })
    const unreadA = await seedNotification({
      userId,
      createdAt: new Date('2026-04-05T12:00:00Z'),
    })
    const unreadB = await seedNotification({
      userId,
      createdAt: new Date('2026-04-05T11:00:00Z'),
      omitEmailFields: true,
    })
    const otherUnread = await seedNotification({
      userId: otherId,
      createdAt: new Date('2026-04-05T10:00:00Z'),
    })

    const result = await new MarkAllNotificationsReadCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService
    ).handle({ actor: actorFor('student', userId) })

    const [read, first, second, other] = await Promise.all([
      readNotification(readId),
      readNotification(unreadA),
      readNotification(unreadB),
      readNotification(otherUnread),
    ])
    expect(result.markedReadCount).toBe(2)
    expect((read['readAt'] as Timestamp).toDate().toISOString()).toBe('2026-04-05T13:05:00.000Z')
    expect(first['readAt']).toBeInstanceOf(Timestamp)
    expect(second['readAt']).toBeInstanceOf(Timestamp)
    expect(second['emailDeliveryStatus']).toBeNull()
    expect(second['emailDeliveredAt']).toBeNull()
    expect(other['readAt']).toBeNull()
  })

  it('bulk mark-read returns zero when the caller has no unread notifications', async () => {
    const userId = `usr_student_${randomUUID()}`
    await seedNotification({
      userId,
      createdAt: new Date('2026-04-05T12:00:00Z'),
      readAt: new Date('2026-04-05T12:05:00Z'),
    })

    const result = await new MarkAllNotificationsReadCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService
    ).handle({ actor: actorFor('student', userId) })

    expect(result.markedReadCount).toBe(0)
  })
})
