'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { BarChart3, BriefcaseBusiness, Plus, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import {
  AIInsightCard,
  CoordinatorPageHeader,
  KPIStatCard,
  SurfaceCard,
} from '@/components/coordinator/Premium'
import { CoordinatorContentSkeleton } from '@/components/coordinator/CoordinatorContentSkeleton'
import { StatusBadge } from '@/components/coordinator/StatusBadge'
import { opportunities } from '@/lib/coordinator/mockData'
import { useCoordinatorApiResource } from '@/hooks/useCoordinatorApiResource'
import {
  createOpportunity,
  listOpportunities,
  listSemesters,
  updateOpportunity,
  verifyOpportunity,
} from '@/lib/coordinator/api'
import { formatDate } from '@/lib/utils'
import type { OpportunityResponse, OpportunityStatus, SemesterResponse } from '@/types/api'

type WorkMode = 'onsite' | 'hybrid' | 'remote'
type OpportunityType = 'pre_approved' | 'custom'

interface OpportunityRow {
  id: string
  title: string
  company: string
  semesterId: string
  type: OpportunityType
  descriptionText: string
  workMode: WorkMode | null
  location: string | null
  sourceUrl: string | null
  status: 'active' | 'pending' | 'archived'
  statusRaw: OpportunityStatus
  applications: number
  engagement: string
  closingDate: string
  createdByUserId: string | null
  submittedByUserId: string | null
  verifiedByUserId: string | null
  verifiedAt: string | null
}

function mapOpportunityRow(item: OpportunityResponse): OpportunityRow {
  return {
    id: item.id,
    title: item.jobTitle,
    company: item.employerName,
    semesterId: item.semesterId,
    type: item.type,
    descriptionText: item.descriptionText,
    workMode: item.workMode,
    location: item.location,
    sourceUrl: item.sourceUrl,
    status:
      item.status === 'published'
        ? 'active'
        : item.status === 'pending_verification' || item.status === 'draft'
          ? 'pending'
          : 'archived',
    statusRaw: item.status,
    applications: item.applicationCount,
    engagement: item.applicationCount > 10 ? 'High' : item.applicationCount > 3 ? 'Medium' : 'New',
    closingDate: item.updatedAt,
    createdByUserId: item.createdByUserId,
    submittedByUserId: item.submittedByUserId,
    verifiedByUserId: item.verifiedByUserId,
    verifiedAt: item.verifiedAt,
  }
}

export default function CoordinatorOpportunitiesPage() {
  const { loading: authLoading } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [comments, setComments] = useState<Record<string, string>>({})
  const [editForm, setEditForm] = useState({ title: '', company: '', descriptionText: '' })
  const [createForm, setCreateForm] = useState({
    semesterId: '',
    type: 'pre_approved' as OpportunityType,
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

  const {
    data: opportunityRows,
    loading,
    error,
    source,
    setData,
    reload,
  } = useCoordinatorApiResource(
    async () => {
      if (process.env.NODE_ENV === 'development') {
        console.debug(
          '[coordinator/opportunities] backend filters: limit only; opportunity cards derive display fields client-side'
        )
      }
      const response = await listOpportunities({ limit: 100, sort: '-createdAt' })
      return response.items.map(mapOpportunityRow)
    },
    opportunities,
    'opportunities',
    { emptyData: [], enabled: !authLoading }
  )

  const semesterLabels = useMemo(() => {
    return new Map(semestersResource.data.map((semester) => [semester.id, semester.displayName]))
  }, [semestersResource.data])

  const pendingVerification = opportunityRows.filter(
    (opportunity) => opportunity.statusRaw === 'pending_verification'
  )
  const publishedOpportunities = opportunityRows.filter(
    (opportunity) => opportunity.statusRaw === 'published' || opportunity.statusRaw === 'draft'
  )
  const archivedOpportunities = opportunityRows.filter(
    (opportunity) => opportunity.statusRaw === 'archived' || opportunity.statusRaw === 'rejected'
  )
  const canCreate = isCreateFormValid(createForm) && semestersResource.data.length > 0 && !saving

  if (loading) {
    return (
      <div className="space-y-6">
        <CoordinatorPageHeader
          eyebrow="Opportunities Management"
          title="Partner Opportunities"
          description="Manage employer opportunities, engagement metrics, application volume, and publication state."
        />
        <CoordinatorContentSkeleton title="Loading opportunities..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Opportunities Management"
        title="Partner Opportunities"
        description="Manage employer opportunities, engagement metrics, application volume, and publication state."
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
        <SurfaceCard className="p-5">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-950">Create opportunity</h2>
            <p className="mt-1 text-sm text-slate-500">
              Select a semester and enter the required opportunity details before publishing to the
              workflow API.
            </p>
          </div>
          {(semestersResource.loading || semestersResource.error) && (
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {semestersResource.loading
                ? 'Loading semesters...'
                : `Semester API unavailable: ${semestersResource.error}`}
            </div>
          )}
          {!semestersResource.loading &&
            !semestersResource.error &&
            semestersResource.data.length === 0 && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-900">
                No semesters available. Create/activate a semester before creating opportunities.
              </div>
            )}
          <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreateOpportunity}>
            <label className="grid gap-1 text-xs font-bold tracking-wide text-slate-500 uppercase">
              Semester
              <select
                value={createForm.semesterId}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, semesterId: event.target.value }))
                }
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium tracking-normal text-slate-900 normal-case outline-none focus:border-red-500"
              >
                <option value="">Select semester</option>
                {semestersResource.data.map((semester) => (
                  <option key={semester.id} value={semester.id}>
                    {semester.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold tracking-wide text-slate-500 uppercase">
              Type
              <select
                value={createForm.type}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    type: event.target.value as OpportunityType,
                  }))
                }
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium tracking-normal text-slate-900 normal-case outline-none focus:border-red-500"
              >
                <option value="pre_approved">Pre-approved</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <TextInput
              label="Employer"
              value={createForm.employerName}
              onChange={(value) =>
                setCreateForm((current) => ({ ...current, employerName: value }))
              }
            />
            <TextInput
              label="Job title"
              value={createForm.jobTitle}
              onChange={(value) => setCreateForm((current) => ({ ...current, jobTitle: value }))}
            />
            <label className="grid gap-1 text-xs font-bold tracking-wide text-slate-500 uppercase">
              Work mode
              <select
                value={createForm.workMode}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    workMode: event.target.value as WorkMode,
                  }))
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
              onChange={(value) => setCreateForm((current) => ({ ...current, location: value }))}
            />
            <label className="grid gap-1 text-xs font-bold tracking-wide text-slate-500 uppercase md:col-span-2">
              Description
              <textarea
                value={createForm.descriptionText}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, descriptionText: event.target.value }))
                }
                className="min-h-24 rounded-xl border border-slate-200 p-3 text-sm font-medium tracking-normal text-slate-900 normal-case outline-none focus:border-red-500"
              />
            </label>
            <TextInput
              label={
                createForm.type === 'pre_approved'
                  ? 'Career Hub/source URL'
                  : 'Source URL (optional)'
              }
              value={createForm.sourceUrl}
              onChange={(value) => setCreateForm((current) => ({ ...current, sourceUrl: value }))}
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
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <KPIStatCard
          title="Active roles"
          value={publishedOpportunities.length}
          detail="Visible or draft opportunities"
          icon={BriefcaseBusiness}
          tone="charcoal"
          progress={66}
        />
        <KPIStatCard
          title="Applications"
          value={opportunityRows.reduce((sum, opportunity) => sum + opportunity.applications, 0)}
          detail="Across postings"
          icon={BarChart3}
          tone="neutral"
          progress={58}
        />
        <KPIStatCard
          title="Pending verification"
          value={pendingVerification.length}
          detail="Student-submitted custom roles"
          icon={Sparkles}
          tone="red"
          progress={42}
        />
      </div>

      <AIInsightCard
        title={`Opportunity AI Suggestions (${source === 'api' ? 'API-backed' : 'fallback data'})`}
        confidence={84}
        insight="Cyber security postings are drawing strong engagement. Consider publishing one additional remote-friendly analytics role for Semester 2 demand."
      />

      {error && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          {`Using isolated fallback data: ${error}`}
        </div>
      )}
      {!loading && !error && source === 'api' && opportunityRows.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Backend connected, but no opportunity records exist yet.
        </div>
      )}

      <OpportunitySection
        title="Pending verification"
        description="Student-submitted custom opportunities awaiting coordinator approval."
        emptyMessage="No opportunities are pending verification."
      >
        {pendingVerification.map((opportunity) => (
          <OpportunityCard
            key={opportunity.id}
            opportunity={opportunity}
            semesterLabel={semesterLabels.get(opportunity.semesterId) ?? opportunity.semesterId}
            editingId={editingId}
            editForm={editForm}
            saving={saving}
            verifyingId={verifyingId}
            comment={comments[opportunity.id] ?? ''}
            onCommentChange={(comment) =>
              setComments((current) => ({ ...current, [opportunity.id]: comment }))
            }
            onEditStart={startEdit}
            onEditChange={setEditForm}
            onUpdate={handleUpdateOpportunity}
            onVerify={handleVerifyOpportunity}
          />
        ))}
      </OpportunitySection>

      <OpportunitySection
        title="Published opportunities"
        description="Coordinator-managed opportunities available for student workflows."
        emptyMessage="No published or draft opportunities yet."
      >
        {publishedOpportunities.map((opportunity) => (
          <OpportunityCard
            key={opportunity.id}
            opportunity={opportunity}
            semesterLabel={semesterLabels.get(opportunity.semesterId) ?? opportunity.semesterId}
            editingId={editingId}
            editForm={editForm}
            saving={saving}
            verifyingId={verifyingId}
            comment={comments[opportunity.id] ?? ''}
            onCommentChange={(comment) =>
              setComments((current) => ({ ...current, [opportunity.id]: comment }))
            }
            onEditStart={startEdit}
            onEditChange={setEditForm}
            onUpdate={handleUpdateOpportunity}
            onVerify={handleVerifyOpportunity}
          />
        ))}
      </OpportunitySection>

      <OpportunitySection
        title="Archived/rejected opportunities"
        description="Closed records retained for review context."
        emptyMessage="No archived or rejected opportunities."
      >
        {archivedOpportunities.map((opportunity) => (
          <OpportunityCard
            key={opportunity.id}
            opportunity={opportunity}
            semesterLabel={semesterLabels.get(opportunity.semesterId) ?? opportunity.semesterId}
            editingId={editingId}
            editForm={editForm}
            saving={saving}
            verifyingId={verifyingId}
            comment={comments[opportunity.id] ?? ''}
            onCommentChange={(comment) =>
              setComments((current) => ({ ...current, [opportunity.id]: comment }))
            }
            onEditStart={startEdit}
            onEditChange={setEditForm}
            onUpdate={handleUpdateOpportunity}
            onVerify={handleVerifyOpportunity}
          />
        ))}
      </OpportunitySection>
    </div>
  )

  function startEdit(opportunity: OpportunityRow) {
    setEditingId(opportunity.id)
    setEditForm({
      title: opportunity.title,
      company: opportunity.company,
      descriptionText: opportunity.descriptionText,
    })
  }

  async function handleCreateOpportunity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canCreate) {
      toast.error('Select a semester and complete all required fields.')
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
      setData([mapOpportunityRow(created), ...opportunityRows])
      setShowCreate(false)
      setCreateForm({
        semesterId: '',
        type: 'pre_approved',
        employerName: '',
        jobTitle: '',
        descriptionText: '',
        workMode: 'hybrid',
        location: '',
        sourceUrl: '',
      })
      toast.success('Opportunity created.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Opportunity API unavailable.')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateOpportunity(event: React.FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault()
    if (!editForm.title.trim() || !editForm.company.trim()) {
      toast.error('Job title and employer are required.')
      return
    }

    setSaving(true)
    try {
      const updated = await updateOpportunity(
        { id },
        {
          jobTitle: editForm.title.trim(),
          employerName: editForm.company.trim(),
          descriptionText: editForm.descriptionText.trim() || undefined,
        }
      )
      setData(opportunityRows.map((row) => (row.id === id ? mapOpportunityRow(updated) : row)))
      setEditingId(null)
      toast.success('Opportunity updated.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Opportunity API unavailable.')
      reload()
    } finally {
      setSaving(false)
    }
  }

  async function handleVerifyOpportunity(
    opportunity: OpportunityRow,
    decision: 'approved' | 'rejected'
  ) {
    const comment = comments[opportunity.id]?.trim() ?? ''
    if (decision === 'rejected' && !comment) {
      toast.error('A rejection comment is required.')
      return
    }

    setVerifyingId(opportunity.id)
    try {
      const updated = await verifyOpportunity(
        { id: opportunity.id },
        decision,
        comment || undefined
      )
      setData(
        opportunityRows.map((row) => (row.id === opportunity.id ? mapOpportunityRow(updated) : row))
      )
      setComments((current) => ({ ...current, [opportunity.id]: '' }))
      toast.success(decision === 'approved' ? 'Opportunity verified.' : 'Opportunity rejected.')
    } catch (err) {
      if (isAlreadyReviewedError(err)) {
        toast.info('This opportunity has already been reviewed.')
        setData(
          opportunityRows.map((row) =>
            row.id === opportunity.id
              ? {
                  ...row,
                  status: 'archived',
                  statusRaw: 'rejected',
                }
              : row
          )
        )
        reload()
      } else {
        toast.error(err instanceof Error ? err.message : 'Opportunity verification unavailable.')
      }
    } finally {
      setVerifyingId(null)
    }
  }
}

function OpportunitySection({
  title,
  description,
  emptyMessage,
  children,
}: {
  title: string
  description: string
  emptyMessage: string
  children: React.ReactNode
}) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children)

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {hasItems ? (
        <div className="grid gap-4 lg:grid-cols-3">{children}</div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
          {emptyMessage}
        </div>
      )}
    </section>
  )
}

function OpportunityCard({
  opportunity,
  semesterLabel,
  editingId,
  editForm,
  saving,
  verifyingId,
  comment,
  onCommentChange,
  onEditStart,
  onEditChange,
  onUpdate,
  onVerify,
}: {
  opportunity: OpportunityRow
  semesterLabel: string
  editingId: string | null
  editForm: { title: string; company: string; descriptionText: string }
  saving: boolean
  verifyingId: string | null
  comment: string
  onCommentChange: (comment: string) => void
  onEditStart: (opportunity: OpportunityRow) => void
  onEditChange: (form: { title: string; company: string; descriptionText: string }) => void
  onUpdate: (event: React.FormEvent<HTMLFormElement>, id: string) => void
  onVerify: (opportunity: OpportunityRow, decision: 'approved' | 'rejected') => void
}) {
  const isPendingVerification = opportunity.statusRaw === 'pending_verification'
  const isVerifying = verifyingId === opportunity.id

  return (
    <SurfaceCard className="p-5 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editingId === opportunity.id ? (
            <form className="space-y-2" onSubmit={(event) => onUpdate(event, opportunity.id)}>
              <input
                value={editForm.title}
                onChange={(event) => onEditChange({ ...editForm, title: event.target.value })}
                className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-red-500"
              />
              <input
                value={editForm.company}
                onChange={(event) => onEditChange({ ...editForm, company: event.target.value })}
                className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-red-500"
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
            <>
              <button
                type="button"
                onClick={() => onEditStart(opportunity)}
                className="text-left font-bold text-slate-950 hover:text-red-700"
              >
                {opportunity.title}
              </button>
              <p className="mt-1 text-sm text-slate-500">{opportunity.company}</p>
            </>
          )}
        </div>
        <StatusBadge status={opportunity.status} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Detail label="Semester" value={semesterLabel} />
        <Detail label="Type" value={opportunity.type.replace('_', ' ')} />
        <Detail label="Applications" value={String(opportunity.applications)} />
        <Detail label="Work mode" value={opportunity.workMode ?? 'Not supplied'} />
      </div>

      <div className="mt-4 space-y-1 text-sm text-slate-500">
        <p>Status: {opportunity.statusRaw.replace(/_/g, ' ')}</p>
        <p>Updated {formatDate(opportunity.closingDate)}</p>
        <p>Created by: {opportunity.createdByUserId ?? 'Not recorded'}</p>
        <p>Submitted by: {opportunity.submittedByUserId ?? 'Not student-submitted'}</p>
        {opportunity.verifiedAt && <p>Reviewed {formatDate(opportunity.verifiedAt)}</p>}
      </div>

      {isPendingVerification ? (
        <div className="mt-4 space-y-3 rounded-xl border border-red-100 bg-red-50 p-3">
          <label className="grid gap-1 text-xs font-bold tracking-wide text-red-900 uppercase">
            Review comment
            <textarea
              value={comment}
              onChange={(event) => onCommentChange(event.target.value)}
              className="min-h-20 rounded-xl border border-red-100 bg-white p-3 text-sm font-medium tracking-normal text-slate-900 normal-case outline-none focus:border-red-500"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isVerifying}
              onClick={() => onVerify(opportunity, 'approved')}
              className="h-9 rounded-xl bg-slate-950 px-3 text-xs font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isVerifying ? 'Sending...' : 'Verify'}
            </button>
            <button
              type="button"
              disabled={isVerifying}
              onClick={() => onVerify(opportunity, 'rejected')}
              className="h-9 rounded-xl border border-red-200 bg-white px-3 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Reject
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
          Reviewed/completed state. Verification actions are unavailable for this status.
        </div>
      )}
    </SurfaceCard>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-bold text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-950">{value}</p>
    </div>
  )
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
  if (form.type === 'pre_approved' && !form.sourceUrl.trim()) return false
  return true
}

function isAlreadyReviewedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return (
    message.includes('not pending') ||
    message.includes('already reviewed') ||
    message.includes('already been reviewed') ||
    message.includes('not pending verification')
  )
}

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="grid gap-1 text-xs font-bold tracking-wide text-slate-500 uppercase">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-medium tracking-normal text-slate-900 normal-case outline-none focus:border-red-500"
      />
    </label>
  )
}
