'use client'

import { CalendarDays } from 'lucide-react'
import { useCoordinatorSemesterContext } from '@/lib/coordinator/semesterContext'
import { semesterStatusLabel } from '@/lib/semester/display'

export function CoordinatorSemesterSwitcher() {
  const { loading, semesters, semesterId, selectedSemester, setSemesterId } =
    useCoordinatorSemesterContext()

  if (loading) {
    return (
      <div className="hidden h-10 w-56 animate-pulse rounded-xl bg-slate-100 md:block" aria-hidden />
    )
  }

  if (semesters.length === 0) {
    return null
  }

  return (
    <div className="hidden min-w-0 items-center gap-2 md:flex">
      <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
      <label className="sr-only" htmlFor="coordinator-semester-switcher">
        Working semester
      </label>
      <select
        id="coordinator-semester-switcher"
        value={semesterId ?? ''}
        onChange={(e) => setSemesterId(e.target.value || null)}
        className="max-w-xs truncate rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:border-red-300 focus:ring-2 focus:ring-red-100 focus:outline-none"
      >
        {semesters.map((semester) => (
          <option key={semester.id} value={semester.id}>
            {semester.displayName} · {semesterStatusLabel(semester.status)}
          </option>
        ))}
      </select>
      {selectedSemester && (
        <span className="hidden truncate text-xs text-slate-500 xl:inline">
          {selectedSemester.courseCode}
        </span>
      )}
    </div>
  )
}
