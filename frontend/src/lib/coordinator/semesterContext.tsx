'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { listSemesters } from '@/lib/coordinator/api'
import {
  buildSemesterLabelMap,
  pickDefaultCoordinatorSemesterId,
} from '@/lib/semester/display'
import type { SemesterResponse } from '@/types/api'

interface CoordinatorSemesterContextValue {
  loading: boolean
  semesters: SemesterResponse[]
  semesterId: string | null
  selectedSemester: SemesterResponse | null
  semesterLabels: Record<string, string>
  setSemesterId: (id: string | null) => void
}

const CoordinatorSemesterContext = createContext<CoordinatorSemesterContextValue | null>(null)

export function CoordinatorSemesterProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
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

  const urlSemesterId = searchParams.get('semesterId')
  const semesterId = urlSemesterId ?? pickDefaultCoordinatorSemesterId(semesters)

  useEffect(() => {
    if (loading || semesters.length === 0) return
    if (urlSemesterId) return
    const defaultId = pickDefaultCoordinatorSemesterId(semesters)
    if (!defaultId) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('semesterId', defaultId)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [loading, pathname, router, searchParams, semesters, urlSemesterId])

  const setSemesterId = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (id) params.set('semesterId', id)
      else params.delete('semesterId')
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const semesterLabels = useMemo(() => buildSemesterLabelMap(semesters), [semesters])
  const selectedSemester = useMemo(
    () => semesters.find((s) => s.id === semesterId) ?? null,
    [semesterId, semesters]
  )

  const value = useMemo(
    () => ({
      loading,
      semesters,
      semesterId,
      selectedSemester,
      semesterLabels,
      setSemesterId,
    }),
    [loading, semesterId, semesterLabels, semesters, selectedSemester, setSemesterId]
  )

  return (
    <CoordinatorSemesterContext.Provider value={value}>{children}</CoordinatorSemesterContext.Provider>
  )
}

export function useCoordinatorSemesterContext() {
  const ctx = useContext(CoordinatorSemesterContext)
  if (!ctx) {
    throw new Error('useCoordinatorSemesterContext must be used within CoordinatorSemesterProvider')
  }
  return ctx
}

export function filterByCoordinatorSemester<T extends { semesterId?: string | null }>(
  items: readonly T[],
  semesterId: string | null
) {
  if (!semesterId) return [...items]
  return items.filter((item) => item.semesterId === semesterId)
}
