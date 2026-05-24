export type ApprovalStatus =
  | 'pending'
  | 'awaiting_placement_approval'
  | 'awaiting_contract_review'
  | 'awaiting_contract_details'
  | 'awaiting_review'
  | 'awaiting_documents'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'changes_requested'
  | 'flagged'
export type StudentOverallStatus = 'on_track' | 'needs_attention' | 'approved' | 'inactive'
export type WorkflowTone = 'red' | 'charcoal' | 'neutral'

export interface SummaryStateCount {
  label: string
  count: number
  status: ApprovalStatus | StudentOverallStatus
}

export interface SummaryMetric {
  title: string
  total: number
  description: string
  states: SummaryStateCount[]
}

export interface PendingApproval {
  id: string
  studentName: string
  type: 'Contract' | 'Placement Review'
  date: string
  href: string
}

export interface SelfSourcedJob {
  id: string
  studentName: string
  studentId: string
  course: string
  semester: string
  jobTitle: string
  company: string
  submissionDate: string
  status: ApprovalStatus
  location: string
  workPattern: string
  supervisor: string
  description: string
  aiAdvisory: string
  concerns: string[]
  notes: string[]
  aiConfidence?: number
  riskLevel?: 'Low' | 'Medium' | 'High'
}

export interface ContractApproval {
  id: string
  studentName: string
  studentId: string
  studentUserId?: string
  course: string
  semester: string
  submissionDate: string
  status: ApprovalStatus
  documentName: string
  placementHost: string
  aiIssues: string[]
  notes: string[]
  aiConfidence?: number
  riskLevel?: 'Low' | 'Medium' | 'High'
}

export interface CoordinatorStudent {
  rowId: string
  recordId?: string
  id: string
  name: string
  studentId: string
  course: string
  semester: string
  overallStatus: StudentOverallStatus
  email: string
  year?: string
  placementStatus?: string
  lastAudit?: string
  internshipCount?: number
}

export const semesters = ['Semester 1 2026', 'Semester 2 2026', 'Summer 2026'] as const

export const courses = [
  'Bachelor of Information Technology',
  'Bachelor of Computer Science',
  'Master of Data Science',
  'Master of Cyber Security',
] as const

export const coordinatorSummary: SummaryMetric[] = [
  {
    title: 'Contracts',
    total: 42,
    description: 'Submitted placement contracts',
    states: [
      { label: 'Awaiting Contract Review', count: 12, status: 'awaiting_contract_review' },
      { label: 'Approved', count: 24, status: 'approved' },
      { label: 'Changes', count: 6, status: 'changes_requested' },
    ],
  },
  {
    title: 'Placement Reviews',
    total: 31,
    description: 'Student-submitted opportunities',
    states: [
      { label: 'Awaiting Placement Approval', count: 9, status: 'awaiting_placement_approval' },
      { label: 'Approved', count: 18, status: 'approved' },
      { label: 'Flagged', count: 4, status: 'flagged' },
    ],
  },
  {
    title: 'Students',
    total: 128,
    description: 'Active internship students',
    states: [
      { label: 'On track', count: 96, status: 'on_track' },
      { label: 'Attention', count: 21, status: 'needs_attention' },
      { label: 'Approved', count: 11, status: 'approved' },
    ],
  },
]

export const pendingApprovals: PendingApproval[] = [
  {
    id: 'job-001',
    studentName: 'Maya Singh',
    type: 'Placement Review',
    date: '2026-05-08',
    href: '/coordinator/jobs/review?id=job-001&returnTo=/coordinator/opportunities&tab=self-sourced',
  },
  {
    id: 'contract-001',
    studentName: 'Noah Tran',
    type: 'Contract',
    date: '2026-05-07',
    href: '/coordinator/contracts/review?id=contract-001&returnTo=/coordinator/jobs',
  },
  {
    id: 'job-002',
    studentName: 'Ava Williams',
    type: 'Placement Review',
    date: '2026-05-06',
    href: '/coordinator/jobs/review?id=job-002&returnTo=/coordinator/opportunities&tab=self-sourced',
  },
  {
    id: 'contract-002',
    studentName: 'Ethan Chen',
    type: 'Contract',
    date: '2026-05-05',
    href: '/coordinator/contracts/review?id=contract-002&returnTo=/coordinator/jobs',
  },
  {
    id: 'job-003',
    studentName: 'Olivia Brown',
    type: 'Placement Review',
    date: '2026-05-04',
    href: '/coordinator/jobs/review?id=job-003&returnTo=/coordinator/opportunities&tab=self-sourced',
  },
]

export const selfSourcedJobs: SelfSourcedJob[] = [
  {
    id: 'job-001',
    studentName: 'Maya Singh',
    studentId: 's3894412',
    course: 'Bachelor of Information Technology',
    semester: 'Semester 1 2026',
    jobTitle: 'Junior Web Developer',
    company: 'Northbank Digital',
    submissionDate: '2026-05-08',
    status: 'awaiting_placement_approval',
    location: 'Melbourne CBD',
    workPattern: '3 days per week, hybrid',
    supervisor: 'Eleanor Marsh, Engineering Lead',
    description:
      'Frontend and API integration work for client portals using React, TypeScript, and Firebase.',
    aiAdvisory:
      'The role appears aligned to course outcomes and includes supervised technical work. Confirm working hours and assessment evidence requirements before approval.',
    concerns: ['Role mentions client delivery deadlines', 'Insurance certificate not attached'],
    notes: [
      'Student has completed employability module',
      'Host has supervised RMIT interns before',
    ],
    aiConfidence: 92,
    riskLevel: 'Medium',
  },
  {
    id: 'job-002',
    studentName: 'Ava Williams',
    studentId: 's3912044',
    course: 'Master of Data Science',
    semester: 'Semester 1 2026',
    jobTitle: 'Data Analyst Intern',
    company: 'Civic Insights',
    submissionDate: '2026-05-06',
    status: 'flagged',
    location: 'Remote',
    workPattern: '2 days per week',
    supervisor: 'Daniel Osei, Analytics Manager',
    description: 'Data cleaning, dashboard preparation, and survey analysis for local services.',
    aiAdvisory:
      'The learning value is strong, but remote supervision needs clearer cadence and escalation details.',
    concerns: ['Remote-only role', 'Supervisor meeting schedule missing'],
    notes: ['Ask student to provide weekly check-in plan'],
    aiConfidence: 78,
    riskLevel: 'High',
  },
  {
    id: 'job-003',
    studentName: 'Olivia Brown',
    studentId: 's3881189',
    course: 'Bachelor of Computer Science',
    semester: 'Semester 2 2026',
    jobTitle: 'Software QA Intern',
    company: 'Harbour Labs',
    submissionDate: '2026-05-04',
    status: 'awaiting_placement_approval',
    location: 'Docklands',
    workPattern: 'Full-time block placement',
    supervisor: 'Priya Menon, QA Practice Lead',
    description: 'Automated regression testing, bug triage, and release support for SaaS products.',
    aiAdvisory: 'Suitable placement scope with practical software engineering exposure.',
    concerns: ['Confirm paid placement status'],
    notes: ['Detailed duties supplied by host'],
    aiConfidence: 88,
    riskLevel: 'Low',
  },
  {
    id: 'job-004',
    studentName: 'Liam Nguyen',
    studentId: 's3927710',
    course: 'Master of Cyber Security',
    semester: 'Semester 2 2026',
    jobTitle: 'Security Operations Intern',
    company: 'Redline Managed Services',
    submissionDate: '2026-04-28',
    status: 'approved',
    location: 'Richmond',
    workPattern: '4 days per week',
    supervisor: 'Grace Patel, SOC Lead',
    description: 'Ticket review, alert enrichment, and supervised incident response documentation.',
    aiAdvisory: 'Approved scope with appropriate supervision and no high-risk access noted.',
    concerns: [],
    notes: ['Approval notification sent to student'],
    aiConfidence: 96,
    riskLevel: 'Low',
  },
  {
    id: 'job-005',
    studentName: 'Charlotte Lee',
    studentId: 's3900788',
    course: 'Bachelor of Information Technology',
    semester: 'Summer 2026',
    jobTitle: 'IT Support Intern',
    company: 'Yarra Health Network',
    submissionDate: '2026-04-20',
    status: 'changes_requested',
    location: 'Carlton',
    workPattern: '3 days per week',
    supervisor: 'Marcus Dell, Service Desk Manager',
    description: 'Service desk support, device provisioning, and knowledge base updates.',
    aiAdvisory: 'Duties are appropriate but require a clearer technical project component.',
    concerns: ['Learning objectives too general'],
    notes: ['Student asked to revise duties on 21 Apr 2026'],
    aiConfidence: 71,
    riskLevel: 'Medium',
  },
  {
    id: 'job-006',
    studentName: 'Henry Wilson',
    studentId: 's3874021',
    course: 'Bachelor of Computer Science',
    semester: 'Semester 1 2026',
    jobTitle: 'Backend Engineering Intern',
    company: 'LedgerWorks',
    submissionDate: '2026-04-17',
    status: 'approved',
    location: 'Melbourne CBD',
    workPattern: 'Part-time, hybrid',
    supervisor: 'Ivy Tan, Platform Lead',
    description: 'API development, test coverage, and observability tasks in a fintech platform.',
    aiAdvisory: 'Strong fit for software engineering outcomes.',
    concerns: [],
    notes: ['Host agreement already on file'],
    aiConfidence: 94,
    riskLevel: 'Low',
  },
]

export const contractApprovals: ContractApproval[] = [
  {
    id: 'contract-001',
    studentName: 'Noah Tran',
    studentId: 's3898910',
    course: 'Bachelor of Computer Science',
    semester: 'Semester 1 2026',
    submissionDate: '2026-05-07',
    status: 'awaiting_contract_review',
    documentName: 'Noah Tran - Placement Agreement.pdf',
    placementHost: 'Circuit House',
    aiIssues: ['Host signature detected', 'Student signature detected', 'Start date needs review'],
    notes: ['Check date alignment with semester census window'],
    aiConfidence: 89,
    riskLevel: 'Medium',
  },
  {
    id: 'contract-002',
    studentName: 'Ethan Chen',
    studentId: 's3917718',
    course: 'Master of Cyber Security',
    semester: 'Semester 1 2026',
    submissionDate: '2026-05-05',
    status: 'flagged',
    documentName: 'Ethan Chen Contract.pdf',
    placementHost: 'SecureStack',
    aiIssues: ['Insurance clause may be missing', 'Host ABN found', 'Student signature detected'],
    notes: ['Request coordinator legal check before approval'],
    aiConfidence: 74,
    riskLevel: 'High',
  },
  {
    id: 'contract-003',
    studentName: 'Grace Martin',
    studentId: 's3920027',
    course: 'Master of Data Science',
    semester: 'Semester 2 2026',
    submissionDate: '2026-05-01',
    status: 'awaiting_contract_review',
    documentName: 'Grace Martin Internship Contract.pdf',
    placementHost: 'Market Signal',
    aiIssues: ['All signatures detected', 'Weekly hours exceed usual threshold'],
    notes: ['Confirm student workload plan'],
    aiConfidence: 82,
    riskLevel: 'Medium',
  },
  {
    id: 'contract-004',
    studentName: 'Zara Ali',
    studentId: 's3889071',
    course: 'Bachelor of Information Technology',
    semester: 'Summer 2026',
    submissionDate: '2026-04-25',
    status: 'approved',
    documentName: 'Zara Ali Placement Contract.pdf',
    placementHost: 'BrightPath Apps',
    aiIssues: ['No blocking issues detected'],
    notes: ['Approved and archived'],
    aiConfidence: 97,
    riskLevel: 'Low',
  },
  {
    id: 'contract-005',
    studentName: 'Amelia Johnson',
    studentId: 's3905159',
    course: 'Bachelor of Computer Science',
    semester: 'Semester 1 2026',
    submissionDate: '2026-04-19',
    status: 'changes_requested',
    documentName: 'Amelia Johnson Draft Agreement.pdf',
    placementHost: 'Aster Systems',
    aiIssues: ['Host signature missing', 'Placement end date missing'],
    notes: ['Student notified of required changes'],
    aiConfidence: 69,
    riskLevel: 'High',
  },
]

export const coordinatorStudents: CoordinatorStudent[] = [
  {
    rowId: 'student-001',
    id: 'student-001',
    name: 'Maya Singh',
    studentId: 's3894412',
    course: 'Bachelor of Information Technology',
    semester: 'Semester 1 2026',
    overallStatus: 'needs_attention',
    email: 'maya.singh@student.rmit.edu.au',
    year: 'Year 3',
    placementStatus: 'Awaiting Placement Approval',
    lastAudit: '2026-05-08',
  },
  {
    rowId: 'student-002',
    id: 'student-002',
    name: 'Noah Tran',
    studentId: 's3898910',
    course: 'Bachelor of Computer Science',
    semester: 'Semester 1 2026',
    overallStatus: 'on_track',
    email: 'noah.tran@student.rmit.edu.au',
    year: 'Year 3',
    placementStatus: 'Awaiting Contract Review',
    lastAudit: '2026-05-07',
  },
  {
    rowId: 'student-003',
    id: 'student-003',
    name: 'Ava Williams',
    studentId: 's3912044',
    course: 'Master of Data Science',
    semester: 'Semester 1 2026',
    overallStatus: 'needs_attention',
    email: 'ava.williams@student.rmit.edu.au',
    year: 'Postgraduate',
    placementStatus: 'AI flagged',
    lastAudit: '2026-05-06',
  },
  {
    rowId: 'student-004',
    id: 'student-004',
    name: 'Liam Nguyen',
    studentId: 's3927710',
    course: 'Master of Cyber Security',
    semester: 'Semester 2 2026',
    overallStatus: 'approved',
    email: 'liam.nguyen@student.rmit.edu.au',
    year: 'Postgraduate',
    placementStatus: 'Accepted',
    lastAudit: '2026-04-28',
  },
  {
    rowId: 'student-005',
    id: 'student-005',
    name: 'Charlotte Lee',
    studentId: 's3900788',
    course: 'Bachelor of Information Technology',
    semester: 'Summer 2026',
    overallStatus: 'needs_attention',
    email: 'charlotte.lee@student.rmit.edu.au',
    year: 'Year 2',
    placementStatus: 'Changes requested',
    lastAudit: '2026-04-21',
  },
  {
    rowId: 'student-006',
    id: 'student-006',
    name: 'Henry Wilson',
    studentId: 's3874021',
    course: 'Bachelor of Computer Science',
    semester: 'Semester 1 2026',
    overallStatus: 'on_track',
    email: 'henry.wilson@student.rmit.edu.au',
    year: 'Year 3',
    placementStatus: 'Accepted',
    lastAudit: '2026-04-17',
  },
]

export const dashboardKpis = [
  { title: 'Total students', value: 128, detail: 'Active WIL cohort', progress: 82 },
  { title: 'Looking', value: 34, detail: 'Still sourcing placements', progress: 42 },
  { title: 'Applied', value: 57, detail: 'Applications in motion', progress: 64 },
  { title: 'Accepted', value: 31, detail: 'Confirmed internships', progress: 36 },
  { title: 'Contracts flagged', value: 6, detail: 'Need coordinator review', progress: 18 },
]

export const recentActivity = [
  {
    title: 'AI flagged contract clause',
    description: 'Ethan Chen contract may be missing insurance coverage wording.',
    time: '12 min ago',
    tone: 'red' as WorkflowTone,
  },
  {
    title: 'Placement review submitted',
    description: 'Maya Singh submitted Northbank Digital role for approval.',
    time: '42 min ago',
    tone: 'neutral' as WorkflowTone,
  },
  {
    title: 'Coordinator note added',
    description: 'Follow-up requested on Ava Williams remote supervision plan.',
    time: 'Today, 10:20 AM',
    tone: 'neutral' as WorkflowTone,
  },
  {
    title: 'Contract approved',
    description: 'Zara Ali placement agreement archived and student notified.',
    time: 'Yesterday',
    tone: 'charcoal' as WorkflowTone,
  },
]

export const actionAlerts = [
  '6 submissions have high-risk AI indicators.',
  '3 contracts are older than 72 hours without review.',
  'Semester 2 onboarding window closes in 9 days.',
]

export const semesterInventory = [
  {
    id: 'semester-001',
    semesterCode: '2026-S1',
    courseCode: 'INTE2710',
    name: 'Semester 1 2026',
    status: 'active' as const,
    students: 128,
    window: 'Feb 26 - Jun 21',
    phase: 'Review and approvals',
    flagged: 10,
  },
  {
    id: 'semester-002',
    semesterCode: '2026-S2',
    courseCode: 'INTE2710',
    name: 'Semester 2 2026',
    status: 'pending',
    students: 92,
    window: 'Jul 20 - Nov 14',
    phase: 'Enrollment open',
    flagged: 3,
  },
  {
    id: 'semester-003',
    semesterCode: '2026-SU',
    courseCode: 'INTE2710',
    name: 'Summer 2026',
    status: 'archived',
    students: 41,
    window: 'Nov 30 - Feb 15',
    phase: 'Reporting',
    flagged: 1,
  },
]

export const opportunities = [
  {
    id: 'opp-001',
    title: 'Frontend Engineering Internship',
    company: 'Northbank Digital',
    semesterId: 'semester-001',
    type: 'pre_approved' as const,
    descriptionText: 'Build accessible frontend features for student-facing placement workflows.',
    workMode: 'hybrid' as const,
    location: 'Melbourne',
    sourceUrl: 'https://careerhub.rmit.edu.au/jobs/opp-001',
    status: 'active' as const,
    statusRaw: 'published' as const,
    applications: 18,
    engagement: 'High',
    closingDate: '2026-05-28',
    createdByUserId: 'coordinator-demo',
    submittedByUserId: null,
    verifiedByUserId: 'coordinator-demo',
    verifiedAt: '2026-05-01',
  },
  {
    id: 'opp-002',
    title: 'Cyber Security Operations Placement',
    company: 'Redline Managed Services',
    semesterId: 'semester-001',
    type: 'pre_approved' as const,
    descriptionText:
      'Support security monitoring, triage, and reporting in a managed services team.',
    workMode: 'onsite' as const,
    location: 'Melbourne',
    sourceUrl: 'https://careerhub.rmit.edu.au/jobs/opp-002',
    status: 'active' as const,
    statusRaw: 'published' as const,
    applications: 12,
    engagement: 'Medium',
    closingDate: '2026-06-04',
    createdByUserId: 'coordinator-demo',
    submittedByUserId: null,
    verifiedByUserId: 'coordinator-demo',
    verifiedAt: '2026-05-02',
  },
  {
    id: 'opp-003',
    title: 'Data Analytics Internship',
    company: 'Civic Insights',
    semesterId: 'semester-002',
    type: 'custom' as const,
    descriptionText: 'Prepare dashboards and analytics datasets for civic service reporting.',
    workMode: 'remote' as const,
    location: 'Remote',
    status: 'awaiting_placement_approval' as const,
    sourceUrl: null,
    statusRaw: 'pending_verification' as const,
    applications: 7,
    engagement: 'Rising',
    closingDate: '2026-06-11',
    createdByUserId: null,
    submittedByUserId: 'student-demo',
    verifiedByUserId: null,
    verifiedAt: null,
  },
]

export const auditLogs = [
  {
    id: 'audit-001',
    actor: 'AI Insights',
    action: 'Flagged missing insurance clause',
    target: 'Ethan Chen Contract',
    timestamp: '2026-05-09 09:42',
    severity: 'High',
  },
  {
    id: 'audit-002',
    actor: 'Coordinator Demo',
    action: 'Requested changes',
    target: 'Ava Williams Job Submission',
    timestamp: '2026-05-08 15:10',
    severity: 'Medium',
  },
  {
    id: 'audit-003',
    actor: 'System',
    action: 'Student notification sent',
    target: 'Zara Ali Contract',
    timestamp: '2026-05-08 11:31',
    severity: 'Low',
  },
  {
    id: 'audit-004',
    actor: 'Coordinator Demo',
    action: 'Approved placement',
    target: 'Liam Nguyen Security Operations',
    timestamp: '2026-05-07 13:12',
    severity: 'Low',
  },
]

export const coordinatorNotifications = [
  {
    id: 'note-001',
    title: 'Ethan Chen uploaded signed contract',
    body: 'Cyber Security Operations Placement • SecureStack • Contract verification stage',
    unread: true,
    href: '/coordinator/contracts/review?id=contract-002&returnTo=/coordinator/notifications',
    workflowStage: 'Contract verification stage',
    placementType: 'Self-sourced placement',
    updatedAt: 'May 9',
  },
  {
    id: 'note-002',
    title: 'Maya Singh submitted placement verification',
    body: 'Junior Web Developer • Northbank Digital • Awaiting Placement Approval',
    unread: true,
    href: '/coordinator/jobs',
    workflowStage: 'Awaiting Placement Approval',
    placementType: 'Self-sourced placement',
    updatedAt: 'May 8',
  },
  {
    id: 'note-003',
    title: 'Liam Nguyen placement approved',
    body: 'Security Operations Intern • Redline Managed Services • Review completed',
    unread: false,
    href: '/coordinator/jobs/review?id=job-004&returnTo=/coordinator/notifications&tab=self-sourced',
    workflowStage: 'Review completed',
    placementType: 'Self-sourced placement',
    updatedAt: 'May 7',
  },
]

export function getSelfSourcedJob(id: string) {
  return selfSourcedJobs.find((job) => job.id === id)
}

export function getContractApproval(id: string) {
  return contractApprovals.find((contract) => contract.id === id)
}
