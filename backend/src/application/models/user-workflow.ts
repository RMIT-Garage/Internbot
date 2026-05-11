import type { WorkflowState } from '../../domain/services/workflow-derivation'

/**
 * UserWorkflowResult — application DTO returned by `GetUserWorkflow`.
 *
 * Wraps the domain `WorkflowState` triple so the api mapper has a stable
 * single argument to format. Nothing here is HTTP-specific; the field
 * names match the wire shape because the §7.2 spec table picks the same
 * names — kept identical to remove a translation layer that has zero
 * value while the two vocabularies are 1:1.
 */
export interface UserWorkflowResult {
  workflow: WorkflowState
}
