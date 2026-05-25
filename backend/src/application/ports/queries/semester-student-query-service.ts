export type SemesterStudentPlacementStatus =
  | 'no_applications'
  | 'browsing'
  | 'offer_in_review'
  | 'offer_changes_requested'
  | 'offer_approved'
  | 'all_rejected'

export interface SemesterStudentItem {
  readonly userId: string
  readonly displayName: string | undefined
  readonly studentNumber: string | undefined
  readonly programCode: string | undefined
  readonly semesterSelectedAt: Date | undefined
  readonly placementStatus: SemesterStudentPlacementStatus
  readonly internshipCount: number
}

export interface SemesterStudentListFilter {
  readonly semesterId: string
  readonly placementStatus?: SemesterStudentPlacementStatus
  readonly programCode?: string
  readonly limit: number
  readonly cursor?: string
}

export interface SemesterStudentListPage {
  readonly items: readonly SemesterStudentItem[]
  readonly nextCursor: string | null
  readonly totalCount: number
}

export interface SemesterStudentQueryService {
  listBySemesterId(filter: SemesterStudentListFilter): Promise<SemesterStudentListPage>
}
