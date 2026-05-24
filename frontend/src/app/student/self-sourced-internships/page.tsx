'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, FileText, Link2, Briefcase, MapPin } from 'lucide-react'

import { SurfaceCard } from '@/components/student/Premium'
import { OpportunitiesService } from '@/lib/api/openapi-client'
import { CreateOpportunityRequest } from '@/api/models/CreateOpportunityRequest'
import { getApiErrorMessage, getApiErrorReason } from '@/lib/api/errors'

export default function Page() {
  const router = useRouter()

  const [employerName, setEmployerName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [workMode, setWorkMode] = useState<'onsite' | 'hybrid' | 'remote' | ''>('')
  const [location, setLocation] = useState('')
  const [descriptionText, setDescriptionText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!employerName.trim() || !jobTitle.trim() || !descriptionText.trim()) {
      setError('Employer name, job title, and position description are required.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      const opportunity = await OpportunitiesService.createOpportunity({
        employerName: employerName.trim(),
        jobTitle: jobTitle.trim(),
        descriptionText: descriptionText.trim(),
        sourceUrl: sourceUrl.trim() || undefined,
        workMode: (workMode || undefined) as CreateOpportunityRequest.workMode | undefined,
        location: location.trim() || undefined,
        type: CreateOpportunityRequest.type.CUSTOM,
      })

      try {
        const stored: string[] = JSON.parse(
          localStorage.getItem('internbot:selfSourced:pending') ?? '[]'
        )
        if (!stored.includes(opportunity.id)) {
          localStorage.setItem(
            'internbot:selfSourced:pending',
            JSON.stringify([...stored, opportunity.id])
          )
        }
      } catch {
        // localStorage unavailable — non-fatal
      }
      router.push(`/student/self-sourced-internships/submission?id=${opportunity.id}`)
    } catch (err: unknown) {
      const reason = getApiErrorReason(err)
      setError(
        reason === 'no_selected_semester'
          ? 'You must select a semester before submitting an internship.'
          : getApiErrorMessage(err, 'Failed to submit. Please try again.')
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-bold tracking-[0.18em] text-red-600 uppercase">
          Self-Sourced Internship
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Submit an Internship</h1>
        <p className="mt-1 text-sm text-gray-500">
          Provide employer and role details for coordinator verification.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Form */}
        <div className="space-y-4">
          {/* Company details */}
          <SurfaceCard className="p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50">
                <Briefcase className="h-3.5 w-3.5 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Company Details</p>
                <p className="text-xs text-gray-400">
                  Basic information about the employer and role
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                  Employer Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={employerName}
                  onChange={(e) => setEmployerName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-400 focus:ring-2 focus:ring-red-100 focus:outline-none"
                  placeholder="e.g. Atlassian, Canva"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                    Job Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-400 focus:ring-2 focus:ring-red-100 focus:outline-none"
                    placeholder="Software Engineer Intern"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                    <span className="flex items-center gap-1">
                      <Link2 className="h-3 w-3" /> Website
                    </span>
                  </label>
                  <input
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    type="url"
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-400 focus:ring-2 focus:ring-red-100 focus:outline-none"
                    placeholder="https://company.com"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                    Work Mode
                  </label>
                  <div className="flex gap-2">
                    {(['onsite', 'hybrid', 'remote'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setWorkMode(workMode === mode ? '' : mode)}
                        className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold capitalize transition ${
                          workMode === mode
                            ? 'border-red-300 bg-red-50 text-red-700'
                            : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> Location
                    </span>
                  </label>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-400 focus:ring-2 focus:ring-red-100 focus:outline-none"
                    placeholder="Melbourne, VIC"
                  />
                </div>
              </div>
            </div>
          </SurfaceCard>

          {/* Position description */}
          <SurfaceCard className="p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50">
                <FileText className="h-3.5 w-3.5 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Position Description</p>
                <p className="text-xs text-gray-400">
                  Describe responsibilities, tools, and learning outcomes
                </p>
              </div>
            </div>

            <textarea
              value={descriptionText}
              onChange={(e) => setDescriptionText(e.target.value)}
              rows={6}
              className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-400 focus:ring-2 focus:ring-red-100 focus:outline-none"
              placeholder="Detail your daily tasks, projects, technologies, and team structure…"
              required
            />
          </SurfaceCard>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-red-600 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit for Coordinator Review'}
          </button>
        </div>

        {/* Sidebar */}
        <div>
          <SurfaceCard className="p-5">
            <p className="text-xs font-bold tracking-[0.18em] text-red-600 uppercase">
              Review Process
            </p>
            <h4 className="mt-1 text-sm font-bold text-gray-900">What happens next?</h4>

            <ol className="mt-4 space-y-0">
              {[
                'Your submission is sent to a coordinator for verification.',
                'Once approved, the opportunity becomes available in your semester.',
                'You can then apply and upload your offer letter.',
              ].map((text, i) => (
                <li key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-50 text-[11px] font-bold text-red-600">
                      {i + 1}
                    </span>
                    {i < 2 && <div className="my-1 h-6 w-px bg-gray-200" />}
                  </div>
                  <p className="pt-0.5 pb-4 text-xs leading-relaxed text-gray-500">{text}</p>
                </li>
              ))}
            </ol>
          </SurfaceCard>
        </div>
      </div>
    </form>
  )
}
