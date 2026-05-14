import type { RequestActor } from '../actor'
import type { InternshipQueryService } from '../ports/queries/internship-query-service'
import type { SemesterQueryService } from '../ports/queries/semester-query-service'
import type { UserQueryService } from '../ports/queries/user-query-service'
import type { AuthorizationService } from '../ports/authorization-service'
import type { WorkflowState } from '../../domain/services/workflow-derivation'
import { NotFoundError } from '../../domain/errors'
import { deriveWorkflowState } from '../../domain/services/workflow-derivation'

export interface UserWorkflowResult {
  workflow: WorkflowState
}

/**
 * GET /api/v1/users/:id/workflow query.
 *
 * Authorization (per §7.2):
 *   - Student owner (`{id} == caller.id`): allowed
 *   - Coordinator: may read any student's workflow during review
 *   - Other students: 403 `student_not_owner`
 *
 * Coordinator targets → 404. The sub-resource doesn't exist for `coordinator`.
 */
export interface GetUserWorkflowQuery {
  actor: RequestActor
  userId: string
}

export class GetUserWorkflowQueryHandler {
  constructor(
    private readonly userQueries: UserQueryService,
    private readonly internshipQueries: InternshipQueryService,
    private readonly semesterQueries: SemesterQueryService,
    private readonly authz: AuthorizationService
  ) {}

  async handle(q: GetUserWorkflowQuery): Promise<UserWorkflowResult> {
    this.authz.requireSelfOrRole(q.actor, q.userId, 'coordinator', 'student_not_owner')

    const user = await this.userQueries.findById(q.userId)
    if (!user) throw new NotFoundError('User', q.userId)
    if (!user.isStudent()) {
      throw new NotFoundError('User', q.userId)
    }

    const semester = user.studentProfile.semesterId
      ? ((await this.semesterQueries.findById(user.studentProfile.semesterId)) ?? undefined)
      : undefined

    const internships = await this.internshipQueries.listByUserId(user.id)
    const workflow = deriveWorkflowState(user, semester, new Date(), internships)
    return { workflow }
  }
}
