// Mirror of backend DTOs — kept here so the feature is self-contained.
// Source of truth: backend/src/api/dto/user.ts

export type ProgramLevel = 'undergraduate' | 'postgraduate'
export type ProgramStatus = 'active_in_program' | 'completed' | 'discontinued'
export type StudyLoad = 'full_time' | 'part_time' | 'unknown'
export type ProfileStatus = 'incomplete' | 'complete'
export type OnboardingStage = 'profile_pending' | 'profile_complete'
export type UserStatus = 'active' | 'inactive' | 'blocked'
export type CurrentWorkflowStep =
  | 'profile'
  | 'semester_selection'
  | 'opportunity_browsing'
  | 'offer_stage'
  | 'completed'

export interface AcademicInfo {
  programName: string
  programLevel: ProgramLevel
  programStatus?: ProgramStatus
  majors?: string[]
  minors?: string[]
  unitsAttempted: number
  creditUnitsEarned: number
  gpa: number
  currentStudyLoad: StudyLoad
  notes?: string
  confirmedAt: string | null
}

export interface StudentProfile {
  studentNumber: string
  programCode: string | null
  phone: string | null
  academicInfo: AcademicInfo | null
  semesterId?: string | null
  semesterSelectedAt?: string | null
  profileStatus: ProfileStatus
}

export interface StudentUser {
  id: string
  email: string
  displayName: string | null
  status: UserStatus
  onboardingStage: OnboardingStage
  role: 'student'
  currentWorkflowStep: CurrentWorkflowStep
  studentProfile: StudentProfile
}

export interface CoordinatorUser {
  id: string
  email: string
  displayName: string | null
  status: UserStatus
  onboardingStage: OnboardingStage
  role: 'coordinator'
}

export type PlatformUser = StudentUser | CoordinatorUser

// PATCH /users/me request body shape
export interface UpdateProfilePayload {
  studentProfile: {
    phone?: string | null
    academicInfo?: {
      programName?: string
      programLevel?: ProgramLevel
      programStatus?: ProgramStatus
      majors?: string[]
      minors?: string[]
      unitsAttempted?: number
      creditUnitsEarned?: number
      gpa?: number
      currentStudyLoad?: StudyLoad
      notes?: string
    }
  }
}
