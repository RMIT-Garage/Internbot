import type { RequestActor } from '../actor'
import type { SemesterQueryService } from '../ports/queries/semester-query-service'
import type { AuthorizationService } from '../ports/authorization-service'
import type { Semester } from '../../domain/entities/semester'
import type { SemesterListCursor } from '../read-models/semester'
import type { SemesterStatus } from '../../domain/value-objects/semester-enums'

export interface SemesterListResult {
  items: readonly Semester[]
  nextPageToken: string | null
}

/**
 * GET /api/v1/semesters query.
 *
 * Authorization per WORKFLOW-API-SPEC.md §7.5: any authenticated platform
 * user. The list endpoint is intentionally not role-gated — students need
 * to surface available active semesters before selecting one.
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
  constructor(
    private readonly semesterQueries: SemesterQueryService,
    private readonly authz: AuthorizationService
  ) {}

  async handle(
    q: ListSemestersQuery
  ): Promise<SemesterListResult & { cursor: SemesterListCursor | null }> {
    this.authz.requirePlatformUser(q.actor)

    const page = await this.semesterQueries.list(q.filter)
    return {
      items: page.items,
      nextPageToken: null,
      cursor: page.nextCursor,
    }
  }
}
