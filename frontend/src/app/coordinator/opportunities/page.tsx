'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Archive,
  BriefcaseBusiness,
  ClipboardCheck,
  Eye,
  FileText,
  PenLine,
  Plus,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { CoordinatorPageHeader, KPIStatCard, SurfaceCard } from '@/components/coordinator/Premium'
import CoordinatorContentSkeleton from '@/components/coordinator/CoordinatorContentSkeleton'
import { opportunities } from '@/lib/coordinator/mockData'
import { useCoordinatorApiResource } from '@/hooks/useCoordinatorApiResource'
import { useAuth } from '@/hooks/useAuth'
import {
  createOpportunity,
  getUser,
  listOpportunities,
  listSemesters,
  transitionOpportunity,
  updateOpportunity,
} from '@/lib/coordinator/api'
import { formatDate } from '@/lib/utils'
import { OPPORTUNITY_SELF_SOURCED_TAB, withReviewReturn } from '@/lib/coordinator/reviewRouting'
import { STUDENT_PROFILE_PENDING, formatStudentDisplay } from '@/lib/coordinator/studentDisplay'
import type { OpportunityResponse, OpportunityStatus, SemesterResponse } from '@/types/api'

type WorkMode = 'onsite' | 'hybrid' | 'remote'
type OpportunityType = 'pre_approved' | 'custom'
type QuickStatusFilter =
  | 'all'
  | 'published'
  | 'draft'
  | 'pending_verification'
  | 'rejected'
  | 'archived'
type SortOption =
  | 'action_required'
  | 'newest'
  | 'oldest_waiting'
  | 'recently_updated'
  | 'employer'
  | 'student'
type PublishingView = 'active' | 'archived' | 'all'
type OpportunityTab = 'published' | 'self_sourced'

interface OpportunityRow {
  id: string
  title: string
  company: string
  semesterId: string
  semesterLabel: string
  courseLabel: string
  type: OpportunityType
  descriptionText: string
  workMode: WorkMode | null
  location: string | null
  sourceUrl: string | null
  statusRaw: OpportunityStatus
  applications: number
  createdByUserId: string | null
  submittedByUserId: string | null
  verifiedByUserId: string | null
  verifiedAt: string | null
  attachmentCount: number
  createdAt: string
  updatedAt: string
}

interface OpportunityFilters {
  search: string
  quickStatus: QuickStatusFilter
  semesterId: string
  course: string
  employer: string
  student: string
  sort: SortOption
}

type MockOpportunity = (typeof opportunities)[number]

const initialFilters: OpportunityFilters = {
  search: '',
  quickStatus: 'all',
  semesterId: 'all',
  course: '',
  employer: '',
  student: '',
  sort: 'action_required',
}

function mapOpportunityRow(
  item: OpportunityResponse,
  semesterLabels: Map<string, string>,
  semesterCourseLabels: Map<string, string>
): OpportunityRow {
  return {
    id: item.id,
    title: item.jobTitle,
    company: item.employerName,
    semesterId: item.semesterId,
    semesterLabel: semesterLabels.get(item.semesterId) ?? item.semesterId,
    courseLabel: semesterCourseLabels.get(item.semesterId) ?? 'Program pending',
    type: item.type,
    descriptionText: item.descriptionText,
    workMode: item.workMode,
    location: item.location,
    sourceUrl: item.sourceUrl,
    statusRaw: item.status,
    applications: displayApplicationCount(item.type, item.applicationCount, item.submittedByUserId),
    createdByUserId: item.createdByUserId,
    submittedByUserId: item.submittedByUserId,
    verifiedByUserId: item.verifiedByUserId,
    verifiedAt: item.verifiedAt,
    attachmentCount: item.attachments.length,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

function mapMockOpportunityRow(
  item: MockOpportunity,
  semesterLabels: Map<string, string>,
  semesterCourseLabels: Map<string, string>
): OpportunityRow {
  return {
    id: item.id,
    title: item.title,
    company: item.company,
    semesterId: item.semesterId,
    semesterLabel: semesterLabels.get(item.semesterId) ?? item.semesterId,
    courseLabel: semesterCourseLabels.get(item.semesterId) ?? 'Program pending',
    type: item.type,
    descriptionText: item.descriptionText,
    workMode: item.workMode,
    location: item.location,
    sourceUrl: item.sourceUrl,
    statusRaw: item.statusRaw,
    applications: displayApplicationCount(item.type, item.applications, item.submittedByUserId),
    createdByUserId: item.createdByUserId,
    submittedByUserId: item.submittedByUserId,
    verifiedByUserId: item.verifiedByUserId,
    verifiedAt: item.verifiedAt,
    attachmentCount: 0,
    createdAt: item.closingDate,
    updatedAt: item.closingDate,
  }
}

export default function CoordinatorOpportunitiesPage() {
  const { loading: authLoading } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [transitioningId, setTransitioningId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [publishingView, setPublishingView] = useState<PublishingView>('active')
  const [activeTab, setActiveTab] = useState<OpportunityTab>('published')
  const [filters, setFilters] = useState<OpportunityFilters>(initialFilters)
  const [studentLabels, setStudentLabels] = useState<Record<string, string>>({})
  const [editForm, setEditForm] = useState({
    title: '',
    company: '',
    semesterId: '',
    descriptionText: '',
    sourceUrl: '',
    type: 'custom' as OpportunityType,
  })
  const [createForm, setCreateForm] = useState({
    semesterId: '',
    type: 'custom' as OpportunityType,
    employerName: '',
    jobTitle: '',
    descriptionText: '',
    workMode: 'hybrid' as WorkMode,
    location: '',
    sourceUrl: '',
  })

  const semestersResource = useCoordinatorApiResource(
    async () => {
      const response = await listSemesters({ limit: 100, status: 'active' })
      return response.items
    },
    [] as SemesterResponse[],
    'opportunity-semesters',
    { emptyData: [], enabled: !authLoading }
  )

  const semesterLabels = useMemo(() => {
    return new Map(semestersResource.data.map((semester) => [semester.id, semester.displayName]))
  }, [semestersResource.data])

  const semesterCourseLabels = useMemo(() => {
    return new Map(semestersResource.data.map((semester) => [semester.id, semester.courseCode]))
  }, [semestersResource.data])

  const {
    data: opportunityRows,
    loading,
    error,
    source,
    setData,
    reload,
  } = useCoordinatorApiResource(
    async () => {
      const response = await listOpportunities({ limit: 100, sort: '-createdAt' })
      return response.items.map((item) =>
        mapOpportunityRow(item, semesterLabels, semesterCourseLabels)
      )
    },
    opportunities.map((item) => mapMockOpportunityRow(item, semesterLabels, semesterCourseLabels)),
    `opportunities-${semestersResource.data.length}`,
    { emptyData: [] }
  )

  const filteredRows = useMemo(
    () =>
      sortRows(
        opportunityRows.filter((row) => matchesFilters(row, filters)),
        filters.sort
      ),
    [filters, opportunityRows]
  )
  const publishedRows = filteredRows.filter((row) => isPublishedOpportunityRow(row, publishingView))
  const publishingCounts = {
    active: opportunityRows.filter((row) => isPublishedOpportunityRow(row, 'active')).length,
    archived: opportunityRows.filter((row) => isPublishedOpportunityRow(row, 'archived')).length,
    all: opportunityRows.filter((row) => isPublishedOpportunityRow(row, 'all')).length,
  }
  const selfSourcedRows = filteredRows.filter((row) => isSelfSourcedReviewRow(row))
  const pendingReviewCount = opportunityRows.filter(
    (row) => row.statusRaw === 'pending_verification'
  ).length
  const activePostingCount = opportunityRows.filter((row) =>
    isPublishedOpportunityRow(row, 'active')
  ).length
  const canCreate = isCreateFormValid(createForm) && semestersResource.data.length > 0 && !saving
  const hasFilters = !areFiltersDefault(filters)

  useEffect(() => {
    const syncTabFromUrl = () => {
      setActiveTab(getOpportunityTabFromUrl())
    }

    syncTabFromUrl()
    window.addEventListener('popstate', syncTabFromUrl)
    return () => window.removeEventListener('popstate', syncTabFromUrl)
  }, [])

  useEffect(() => {
    const missingIds = Array.from(
      new Set(
        opportunityRows
          .map((row) => row.submittedByUserId)
          .filter((id): id is string => Boolean(id && !studentLabels[id]))
      )
    )

    if (missingIds.length === 0) return

    let active = true
    Promise.all(
      missingIds.map(async (id) => {
        try {
          const user = await getUser(id)
          return [id, formatStudentDisplay(user)] as const
        } catch {
          return [id, STUDENT_PROFILE_PENDING] as const
        }
      })
    ).then((entries) => {
      if (!active) return
      setStudentLabels((current) => ({
        ...current,
        ...Object.fromEntries(entries),
      }))
    })

    return () => {
      active = false
    }
  }, [opportunityRows, studentLabels])

  if (loading) {
    return (
      <div className="space-y-6">
        <CoordinatorPageHeader
          eyebrow="Internship Search"
          title="Internship Opportunities"
          description="Manage internships before a student officially receives an offer."
        />
        <CoordinatorContentSkeleton title="Loading opportunities..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Internship Search"
        title="Internship Opportunities"
        description="Manage the student-facing opportunity board and review self-sourced position descriptions before placement processing begins."
        actions={
          <button
            type="button"
            onClick={() => setShowCreate((current) => !current)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-700 bg-red-700 px-4 text-sm font-bold text-white transition hover:bg-red-800"
          >
            <Plus className="h-4 w-4" />
            New opportunity
          </button>
        }
      />

      {showCreate && (
        <CreateOpportunityPanel
          createForm={createForm}
          canCreate={canCreate}
          saving={saving}
          semesters={semestersResource.data}
          semesterLoading={semestersResource.loading}
          semesterError={semestersResource.error}
          onFormChange={setCreateForm}
          onSubmit={handleCreateOpportunity}
        />
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <KPIStatCard
          title="Published listings"
          value={activePostingCount}
          detail="Student-facing internships and accepted self-sourced roles"
          icon={BriefcaseBusiness}
          tone="charcoal"
          progress={58}
        />
        <KPIStatCard
          title="Awaiting Placement Approval"
          value={pendingReviewCount}
          detail="Self-sourced position descriptions needing suitability review"
          icon={ClipboardCheck}
          tone="neutral"
          progress={42}
        />
        <KPIStatCard
          title="Applications"
          value={opportunityRows.reduce((sum, opportunity) => sum + opportunity.applications, 0)}
          detail="Across published opportunity records"
          icon={FileText}
          tone="neutral"
          progress={50}
        />
      </div>

      {error && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Opportunity records are temporarily unavailable. Showing saved records where available.
        </div>
      )}
      {!loading && !error && source === 'api' && opportunityRows.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          No opportunity records exist yet.
        </div>
      )}

      <OpportunityFiltersBar
        filters={filters}
        semesters={semestersResource.data}
        totalCount={opportunityRows.length}
        shownCount={filteredRows.length}
        hasFilters={hasFilters}
        onChange={setFilters}
        onClear={() => setFilters(initialFilters)}
      />

      <OpportunityTabs
        activeTab={activeTab}
        publishedCount={publishedRows.length}
        selfSourcedCount={selfSourcedRows.length}
        onTabChange={handleTabChange}
      />

      {activeTab === 'published' ? (
        <PublishedOpportunitySection
          rows={publishedRows}
          view={publishingView}
          counts={publishingCounts}
          editingId={editingId}
          editForm={editForm}
          semesters={semestersResource.data}
          studentLabels={studentLabels}
          saving={saving}
          transitioningId={transitioningId}
          onViewChange={setPublishingView}
          onEditStart={startEdit}
          onEditChange={setEditForm}
          onEditCancel={() => setEditingId(null)}
          onUpdate={handleUpdateOpportunity}
          onTransition={handleTransitionOpportunity}
        />
      ) : (
        <SelfSourcedReviewSection rows={selfSourcedRows} studentLabels={studentLabels} />
      )}
    </div>
  )

  function startEdit(opportunity: OpportunityRow) {
    if (!canEditPublishedOpportunity(opportunity)) return
    setEditingId(opportunity.id)
    setEditForm({
      title: opportunity.title,
      company: opportunity.company,
      semesterId: opportunity.semesterId,
      descriptionText: opportunity.descriptionText,
      sourceUrl: opportunity.sourceUrl ?? '',
      type: opportunity.type,
    })
  }

  function handleTabChange(tab: OpportunityTab) {
    setActiveTab(tab)
    const params = new URLSearchParams(window.location.search)
    if (tab === 'self_sourced') {
      params.set('tab', OPPORTUNITY_SELF_SOURCED_TAB)
    } else {
      params.delete('tab')
    }
    const query = params.toString()
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname)
  }

  async function handleCreateOpportunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canCreate) {
      toast.error(getCreateOpportunityValidationMessage(createForm))
      return
    }

    setSaving(true)
    try {
      const created = await createOpportunity({
        semesterId: createForm.semesterId,
        type: createForm.type,
        employerName: createForm.employerName.trim(),
        jobTitle: createForm.jobTitle.trim(),
        descriptionText: createForm.descriptionText.trim(),
        workMode: createForm.workMode,
        location: createForm.location.trim(),
        ...(createForm.sourceUrl.trim() ? { sourceUrl: createForm.sourceUrl.trim() } : {}),
      })
      const publishedCreated =
        isDraftStatus(created.status) && !created.submittedByUserId
          ? await transitionOpportunity({ id: created.id }, 'published')
          : created
      const createdRow = mapOpportunityRow(publishedCreated, semesterLabels, semesterCourseLabels)
      setData([createdRow, ...opportunityRows.filter((row) => row.id !== createdRow.id)])
      setShowCreate(false)
      setCreateForm({
        semesterId: '',
        type: 'custom',
        employerName: '',
        jobTitle: '',
        descriptionText: '',
        workMode: 'hybrid',
        location: '',
        sourceUrl: '',
      })
      setActiveTab('published')
      setPublishingView(isArchived(createdRow) ? 'all' : 'active')
      setFilters(initialFilters)
      toast.success('Opportunity created.')
      try {
        const refreshed = await listOpportunities({ limit: 100, sort: '-createdAt' })
        const refreshedRows = refreshed.items.map((item) =>
          mapOpportunityRow(item, semesterLabels, semesterCourseLabels)
        )
        setData(mergeOpportunityRows(createdRow, refreshedRows))
      } catch {
        setData([createdRow, ...opportunityRows.filter((row) => row.id !== createdRow.id)])
      }
    } catch (err) {
      toast.error(formatOpportunityError(err, createForm.type))
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateOpportunity(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault()
    if (!editForm.title.trim() || !editForm.company.trim() || !editForm.semesterId) {
      toast.error('Job title, employer, and semester are required.')
      return
    }
    const sourceUrlError = getSourceUrlError(editForm.type, editForm.sourceUrl)
    if (sourceUrlError) {
      toast.error(sourceUrlError)
      return
    }

    setSaving(true)
    try {
      const updated = await updateOpportunity(
        { id },
        {
          jobTitle: editForm.title.trim(),
          employerName: editForm.company.trim(),
          semesterId: editForm.semesterId,
          descriptionText: editForm.descriptionText.trim() || undefined,
          sourceUrl: editForm.sourceUrl.trim() || null,
        }
      )
      setData(
        opportunityRows.map((row) =>
          row.id === id ? mapOpportunityRow(updated, semesterLabels, semesterCourseLabels) : row
        )
      )
      setEditingId(null)
      toast.success('Opportunity updated.')
      try {
        const refreshed = await listOpportunities({ limit: 100, sort: '-createdAt' })
        setData(
          refreshed.items.map((item) =>
            mapOpportunityRow(item, semesterLabels, semesterCourseLabels)
          )
        )
      } catch {
        reload()
      }
    } catch (err) {
      toast.error(formatOpportunityError(err, editForm.type))
      reload()
    } finally {
      setSaving(false)
    }
  }

  async function handleTransitionOpportunity(opportunity: OpportunityRow, to: 'archived') {
    setTransitioningId(opportunity.id)
    try {
      const updated = await transitionOpportunity({ id: opportunity.id }, to)
      setData(
        opportunityRows.map((row) =>
          row.id === opportunity.id
            ? mapOpportunityRow(updated, semesterLabels, semesterCourseLabels)
            : row
        )
      )
      toast.success('Opportunity archived.')
    } catch (err) {
      const fallbackMessage = 'Opportunity transition unavailable.'
      toast.error(err instanceof Error ? `${fallbackMessage} ${err.message}` : fallbackMessage)
      reload()
    } finally {
      setTransitioningId(null)
    }
  }
}

function CreateOpportunityPanel({
  createForm,
  canCreate,
  saving,
  semesters,
  semesterLoading,
  semesterError,
  onFormChange,
  onSubmit,
}: {
  createForm: {
    semesterId: string
    type: OpportunityType
    employerName: string
    jobTitle: string
    descriptionText: string
    workMode: WorkMode
    location: string
    sourceUrl: string
  }
  canCreate: boolean
  saving: boolean
  semesters: SemesterResponse[]
  semesterLoading: boolean
  semesterError: string | null
  onFormChange: (form: {
    semesterId: string
    type: OpportunityType
    employerName: string
    jobTitle: string
    descriptionText: string
    workMode: WorkMode
    location: string
    sourceUrl: string
  }) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <SurfaceCard className="p-5">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-950">
          Create Coordinator Published opportunity
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Coordinator-published listings go straight to the student opportunity board. Student
          self-sourced submissions appear separately in Self-Sourced Reviews.
        </p>
      </div>
      {(semesterLoading || semesterError) && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {semesterLoading ? 'Loading semesters...' : 'Semester list is temporarily unavailable.'}
        </div>
      )}
      {!semesterLoading && !semesterError && semesters.length === 0 && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-900">
          No semesters available. Create/activate a semester before creating opportunities.
        </div>
      )}
      <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
        <label className="grid gap-1 text-xs font-bold tracking-wide text-slate-500 uppercase">
          Semester
          <select
            value={createForm.semesterId}
            onChange={(event) => onFormChange({ ...createForm, semesterId: event.target.value })}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium tracking-normal text-slate-900 normal-case outline-none focus:border-red-500"
          >
            <option value="">Select semester</option>
            {semesters.map((semester) => (
              <option key={semester.id} value={semester.id}>
                {semester.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold tracking-wide text-slate-500 uppercase">
          Source
          <select
            value={createForm.type}
            onChange={(event) =>
              onFormChange({ ...createForm, type: event.target.value as OpportunityType })
            }
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium tracking-normal text-slate-900 normal-case outline-none focus:border-red-500"
          >
            <option value="custom">Coordinator Published</option>
            <option value="pre_approved">CareerHub</option>
          </select>
        </label>
        <TextInput
          label="Employer"
          value={createForm.employerName}
          onChange={(value) => onFormChange({ ...createForm, employerName: value })}
        />
        <TextInput
          label="Job title"
          value={createForm.jobTitle}
          onChange={(value) => onFormChange({ ...createForm, jobTitle: value })}
        />
        <label className="grid gap-1 text-xs font-bold tracking-wide text-slate-500 uppercase">
          Work mode
          <select
            value={createForm.workMode}
            onChange={(event) =>
              onFormChange({ ...createForm, workMode: event.target.value as WorkMode })
            }
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium tracking-normal text-slate-900 normal-case outline-none focus:border-red-500"
          >
            <option value="onsite">Onsite</option>
            <option value="hybrid">Hybrid</option>
            <option value="remote">Remote</option>
          </select>
        </label>
        <TextInput
          label="Location"
          value={createForm.location}
          onChange={(value) => onFormChange({ ...createForm, location: value })}
        />
        <label className="grid gap-1 text-xs font-bold tracking-wide text-slate-500 uppercase md:col-span-2">
          Description
          <textarea
            value={createForm.descriptionText}
            onChange={(event) =>
              onFormChange({ ...createForm, descriptionText: event.target.value })
            }
            className="min-h-24 rounded-xl border border-slate-200 p-3 text-sm font-medium tracking-normal text-slate-900 normal-case outline-none focus:border-red-500"
          />
        </label>
        <TextInput
          label={
            createForm.type === 'pre_approved'
              ? 'CareerHub opportunity link'
              : 'Job listing or careers link'
          }
          value={createForm.sourceUrl}
          onChange={(value) => onFormChange({ ...createForm, sourceUrl: value })}
          error={getSourceUrlError(createForm.type, createForm.sourceUrl)}
        />
        <div className="flex items-end">
          <button
            type="submit"
            disabled={!canCreate}
            className="inline-flex h-10 items-center rounded-xl bg-slate-950 px-4 text-sm font-bold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Creating...' : 'Create opportunity'}
          </button>
        </div>
      </form>
    </SurfaceCard>
  )
}

function OpportunityFiltersBar({
  filters,
  semesters,
  totalCount,
  shownCount,
  hasFilters,
  onChange,
  onClear,
}: {
  filters: OpportunityFilters
  semesters: SemesterResponse[]
  totalCount: number
  shownCount: number
  hasFilters: boolean
  onChange: (filters: OpportunityFilters) => void
  onClear: () => void
}) {
  const statusOptions: Array<{ value: QuickStatusFilter; label: string }> = [
    { value: 'all', label: 'All states' },
    { value: 'published', label: 'Published' },
    { value: 'draft', label: 'Draft' },
    { value: 'pending_verification', label: 'Awaiting Placement Approval' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'archived', label: 'Archived' },
  ]

  return (
    <SurfaceCard className="space-y-4 p-4">
      <div className="grid gap-3 xl:grid-cols-[1.5fr_0.8fr_0.9fr_1fr_0.9fr_0.9fr_0.9fr]">
        <label className="grid gap-1 text-xs font-bold tracking-wide text-slate-500 uppercase">
          Search
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <input
              value={filters.search}
              onChange={(event) => onChange({ ...filters, search: event.target.value })}
              placeholder="Role, employer, student"
              className="h-10 w-full rounded-xl border border-slate-200 pr-3 pl-9 text-sm font-medium tracking-normal text-slate-900 normal-case outline-none focus:border-red-500"
            />
          </div>
        </label>
        <SelectField
          label="State"
          value={filters.quickStatus}
          onChange={(value) => onChange({ ...filters, quickStatus: value as QuickStatusFilter })}
          options={statusOptions}
        />
        <SelectField
          label="Semester"
          value={filters.semesterId}
          onChange={(value) => onChange({ ...filters, semesterId: value })}
          options={[
            { value: 'all', label: 'All semesters' },
            ...semesters.map((semester) => ({ value: semester.id, label: semester.displayName })),
          ]}
        />
        <TextInput
          label="Program/course"
          value={filters.course}
          onChange={(value) => onChange({ ...filters, course: value })}
        />
        <TextInput
          label="Employer"
          value={filters.employer}
          onChange={(value) => onChange({ ...filters, employer: value })}
        />
        <TextInput
          label="Student"
          value={filters.student}
          onChange={(value) => onChange({ ...filters, student: value })}
        />
        <SelectField
          label="Sort"
          value={filters.sort}
          onChange={(value) => onChange({ ...filters, sort: value as SortOption })}
          options={[
            { value: 'action_required', label: 'Action required first' },
            { value: 'newest', label: 'Newest submissions' },
            { value: 'oldest_waiting', label: 'Oldest waiting' },
            { value: 'recently_updated', label: 'Recently updated' },
            { value: 'employer', label: 'Employer A-Z' },
            { value: 'student', label: 'Student A-Z' },
          ]}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <p className="text-sm font-medium text-slate-600">
          Showing <span className="font-bold text-slate-950">{shownCount}</span> of{' '}
          <span className="font-bold text-slate-950">{totalCount}</span> opportunity records
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={onClear}
            className="text-sm font-bold text-red-700 hover:text-red-900"
          >
            Clear all filters
          </button>
        )}
      </div>
      {hasFilters && (
        <div className="flex flex-wrap gap-2">
          {filterChips(filters).map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => onChange({ ...filters, [chip.key]: initialFilters[chip.key] })}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700 hover:border-red-200 hover:bg-red-50"
            >
              {chip.label} x
            </button>
          ))}
        </div>
      )}
    </SurfaceCard>
  )
}

function PublishedOpportunitySection({
  rows,
  view,
  counts,
  editingId,
  editForm,
  semesters,
  studentLabels,
  saving,
  transitioningId,
  onViewChange,
  onEditStart,
  onEditChange,
  onEditCancel,
  onUpdate,
  onTransition,
}: {
  rows: OpportunityRow[]
  view: PublishingView
  counts: Record<PublishingView, number>
  editingId: string | null
  editForm: {
    title: string
    company: string
    semesterId: string
    descriptionText: string
    sourceUrl: string
    type: OpportunityType
  }
  semesters: SemesterResponse[]
  studentLabels: Record<string, string>
  saving: boolean
  transitioningId: string | null
  onViewChange: (view: PublishingView) => void
  onEditStart: (opportunity: OpportunityRow) => void
  onEditChange: (form: {
    title: string
    company: string
    semesterId: string
    descriptionText: string
    sourceUrl: string
    type: OpportunityType
  }) => void
  onEditCancel: () => void
  onUpdate: (event: FormEvent<HTMLFormElement>, id: string) => void
  onTransition: (opportunity: OpportunityRow, to: 'archived') => void
}) {
  const emptyMessage =
    view === 'archived'
      ? 'No archived coordinator-created opportunities match the current filters.'
      : view === 'all'
        ? 'No coordinator-created opportunities match the current filters.'
        : 'No active coordinator-created opportunities match the current filters.'

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeader
          title="Published Opportunities"
          description="Student-facing internship listings. No placement processing or contract review happens here."
        />
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
          {[
            { value: 'active', label: 'Active / Published' },
            { value: 'archived', label: 'Archived' },
            { value: 'all', label: 'All' },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onViewChange(item.value as PublishingView)}
              className={[
                'inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold transition',
                view === item.value
                  ? 'bg-slate-950 text-white'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950',
              ].join(' ')}
            >
              {item.label}
              <span
                className={[
                  'rounded-full px-1.5 py-0.5 text-[10px]',
                  view === item.value ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600',
                ].join(' ')}
              >
                {counts[item.value as PublishingView]}
              </span>
            </button>
          ))}
        </div>
      </div>
      <SurfaceCard className="overflow-hidden">
        <div className="grid grid-cols-[1.25fr_0.95fr_0.95fr_0.85fr_0.9fr_0.85fr_0.55fr_1fr] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold tracking-wide text-slate-500 uppercase max-xl:hidden">
          <span>Role</span>
          <span>Student</span>
          <span>Employer</span>
          <span>Source type</span>
          <span>Semester</span>
          <span>Published status</span>
          <span>Applicants</span>
          <span>Actions</span>
        </div>
        {rows.length === 0 ? (
          <EmptyState message={emptyMessage} />
        ) : (
          rows.map((row) => (
            <form
              key={row.id}
              className="grid gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 xl:grid-cols-[1.25fr_0.95fr_0.95fr_0.85fr_0.9fr_0.85fr_0.55fr_1fr] xl:items-center"
              onSubmit={(event) => onUpdate(event, row.id)}
            >
              {editingId === row.id ? (
                <div className="grid gap-3 xl:col-span-8 xl:grid-cols-[1.2fr_1fr_1fr_0.9fr_1.4fr_auto] xl:items-start">
                  <input
                    value={editForm.title}
                    onChange={(event) => onEditChange({ ...editForm, title: event.target.value })}
                    placeholder="Role title"
                    className="h-9 rounded-xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-red-500"
                  />
                  <input
                    value={editForm.company}
                    onChange={(event) => onEditChange({ ...editForm, company: event.target.value })}
                    placeholder="Employer"
                    className="h-9 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-red-500"
                  />
                  <input
                    value={editForm.sourceUrl}
                    onChange={(event) =>
                      onEditChange({ ...editForm, sourceUrl: event.target.value })
                    }
                    placeholder="Job listing or careers link"
                    className={[
                      'h-9 rounded-xl border px-3 text-sm outline-none focus:border-red-500',
                      getSourceUrlError(editForm.type, editForm.sourceUrl)
                        ? 'border-red-300 bg-red-50/40'
                        : 'border-slate-200',
                    ].join(' ')}
                  />
                  <select
                    value={editForm.semesterId}
                    onChange={(event) =>
                      onEditChange({ ...editForm, semesterId: event.target.value })
                    }
                    className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-red-500"
                  >
                    {semesters.map((semester) => (
                      <option key={semester.id} value={semester.id}>
                        {semester.displayName}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={editForm.descriptionText}
                    onChange={(event) =>
                      onEditChange({ ...editForm, descriptionText: event.target.value })
                    }
                    placeholder="Description"
                    className="min-h-20 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-red-500"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex h-9 items-center rounded-lg bg-slate-950 px-3 text-xs font-bold text-white disabled:opacity-60"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={onEditCancel}
                      className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <p className="font-bold text-slate-950">{row.title}</p>
                    <p className="mt-1 text-xs text-slate-500 xl:hidden">{row.company}</p>
                    <p className="mt-1 text-xs text-slate-500 xl:hidden">
                      Student: {studentOwnerLabel(row, studentLabels)}
                    </p>
                  </div>
                </>
              )}
              {editingId !== row.id && (
                <>
                  <StudentOwnerCell row={row} studentLabels={studentLabels} />
                  <p className="text-sm font-medium text-slate-700 max-xl:hidden">{row.company}</p>
                  <SourceTypeBadge row={row} />
                  <p className="text-sm text-slate-600">{row.semesterLabel}</p>
                  <StatePill row={row} />
                  <p className="text-sm font-bold text-slate-950">{row.applications}</p>
                  <div className="flex flex-wrap gap-2">
                    <IconAction
                      href={withReviewReturn(
                        `/coordinator/jobs/review?id=${encodeURIComponent(row.id)}`,
                        '/coordinator/opportunities',
                        { tab: OPPORTUNITY_SELF_SOURCED_TAB }
                      )}
                      label="View"
                      icon={Eye}
                    />
                    {!isArchived(row) && (
                      <>
                        {canEditPublishedOpportunity(row) && (
                          <IconButton
                            label="Edit"
                            icon={PenLine}
                            onClick={() => onEditStart(row)}
                          />
                        )}
                        <IconButton
                          label={transitioningId === row.id ? 'Archiving' : 'Archive'}
                          icon={Archive}
                          disabled={transitioningId === row.id}
                          onClick={() => onTransition(row, 'archived')}
                        />
                      </>
                    )}
                    {isArchived(row) && (
                      <span className="inline-flex min-h-8 items-center rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1 text-xs leading-4 font-semibold text-slate-500">
                        This opportunity has been archived and is no longer active.
                      </span>
                    )}
                  </div>
                </>
              )}
            </form>
          ))
        )}
      </SurfaceCard>
    </section>
  )
}

function SelfSourcedReviewSection({
  rows,
  studentLabels,
}: {
  rows: OpportunityRow[]
  studentLabels: Record<string, string>
}) {
  return (
    <section className="space-y-3">
      <SectionHeader
        title="Self-Sourced Placement Reviews"
        description="Position descriptions submitted by students for internship suitability approval. Placement documents remain locked until approval."
      />
      <SurfaceCard className="overflow-hidden">
        <div className="grid grid-cols-[1.2fr_0.9fr_0.9fr_0.7fr_0.9fr_1.2fr_0.6fr] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold tracking-wide text-slate-500 uppercase max-2xl:hidden">
          <span>Role</span>
          <span>Student</span>
          <span>Employer</span>
          <span>Applicants</span>
          <span>Submitted</span>
          <span>Status</span>
          <span>Action</span>
        </div>
        {rows.length === 0 ? (
          <EmptyState message="No self-sourced placement verification records match the current filters." />
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="grid gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 2xl:grid-cols-[1.2fr_0.9fr_0.9fr_0.7fr_0.9fr_1.2fr_0.6fr] 2xl:items-center"
            >
              <div>
                <p className="font-bold text-slate-950">{row.title}</p>
                <p className="mt-1 text-xs text-slate-500">{row.courseLabel}</p>
              </div>
              <p className="text-sm font-medium text-slate-700">
                {studentOwnerLabel(row, studentLabels)}
              </p>
              <p className="text-sm text-slate-600">{row.company}</p>
              <p className="text-sm font-bold text-slate-950">{row.applications}</p>
              <p className="text-sm text-slate-600">{formatDate(row.createdAt)}</p>
              <div className="space-y-1">
                <IntakeTracker status={row.statusRaw} />
                <StatePill row={row} />
              </div>
              <Link
                href={withReviewReturn(
                  `/coordinator/jobs/review?id=${encodeURIComponent(row.id)}`,
                  '/coordinator/opportunities',
                  { tab: OPPORTUNITY_SELF_SOURCED_TAB }
                )}
                className="inline-flex h-9 items-center justify-center rounded-xl bg-slate-950 px-3 text-xs font-bold text-white transition hover:bg-black"
              >
                Review
              </Link>
            </div>
          ))
        )}
      </SurfaceCard>
    </section>
  )
}

function OpportunityTabs({
  activeTab,
  publishedCount,
  selfSourcedCount,
  onTabChange,
}: {
  activeTab: OpportunityTab
  publishedCount: number
  selfSourcedCount: number
  onTabChange: (tab: OpportunityTab) => void
}) {
  const tabs: Array<{ id: OpportunityTab; label: string; count: number; detail: string }> = [
    {
      id: 'published',
      label: 'Published Opportunities',
      count: publishedCount,
      detail: 'Job board and approved opportunity records',
    },
    {
      id: 'self_sourced',
      label: 'Self-Sourced Reviews',
      count: selfSourcedCount,
      detail: 'Position description suitability checks',
    },
  ]

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={[
            'rounded-2xl border p-4 text-left transition',
            activeTab === tab.id
              ? 'border-red-200 bg-red-50/40 shadow-sm'
              : 'border-slate-200 bg-white hover:border-slate-300',
          ].join(' ')}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="font-bold text-slate-950">{tab.label}</span>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-950 ring-1 ring-slate-200">
              {tab.count}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">{tab.detail}</p>
        </button>
      ))}
    </div>
  )
}

function IntakeTracker({ status }: { status: OpportunityStatus }) {
  const isRejected = status === 'rejected'
  const steps = ['Submitted', 'Placement Approval', isRejected ? 'Rejected' : 'Approved']
  const currentIndex =
    status === 'pending_verification' || status === 'draft'
      ? 1
      : isPublishedStatus(status) || status === 'rejected'
        ? 2
        : 1

  return (
    <div className="min-w-44">
      <div className="flex items-center gap-1.5">
        {steps.map((step, index) => {
          const isComplete =
            index < currentIndex || (index === currentIndex && isPublishedStatus(status))
          const isCurrent = index === currentIndex
          return (
            <div key={step} className="flex flex-1 items-center gap-1.5">
              <span
                className={[
                  'h-2.5 w-2.5 rounded-full border',
                  isRejected && isCurrent
                    ? 'border-red-700 bg-red-700'
                    : isComplete
                      ? 'border-slate-950 bg-slate-950'
                      : isCurrent
                        ? 'border-red-700 bg-white'
                        : 'border-slate-300 bg-white',
                ].join(' ')}
              />
              {index < steps.length - 1 && (
                <span
                  className={[
                    'h-px flex-1',
                    index < currentIndex ? 'bg-slate-950' : 'bg-slate-200',
                  ].join(' ')}
                />
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-1 text-xs font-bold text-slate-700">{steps[currentIndex]}</p>
    </div>
  )
}

function SourceTypeBadge({ row }: { row: OpportunityRow }) {
  const label = isSelfSourcedOpportunity(row)
    ? 'Self-Sourced'
    : isCareerHubOpportunity(row)
      ? 'CareerHub'
      : 'Coordinator Published'

  return (
    <span className="inline-flex w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
      {label}
    </span>
  )
}

function StudentOwnerCell({
  row,
  studentLabels,
}: {
  row: OpportunityRow
  studentLabels: Record<string, string>
}) {
  return (
    <div className="text-sm">
      <p
        className={[
          'font-semibold',
          row.applications === 0 && !isSelfSourcedOpportunity(row)
            ? 'text-slate-500'
            : 'text-slate-800',
        ].join(' ')}
      >
        {studentOwnerLabel(row, studentLabels)}
      </p>
    </div>
  )
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return <div className="px-4 py-8 text-sm text-slate-500">{message}</div>
}

function getOpportunityTabFromUrl(): OpportunityTab {
  if (typeof window === 'undefined') return 'published'
  const tab = new URLSearchParams(window.location.search).get('tab')
  return tab === OPPORTUNITY_SELF_SOURCED_TAB ? 'self_sourced' : 'published'
}

function StatePill({ row }: { row: OpportunityRow }) {
  const { statusRaw: status, type } = row
  const awaitingContractDetails = isAwaitingContractDetails(row)
  const label =
    status === 'pending_verification'
      ? 'Awaiting Placement Approval'
      : awaitingContractDetails
        ? 'Awaiting Contract Details'
        : isPublishedStatus(status)
          ? 'Published'
          : status.replace(/_/g, ' ')
  const tone =
    status === 'rejected'
      ? 'border-red-200 bg-red-50 text-red-800'
      : status === 'pending_verification'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : awaitingContractDetails
          ? 'border-slate-300 bg-slate-50 text-slate-800'
          : isPublishedStatus(status)
            ? type === 'custom'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-slate-300 bg-white text-slate-950'
            : 'border-slate-200 bg-slate-50 text-slate-700'

  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${tone}`}
    >
      {label}
    </span>
  )
}

function isAwaitingContractDetails(row: OpportunityRow) {
  return (
    isPublishedStatus(row.statusRaw) && (isSelfSourcedOpportunity(row) || hasStudentUptake(row))
  )
}

function hasStudentUptake(row: OpportunityRow) {
  return row.applications > 0
}

function displayApplicationCount(
  type: OpportunityType,
  applicationCount: number,
  submittedByUserId: string | null
) {
  const typeValue = String(type).toLowerCase()
  return (typeValue === 'custom' || typeValue === 'self_sourced') && submittedByUserId
    ? 1
    : applicationCount
}

function studentOwnerLabel(row: OpportunityRow, studentLabels: Record<string, string>) {
  if (row.submittedByUserId) return studentLabels[row.submittedByUserId] ?? STUDENT_PROFILE_PENDING
  if (row.applications > 0) return STUDENT_PROFILE_PENDING
  return 'Not taken yet'
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <label className="grid gap-1 text-xs font-bold tracking-wide text-slate-500 uppercase">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium tracking-normal text-slate-900 normal-case outline-none focus:border-red-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function TextInput({
  label,
  value,
  onChange,
  error,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  return (
    <label className="grid gap-1 text-xs font-bold tracking-wide text-slate-500 uppercase">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={[
          'h-10 rounded-xl border px-3 text-sm font-medium tracking-normal text-slate-900 normal-case outline-none focus:border-red-500',
          error ? 'border-red-300 bg-red-50/40' : 'border-slate-200',
        ].join(' ')}
      />
      {error && <span className="text-xs font-medium text-red-700 normal-case">{error}</span>}
    </label>
  )
}

function IconAction({
  href,
  label,
  icon: Icon,
}: {
  href: string
  label: string
  icon: typeof Eye
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-bold text-slate-700 hover:border-red-200 hover:bg-red-50"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  )
}

function IconButton({
  label,
  icon: Icon,
  disabled,
  onClick,
}: {
  label: string
  icon: typeof Eye
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-bold text-slate-700 hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

function matchesFilters(row: OpportunityRow, filters: OpportunityFilters) {
  const search = filters.search.trim().toLowerCase()
  const course = filters.course.trim().toLowerCase()
  const employer = filters.employer.trim().toLowerCase()
  const student = filters.student.trim().toLowerCase()
  const haystack = [
    row.title,
    row.company,
    row.semesterLabel,
    row.courseLabel,
    row.submittedByUserId ?? '',
    row.location ?? '',
    row.descriptionText,
  ]
    .join(' ')
    .toLowerCase()

  if (search && !haystack.includes(search)) return false
  if (filters.quickStatus === 'published' && !isPublishedStatus(row.statusRaw)) return false
  if (
    filters.quickStatus !== 'all' &&
    filters.quickStatus !== 'published' &&
    row.statusRaw !== filters.quickStatus
  ) {
    return false
  }
  if (filters.semesterId !== 'all' && row.semesterId !== filters.semesterId) return false
  if (course && !`${row.courseLabel} ${row.semesterLabel}`.toLowerCase().includes(course)) {
    return false
  }
  if (employer && !row.company.toLowerCase().includes(employer)) return false
  if (student && !(row.submittedByUserId ?? '').toLowerCase().includes(student)) return false
  return true
}

function matchesPublishingView(row: OpportunityRow, view: PublishingView) {
  if (view === 'all') return true
  if (view === 'archived') return isArchived(row)
  return isPublishedStatus(row.statusRaw) && !isArchived(row)
}

function isPublishedOpportunityRow(row: OpportunityRow, view: PublishingView) {
  const isApprovedOpportunity =
    row.type === 'pre_approved' ||
    !isSelfSourcedOpportunity(row) ||
    (isSelfSourcedOpportunity(row) && isPublishedStatus(row.statusRaw))
  if (!isApprovedOpportunity) return false
  return matchesPublishingView(row, view)
}

function isSelfSourcedReviewRow(row: OpportunityRow) {
  if (!isSelfSourcedOpportunity(row)) return false
  return row.statusRaw === 'pending_verification' || row.statusRaw === 'rejected'
}

function isSelfSourcedOpportunity(row: OpportunityRow) {
  const type = String(row.type).toLowerCase()
  return (type === 'custom' || type === 'self_sourced') && Boolean(row.submittedByUserId)
}

function isCareerHubOpportunity(row: OpportunityRow) {
  const type = String(row.type).toLowerCase()
  return type === 'pre_approved' || type === 'university'
}

function canEditPublishedOpportunity(row: OpportunityRow) {
  return !isArchived(row) && !isSelfSourcedOpportunity(row) && !isCareerHubOpportunity(row)
}

function isArchived(row: OpportunityRow) {
  const status = String(row.statusRaw).toLowerCase()
  return status === 'archived' || status === 'unpublished_archived'
}

function isPublishedStatus(status: OpportunityStatus | string) {
  const value = String(status).toLowerCase()
  return value === 'published' || value === 'active'
}

function isDraftStatus(status: OpportunityStatus | string) {
  return String(status).toLowerCase() === 'draft'
}

function mergeOpportunityRows(preferredRow: OpportunityRow, rows: OpportunityRow[]) {
  return [preferredRow, ...rows.filter((row) => row.id !== preferredRow.id)]
}

function sortRows(rows: OpportunityRow[], sort: SortOption) {
  return [...rows].sort((a, b) => {
    if (sort === 'action_required') {
      const actionDelta = actionPriority(a) - actionPriority(b)
      if (actionDelta !== 0) return actionDelta
      return dateValue(b.updatedAt) - dateValue(a.updatedAt)
    }
    if (sort === 'newest') return dateValue(b.createdAt) - dateValue(a.createdAt)
    if (sort === 'oldest_waiting') return dateValue(a.createdAt) - dateValue(b.createdAt)
    if (sort === 'recently_updated') return dateValue(b.updatedAt) - dateValue(a.updatedAt)
    if (sort === 'employer') return a.company.localeCompare(b.company)
    return (a.submittedByUserId ?? '').localeCompare(b.submittedByUserId ?? '')
  })
}

function actionPriority(row: OpportunityRow) {
  if (row.statusRaw === 'pending_verification') return 0
  if (row.statusRaw === 'draft') return 1
  if (isPublishedStatus(row.statusRaw)) return 2
  return 3
}

function dateValue(value: string) {
  return new Date(value).getTime()
}

function filterChips(filters: OpportunityFilters) {
  const chips: Array<{ key: keyof OpportunityFilters; label: string }> = []
  if (filters.search) chips.push({ key: 'search', label: `Search: ${filters.search}` })
  if (filters.quickStatus !== 'all') {
    chips.push({
      key: 'quickStatus',
      label: `State: ${opportunityStatusFilterLabel(filters.quickStatus)}`,
    })
  }
  if (filters.semesterId !== 'all') chips.push({ key: 'semesterId', label: 'Semester selected' })
  if (filters.course) chips.push({ key: 'course', label: `Program/course: ${filters.course}` })
  if (filters.employer) chips.push({ key: 'employer', label: `Employer: ${filters.employer}` })
  if (filters.student) chips.push({ key: 'student', label: `Student: ${filters.student}` })
  if (filters.sort !== initialFilters.sort) chips.push({ key: 'sort', label: `Sort changed` })
  return chips
}

function opportunityStatusFilterLabel(status: QuickStatusFilter) {
  if (status === 'pending_verification') return 'Awaiting Placement Approval'
  if (status === 'published') return 'Published'
  return status.replace(/_/g, ' ')
}

function areFiltersDefault(filters: OpportunityFilters) {
  return Object.keys(initialFilters).every((key) => {
    const filterKey = key as keyof OpportunityFilters
    return filters[filterKey] === initialFilters[filterKey]
  })
}

function isCreateFormValid(form: {
  semesterId: string
  type: OpportunityType
  employerName: string
  jobTitle: string
  descriptionText: string
  location: string
  sourceUrl: string
}) {
  if (!form.semesterId || !form.employerName.trim() || !form.jobTitle.trim()) return false
  if (!form.descriptionText.trim() || !form.location.trim()) return false
  if (form.type === 'pre_approved' && !isValidCareerHubUrl(form.sourceUrl)) return false
  if (form.type === 'custom' && !isValidJobListingUrl(form.sourceUrl)) return false
  return true
}

function isValidCareerHubUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return false

  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:') return false
    return ['rmit.careercentre.me', 'careerhub.rmit.edu.au'].some(
      (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`)
    )
  } catch {
    return false
  }
}

function isValidJobListingUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return false

  try {
    const url = new URL(trimmed)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function getSourceUrlError(type: OpportunityType, value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (type === 'pre_approved' && !isValidCareerHubUrl(trimmed)) {
    return 'Please enter a valid RMIT CareerHub opportunity link.'
  }
  if (type === 'custom' && !isValidJobListingUrl(trimmed)) {
    return 'Please enter a valid job listing or careers link.'
  }
  return undefined
}

function getCreateOpportunityValidationMessage(form: {
  semesterId: string
  type: OpportunityType
  employerName: string
  jobTitle: string
  descriptionText: string
  location: string
  sourceUrl: string
}) {
  if (form.type === 'pre_approved' && !isValidCareerHubUrl(form.sourceUrl)) {
    return 'Please enter a valid RMIT CareerHub opportunity link.'
  }
  if (form.type === 'custom' && !isValidJobListingUrl(form.sourceUrl)) {
    return 'Please enter a valid job listing or careers link.'
  }
  return 'Select a semester and complete all required fields.'
}

function formatOpportunityError(error: unknown, type: OpportunityType) {
  const message = error instanceof Error ? error.message : 'Opportunity service unavailable.'
  const lower = message.toLowerCase()
  if (
    lower.includes('career hub') ||
    lower.includes('careerhub') ||
    lower.includes('allowlist') ||
    lower.includes('sourceurl')
  ) {
    return type === 'pre_approved'
      ? 'Please enter a valid RMIT CareerHub opportunity link.'
      : 'Please enter a valid job listing or careers link.'
  }
  return message
}
