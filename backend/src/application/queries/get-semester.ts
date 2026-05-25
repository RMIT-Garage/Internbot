import type { RequestActor } from '../actor'
import type { SemesterQueryService, SemesterKPIs } from '../ports/queries/semester-query-service'
import type { AuthorizationService } from '../ports/authorization-service'
import type { Semester } from '../../domain/entities/semester'
import { NotFoundError } from '../../domain/errors'

export interface SemesterResult {
  semester: Semester
  kpis: SemesterKPIs
}

/**
 * GET /api/v1/semesters/:id query — returns one semester record.
 *
 * Authorization per WORKFLOW-API-SPEC.md §7.5: any authenticated platform
 * user (student or coordinator) may read.
 */
export interface GetSemesterQuery {
  actor: RequestActor
  semesterId: string
}

export class GetSemesterQueryHandler {
  constructor(
    private readonly semesterQueries: SemesterQueryService,
    private readonly authz: AuthorizationService
  ) {}

  async handle(q: GetSemesterQuery): Promise<SemesterResult> {
    this.authz.requirePlatformUser(q.actor)

    const semester = await this.semesterQueries.findById(q.semesterId)
    if (!semester) throw new NotFoundError('Semester', q.semesterId)
    const kpis = await this.semesterQueries.getKPIs(q.semesterId)
    return { semester, kpis }
  }
}
