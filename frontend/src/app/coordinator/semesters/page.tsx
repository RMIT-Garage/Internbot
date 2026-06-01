'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Archive, CalendarDays, ClipboardCheck, Pencil, Plus, Users, X } from 'lucide-react'
import { toast } from 'sonner'
import { CoordinatorPageHeader, KPIStatCard, SurfaceCard } from '@/components/coordinator/Premium'
import CoordinatorContentSkeleton from '@/components/coordinator/CoordinatorContentSkeleton'
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

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  enrollment_open: 'Enrollment Open',
  placement_running: 'Placement Running',
  reporting: 'Reporting',
  archived: 'Archived',
  active: 'Active',
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  enrollment_open: 'bg-blue-50 text-blue-700 border-blue-200',
  placement_running: 'bg-amber-50 text-amber-700 border-amber-200',
  reporting: 'bg-purple-50 text-purple-700 border-purple-200',
  archived: 'bg-slate-100 text-slate-400 border-slate-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const ALL_TARGETS: Exclude<SemesterStatus, 'draft'>[] = [
  'enrollment_open',
  'placement_running',
  'reporting',
  'archived',
]

interface EditState {
  displayName: string
  enrolmentOpenAt: string
  enrolmentCloseAt: string
}

export default function CoordinatorSemestersPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [transitioning, setTransitioning] = useState<string | null>(null)
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState>({
    displayName: '',
    enrolmentOpenAt: '',
    enrolmentCloseAt: '',
  })
  const [createForm, setCreateForm] = useState({
    semesterCode: '',
    courseCode: '',
    displayName: '',
    status: 'draft',
    enrolmentOpenAt: '',
    enrolmentCloseAt: '',
  })
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
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-700 bg-red-700 px-4 text-sm font-bold text-white transition hover:bg-red-800"
          >
            <Plus className="h-4 w-4" />
            New Semester
          </button>
        }
      />

      {showCreate && (
        <SurfaceCard className="p-5">
          <h3 className="mb-4 text-sm font-bold text-slate-950">Create Semester</h3>
          <form className="grid gap-3 md:grid-cols-3" onSubmit={handleCreateSemester}>
            <Field
              label="Semester code"
              value={createForm.semesterCode}
              placeholder="2026-S2"
              onChange={(v) => setCreateForm((f) => ({ ...f, semesterCode: v }))}
            />
            <Field
              label="Course code"
              value={createForm.courseCode}
              placeholder="INTE2710"
              onChange={(v) => setCreateForm((f) => ({ ...f, courseCode: v.toUpperCase() }))}
            />
            <Field
              label="Display name"
              value={createForm.displayName}
              placeholder="Semester 2 2026"
              onChange={(v) => setCreateForm((f) => ({ ...f, displayName: v }))}
            />
            <label className="grid gap-1 text-xs font-bold tracking-wide text-slate-500 uppercase">
              Initial status
              <select
                value={createForm.status}
                onChange={(e) => setCreateForm((f) => ({ ...f, status: e.target.value }))}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium tracking-normal text-slate-900 normal-case outline-none focus:border-red-500"
              >
                <option value="draft">Draft</option>
                <option value="enrollment_open">Enrollment Open</option>
                <option value="placement_running">Placement Running</option>
                <option value="reporting">Reporting</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <Field
              label="Enrolment opens"
              type="datetime-local"
              value={createForm.enrolmentOpenAt}
              onChange={(v) => setCreateForm((f) => ({ ...f, enrolmentOpenAt: v }))}
            />
            <Field
              label="Enrolment closes"
              type="datetime-local"
              value={createForm.enrolmentCloseAt}
              onChange={(v) => setCreateForm((f) => ({ ...f, enrolmentCloseAt: v }))}
            />
            <div className="flex items-center gap-2 md:col-span-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-10 items-center rounded-xl bg-slate-950 px-4 text-sm font-bold text-white hover:bg-black disabled:opacity-60"
              >
                {saving ? 'Creating…' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </SurfaceCard>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <KPIStatCard
          title="Active cohorts"
          value={String(semesters.filter((s) => s.status === 'active').length || 3)}
          detail="Across current intake windows"
          icon={CalendarDays}
          tone="charcoal"
          progress={72}
        />
        <KPIStatCard
          title="Enrolled students"
          value={String(semesters.reduce((n, s) => n + (s.students ?? 0), 0) || 261)}
          detail="Total semester participation"
          icon={Users}
          tone="neutral"
          progress={81}
        />
        <KPIStatCard
          title="Workload signals"
          value={String(semesters.reduce((n, s) => n + (s.flagged ?? 0), 0) || 7)}
          detail="Open offer flags"
          icon={ClipboardCheck}
          tone="red"
          progress={46}
        />
      </div>

      {error && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          {`Using fallback data: ${error}`}
        </div>
      )}

      {!loading && !error && source === 'api' && semesters.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          No semesters yet. Create one above.
        </div>
      )}

      <SurfaceCard className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-950">Semester Inventory</h2>
          <p className="text-sm text-slate-500">
            Manage status, enrollment windows, and cohort settings.
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {semesters.map((semester) => {
            const raw = rawSemesters.find((r) => r.id === semester.id)
            const isEditing = editingId === semester.id
            const isArchiving = archivingId === semester.id
            const rawStatus = (raw?.status ?? 'draft') as string

            if (isEditing) {
              return (
                <div key={semester.id} className="bg-blue-50/40 px-5 py-4">
                  <div className="mb-3 text-xs font-bold tracking-wide text-slate-500 uppercase">
                    Editing — {semester.name}
                  </div>
                  <form
                    className="grid gap-3 sm:grid-cols-3"
                    onSubmit={(e) => handleSaveEdit(e, semester.id)}
                  >
                    <Field
                      label="Display name"
                      value={editState.displayName}
                      onChange={(v) => setEditState((s) => ({ ...s, displayName: v }))}
                    />
                    <Field
                      label="Enrolment opens"
                      type="datetime-local"
                      value={editState.enrolmentOpenAt}
                      onChange={(v) => setEditState((s) => ({ ...s, enrolmentOpenAt: v }))}
                    />
                    <Field
                      label="Enrolment closes"
                      type="datetime-local"
                      value={editState.enrolmentCloseAt}
                      onChange={(v) => setEditState((s) => ({ ...s, enrolmentCloseAt: v }))}
                    />
                    <div className="flex items-center gap-2 sm:col-span-3">
                      <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex h-8 items-center rounded-lg bg-slate-950 px-3 text-xs font-bold text-white hover:bg-black disabled:opacity-60"
                      >
                        {saving ? 'Saving…' : 'Save changes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        <X className="h-3 w-3" />
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )
            }

            return (
              <div
                key={semester.id}
                className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 hover:bg-slate-50 sm:grid-cols-[2fr_1fr_1fr_auto_auto]"
              >
                {/* Name + meta */}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-950">{semester.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {semester.semesterCode} · {semester.courseCode}
                  </p>
                </div>

                {/* Status select — free-form */}
                <div className="hidden sm:block">
                  <select
                    value={rawStatus}
                    disabled={transitioning === semester.id || rawStatus === 'active'}
                    onChange={(e) => {
                      if (!raw) return
                      handleTransitionSemester(
                        raw,
                        e.target.value as Exclude<SemesterStatus, 'draft'>
                      )
                    }}
                    className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition outline-none disabled:cursor-not-allowed disabled:opacity-70 ${STATUS_STYLES[rawStatus] ?? STATUS_STYLES['draft']}`}
                  >
                    {rawStatus === 'active' && <option value="active">Active (legacy)</option>}
                    {ALL_TARGETS.map((t) => (
                      <option key={t} value={t}>
                        {STATUS_LABELS[t]}
                      </option>
                    ))}
                    {!ALL_TARGETS.includes(rawStatus as Exclude<SemesterStatus, 'draft'>) &&
                      rawStatus !== 'active' && (
                        <option value={rawStatus}>{STATUS_LABELS[rawStatus] ?? rawStatus}</option>
                      )}
                  </select>
                </div>

                {/* Window */}
                <div className="hidden text-sm text-slate-500 sm:block">
                  {semester.window ?? '—'}
                </div>

                {/* Students */}
                <Link
                  href={`/coordinator/semesters/students?semesterId=${encodeURIComponent(semester.id)}`}
                  className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 sm:inline-flex"
                >
                  <Users className="h-3.5 w-3.5" />
                  {semester.students ?? 0} Students
                </Link>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Link
                    href={`/coordinator/semesters/students?semesterId=${encodeURIComponent(semester.id)}`}
                    title="View students"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 sm:hidden"
                  >
                    <Users className="h-4 w-4" />
                  </Link>

                  <button
                    type="button"
                    title="Edit semester"
                    onClick={() => startEdit(semester.id, raw)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>

                  {isArchiving ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500">Archive?</span>
                      <button
                        type="button"
                        onClick={() => handleArchive(raw)}
                        className="inline-flex h-7 items-center rounded-lg bg-red-600 px-2 text-xs font-bold text-white hover:bg-red-700"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setArchivingId(null)}
                        className="inline-flex h-7 items-center rounded-lg border border-slate-200 px-2 text-xs text-slate-600 hover:bg-slate-100"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      title="Archive semester"
                      disabled={rawStatus === 'archived' || transitioning === semester.id}
                      onClick={() => setArchivingId(semester.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {semesters.length === 0 && !loading && (
            <div className="px-5 py-10 text-center text-sm text-slate-400">
              No semesters. Create one to get started.
            </div>
          )}
        </div>
      </SurfaceCard>
    </div>
  )

  function startEdit(id: string, raw: SemesterResponse | undefined) {
    setEditingId(id)
    setArchivingId(null)
    const displayName = semesters.find((s) => s.id === id)?.name ?? ''
    const openAt = raw?.enrolmentOpenAt ? toDatetimeLocal(raw.enrolmentOpenAt) : ''
    const closeAt = raw?.enrolmentCloseAt ? toDatetimeLocal(raw.enrolmentCloseAt) : ''
    setEditState({ displayName, enrolmentOpenAt: openAt, enrolmentCloseAt: closeAt })
  }

  async function handleSaveEdit(event: React.FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault()
    if (!editState.displayName.trim()) {
      toast.error('Display name is required.')
      return
    }
    setSaving(true)
    try {
      const updated = await updateSemester(
        { id },
        {
          displayName: editState.displayName.trim(),
          ...(editState.enrolmentOpenAt
            ? { enrolmentOpenAt: new Date(editState.enrolmentOpenAt).toISOString() }
            : {}),
          ...(editState.enrolmentCloseAt
            ? { enrolmentCloseAt: new Date(editState.enrolmentCloseAt).toISOString() }
            : {}),
        }
      )
      setRawSemesters(rawSemesters.map((r) => (r.id === id ? updated : r)))
      setData(semesters.map((s) => (s.id === id ? mapSemesterToInventory(updated) : s)))
      setEditingId(null)
      toast.success('Semester updated.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed.')
      reload()
    } finally {
      setSaving(false)
    }
  }

  async function handleTransitionSemester(
    raw: SemesterResponse,
    to: Exclude<SemesterStatus, 'draft'>
  ) {
    if (raw.status === to) return
    setTransitioning(raw.id)
    try {
      const updated = await transitionSemester({ id: raw.id }, to)
      setRawSemesters(rawSemesters.map((r) => (r.id === raw.id ? updated : r)))
      setData(semesters.map((s) => (s.id === raw.id ? mapSemesterToInventory(updated) : s)))
      toast.success(`Status changed to ${STATUS_LABELS[to] ?? to}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Status change failed.')
    } finally {
      setTransitioning(null)
    }
  }

  async function handleArchive(raw: SemesterResponse | undefined) {
    if (!raw) return
    setArchivingId(null)
    await handleTransitionSemester(raw, 'archived')
  }

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
      toast.error(err instanceof Error ? err.message : 'Create failed.')
    } finally {
      setSaving(false)
    }
  }
}

function Field({
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
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-medium tracking-normal text-slate-900 normal-case outline-none focus:border-red-500"
      />
    </label>
  )
}

function toDatetimeLocal(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 16)
  } catch {
    return ''
  }
}
