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
  if (status === 'offer_approved') return 'approved'
  if (status === 'offer_changes_requested') return 'changes_requested'
  if (status === 'rejected') return 'flagged'
  return 'pending'
}

export function opportunityStatusToApprovalStatus(status: string): ApprovalStatus {
  if (status === 'published') return 'approved'
  if (status === 'rejected') return 'changes_requested'
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
    notes: [`API-backed opportunity ${opportunity.id}`],
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
        : ['No blocking API-backed issues recorded'],
    notes: [`API-backed internship ${internship.id}`],
    aiConfidence: 86,
    riskLevel: internship.status === 'rejected' ? 'High' : 'Medium',
  }
}

export function mapSemesterToInventory(semester: SemesterResponse) {
  return {
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

export function mapNotification(notification: NotificationResponse) {
  const href = notification.relatedInternshipId
    ? `/coordinator/contracts/${notification.relatedInternshipId}`
    : notification.relatedOpportunityId
      ? `/coordinator/jobs/${notification.relatedOpportunityId}`
      : '/coordinator/notifications'

  return {
    id: notification.id,
    title: notification.title,
    body: notification.body,
    urgency: notification.type.includes('decision') ? 'High' : 'Medium',
    unread: !notification.readAt,
    href,
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
  return internships.map((item) => ({
    id: item.userId,
    name: item.userId,
    studentId: item.userId,
    course: item.studentProgramCode ?? 'Program pending',
    semester: 'Current semester',
    overallStatus: studentStatus(item.status),
    email: 'Email available from user profile endpoint',
    year: 'Current',
    placementStatus: item.status.replace(/_/g, ' '),
    lastAudit: item.lastSubmittedAt ?? item.createdAt,
  }))
}

export function buildPendingApprovals(
  jobs: SelfSourcedJob[],
  contracts: ContractApproval[]
): PendingApproval[] {
  return [
    ...jobs
      .filter((job) => job.status === 'pending' || job.status === 'flagged')
      .map((job) => ({
        id: job.id,
        studentName: job.studentName,
        type: 'Self-Sourced Job' as const,
        date: job.submissionDate,
        href: `/coordinator/jobs/${job.id}`,
      })),
    ...contracts
      .filter((contract) => contract.status === 'pending' || contract.status === 'flagged')
      .map((contract) => ({
        id: contract.id,
        studentName: contract.studentName,
        type: 'Contract' as const,
        date: contract.submissionDate,
        href: `/coordinator/contracts/${contract.id}`,
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
  if (value.includes('approved') || value.includes('published')) return 'green'
  if (value.includes('reject')) return 'red'
  if (value.includes('change') || value.includes('pending')) return 'amber'
  return 'blue'
}

function studentStatus(status: string): StudentOverallStatus {
  if (status === 'offer_approved') return 'approved'
  if (status === 'rejected' || status === 'offer_changes_requested') return 'needs_attention'
  return 'on_track'
}
