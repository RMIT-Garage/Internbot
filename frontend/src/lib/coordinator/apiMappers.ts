import type {
  InternshipListItemResponse,
  InternshipResponse,
  NotificationResponse,
  OpportunityResponse,
  SemesterResponse,
  UserActivityFeedItemResponse,
} from '@/types/api'
import type {
  ApprovalStatus,
  ContractApproval,
  CoordinatorStudent,
  PendingApproval,
  SelfSourcedJob,
  StudentOverallStatus,
  WorkflowTone,
} from './mockData'

export function internshipStatusToApprovalStatus(status: string): ApprovalStatus {
  if (status === 'offer_pending_review') return 'pending'
  if (status === 'offer_approved') return 'approved'
  if (status === 'offer_changes_requested') return 'changes_requested'
  if (status === 'rejected') return 'rejected'
  return 'flagged'
}

export function opportunityStatusToApprovalStatus(status: string): ApprovalStatus {
  if (status === 'published' || status === 'approved') return 'approved'
  if (status === 'rejected') return 'rejected'
  if (status === 'pending_verification') return 'pending'
  return 'flagged'
}

export function mapOpportunityToSelfSourcedJob(opportunity: OpportunityResponse): SelfSourcedJob {
  return {
    id: opportunity.id,
    studentName: opportunity.submittedByUserId ?? opportunity.createdByUserId ?? 'Student pending',
    studentId: opportunity.submittedByUserId ?? 'Unassigned',
    course: 'Program pending',
    semester: opportunity.semesterId,
    jobTitle: opportunity.jobTitle,
    company: opportunity.employerName,
    submissionDate: opportunity.updatedAt ?? opportunity.createdAt,
    status: opportunityStatusToApprovalStatus(opportunity.status),
    location: opportunity.location ?? 'Not supplied',
    workPattern: opportunity.workMode ?? 'Not supplied',
    supervisor: 'Supervisor details pending',
    description: opportunity.descriptionText,
    aiAdvisory:
      'AI advisory is not yet backed by the API. Coordinator should assess learning alignment, supervision, and work mode.',
    concerns:
      opportunity.status === 'pending_verification' ? ['Awaiting coordinator verification'] : [],
    notes: [],
    aiConfidence: 84,
    riskLevel: opportunity.workMode === 'remote' ? 'Medium' : 'Low',
  }
}

export function mapInternshipToContractApproval(
  internship: InternshipListItemResponse | InternshipResponse
): ContractApproval {
  return {
    id: internship.id,
    studentName: internship.userId,
    studentId: internship.userId,
    course: internship.studentProgramCode ?? 'Program pending',
    semester: 'Current semester',
    submissionDate: internship.lastSubmittedAt ?? internship.createdAt,
    status: internshipStatusToApprovalStatus(internship.status),
    documentName: `${internship.opportunityJobTitle} offer submission`,
    placementHost: internship.opportunityEmployerName,
    aiIssues:
      internship.status === 'offer_pending_review'
        ? ['Offer is awaiting coordinator review', 'Attachment and date checks require review']
        : [],
    notes: [],
    aiConfidence: 86,
    riskLevel: internship.status === 'rejected' ? 'High' : 'Medium',
  }
}

export function mapSemesterToInventory(semester: SemesterResponse) {
  return {
    id: semester.id,
    semesterCode: semester.semesterCode,
    courseCode: semester.courseCode,
    name: semester.displayName,
    status: semester.status === 'draft' ? 'pending' : semester.status,
    students: 0,
    window:
      semester.enrolmentOpenAt && semester.enrolmentCloseAt
        ? `${shortDate(semester.enrolmentOpenAt)} - ${shortDate(semester.enrolmentCloseAt)}`
        : 'Window pending',
    phase: semester.status === 'active' ? 'Review and approvals' : 'Academic cycle setup',
    flagged: 0,
  }
}

export function mapNotification(
  notification: NotificationResponse,
  context: {
    internships?: Map<string, InternshipListItemResponse | InternshipResponse>
    opportunities?: Map<string, OpportunityResponse>
  } = {}
) {
  const href = notification.relatedInternshipId
    ? `/coordinator/contracts/review?id=${encodeURIComponent(notification.relatedInternshipId)}`
    : notification.relatedOpportunityId
      ? `/coordinator/jobs/review?id=${encodeURIComponent(notification.relatedOpportunityId)}`
      : '/coordinator/notifications'
  const internship = notification.relatedInternshipId
    ? context.internships?.get(notification.relatedInternshipId)
    : undefined
  const opportunity = notification.relatedOpportunityId
    ? context.opportunities?.get(notification.relatedOpportunityId)
    : undefined
  const workflow = buildNotificationWorkflow(notification, internship, opportunity)

  return {
    id: notification.id,
    title: workflow.primary,
    body: workflow.secondary,
    workflowStage: workflow.stage,
    placementType: workflow.placementType,
    updatedAt: shortDate(notification.createdAt),
    unread: !notification.readAt,
    href,
  }
}

function buildNotificationWorkflow(
  notification: NotificationResponse,
  internship?: InternshipListItemResponse | InternshipResponse,
  opportunity?: OpportunityResponse
) {
  if (internship) {
    const student = internship.userId || 'Student'
    const event =
      internship.status === 'offer_approved'
        ? 'placement approved'
        : internship.status === 'rejected'
          ? 'placement rejected'
          : internship.status === 'offer_changes_requested'
            ? 'responded to requested placement changes'
            : 'uploaded signed contract'
    const stage =
      internship.status === 'offer_pending_review'
        ? 'Contract verification stage'
        : internship.status === 'offer_approved'
          ? 'Review completed'
          : internship.status === 'offer_changes_requested'
            ? 'Changes requested'
            : internship.status.replace(/_/g, ' ')

    return {
      primary: `${student} ${event}`,
      secondary: `${internship.opportunityJobTitle} • ${internship.opportunityEmployerName} • ${stage}`,
      stage,
      placementType:
        internship.opportunityType === 'custom' ? 'Self-sourced placement' : 'Partner opportunity',
    }
  }

  if (opportunity) {
    const student = opportunity.submittedByUserId ?? opportunity.createdByUserId ?? 'Student'
    const event =
      opportunity.status === 'pending_verification'
        ? 'submitted placement verification'
        : opportunity.status === 'published'
          ? 'placement approved'
          : opportunity.status === 'rejected'
            ? 'placement rejected'
            : 'placement record updated'
    const stage =
      opportunity.status === 'pending_verification'
        ? 'Awaiting coordinator review'
        : opportunity.status === 'published'
          ? 'Review completed'
          : opportunity.status === 'rejected'
            ? 'Review closed'
            : opportunity.status.replace(/_/g, ' ')

    return {
      primary: `${student} ${event}`,
      secondary: `${opportunity.jobTitle} • ${opportunity.employerName} • ${stage}`,
      stage,
      placementType:
        opportunity.type === 'custom' ? 'Self-sourced placement' : 'Partner opportunity',
    }
  }

  return {
    primary: notification.title,
    secondary: notification.body,
    stage: notification.type.replace(/_/g, ' '),
    placementType: 'Workflow alert',
  }
}

export function mapActivity(item: UserActivityFeedItemResponse) {
  return {
    title: item.type.replace(/_/g, ' '),
    description:
      item.text ??
      `${item.resourceType} moved ${item.from ?? 'from queue'} to ${item.to ?? 'updated'}.`,
    time: shortDate(item.createdAt),
    tone: activityTone(item.to ?? item.type),
  }
}

export function deriveStudentsFromInternships(
  internships: Array<InternshipListItemResponse | InternshipResponse>
): CoordinatorStudent[] {
  return internships
    .map((item, index) => ({
      rowId: `${item.userId}-${item.id}-${index}`,
      recordId: item.id,
      id: item.userId,
      name: item.userId,
      studentId: item.userId,
      course: item.studentProgramCode ?? 'Program pending',
      semester: 'Current semester',
      overallStatus: studentStatus(item.status),
      email: 'Additional student profile data unavailable.',
      year: 'Current',
      placementStatus: item.status.replace(/_/g, ' '),
      lastAudit: item.lastSubmittedAt ?? item.createdAt,
    }))
    .sort((a, b) => Date.parse(b.lastAudit ?? '') - Date.parse(a.lastAudit ?? ''))
}

export function buildPendingApprovals(
  jobs: SelfSourcedJob[],
  contracts: ContractApproval[]
): PendingApproval[] {
  return [
    ...jobs
      .filter((job) => job.status === 'pending')
      .map((job) => ({
        id: job.id,
        studentName: job.studentName,
        type: 'Placement Review' as const,
        date: job.submissionDate,
        href: `/coordinator/jobs/review?id=${encodeURIComponent(job.id)}`,
      })),
    ...contracts
      .filter((contract) => contract.status === 'pending')
      .map((contract) => ({
        id: contract.id,
        studentName: contract.studentName,
        type: 'Contract' as const,
        date: contract.submissionDate,
        href: `/coordinator/contracts/review?id=${encodeURIComponent(contract.id)}`,
      })),
  ]
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 5)
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat('en-AU', { month: 'short', day: 'numeric' }).format(
    new Date(value)
  )
}

function activityTone(value: string): WorkflowTone {
  if (value.includes('reject')) return 'red'
  if (value.includes('change') || value.includes('pending')) return 'neutral'
  return value.includes('approved') || value.includes('published') ? 'charcoal' : 'neutral'
}

function studentStatus(status: string): StudentOverallStatus {
  if (status === 'offer_approved') return 'approved'
  if (
    status === 'rejected' ||
    status === 'offer_changes_requested' ||
    status === 'offer_pending_review'
  ) {
    return 'needs_attention'
  }
  return 'on_track'
}
