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
import {
  OPPORTUNITY_SELF_SOURCED_TAB,
  PLACEMENT_PROCESSING_CONTEXT,
  SELF_SOURCED_REVIEW_CONTEXT,
  withReviewReturn,
} from './reviewRouting'
import { formatStudentDisplayFromIds } from './studentDisplay'
import { resolveSemesterLabel } from '@/lib/semester/display'

export function internshipStatusToApprovalStatus(status: string): ApprovalStatus {
  if (status === 'applied') return 'awaiting_contract_details'
  if (status === 'offer_pending_review') return 'awaiting_contract_review'
  if (status === 'offer_approved') return 'approved'
  if (status === 'offer_changes_requested') return 'awaiting_documents'
  if (status === 'rejected') return 'rejected'
  if (isExplicitlyFlaggedStatus(status)) return 'flagged'
  return 'pending'
}

export function opportunityStatusToApprovalStatus(status: string): ApprovalStatus {
  if (status === 'published' || status === 'approved') return 'awaiting_contract_details'
  if (status === 'rejected') return 'rejected'
  if (status === 'pending_verification') return 'awaiting_placement_approval'
  if (status === 'draft' || status === 'archived') return 'pending'
  if (isExplicitlyFlaggedStatus(status)) return 'flagged'
  return 'pending'
}

function isExplicitlyFlaggedStatus(status: string) {
  return [
    'flagged',
    'escalated',
    'manual_escalation',
    'compliance_concern',
    'invalid_contract',
    'missing_critical_information',
    'suspicious_documentation',
    'incomplete_documentation',
  ].includes(status)
}

/** Student originally submitted this custom opportunity (may now be published). */
export function hasStudentSubmitter(
  opportunity: Pick<OpportunityResponse, 'type' | 'submittedByUserId'>
) {
  return opportunity.type === 'custom' && Boolean(opportunity.submittedByUserId)
}

/** Awaiting coordinator suitability review — not a published listing detail view. */
export function needsPlacementSuitabilityReview(
  opportunity: Pick<OpportunityResponse, 'type' | 'submittedByUserId' | 'status'>
) {
  return hasStudentSubmitter(opportunity) && opportunity.status === 'pending_verification'
}

/** @deprecated Use {@link needsPlacementSuitabilityReview} or {@link hasStudentSubmitter}. */
export function isSelfSourcedOpportunityResponse(
  opportunity: Pick<OpportunityResponse, 'type' | 'submittedByUserId' | 'status'>
) {
  return needsPlacementSuitabilityReview(opportunity)
}

export function opportunitySourceTypeLabel(
  opportunity: Pick<OpportunityResponse, 'type' | 'submittedByUserId' | 'status'>
) {
  if (needsPlacementSuitabilityReview(opportunity)) return 'Self-Sourced (pending review)'
  if (hasStudentSubmitter(opportunity) && opportunity.status === 'published') {
    return 'Verified student listing'
  }
  if (opportunity.type === 'pre_approved') return 'CareerHub'
  return 'Coordinator Published'
}

export function opportunityReviewEyebrow(
  opportunity: Pick<OpportunityResponse, 'type' | 'submittedByUserId' | 'status'>,
  mode: 'suitability' | 'detail' = 'detail'
) {
  if (needsPlacementSuitabilityReview(opportunity)) {
    return mode === 'suitability' ? 'Self-Sourced Opportunity Review' : 'Self-Sourced Opportunity'
  }
  if (opportunity.type === 'pre_approved') return 'CareerHub Opportunity'
  if (opportunity.status === 'published') return 'Published Opportunity'
  if (opportunity.status === 'draft') return 'Draft Opportunity'
  if (opportunity.status === 'archived') return 'Archived Opportunity'
  return 'Coordinator Opportunity'
}

export function mapOpportunityToSelfSourcedJob(
  opportunity: OpportunityResponse,
  semesterLabels: Record<string, string> = {}
): SelfSourcedJob {
  return {
    id: opportunity.id,
    studentName: formatStudentDisplayFromIds(opportunity.submittedByUserId),
    studentId: formatStudentDisplayFromIds(opportunity.submittedByUserId),
    course: 'Program pending',
    semester: resolveSemesterLabel(opportunity.semesterId, semesterLabels),
    semesterId: opportunity.semesterId,
    jobTitle: opportunity.jobTitle,
    company: opportunity.employerName,
    submissionDate: opportunity.updatedAt ?? opportunity.createdAt,
    status: opportunityStatusToApprovalStatus(opportunity.status),
    location: opportunity.location ?? 'Not supplied',
    workPattern: formatWorkPattern(opportunity.workMode),
    supervisor: 'Supervisor details pending',
    description: opportunity.descriptionText,
    aiAdvisory:
      'Assess learning alignment, supervision, work mode, and supporting placement evidence before approval.',
    concerns: isExplicitlyFlaggedStatus(opportunity.status)
      ? ['Escalated for coordinator review']
      : [],
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
    studentName: formatStudentDisplayFromIds(undefined, internship.userId),
    studentId: formatStudentDisplayFromIds(undefined, internship.userId),
    studentUserId: internship.userId,
    course: internship.studentProgramCode ?? 'Program pending',
    semester: internship.semesterDisplayName || internship.semesterCode || 'Semester pending',
    semesterId: internship.semesterId,
    submissionDate: internship.lastSubmittedAt ?? internship.createdAt,
    status: internshipStatusToApprovalStatus(internship.status),
    documentName: `${internship.opportunityJobTitle} offer submission`,
    placementHost: internship.opportunityEmployerName,
    aiIssues: isExplicitlyFlaggedStatus(internship.status)
      ? ['Escalated for coordinator review']
      : internship.status === 'offer_pending_review'
        ? ['Offer is awaiting coordinator review', 'Attachment and date checks require review']
        : [],
    notes: [],
    aiConfidence: 86,
    riskLevel: internship.status === 'rejected' ? 'High' : 'Medium',
  }
}

export function mapSemesterToInventory(semester: SemesterResponse) {
  const effectiveStatus =
    (semester.status as string) === 'active' ? 'enrollment_open' : semester.status

  const badgeStatus =
    effectiveStatus === 'enrollment_open' ||
    effectiveStatus === 'placement_running' ||
    effectiveStatus === 'reporting'
      ? 'active'
      : effectiveStatus === 'draft'
        ? 'pending'
        : 'archived'

  const phase =
    effectiveStatus === 'enrollment_open'
      ? 'Enrollment Open'
      : effectiveStatus === 'placement_running'
        ? 'Placement Running'
        : effectiveStatus === 'reporting'
          ? 'Reporting'
          : effectiveStatus === 'draft'
            ? 'Setup'
            : 'Archived'

  return {
    id: semester.id,
    semesterCode: semester.semesterCode,
    courseCode: semester.courseCode,
    name: semester.displayName,
    status: badgeStatus,
    students: semester.enrolledStudentCount,
    window:
      semester.enrolmentOpenAt && semester.enrolmentCloseAt
        ? `${shortDate(semester.enrolmentOpenAt)} - ${shortDate(semester.enrolmentCloseAt)}`
        : 'Window pending',
    phase,
    flagged: semester.openOfferCount,
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
    ? withReviewReturn(
        `/coordinator/contracts/review?id=${encodeURIComponent(notification.relatedInternshipId)}`,
        '/coordinator/notifications',
        { context: PLACEMENT_PROCESSING_CONTEXT }
      )
    : notification.relatedOpportunityId
      ? withReviewReturn(
          `/coordinator/jobs/review?id=${encodeURIComponent(notification.relatedOpportunityId)}`,
          '/coordinator/notifications',
          { tab: OPPORTUNITY_SELF_SOURCED_TAB, context: SELF_SOURCED_REVIEW_CONTEXT }
        )
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
    const student = formatStudentDisplayFromIds(undefined, internship.userId)
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
    const student = formatStudentDisplayFromIds(opportunity.submittedByUserId)
    const event =
      opportunity.status === 'pending_verification'
        ? 'submitted placement verification'
        : opportunity.status === 'published'
          ? 'placement ready for contract details'
          : opportunity.status === 'rejected'
            ? 'placement rejected'
            : 'placement record updated'
    const stage =
      opportunity.status === 'pending_verification'
        ? 'Awaiting Placement Approval'
        : opportunity.status === 'published'
          ? 'Awaiting Contract Details'
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

export function mapActivity(
  item: UserActivityFeedItemResponse,
  context: {
    internships?: Map<string, InternshipListItemResponse | InternshipResponse>
    opportunities?: Map<string, OpportunityResponse>
    studentLabels?: Record<string, string>
  } = {}
) {
  const internship = item.internshipId ? context.internships?.get(item.internshipId) : undefined
  const opportunity = item.opportunityId
    ? context.opportunities?.get(item.opportunityId)
    : undefined
  const roleTitle =
    opportunity?.jobTitle ?? internship?.opportunityJobTitle ?? resourceFallbackTitle(item)
  const employer =
    opportunity?.employerName ?? internship?.opportunityEmployerName ?? 'Employer pending'
  const studentId = opportunity?.submittedByUserId ?? internship?.userId ?? null
  const student = studentId
    ? (context.studentLabels?.[studentId] ?? formatStudentDisplayFromIds(undefined, studentId))
    : formatStudentDisplayFromIds(null)
  const source = opportunity?.type === 'custom' ? 'self_sourced' : 'coordinator'
  const from = item.from ? humanizeActivityState(item.from, source) : null
  const to = item.to ? humanizeActivityState(item.to, source) : null
  const action = activityActionLabel(item, opportunity, internship)
  const bodyPrefix =
    item.resourceType === 'internship'
      ? `${student} / ${employer}`
      : activityBodyPrefix(opportunity, student, employer)

  return {
    title: `${action} — ${roleTitle}`,
    description: `${bodyPrefix} — ${activityChangeDescription(item, from, to, source)}`,
    time: shortDate(item.createdAt),
    tone: activityTone(item.to ?? item.type),
  }
}

function activityActionLabel(
  item: UserActivityFeedItemResponse,
  opportunity?: OpportunityResponse,
  internship?: InternshipListItemResponse | InternshipResponse
) {
  const type = item.type.toLowerCase()
  const to = item.to?.toLowerCase()
  if (
    item.resourceType === 'internship' &&
    (type === 'submit_offer' || to === 'offer_pending_review')
  ) {
    return 'Contract documents submitted'
  }
  if (item.resourceType === 'opportunity' && to === 'archived') return 'Opportunity archived'
  if (item.resourceType === 'opportunity' && opportunity?.type === 'custom' && to === 'published') {
    return 'Self-sourced placement approved'
  }
  if (item.resourceType === 'opportunity' && to === 'published') {
    return 'Coordinator opportunity published'
  }
  if (type === 'reject' || item.decision === 'rejected' || to === 'rejected')
    return 'Review rejected'
  if (type === 'request_changes' || to === 'offer_changes_requested') return 'Changes requested'
  if (type === 'approve_offer' || to === 'offer_approved') return 'Placement approved'
  if (type === 'edit') {
    return item.resourceType === 'opportunity'
      ? 'Opportunity details updated'
      : 'Placement details updated'
  }
  if (internship) return 'Placement workflow updated'
  return 'Opportunity workflow updated'
}

function activityBodyPrefix(
  opportunity: OpportunityResponse | undefined,
  student: string,
  employer: string
) {
  return opportunity?.type === 'custom' ? `${student} / ${employer}` : employer
}

function activityChangeDescription(
  item: UserActivityFeedItemResponse,
  from: string | null,
  to: string | null,
  source: 'self_sourced' | 'coordinator'
) {
  if (item.resourceType === 'opportunity' && item.to === 'published' && source === 'coordinator') {
    return 'published to the student job board.'
  }
  if (item.to === 'archived') return 'removed from active published opportunities.'
  if (item.resourceType === 'internship' && item.to === 'offer_pending_review') {
    return 'placement moved to Awaiting Contract Review.'
  }
  if (from && to) return `moved from ${from} to ${to}.`
  if (to) return `moved to ${to}.`
  return item.resourceType === 'opportunity'
    ? 'opportunity details updated.'
    : 'placement details updated.'
}

function resourceFallbackTitle(item: UserActivityFeedItemResponse) {
  return item.resourceType === 'opportunity' ? 'Opportunity record' : 'Placement record'
}

function humanizeWorkflowState(value: string) {
  const normalized = value
    .replace(/\bpd_/gi, '')
    .replace(/\barchived_state\b/gi, 'archived')
    .replace(/pending_verification/gi, 'Awaiting Placement Approval')
    .replace(/offer_pending_review/gi, 'Awaiting Contract Review')
    .replace(/offer_changes_requested/gi, 'Documents Requested')
    .replace(/offer_approved/gi, 'Approved / Finalised')
    .replace(/published/gi, 'Published to Internship Opportunities')
    .replace(/_/g, ' ')

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function humanizeActivityState(value: string, source: 'self_sourced' | 'coordinator') {
  const normalized = value.toLowerCase()
  if (normalized === 'pending_verification') return 'Awaiting Placement Approval'
  if (normalized === 'published') {
    return source === 'self_sourced' ? 'Awaiting Contract Details' : 'Published'
  }
  if (normalized === 'archived') return 'Archived'
  if (normalized === 'offer_pending_review' || normalized === 'contract_review') {
    return 'Awaiting Contract Review'
  }
  if (normalized === 'offer_changes_requested') return 'Documents Requested'
  if (normalized === 'offer_approved') return 'Approved'
  if (normalized === 'applied') return 'Awaiting Contract Details'
  if (normalized === 'rejected') return 'Rejected'
  return humanizeWorkflowState(value)
}

export function deriveStudentsFromInternships(
  internships: Array<InternshipListItemResponse | InternshipResponse>
): CoordinatorStudent[] {
  const grouped = new Map<string, Array<InternshipListItemResponse | InternshipResponse>>()

  for (const item of internships) {
    const key = getInternshipStudentKey(item)
    grouped.set(key, [...(grouped.get(key) ?? []), item])
  }

  return Array.from(grouped.entries())
    .map(([key, records]) => {
      const sorted = sortInternshipsByActivity(records)
      const latest = sorted[0]!
      const studentId = getInternshipStudentId(latest)
      const displayStudent = formatStudentDisplayFromIds(studentId)
      const courses = new Set(sorted.map((item) => item.studentProgramCode).filter(Boolean))

      return {
        rowId: key,
        recordId: latest.id,
        id: hasBackendStudentId(latest) ? studentId : key,
        name: displayStudent,
        studentId: displayStudent,
        course:
          courses.size > 1 ? 'Multiple programs' : (latest.studentProgramCode ?? 'Program pending'),
        semester: latest.semesterDisplayName || latest.semesterCode || 'Semester pending',
        semesterId: latest.semesterId,
        overallStatus: aggregateStudentStatus(sorted.map((item) => item.status)),
        email: '',
        year: 'Current',
        placementStatus: highestStudentStage(sorted.map((item) => item.status)),
        lastAudit: latest.lastSubmittedAt ?? latest.createdAt,
        internshipCount: sorted.length,
      }
    })
    .sort((a, b) => Date.parse(b.lastAudit ?? '') - Date.parse(a.lastAudit ?? ''))
}

export function getInternshipStudentKey(
  internship: InternshipListItemResponse | InternshipResponse
) {
  const studentId = normalizeStudentId(internship)
  return studentId ? `user:${studentId}` : `record:${internship.id}`
}

export function getInternshipStudentId(
  internship: InternshipListItemResponse | InternshipResponse
) {
  return normalizeStudentId(internship) ?? `Record ${internship.id}`
}

export function hasBackendStudentId(internship: InternshipListItemResponse | InternshipResponse) {
  return Boolean(normalizeStudentId(internship))
}

export function internshipSourceLabel(internship: InternshipListItemResponse | InternshipResponse) {
  if (internship.opportunityType === 'custom') return 'Self-Sourced'
  return internship.opportunitySourceUrl ? 'CareerHub' : 'Coordinator Published'
}

export function internshipStageLabel(status: string) {
  if (status === 'offer_pending_review') return 'Awaiting Contract Review'
  if (status === 'offer_changes_requested') return 'Documents Requested'
  if (status === 'offer_approved') return 'Approved / Finalised'
  if (status === 'rejected') return 'Rejected'
  if (status === 'applied') return 'Awaiting Contract Review'
  return status.replace(/_/g, ' ')
}

export function internshipUpdatedAt(internship: InternshipListItemResponse | InternshipResponse) {
  return (
    ('updatedAt' in internship ? internship.updatedAt : null) ??
    internship.lastSubmittedAt ??
    internship.createdAt
  )
}

function sortInternshipsByActivity<T extends InternshipListItemResponse | InternshipResponse>(
  internships: T[]
) {
  return [...internships].sort(
    (a, b) => Date.parse(internshipUpdatedAt(b)) - Date.parse(internshipUpdatedAt(a))
  )
}

function normalizeStudentId(internship: InternshipListItemResponse | InternshipResponse) {
  const runtime = internship as InternshipListItemResponse & {
    studentId?: string | null
    userId?: string | null
  }
  const id = runtime.userId ?? runtime.studentId
  const normalized = typeof id === 'string' ? id.trim() : ''
  return normalized || null
}

function aggregateStudentStatus(statuses: string[]): StudentOverallStatus {
  if (
    statuses.some(
      (status) =>
        status === 'rejected' ||
        status === 'offer_changes_requested' ||
        isExplicitlyFlaggedStatus(status)
    )
  ) {
    return 'needs_attention'
  }
  if (statuses.some((status) => status === 'offer_approved')) return 'approved'
  if (statuses.length === 0) return 'inactive'
  return 'on_track'
}

function highestStudentStage(statuses: string[]) {
  const ranked = [...statuses].sort((a, b) => workflowRank(b) - workflowRank(a))
  return internshipStageLabel(ranked[0] ?? '')
}

function workflowRank(status: string) {
  if (status === 'offer_approved') return 5
  if (status === 'offer_pending_review') return 4
  if (status === 'offer_changes_requested') return 3
  if (status === 'rejected') return 2
  if (status === 'applied') return 1
  return 0
}

function formatWorkPattern(value: string | null | undefined) {
  return value ? value : 'Full time'
}

export function buildPendingApprovals(
  jobs: SelfSourcedJob[],
  contracts: ContractApproval[]
): PendingApproval[] {
  return [
    ...jobs
      .filter(
        (job) =>
          job.status === 'pending' ||
          job.status === 'awaiting_review' ||
          job.status === 'awaiting_placement_approval'
      )
      .map((job) => ({
        id: job.id,
        studentName: job.studentName,
        type: 'Placement Review' as const,
        date: job.submissionDate,
        href: withReviewReturn(
          `/coordinator/jobs/review?id=${encodeURIComponent(job.id)}`,
          '/coordinator/opportunities',
          { tab: OPPORTUNITY_SELF_SOURCED_TAB, context: SELF_SOURCED_REVIEW_CONTEXT }
        ),
      })),
    ...contracts
      .filter(
        (contract) =>
          contract.status === 'pending' ||
          contract.status === 'awaiting_review' ||
          contract.status === 'awaiting_contract_review'
      )
      .map((contract) => ({
        id: contract.id,
        studentName: contract.studentName,
        type: 'Contract' as const,
        date: contract.submissionDate,
        href: withReviewReturn(
          `/coordinator/contracts/review?id=${encodeURIComponent(contract.id)}`,
          '/coordinator/jobs',
          { context: PLACEMENT_PROCESSING_CONTEXT }
        ),
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
