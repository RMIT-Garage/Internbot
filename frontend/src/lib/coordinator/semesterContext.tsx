'use client'

import { useEffect, useMemo, useState } from 'react'
import { listSemesters } from '@/lib/coordinator/api'
import { buildSemesterLabelMap } from '@/lib/semester/display'
import type { SemesterResponse } from '@/types/api'

/** Semester list for per-page filter dropdowns (not a global shell filter). */
export function useCoordinatorSemesterOptions() {
  const [loading, setLoading] = useState(true)
  const [semesters, setSemesters] = useState<SemesterResponse[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const result = await listSemesters({ limit: 50 })
        if (!cancelled) setSemesters(result.items)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const semesterLabels = useMemo(() => buildSemesterLabelMap(semesters), [semesters])

  return { loading, semesters, semesterLabels }
}
