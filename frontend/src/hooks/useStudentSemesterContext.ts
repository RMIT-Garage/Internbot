'use client'

import { useEffect, useState } from 'react'
import { InternshipsService, SemestersService, UsersService } from '@/lib/api/openapi-client'
import type { SemesterResponse, StudentUserResponse } from '@/lib/api/openapi-client'
import type { UserWorkflowResponse } from '@/api/models/UserWorkflowResponse'
import {
  findApprovedInternship,
  placementSemesterLabelFromInternship,
  resolveEffectiveSemesterId,
} from '@/lib/student/semesterContext'

export interface StudentSemesterContext {
  loading: boolean
  user: StudentUserResponse | null
  semester: SemesterResponse | null
  workflow: UserWorkflowResponse | null
  hasApprovedPlacement: boolean
  approvedInternshipId: string | null
  placementSemesterLabel: string | null
  canChangeSemester: boolean
  refresh: () => Promise<void>
}

export function useStudentSemesterContext(options?: { includeWorkflow?: boolean }) {
  const includeWorkflow = options?.includeWorkflow ?? true
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<StudentUserResponse | null>(null)
  const [semester, setSemester] = useState<SemesterResponse | null>(null)
  const [workflow, setWorkflow] = useState<UserWorkflowResponse | null>(null)
  const [approvedInternshipId, setApprovedInternshipId] = useState<string | null>(null)
  const [placementSemesterLabel, setPlacementSemesterLabel] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const profile = await UsersService.getMyProfile()
      if (profile.role !== 'student') {
        setUser(null)
        setSemester(null)
        setWorkflow(null)
        setApprovedInternshipId(null)
        setPlacementSemesterLabel(null)
        return
      }

      setUser(profile)
      const profileSemesterId = profile.studentProfile?.semesterId ?? null

      const [internshipsRes, workflowRes] = await Promise.all([
        InternshipsService.listInternships().catch(() => ({ items: [] })),
        includeWorkflow ? UsersService.getMyWorkflow().catch(() => null) : Promise.resolve(null),
      ])

      const approved = findApprovedInternship(internshipsRes.items)
      setApprovedInternshipId(approved?.id ?? null)
      setPlacementSemesterLabel(placementSemesterLabelFromInternship(approved))
      setWorkflow(workflowRes)

      const effectiveSemesterId = resolveEffectiveSemesterId(
        profileSemesterId,
        internshipsRes.items
      )
      const semesterRes = effectiveSemesterId
        ? await SemestersService.getSemester(effectiveSemesterId).catch(() => null)
        : null
      setSemester(semesterRes)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [includeWorkflow])

  const hasApprovedPlacement = workflow?.internshipStatus === 'offer_approved'

  return {
    loading,
    user,
    semester,
    workflow,
    hasApprovedPlacement,
    approvedInternshipId,
    placementSemesterLabel,
    canChangeSemester: !hasApprovedPlacement,
    refresh: load,
  } satisfies StudentSemesterContext
}
