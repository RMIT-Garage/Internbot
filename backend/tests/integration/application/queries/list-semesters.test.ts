import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { CreateSemesterCommandHandler } from '../../../../src/application/commands/create-semester'
import { ListSemestersQueryHandler } from '../../../../src/application/queries/list-semesters'
import { FirestoreUnitOfWork } from '../../../../src/infrastructure/firestore/firestore-unit-of-work'
import { firestoreIdGenerator } from '../../../../src/infrastructure/firestore/firestore-id-generator'
import { firestoreSemesterQueryService } from '../../../../src/infrastructure/firestore/firestore-semester-query-service'
import { defaultAuthorizationService } from '../../../../src/infrastructure/authorization/default-authorization-service'
import { initEmulator, clearDocs, trackDoc } from '../../../setup.emulator'
import type { RequestActor } from '../../../../src/application/actor'

function actorFor(role: 'student' | 'coordinator'): RequestActor {
  return {
    firebaseUid: `fb_${randomUUID()}`,
    email: `${randomUUID().slice(0, 6)}@rmit.edu.au`,
    platformUser: { id: `usr_${randomUUID()}`, role },
  }
}

async function seedThree(courseCode: string): Promise<string[]> {
  const create = new CreateSemesterCommandHandler(
    new FirestoreUnitOfWork(),
    defaultAuthorizationService,
    firestoreIdGenerator
  )
  const ids: string[] = []
  for (let i = 0; i < 3; i++) {
    const code = `2026-S${randomUUID()
      .slice(0, 8)
      .replace(/[^A-Za-z0-9]/g, 'a')}`
    const { id } = await create.handle({
      actor: actorFor('coordinator'),
      payload: {
        semesterCode: code,
        courseCode,
        displayName: `Sem ${i}`,
        status: 'draft',
        enrolmentOpenAt: undefined,
        enrolmentCloseAt: undefined,
      },
    })
    trackDoc('semesters', id)
    ids.push(id)
  }
  return ids
}

describe('ListSemestersQueryHandler — integration', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
  })

  it('paginates with cursor when more results exist than limit', async () => {
    const courseCode = `INTE${Math.floor(Math.random() * 9000 + 1000)}`
    await seedThree(courseCode)
    const handler = new ListSemestersQueryHandler(
      firestoreSemesterQueryService,
      defaultAuthorizationService
    )

    const page1 = await handler.handle({
      actor: actorFor('student'),
      filter: {
        status: undefined,
        semesterCode: undefined,
        courseCode,
        limit: 2,
        sortField: 'createdAt',
        sortDirection: 'desc',
        cursor: undefined,
      },
    })
    expect(page1.items.length).toBe(2)
    expect(page1.cursor).not.toBeNull()

    const page2 = await handler.handle({
      actor: actorFor('student'),
      filter: {
        status: undefined,
        semesterCode: undefined,
        courseCode,
        limit: 2,
        sortField: 'createdAt',
        sortDirection: 'desc',
        cursor: page1.cursor!,
      },
    })
    expect(page2.items.length).toBe(1)
    expect(page2.cursor).toBeNull()
  })

  it('filters by courseCode', async () => {
    const courseA = `INTE${Math.floor(Math.random() * 9000 + 1000)}`
    const courseB = `INTE${Math.floor(Math.random() * 9000 + 1000)}`
    await seedThree(courseA)
    await seedThree(courseB)

    const handler = new ListSemestersQueryHandler(
      firestoreSemesterQueryService,
      defaultAuthorizationService
    )
    const result = await handler.handle({
      actor: actorFor('coordinator'),
      filter: {
        status: undefined,
        semesterCode: undefined,
        courseCode: courseA,
        limit: 50,
        sortField: 'createdAt',
        sortDirection: 'desc',
        cursor: undefined,
      },
    })
    expect(result.items.every((s) => s.semester.courseCode === courseA)).toBe(true)
    expect(result.items.length).toBeGreaterThanOrEqual(3)
  })

  it('sort=enrolmentOpenAt includes semesters created without an enrolment window', async () => {
    // Regression: Firestore `orderBy(field)` only returns docs where the
    // field is *present*. Earlier the create-payload mapper omitted the key
    // when undefined, so newly-created semesters silently disappeared from
    // `sort=enrolmentOpenAt`. Persisting `null` puts them on the boundary
    // of the ordered range and keeps them paginatable.
    const courseCode = `INTE${Math.floor(Math.random() * 9000 + 1000)}`
    const create = new CreateSemesterCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService,
      firestoreIdGenerator
    )

    // Mix: one with an enrolment window, one without.
    const withWindow = await create.handle({
      actor: actorFor('coordinator'),
      payload: {
        semesterCode: `2026-S${randomUUID()
          .slice(0, 8)
          .replace(/[^A-Za-z0-9]/g, 'a')}`,
        courseCode,
        displayName: 'Has window',
        status: 'draft',
        enrolmentOpenAt: new Date('2026-01-15T00:00:00Z'),
        enrolmentCloseAt: new Date('2026-03-13T23:59:59Z'),
      },
    })
    trackDoc('semesters', withWindow.id)

    const noWindow = await create.handle({
      actor: actorFor('coordinator'),
      payload: {
        semesterCode: `2026-S${randomUUID()
          .slice(0, 8)
          .replace(/[^A-Za-z0-9]/g, 'a')}`,
        courseCode,
        displayName: 'No window',
        status: 'draft',
        enrolmentOpenAt: undefined,
        enrolmentCloseAt: undefined,
      },
    })
    trackDoc('semesters', noWindow.id)

    const handler = new ListSemestersQueryHandler(
      firestoreSemesterQueryService,
      defaultAuthorizationService
    )
    const result = await handler.handle({
      actor: actorFor('coordinator'),
      filter: {
        status: undefined,
        semesterCode: undefined,
        courseCode,
        limit: 50,
        sortField: 'enrolmentOpenAt',
        sortDirection: 'asc',
        cursor: undefined,
      },
    })
    const ids = result.items.map((s) => s.semester.id)
    expect(ids).toContain(withWindow.id)
    expect(ids).toContain(noWindow.id)
  })

  it('rejects pre-sync caller', async () => {
    const handler = new ListSemestersQueryHandler(
      firestoreSemesterQueryService,
      defaultAuthorizationService
    )
    await expect(
      handler.handle({
        actor: {
          firebaseUid: `fb_${randomUUID()}`,
          email: 'x@rmit.edu.au',
          platformUser: null,
        },
        filter: {
          status: undefined,
          semesterCode: undefined,
          courseCode: undefined,
          limit: 50,
          sortField: 'createdAt',
          sortDirection: 'desc',
          cursor: undefined,
        },
      })
    ).rejects.toMatchObject({ reason: 'no_platform_user' })
  })
})
