import { apiFetch } from '@/lib/api/client'
import type {
  InternshipListResponse,
  InternshipResponse,
  NotificationListResponse,
  NotificationResponse,
  OpportunityListResponse,
  OpportunityResponse,
  SemesterListResponse,
  SemesterResponse,
  UserActivityFeedResponse,
} from '@/types/api'

type QueryValue = string | number | boolean | null | undefined
type Query = Record<string, QueryValue>

const internshipQueryKeys = new Set([
  'userId',
  'opportunityId',
  'status',
  'sort',
  'pageToken',
  'limit',
])
const opportunityQueryKeys = new Set(['semesterId', 'status', 'type', 'sort', 'pageToken', 'limit'])
const semesterQueryKeys = new Set([
  'status',
  'semesterCode',
  'courseCode',
  'sort',
  'pageToken',
  'limit',
])
const notificationQueryKeys = new Set(['unreadOnly', 'pageToken', 'limit'])
const activityQueryKeys = new Set(['sort', 'pageToken', 'limit'])

function sanitizeQuery(query: Query, allowedKeys: Set<string>, resource: string) {
  const sanitized: Query = {}
  const removed: string[] = []
  for (const [key, value] of Object.entries(query)) {
    if (allowedKeys.has(key)) {
      sanitized[key] = value
    } else {
      removed.push(key)
    }
  }

  if (process.env.NODE_ENV === 'development' && removed.length > 0) {
    console.debug('[coordinator-api] stripped frontend-only query params', {
      resource,
      removed,
      filtering: 'unsupported filters are applied client-side',
    })
  }

  return sanitized
}

function withQuery(path: string, query: Query = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '' || value === 'all') continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

function logCoordinatorRequest(resource: string, path: string, backendFilters: Query) {
  if (process.env.NODE_ENV !== 'development') return
  console.debug('[coordinator-api] final request', {
    resource,
    path,
    backendFilters,
    filtering: 'backend-supported params only; remaining UI filters run client-side',
  })
}

export function listInternships(query: Query = {}) {
  const sanitized = sanitizeQuery(query, internshipQueryKeys, 'internships')
  const path = withQuery('/api/v1/internships', sanitized)
  logCoordinatorRequest('internships', path, sanitized)
  return apiFetch<InternshipListResponse>(path)
}

export function getInternship(id: string) {
  return apiFetch<InternshipResponse>(`/api/v1/internships/${id}`)
}

export function decideInternship(
  internship: Pick<InternshipResponse, 'id' | 'version'>,
  decision: 'approved' | 'rejected' | 'changes_requested',
  comment?: string
) {
  return apiFetch<InternshipResponse>(`/api/v1/internships/${internship.id}/decisions`, {
    method: 'POST',
    headers: { 'If-Match': `W/"${internship.version}"` },
    body: { decision, ...(comment ? { comment } : {}) },
  })
}

export function listOpportunities(query: Query = {}) {
  const sanitized = sanitizeQuery(query, opportunityQueryKeys, 'opportunities')
  const path = withQuery('/api/v1/opportunities', sanitized)
  logCoordinatorRequest('opportunities', path, sanitized)
  return apiFetch<OpportunityListResponse>(path)
}

export function getOpportunity(id: string) {
  return apiFetch<OpportunityResponse>(`/api/v1/opportunities/${id}`)
}

export function verifyOpportunity(
  opportunity: Pick<OpportunityResponse, 'id'>,
  decision: 'approved' | 'rejected',
  comment?: string
) {
  return apiFetch<OpportunityResponse>(`/api/v1/opportunities/${opportunity.id}/verifications`, {
    method: 'POST',
    body: { decision, ...(comment ? { comment } : {}) },
  })
}

export function createOpportunity(body: {
  semesterId?: string
  type?: 'pre_approved' | 'custom'
  employerName: string
  jobTitle: string
  descriptionText: string
  workMode?: 'onsite' | 'hybrid' | 'remote'
  location?: string
  sourceUrl?: string
}) {
  return apiFetch<OpportunityResponse>('/api/v1/opportunities', { method: 'POST', body })
}

export function updateOpportunity(
  opportunity: Pick<OpportunityResponse, 'id'>,
  body: {
    employerName?: string
    jobTitle?: string
    descriptionText?: string
    workMode?: 'onsite' | 'hybrid' | 'remote' | null
    location?: string | null
    sourceUrl?: string | null
  }
) {
  return apiFetch<OpportunityResponse>(`/api/v1/opportunities/${opportunity.id}`, {
    method: 'PATCH',
    body,
  })
}

export function listSemesters(query: Query = {}) {
  const sanitized = sanitizeQuery(query, semesterQueryKeys, 'semesters')
  const path = withQuery('/api/v1/semesters', sanitized)
  logCoordinatorRequest('semesters', path, sanitized)
  return apiFetch<SemesterListResponse>(path)
}

export function createSemester(body: {
  semesterCode: string
  courseCode: string
  displayName: string
  status: SemesterResponse['status']
  enrolmentOpenAt?: string | null
  enrolmentCloseAt?: string | null
}) {
  return apiFetch<SemesterResponse>('/api/v1/semesters', { method: 'POST', body })
}

export function updateSemester(
  semester: Pick<SemesterResponse, 'id'>,
  body: {
    displayName?: string
    enrolmentOpenAt?: string | null
    enrolmentCloseAt?: string | null
  }
) {
  return apiFetch<SemesterResponse>(`/api/v1/semesters/${semester.id}`, {
    method: 'PATCH',
    body,
  })
}

export function listNotifications(query: Query = {}) {
  const sanitized = sanitizeQuery(query, notificationQueryKeys, 'notifications')
  const path = withQuery('/api/v1/notifications', sanitized)
  logCoordinatorRequest('notifications', path, sanitized)
  return apiFetch<NotificationListResponse>(path)
}

export function markNotificationRead(id: string) {
  return apiFetch<NotificationResponse>(`/api/v1/notifications/${id}`, {
    method: 'PATCH',
    body: { read: true },
  })
}

export function markAllNotificationsRead() {
  return apiFetch<{ markedReadCount: number }>('/api/v1/notifications', {
    method: 'PUT',
    body: { read: true },
  })
}

export function listMyActivity(query: Query = {}) {
  const sanitized = sanitizeQuery(query, activityQueryKeys, 'userActivity')
  const path = withQuery('/api/v1/users/me/activity', sanitized)
  logCoordinatorRequest('userActivity', path, sanitized)
  return apiFetch<UserActivityFeedResponse>(path)
}
