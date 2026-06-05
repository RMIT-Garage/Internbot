import type { InternshipListItemResponse } from '@/lib/api/openapi-client'

export function findApprovedInternship(
  internships: readonly InternshipListItemResponse[]
): InternshipListItemResponse | null {
  return internships.find((i) => i.status === 'offer_approved') ?? null
}

/** Prefer the semester tied to an approved placement over profile selection. */
export function resolveEffectiveSemesterId(
  profileSemesterId: string | null | undefined,
  internships: readonly InternshipListItemResponse[]
): string | null {
  const approved = findApprovedInternship(internships)
  return approved?.semesterId ?? profileSemesterId ?? null
}

export function filterInternshipsForDashboard(
  internships: readonly InternshipListItemResponse[],
  effectiveSemesterId: string | null
): InternshipListItemResponse[] {
  if (!effectiveSemesterId) return [...internships]
  return internships.filter(
    (i) => i.semesterId === effectiveSemesterId || i.status === 'offer_approved'
  )
}

export function placementSemesterLabelFromInternship(
  internship: InternshipListItemResponse | null
): string | null {
  if (!internship?.semesterDisplayName) return null
  return internship.semesterCode
    ? `${internship.semesterDisplayName} · ${internship.semesterCode}`
    : internship.semesterDisplayName
}
