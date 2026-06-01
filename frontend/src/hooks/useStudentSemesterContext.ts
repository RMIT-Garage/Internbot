'use client'

import { useEffect, useState } from 'react'
import { SemestersService, UsersService } from '@/lib/api/openapi-client'
import type { SemesterResponse, StudentUserResponse } from '@/lib/api/openapi-client'
import type { UserWorkflowResponse } from '@/api/models/UserWorkflowResponse'

export interface StudentSemesterContext {
  loading: boolean
  user: StudentUserResponse | null
  semester: SemesterResponse | null
  workflow: UserWorkflowResponse | null
  hasApprovedPlacement: boolean
  approvedInternshipId: string | null
  canChangeSemester: boolean
  refresh: () => Promise<void>
}

export function useStudentSemesterContext(options?: { includeWorkflow?: boolean }) {
  const includeWorkflow = options?.includeWorkflow ?? true
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<StudentUserResponse | null>(null)
  const [semester, setSemester] = useState<SemesterResponse | null>(null)
  const [workflow, setWorkflow] = useState<UserWorkflowResponse | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const profile = await UsersService.getMyProfile()
      if (profile.role !== 'student') {
        setUser(null)
        setSemester(null)
        setWorkflow(null)
        return
      }

      setUser(profile)
      const semesterId = profile.studentProfile?.semesterId ?? null

      const [semesterRes, workflowRes] = await Promise.all([
        semesterId ? SemestersService.getSemester(semesterId).catch(() => null) : Promise.resolve(null),
        includeWorkflow ? UsersService.getMyWorkflow().catch(() => null) : Promise.resolve(null),
      ])

      setSemester(semesterRes)
      setWorkflow(workflowRes)
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
    approvedInternshipId: null as string | null,
    canChangeSemester: !hasApprovedPlacement,
    refresh: load,
  } satisfies StudentSemesterContext
}
