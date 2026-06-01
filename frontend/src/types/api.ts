export type ApiUserRole = 'student' | 'coordinator' | 'staff' | 'admin'
export type ApiUserStatus = 'active' | 'invited' | 'disabled'
export type ApiOnboardingStage = 'profile_pending' | 'profile_complete' | 'semester_selected'

export interface UserResponse {
  id: string
  email: string
  displayName: string | null
  role: ApiUserRole
  status: ApiUserStatus
  onboardingStage: ApiOnboardingStage
}

export type InternshipStatus =
  | 'applied'
  | 'offer_pending_review'
  | 'offer_changes_requested'
  | 'offer_approved'
  | 'rejected'

export interface InternshipAttachmentResponse {
  id: string
  fileName: string | null
  contentType: string | null
  uploadedAt: string
}

export interface InternshipListItemResponse {
  id: string
  userId: string
  opportunityId: string
  studentProgramCode: string | null
  opportunityEmployerName: string
  opportunityJobTitle: string
  opportunityType: 'pre_approved' | 'custom'
  opportunitySourceUrl: string | null
  semesterId: string
  semesterDisplayName: string
  semesterCode: string
  status: InternshipStatus
  lastSubmittedAt: string | null
  createdAt: string
}

export interface InternshipResponse extends InternshipListItemResponse {
  version: number
  coordinatorDecision: 'approved' | 'rejected' | 'changes_requested' | null
  coordinatorComment: string | null
  reviewedByUserId: string | null
  reviewedAt: string | null
  offerDate: string | null
  startDate: string | null
  endDate: string | null
  attachmentUploadPathPrefix: string
  attachments: InternshipAttachmentResponse[]
  updatedAt: string
}

export interface InternshipListResponse {
  items: InternshipListItemResponse[]
  nextPageToken: string | null
}

export type OpportunityStatus =
  | 'draft'
  | 'pending_verification'
  | 'published'
  | 'rejected'
  | 'archived'

export interface OpportunityAttachmentResponse {
  id: string
  fileName: string | null
  contentType: string | null
  uploadedAt: string
}

export interface OpportunityResponse {
  id: string
  semesterId: string
  type: 'pre_approved' | 'custom'
  employerName: string
  jobTitle: string
  descriptionText: string
  workMode: 'onsite' | 'hybrid' | 'remote' | null
  location: string | null
  sourceUrl: string | null
  status: OpportunityStatus
  applicationCount: number
  createdByUserId: string | null
  submittedByUserId: string | null
  verifiedByUserId: string | null
  verifiedAt: string | null
  attachmentUploadPathPrefix: string
  attachments: OpportunityAttachmentResponse[]
  createdAt: string
  updatedAt: string
}

export interface OpportunityListResponse {
  items: OpportunityResponse[]
  nextPageToken: string | null
}

export type SemesterStatus =
  | 'draft'
  | 'enrollment_open'
  | 'placement_running'
  | 'reporting'
  | 'archived'

export interface SemesterResponse {
  id: string
  semesterCode: string
  courseCode: string
  displayName: string
  status: SemesterStatus
  enrolmentOpenAt: string | null
  enrolmentCloseAt: string | null
  createdAt: string
  updatedAt: string
  enrolledStudentCount: number
  openOfferCount: number
}

export interface SemesterListResponse {
  items: SemesterResponse[]
  nextPageToken: string | null
}

export type SemesterStudentPlacementStatus =
  | 'no_applications'
  | 'browsing'
  | 'offer_in_review'
  | 'offer_changes_requested'
  | 'offer_approved'
  | 'all_rejected'

export interface SemesterStudentItem {
  userId: string
  displayName: string | null
  studentNumber: string | null
  programCode: string | null
  semesterSelectedAt: string | null
  placementStatus: SemesterStudentPlacementStatus
  internshipCount: number
}

export interface SemesterStudentListResponse {
  items: SemesterStudentItem[]
  nextPageToken: string | null
  totalCount: number
}

export interface NotificationResponse {
  id: string
  type: string
  title: string
  body: string
  relatedInternshipId: string | null
  relatedOpportunityId: string | null
  relatedTicketId: string | null
  emailDeliveryStatus: string | null
  emailDeliveredAt: string | null
  readAt: string | null
  createdAt: string
}

export interface NotificationListResponse {
  items: NotificationResponse[]
  nextPageToken: string | null
  unreadCount: number
}

export interface UserActivityFeedItemResponse {
  id: string
  resourceType: 'internship' | 'opportunity'
  internshipId: string | null
  opportunityId: string | null
  type: string
  authorUserId: string
  authorRole: ApiUserRole
  text: string | null
  from: string | null
  to: string | null
  decision: string | null
  createdAt: string
}

export interface UserActivityFeedResponse {
  items: UserActivityFeedItemResponse[]
  nextPageToken: string | null
}
