'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CalendarDays, ClipboardCheck, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { CoordinatorPageHeader, KPIStatCard, SurfaceCard } from '@/components/coordinator/Premium'
import CoordinatorContentSkeleton from '@/components/coordinator/CoordinatorContentSkeleton'
import { StatusBadge } from '@/components/coordinator/StatusBadge'
import { semesterInventory } from '@/lib/coordinator/mockData'
import { useCoordinatorApiResource } from '@/hooks/useCoordinatorApiResource'
import {
  createSemester,
  listSemesters,
  updateSemester,
  transitionSemester,
} from '@/lib/coordinator/api'
import { mapSemesterToInventory } from '@/lib/coordinator/apiMappers'
import type { SemesterResponse, SemesterStatus } from '@/types/api'

const TRANSITION_TARGETS: Record<SemesterStatus, Exclude<SemesterStatus, 'draft'>[]> = {
  draft: ['enrollment_open', 'archived'],
  enrollment_open: ['placement_running', 'archived'],
  placement_running: ['reporting', 'archived'],
  reporting: ['archived'],
  archived: [],
}

export default function CoordinatorSemestersPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [transitioning, setTransitioning] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({
    semesterCode: '',
    courseCode: '',
    displayName: '',
    status: 'draft',
    enrolmentOpenAt: '',
    enrolmentCloseAt: '',
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [rawSemesters, setRawSemesters] = useState<SemesterResponse[]>([])
  const {
    data: semesters,
    loading,
    error,
    source,
    setData,
    reload,
  } = useCoordinatorApiResource(
    async () => {
      if (process.env.NODE_ENV === 'development') {
        console.debug(
          '[coordinator/semesters] backend filters: limit only; display filters are client-side'
        )
      }
      const response = await listSemesters({ limit: 100 })
      setRawSemesters(response.items)
      return response.items.map(mapSemesterToInventory)
    },
    semesterInventory,
    'semesters',
    { emptyData: [] }
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <CoordinatorPageHeader
          eyebrow="Semester Management"
          title="Semester Operations"
          description="Manage intake windows, lifecycle phases, cohort enrollment, and approval workload across academic periods."
        />
        <CoordinatorContentSkeleton title="Loading semesters..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Semester Management"
        title="Semester Operations"
        description="Manage intake windows, lifecycle phases, cohort enrollment, and approval workload across academic periods."
        actions={
          <button
            type="button"
            onClick={() => setShowCreate((current) => !current)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-700 bg-red-700 px-4 text-sm font-bold text-white transition hover:bg-red-800"
          >
            <Plus className="h-4 w-4" />
            Create New Semester
          </button>
        }
      />
      {showCreate && (
        <SurfaceCard className="p-5">
          <form className="grid gap-3 md:grid-cols-3" onSubmit={handleCreateSemester}>
            <TextInput
              label="Semester code"
              value={createForm.semesterCode}
              placeholder="2026-S2"
              onChange={(value) =>
                setCreateForm((current) => ({ ...current, semesterCode: value }))
              }
            />
            <TextInput
              label="Course code"
              value={createForm.courseCode}
              placeholder="INTE2710"
              onChange={(value) =>
                setCreateForm((current) => ({ ...current, courseCode: value.toUpperCase() }))
              }
            />
            <TextInput
              label="Display name"
              value={createForm.displayName}
              placeholder="Semester 2 2026"
              onChange={(value) => setCreateForm((current) => ({ ...current, displayName: value }))}
            />
            <label className="grid gap-1 text-xs font-bold tracking-wide text-slate-500 uppercase">
              Status
              <select
                value={createForm.status}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, status: event.target.value }))
                }
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium tracking-normal text-slate-900 normal-case outline-none focus:border-red-500"
              >
                <option value="draft">Draft</option>
                <option value="enrollment_open">Enrollment Open</option>
                <option value="placement_running">Placement Running</option>
                <option value="reporting">Reporting</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <TextInput
              label="Open at"
              type="datetime-local"
              value={createForm.enrolmentOpenAt}
              onChange={(value) =>
                setCreateForm((current) => ({ ...current, enrolmentOpenAt: value }))
              }
            />
            <TextInput
              label="Close at"
              type="datetime-local"
              value={createForm.enrolmentCloseAt}
              onChange={(value) =>
                setCreateForm((current) => ({ ...current, enrolmentCloseAt: value }))
              }
            />
            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-10 items-center rounded-xl bg-slate-950 px-4 text-sm font-bold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Creating...' : 'Create semester'}
              </button>
            </div>
          </form>
        </SurfaceCard>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <KPIStatCard
          title="Active cohorts"
          value="3"
          detail="Across 2026 intake windows"
          icon={CalendarDays}
          tone="charcoal"
          progress={72}
        />
        <KPIStatCard
          title="Enrolled students"
          value="261"
          detail="Total semester participation"
          icon={Plus}
          tone="neutral"
          progress={81}
        />
        <KPIStatCard
          title="Workload signals"
          value="7"
          detail="Setup and review indicators"
          icon={ClipboardCheck}
          tone="red"
          progress={46}
        />
      </div>
      {error && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          {`Using isolated fallback data: ${error}`}
        </div>
      )}
      {!loading && !error && source === 'api' && semesters.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Backend connected, but no records exist yet.
        </div>
      )}
      <SurfaceCard className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-950">Semester Inventory</h2>
          <p className="text-sm text-slate-500">
            Lifecycle status, enrollment windows, and flagged workload.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold tracking-wide text-slate-500 uppercase">
              <tr>
                {[
                  'Semester',
                  'Lifecycle',
                  'Enrollment Window',
                  'Students',
                  'Current Phase',
                  'Flags',
                  'Actions',
                ].map((head) => (
                  <th key={head} className="px-5 py-3">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {semesters.map((semester) => {
                const raw = rawSemesters.find((r) => r.id === semester.id)
                const rawStatus = raw?.status as SemesterStatus | undefined
                const targets = rawStatus ? (TRANSITION_TARGETS[rawStatus] ?? []) : []
                return (
                  <tr key={semester.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-bold text-slate-950">
                      {editingId === semester.id ? (
                        <form
                          className="flex min-w-64 gap-2"
                          onSubmit={(event) => handleUpdateSemester(event, semester.id)}
                        >
                          <input
                            value={editingName}
                            onChange={(event) => setEditingName(event.target.value)}
                            className="h-9 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-red-500"
                          />
                          <button
                            type="submit"
                            disabled={saving}
                            className="h-9 rounded-xl bg-slate-950 px-3 text-xs font-bold text-white disabled:opacity-60"
                          >
                            Save
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(semester.id)
                            setEditingName(semester.name)
                          }}
                          className="text-left font-bold text-slate-950 hover:text-red-700"
                        >
                          {semester.name}
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={semester.status as 'active' | 'pending' | 'archived'} />
                    </td>
                    <td className="px-5 py-4 text-slate-600">{semester.window}</td>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      <Link
                        href={`/coordinator/semesters/${semester.id}/students`}
                        className="hover:text-red-700 hover:underline"
                      >
                        {semester.students}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{semester.phase}</td>
                    <td className="px-5 py-4 font-bold text-red-700">{semester.flagged}</td>
                    <td className="px-5 py-4">
                      {targets.length > 0 && raw && (
                        <select
                          disabled={transitioning === semester.id}
                          defaultValue=""
                          onChange={(event) => {
                            const to = event.target.value as Exclude<SemesterStatus, 'draft'>
                            if (to) handleTransitionSemester(raw, to)
                            event.target.value = ''
                          }}
                          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 outline-none focus:border-red-500 disabled:opacity-60"
                        >
                          <option value="" disabled>
                            Transition…
                          </option>
                          {targets.map((t) => (
                            <option key={t} value={t}>
                              → {t.replace(/_/g, ' ')}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SurfaceCard>
    </div>
  )

  async function handleCreateSemester(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!createForm.semesterCode || !createForm.courseCode || !createForm.displayName) {
      toast.error('Semester code, course code, and display name are required.')
      return
    }

    setSaving(true)
    try {
      const created = await createSemester({
        semesterCode: createForm.semesterCode,
        courseCode: createForm.courseCode,
        displayName: createForm.displayName,
        status: createForm.status as SemesterStatus,
        ...(createForm.enrolmentOpenAt
          ? { enrolmentOpenAt: new Date(createForm.enrolmentOpenAt).toISOString() }
          : {}),
        ...(createForm.enrolmentCloseAt
          ? { enrolmentCloseAt: new Date(createForm.enrolmentCloseAt).toISOString() }
          : {}),
      })
      setRawSemesters([created, ...rawSemesters])
      setData([mapSemesterToInventory(created), ...semesters])
      setShowCreate(false)
      setCreateForm({
        semesterCode: '',
        courseCode: '',
        displayName: '',
        status: 'draft',
        enrolmentOpenAt: '',
        enrolmentCloseAt: '',
      })
      toast.success('Semester created.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Semester API unavailable.')
    } finally {
      setSaving(false)
    }
  }

  async function handleTransitionSemester(
    raw: SemesterResponse,
    to: Exclude<SemesterStatus, 'draft'>
  ) {
    setTransitioning(raw.id)
    try {
      const updated = await transitionSemester({ id: raw.id }, to)
      setRawSemesters(rawSemesters.map((r) => (r.id === raw.id ? updated : r)))
      setData(semesters.map((s) => (s.id === raw.id ? mapSemesterToInventory(updated) : s)))
      toast.success(`Semester transitioned to ${to.replace(/_/g, ' ')}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Transition failed.')
    } finally {
      setTransitioning(null)
    }
  }

  async function handleUpdateSemester(event: React.FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault()
    if (!editingName.trim()) {
      toast.error('Display name is required.')
      return
    }

    setSaving(true)
    try {
      const updated = await updateSemester({ id }, { displayName: editingName.trim() })
      setRawSemesters(rawSemesters.map((r) => (r.id === id ? updated : r)))
      setData(
        semesters.map((semester) =>
          semester.id === id ? mapSemesterToInventory(updated) : semester
        )
      )
      setEditingId(null)
      toast.success('Semester updated.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Semester API unavailable.')
      reload()
    } finally {
      setSaving(false)
    }
  }
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <label className="grid gap-1 text-xs font-bold tracking-wide text-slate-500 uppercase">
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-medium tracking-normal text-slate-900 normal-case outline-none focus:border-red-500"
      />
    </label>
  )
}
