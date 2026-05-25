import type { RequestActor } from '../actor'
import type { AuthorizationService } from '../ports/authorization-service'
import type { SemesterQueryService } from '../ports/queries/semester-query-service'
import type {
  SemesterStudentQueryService,
  SemesterStudentListFilter,
  SemesterStudentListPage,
  SemesterStudentPlacementStatus,
} from '../ports/queries/semester-student-query-service'
import { NotFoundError } from '../../domain/errors'

export interface ListSemesterStudentsQuery {
  actor: RequestActor
  semesterId: string
  filter: {
    placementStatus?: SemesterStudentPlacementStatus
    programCode?: string
    limit: number
    cursor?: string
  }
}

export class ListSemesterStudentsQueryHandler {
  constructor(
    private readonly semesterStudentQueries: SemesterStudentQueryService,
    private readonly semesterQueries: SemesterQueryService,
    private readonly authz: AuthorizationService
  ) {}

  async handle(q: ListSemesterStudentsQuery): Promise<SemesterStudentListPage> {
    this.authz.requireRole(q.actor, 'coordinator')

    const semester = await this.semesterQueries.findById(q.semesterId)
    if (!semester) throw new NotFoundError('Semester', q.semesterId)

    const filter: SemesterStudentListFilter = {
      semesterId: q.semesterId,
      placementStatus: q.filter.placementStatus,
      programCode: q.filter.programCode,
      limit: q.filter.limit,
      cursor: q.filter.cursor,
    }
    return this.semesterStudentQueries.listBySemesterId(filter)
  }
}
