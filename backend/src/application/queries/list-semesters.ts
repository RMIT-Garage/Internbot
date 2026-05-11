import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { SemesterListResult } from '../models/semester'
import type { SemesterStatus } from '../../domain/value-objects/semester-enums'
import type { SemesterListCursor } from '../../domain/repositories/semester-repository'
import { ForbiddenError } from '../../domain/errors'

/**
 * GET /api/v1/semesters query — list semesters with pagination, sort, and
 * status / semesterCode / courseCode filters.
 *
 * Authorization per WORKFLOW-API-SPEC.md §7.5: any authenticated platform
 * user. The list endpoint is intentionally not role-gated — students need
 * to surface available active semesters before selecting one.
 *
 * The query layer is repository-shape native: `cursor` is the typed
 * domain cursor, not the opaque base64 token. The api mapper handles
 * encode / decode of `pageToken ↔ cursor` at the boundary.
 */
export interface ListSemestersQuery {
  actor: RequestActor
  filter: {
    status: readonly SemesterStatus[] | undefined
    semesterCode: string | undefined
    courseCode: string | undefined
    limit: number
    sortField: 'createdAt' | 'enrolmentOpenAt'
    sortDirection: 'asc' | 'desc'
    cursor: SemesterListCursor | undefined
  }
}

export class ListSemestersQueryHandler {
  constructor(private readonly uow: UnitOfWork) {}

  async handle(
    q: ListSemestersQuery
  ): Promise<SemesterListResult & { cursor: SemesterListCursor | null }> {
    if (!q.actor.platformUser) {
      throw new ForbiddenError('Caller has no platform user record.', 'no_platform_user')
    }

    return this.uow.execute(async (ctx) => {
      const page = await ctx.semesters.list(q.filter)
      return {
        items: page.items,
        nextPageToken: null, // route layer overwrites with the encoded cursor
        cursor: page.nextCursor,
      }
    })
  }
}
