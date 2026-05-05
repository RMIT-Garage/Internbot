import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { CreateTicketCommandHandler } from '../../../../src/application/commands/create-ticket'
import { PostTicketReplyCommandHandler } from '../../../../src/application/commands/post-ticket-reply'
import { TransitionTicketCommandHandler } from '../../../../src/application/commands/transition-ticket'
import { GetTicketQueryHandler } from '../../../../src/application/queries/get-ticket'
import { ListTicketsQueryHandler } from '../../../../src/application/queries/list-tickets'
import { FirestoreUnitOfWork } from '../../../../src/infrastructure/firestore/firestore-unit-of-work'
import { firestoreIdGenerator } from '../../../../src/infrastructure/firestore/firestore-id-generator'
import { adminDb, Timestamp } from '../../../../src/infrastructure/config/firebase-admin'
import { User } from '../../../../src/domain/entities/user'
import { UserIdentity } from '../../../../src/domain/value-objects/user-identity'
import { StudentProfile } from '../../../../src/domain/value-objects/student-profile'
import { clearDocs, initEmulator, trackDoc } from '../../../setup.emulator'
import type { RequestActor } from '../../../../src/application/actor'

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

async function seedUser(role: 'student' | 'coordinator', id: string): Promise<void> {
  const now = new Date()
  await new FirestoreUnitOfWork().execute(async (ctx) => {
    await ctx.users.create(
      User.create({
        id,
        version: 0,
        email: `${id}@${role === 'student' ? 'student.' : ''}rmit.edu.au`,
        role,
        status: 'active',
        onboardingStage: 'profile_complete',
        identity: UserIdentity.create({
          provider: 'firebase',
          providerUserId: `fb_${randomUUID()}`,
          emailSnapshot: `${id}@rmit.edu.au`,
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
  trackDoc('users', id)
}

async function createOpenTicket(studentId: string): Promise<string> {
  const { id } = await new CreateTicketCommandHandler(
    new FirestoreUnitOfWork(),
    firestoreIdGenerator
  ).handle({
    actor: actorFor('student', studentId),
    payload: {
      subject: 'Need help',
      body: 'Cannot find the apply button',
      category: 'general',
    },
  })
  trackDoc('tickets', id)
  return id
}

async function readTicket(id: string): Promise<Record<string, unknown>> {
  const snap = await adminDb.collection('tickets').doc(id).get()
  return snap.data() ?? {}
}

async function listReplies(ticketId: string): Promise<readonly Record<string, unknown>[]> {
  const snap = await adminDb.collection('tickets').doc(ticketId).collection('replies').get()
  return snap.docs.map((d) => d.data())
}

async function listActivity(ticketId: string): Promise<readonly Record<string, unknown>[]> {
  const snap = await adminDb.collection('tickets').doc(ticketId).collection('activity').get()
  return snap.docs.map((d) => d.data())
}

async function listNotificationsFor(userId: string): Promise<readonly Record<string, unknown>[]> {
  const snap = await adminDb.collection('notifications').where('userId', '==', userId).get()
  for (const doc of snap.docs) trackDoc('notifications', doc.id)
  return snap.docs.map((d) => d.data())
}

describe('Tickets — integration', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
  })

  it('Student creating a ticket persists open status and notifies coordinators', async () => {
    const studentId = `usr_student_${randomUUID()}`
    const coordId = `usr_coord_${randomUUID()}`
    await seedUser('student', studentId)
    await seedUser('coordinator', coordId)

    const { id } = await new CreateTicketCommandHandler(
      new FirestoreUnitOfWork(),
      firestoreIdGenerator
    ).handle({
      actor: actorFor('student', studentId),
      payload: { subject: 'Help', body: 'Body', category: 'eligibility' },
    })
    trackDoc('tickets', id)

    const stored = await readTicket(id)
    const coordNotifications = await listNotificationsFor(coordId)

    expect(stored['status']).toBe('open')
    expect(stored['userId']).toBe(studentId)
    expect(stored['version']).toBe(1)
    expect(coordNotifications).toHaveLength(1)
    expect(coordNotifications[0]?.['type']).toBe('new_ticket')
    expect(coordNotifications[0]?.['relatedTicketId']).toBe(id)
  })

  it('Coordinators listing see all tickets; students see only their own', async () => {
    const studentA = `usr_student_a_${randomUUID()}`
    const studentB = `usr_student_b_${randomUUID()}`
    const coordId = `usr_coord_${randomUUID()}`
    await seedUser('student', studentA)
    await seedUser('student', studentB)
    await seedUser('coordinator', coordId)

    const aTicket = await createOpenTicket(studentA)
    const bTicket = await createOpenTicket(studentB)

    const list = new ListTicketsQueryHandler(new FirestoreUnitOfWork())
    const studentList = await list.handle({
      actor: actorFor('student', studentA),
      filter: { status: undefined, limit: 50, sortDirection: 'desc', cursor: undefined },
    })
    const coordList = await list.handle({
      actor: actorFor('coordinator', coordId),
      filter: { status: undefined, limit: 50, sortDirection: 'desc', cursor: undefined },
    })

    expect(studentList.items.map((t) => t.id)).toEqual([aTicket])
    expect(coordList.items.map((t) => t.id).sort()).toEqual([aTicket, bTicket].sort())
  })

  it('Student replying notifies coordinators; coordinator replying notifies the owner', async () => {
    const studentId = `usr_student_${randomUUID()}`
    const coordId = `usr_coord_${randomUUID()}`
    await seedUser('student', studentId)
    await seedUser('coordinator', coordId)
    const ticketId = await createOpenTicket(studentId)
    // discard the new_ticket notification noise from listings later
    await listNotificationsFor(coordId)

    const handler = new PostTicketReplyCommandHandler(
      new FirestoreUnitOfWork(),
      firestoreIdGenerator
    )
    await handler.handle({
      actor: actorFor('student', studentId),
      ticketId,
      text: 'thanks',
    })
    await handler.handle({
      actor: actorFor('coordinator', coordId),
      ticketId,
      text: 'no worries',
    })

    const replies = await listReplies(ticketId)
    const coordNotifications = await listNotificationsFor(coordId)
    const studentNotifications = await listNotificationsFor(studentId)
    const ticket = await readTicket(ticketId)

    expect(replies).toHaveLength(2)
    // Coordinator received: 1 new_ticket already drained, plus 1 ticket_reply
    expect(coordNotifications.filter((n) => n['type'] === 'ticket_reply')).toHaveLength(1)
    expect(studentNotifications.filter((n) => n['type'] === 'ticket_reply')).toHaveLength(1)
    expect(ticket['version']).toBe(1)
  })

  it('Reply does not rotate the ticket ETag/version', async () => {
    const studentId = `usr_student_${randomUUID()}`
    const coordId = `usr_coord_${randomUUID()}`
    await seedUser('student', studentId)
    await seedUser('coordinator', coordId)
    const ticketId = await createOpenTicket(studentId)
    const before = await readTicket(ticketId)

    await new PostTicketReplyCommandHandler(new FirestoreUnitOfWork(), firestoreIdGenerator).handle(
      {
        actor: actorFor('coordinator', coordId),
        ticketId,
        text: 'hi',
      }
    )

    const after = await readTicket(ticketId)
    expect(before['version']).toBe(after['version'])
    expect((after['updatedAt'] as Timestamp).toMillis()).toBeGreaterThanOrEqual(
      (before['updatedAt'] as Timestamp).toMillis()
    )
  })

  it('Coordinator transitioning open → in_progress writes activity with actorRole and rotates ETag', async () => {
    const studentId = `usr_student_${randomUUID()}`
    const coordId = `usr_coord_${randomUUID()}`
    await seedUser('student', studentId)
    await seedUser('coordinator', coordId)
    const ticketId = await createOpenTicket(studentId)

    await new TransitionTicketCommandHandler(
      new FirestoreUnitOfWork(),
      firestoreIdGenerator
    ).handle({
      actor: actorFor('coordinator', coordId),
      ticketId,
      payload: { to: 'in_progress', comment: 'on it' },
    })

    const after = await readTicket(ticketId)
    const activity = await listActivity(ticketId)
    const studentNotifications = await listNotificationsFor(studentId)

    expect(after['status']).toBe('in_progress')
    expect(after['version']).toBe(2)
    expect(activity).toHaveLength(1)
    expect(activity[0]?.['type']).toBe('transition')
    expect(activity[0]?.['from']).toBe('open')
    expect(activity[0]?.['to']).toBe('in_progress')
    expect(activity[0]?.['actorRole']).toBe('coordinator')
    expect(activity[0]?.['comment']).toBe('on it')
    expect(studentNotifications.some((n) => n['type'] === 'ticket_transition')).toBe(true)
  })

  it('Stale If-Match returns 412', async () => {
    const studentId = `usr_student_${randomUUID()}`
    const coordId = `usr_coord_${randomUUID()}`
    await seedUser('student', studentId)
    await seedUser('coordinator', coordId)
    const ticketId = await createOpenTicket(studentId)

    await expect(
      new TransitionTicketCommandHandler(new FirestoreUnitOfWork(), firestoreIdGenerator).handle({
        actor: actorFor('coordinator', coordId),
        ticketId,
        payload: { to: 'in_progress', comment: undefined },
        metadata: { expectedVersion: 99 },
      })
    ).rejects.toMatchObject({ name: 'PreconditionFailedError' })
  })

  it('Get rejects non-owner student with ticket_not_owner', async () => {
    const ownerId = `usr_student_${randomUUID()}`
    const otherId = `usr_student_${randomUUID()}`
    await seedUser('student', ownerId)
    await seedUser('student', otherId)
    const ticketId = await createOpenTicket(ownerId)

    await expect(
      new GetTicketQueryHandler(new FirestoreUnitOfWork()).handle({
        actor: actorFor('student', otherId),
        ticketId,
      })
    ).rejects.toMatchObject({ reason: 'ticket_not_owner' })
  })

  it('Reply rejects non-owner student with student_not_owner', async () => {
    const ownerId = `usr_student_${randomUUID()}`
    const otherId = `usr_student_${randomUUID()}`
    await seedUser('student', ownerId)
    await seedUser('student', otherId)
    const ticketId = await createOpenTicket(ownerId)

    await expect(
      new PostTicketReplyCommandHandler(new FirestoreUnitOfWork(), firestoreIdGenerator).handle({
        actor: actorFor('student', otherId),
        ticketId,
        text: 'snooping',
      })
    ).rejects.toMatchObject({ reason: 'student_not_owner' })
  })

  it('Transition rejects non-owner student with student_not_owner', async () => {
    const ownerId = `usr_student_${randomUUID()}`
    const otherId = `usr_student_${randomUUID()}`
    await seedUser('student', ownerId)
    await seedUser('student', otherId)
    const ticketId = await createOpenTicket(ownerId)

    await expect(
      new TransitionTicketCommandHandler(new FirestoreUnitOfWork(), firestoreIdGenerator).handle({
        actor: actorFor('student', otherId),
        ticketId,
        payload: { to: 'closed', comment: undefined },
      })
    ).rejects.toMatchObject({ reason: 'student_not_owner' })
  })

  it('List supports status filter and cursor pagination', async () => {
    const studentId = `usr_student_${randomUUID()}`
    const coordId = `usr_coord_${randomUUID()}`
    await seedUser('student', studentId)
    await seedUser('coordinator', coordId)
    const t1 = await createOpenTicket(studentId)
    const t2 = await createOpenTicket(studentId)
    const t3 = await createOpenTicket(studentId)
    await new TransitionTicketCommandHandler(
      new FirestoreUnitOfWork(),
      firestoreIdGenerator
    ).handle({
      actor: actorFor('coordinator', coordId),
      ticketId: t1,
      payload: { to: 'in_progress', comment: undefined },
    })

    const list = new ListTicketsQueryHandler(new FirestoreUnitOfWork())
    const inProgress = await list.handle({
      actor: actorFor('coordinator', coordId),
      filter: { status: 'in_progress', limit: 50, sortDirection: 'desc', cursor: undefined },
    })
    const firstPage = await list.handle({
      actor: actorFor('coordinator', coordId),
      filter: { status: undefined, limit: 2, sortDirection: 'desc', cursor: undefined },
    })
    const secondPage = await list.handle({
      actor: actorFor('coordinator', coordId),
      filter: {
        status: undefined,
        limit: 2,
        sortDirection: 'desc',
        cursor: firstPage.cursor ?? undefined,
      },
    })

    expect(inProgress.items.map((t) => t.id)).toEqual([t1])
    expect(firstPage.items).toHaveLength(2)
    expect(firstPage.cursor).not.toBeNull()
    const seen = new Set([
      ...firstPage.items.map((t) => t.id),
      ...secondPage.items.map((t) => t.id),
    ])
    expect(seen).toEqual(new Set([t1, t2, t3]))
  })

  it('Handlers reject actors without a platformUser record', async () => {
    const noUser = {
      firebaseUid: `fb_${randomUUID()}`,
      email: 'ghost@rmit.edu.au',
      platformUser: undefined,
    } as const

    await expect(
      new CreateTicketCommandHandler(new FirestoreUnitOfWork(), firestoreIdGenerator).handle({
        actor: noUser,
        payload: { subject: 's', body: 'b', category: undefined },
      })
    ).rejects.toMatchObject({ reason: 'no_platform_user' })

    await expect(
      new PostTicketReplyCommandHandler(new FirestoreUnitOfWork(), firestoreIdGenerator).handle({
        actor: noUser,
        ticketId: 'whatever',
        text: 'hi',
      })
    ).rejects.toMatchObject({ reason: 'no_platform_user' })

    await expect(
      new TransitionTicketCommandHandler(new FirestoreUnitOfWork(), firestoreIdGenerator).handle({
        actor: noUser,
        ticketId: 'whatever',
        payload: { to: 'closed', comment: undefined },
      })
    ).rejects.toMatchObject({ reason: 'no_platform_user' })

    await expect(
      new GetTicketQueryHandler(new FirestoreUnitOfWork()).handle({
        actor: noUser,
        ticketId: 'whatever',
      })
    ).rejects.toMatchObject({ reason: 'no_platform_user' })

    await expect(
      new ListTicketsQueryHandler(new FirestoreUnitOfWork()).handle({
        actor: noUser,
        filter: { status: undefined, limit: 50, sortDirection: 'desc', cursor: undefined },
      })
    ).rejects.toMatchObject({ reason: 'no_platform_user' })
  })
})
