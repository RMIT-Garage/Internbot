'use client'

import { auth } from '@/lib/firebase/client'
import { OpenAPI } from '@/api/core/OpenAPI'

OpenAPI.BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

OpenAPI.TOKEN = async () => {
  const user = auth.currentUser
  if (!user) return ''
  return user.getIdToken()
}

export { HealthService } from '@/api/services/HealthService'
export { UsersService } from '@/api/services/UsersService'
export { SemestersService } from '@/api/services/SemestersService'
export { OpportunitiesService } from '@/api/services/OpportunitiesService'
export { InternshipsService } from '@/api/services/InternshipsService'
export { NotificationsService } from '@/api/services/NotificationsService'
export { TicketsService } from '@/api/services/TicketsService'

export type {
  UserResponse,
  StudentUserResponse,
  CoordinatorUserResponse,
  SemesterResponse,
  SemesterListResponse,
  OpportunityResponse,
  OpportunityListResponse,
  InternshipResponse,
  InternshipListResponse,
  InternshipListItemResponse,
  NotificationResponse,
  NotificationListResponse,
  TicketResponse,
  TicketListResponse,
  HealthResponse,
  ErrorResponse,
} from '@/api/index'
