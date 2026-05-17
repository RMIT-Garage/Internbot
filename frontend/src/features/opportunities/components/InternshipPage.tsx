'use client'

import { useState } from 'react'
import {
  Bookmark,
  MapPin,
  Clock,
  Calendar,
  ChevronRight,
  X,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react'
import {
  useOpportunities,
  type Opportunity,
  type OpportunityType,
  type OpportunityWorkMode,
} from '@/features/opportunities/hooks/useOpportunities'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

// Maps backend type to display label and style
function typeTag(type: OpportunityType) {
  return type === 'pre_approved'
    ? { label: 'PRE-APPROVED', className: 'bg-indigo-50 text-indigo-600' }
    : { label: 'CUSTOM ROLE', className: 'bg-orange-50 text-orange-600' }
}

// Maps backend workMode + location to display string
function locationDisplay(workMode: OpportunityWorkMode | null, location: string | null): string {
  const parts: string[] = []
  if (location) parts.push(location)
  if (workMode === 'hybrid') parts.push('Hybrid')
  if (workMode === 'remote') return 'Remote'
  return parts.join(' / ') || '—'
}

// First letter of employer name as logo
function logoLetter(employerName: string): string {
  return employerName.charAt(0).toUpperCase()
}

export function InternshipsPage() {
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<OpportunityType | undefined>()
  const [workModeFilter, setWorkModeFilter] = useState<OpportunityWorkMode | undefined>()

  const { opportunities, loading, error, nextPageToken, loadMore } = useOpportunities({
    type: typeFilter,
  })

  // Client-side search filter on top of API results
  const filtered = opportunities.filter((o) => {
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      o.jobTitle.toLowerCase().includes(q) ||
      o.employerName.toLowerCase().includes(q) ||
      (o.location?.toLowerCase().includes(q) ?? false)
    const matchesWorkMode = !workModeFilter || o.workMode === workModeFilter
    return matchesSearch && matchesWorkMode
  })

  return (
    <div className="flex min-h-screen bg-[#F9FAFB] font-sans text-slate-900">
      <div className="flex-1">
        <main className="mx-auto max-w-7xl p-10">
          {/* Header */}
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="mb-2 text-4xl font-black text-slate-900">Internship Opportunities</h1>
              <p className="text-slate-500">
                Discover curated roles tailored to your RMIT academic profile.
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex gap-4">
              <FilterDropdown
                label="Work Mode"
                value={workModeFilter ? workModeFilter.replace('_', ' ') : 'All Modes'}
                options={[
                  { label: 'All Modes', value: undefined },
                  { label: 'On Site', value: 'on_site' },
                  { label: 'Hybrid', value: 'hybrid' },
                  { label: 'Remote', value: 'remote' },
                ]}
                onChange={(v) => setWorkModeFilter(v as OpportunityWorkMode | undefined)}
              />
              <FilterDropdown
                label="Role Type"
                value={
                  typeFilter
                    ? typeFilter === 'pre_approved'
                      ? 'Pre-Approved'
                      : 'Custom'
                    : 'All Roles'
                }
                options={[
                  { label: 'All Roles', value: undefined },
                  { label: 'Pre-Approved', value: 'pre_approved' },
                  { label: 'Custom Role', value: 'custom' },
                ]}
                onChange={(v) => setTypeFilter(v as OpportunityType | undefined)}
              />
            </div>
          </div>

          {/* States */}
          {loading && (
            <div className="flex justify-center py-20">
              <LoadingSpinner size="md" />
            </div>
          )}
          {error && <div className="py-10 text-center text-sm text-red-500">{error}</div>}

          {/* Grid */}
          {!loading && !error && (
            <>
              {filtered.length === 0 ? (
                <div className="py-20 text-center text-sm text-gray-400">
                  No opportunities found.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((opportunity) => (
                    <JobCard
                      key={opportunity.id}
                      opportunity={opportunity}
                      onClick={() => setSelectedOpportunity(opportunity)}
                    />
                  ))}
                </div>
              )}

              {nextPageToken && (
                <div className="mt-10 flex justify-center">
                  <button
                    onClick={loadMore}
                    className="rounded-xl border border-gray-200 px-8 py-3 text-sm font-bold text-slate-600 transition hover:bg-gray-50"
                  >
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Modal */}
      {selectedOpportunity && (
        <JobDetailModal
          opportunity={selectedOpportunity}
          onClose={() => setSelectedOpportunity(null)}
        />
      )}
    </div>
  )
}

// ── Subcomponents ─────────────────────────────────────────────

function JobCard({ opportunity, onClick }: { opportunity: Opportunity; onClick: () => void }) {
  const tag = typeTag(opportunity.type)
  const loc = locationDisplay(opportunity.workMode, opportunity.location)

  return (
    <div
      onClick={onClick}
      className="relative cursor-pointer rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:shadow-md"
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900 font-bold text-white">
          {logoLetter(opportunity.employerName)}
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${tag.className}`}>
          {tag.label}
        </span>
      </div>

      <h3 className="mb-1 text-lg font-black">{opportunity.jobTitle}</h3>
      <p className="mb-4 text-xs font-bold text-gray-400">{opportunity.employerName}</p>
      <p className="mb-6 line-clamp-3 text-xs leading-relaxed text-slate-500">
        {opportunity.descriptionText}
      </p>

      <div className="flex gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onClick()
          }}
          className="flex-1 rounded-xl bg-[#C41E3A] py-3 text-xs font-bold text-white transition hover:bg-red-800"
        >
          Apply Now
        </button>
        {/* <button
          onClick={(e) => e.stopPropagation()}
          className="rounded-xl border border-gray-100 p-3 transition hover:bg-gray-50"
        >
          <Bookmark size={18} className="text-gray-400" />
        </button> */}
      </div>
    </div>
  )
}

function JobDetailModal({
  opportunity,
  onClose,
}: {
  opportunity: Opportunity
  onClose: () => void
}) {
  const tag = typeTag(opportunity.type)
  const loc = locationDisplay(opportunity.workMode, opportunity.location)
  const workModeLabel =
    opportunity.workMode === 'hybrid'
      ? 'Hybrid'
      : opportunity.workMode === 'remote'
        ? 'Remote'
        : 'On-site'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-6 backdrop-blur-sm">
      <div className="relative flex h-[85vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-10 text-gray-400 hover:text-gray-600"
        >
          <X size={24} />
        </button>

        {/* Left sidebar */}
        <div className="w-1/3 overflow-y-auto border-r border-gray-100 bg-gray-50 p-10">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-2xl font-bold text-white">
            {logoLetter(opportunity.employerName)}
          </div>
          <h2 className="mb-2 text-3xl font-black">{opportunity.employerName}</h2>
          <div className="mb-8 flex items-center gap-2 text-xs font-bold text-gray-400">
            <MapPin size={14} /> {loc}
          </div>

          {opportunity.type === 'pre_approved' && (
            <div className="mb-8 rounded-2xl border border-l-4 border-gray-100 border-l-[#2B78C5] bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-[#2B78C5]">
                <ShieldCheck size={18} />
                <span className="text-[10px] font-black tracking-widest uppercase">
                  Institutional Benefit
                </span>
              </div>
              <h4 className="mb-2 text-sm font-black">Fast Track Approval</h4>
              <p className="text-[11px] leading-relaxed text-slate-500">
                As this is a pre-approved RMIT partner role, your credit evaluation is automated
                upon acceptance.
              </p>
            </div>
          )}

          <div className="space-y-6">
            <DetailRowItem label="Work Mode" value={workModeLabel} icon={<MapPin size={16} />} />
            {opportunity.applicationCount > 0 && (
              <DetailRowItem
                label="Applications"
                value={`${opportunity.applicationCount} applied`}
                icon={<Clock size={16} />}
              />
            )}
            {opportunity.sourceUrl && (
              <DetailRowItem
                label="Source"
                value="View listing"
                icon={<Calendar size={16} />}
                href={opportunity.sourceUrl}
              />
            )}
          </div>
        </div>

        {/* Right content */}
        <div className="flex-1 overflow-y-auto p-12">
          <div className="mb-6 flex gap-3">
            <span
              className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${tag.className}`}
            >
              {tag.label}
            </span>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-black text-gray-500 uppercase">
              {workModeLabel}
            </span>
          </div>

          <h1 className="mb-10 text-4xl font-black">{opportunity.jobTitle}</h1>

          <section className="mb-10">
            <h5 className="mb-4 text-[10px] font-black tracking-widest text-red-600 uppercase">
              About the Role
            </h5>
            <p className="text-sm leading-relaxed whitespace-pre-line text-slate-600">
              {opportunity.descriptionText}
            </p>
          </section>

          <div className="mt-10">
            <a
              href={opportunity.sourceUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#C41E3A] px-10 py-4 text-sm font-bold text-white shadow-lg shadow-red-100 transition hover:bg-red-800"
            >
              Apply Now <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailRowItem({
  label,
  value,
  icon,
  href,
}: {
  label: string
  value: string
  icon: React.ReactNode
  href?: string
}) {
  return (
    <div className="flex items-center justify-between text-xs font-bold">
      <div className="flex items-center gap-2 text-gray-400">
        {icon} <span>{label}</span>
      </div>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-red-600 underline">
          {value}
        </a>
      ) : (
        <span className="text-slate-800">{value}</span>
      )}
    </div>
  )
}

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { label: string; value: string | undefined }[]
  onChange: (value: string | undefined) => void
}) {
  return (
    <div className="group relative">
      <div className="flex cursor-pointer items-center gap-4 rounded-xl border border-gray-100 bg-white px-4 py-2 transition hover:bg-gray-50">
        <span className="text-[9px] font-black tracking-widest text-gray-400 uppercase">
          {label}:
        </span>
        <span className="flex items-center gap-2 text-[11px] font-bold text-slate-700">
          {value} <ChevronRight size={12} className="rotate-90 text-gray-400" />
        </span>
      </div>
      <div className="absolute top-full left-0 z-20 mt-1 hidden min-w-[140px] overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg group-hover:block">
        {options.map((opt) => (
          <button
            key={opt.label}
            onClick={() => onChange(opt.value)}
            className="block w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-gray-50"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
