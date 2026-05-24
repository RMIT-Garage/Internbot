'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { OpportunitiesService } from '@/lib/api/openapi-client'
import { CreateOpportunityRequest } from '@/api/models/CreateOpportunityRequest'
import { getApiErrorMessage, getApiErrorReason } from '@/lib/api/errors'

export default function Page() {
  const router = useRouter()

  const [employerName, setEmployerName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
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
        type: CreateOpportunityRequest.type.CUSTOM,
      })

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
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-7xl flex-1 p-6">
      {/* HEADER */}
      <div className="mb-12 space-y-4">
        <nav className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase">
          <span className="text-slate-400">Internships</span>
          <span className="text-slate-300">/</span>
          <span className="text-rose-700">Self-Sourced Submission</span>
        </nav>

        <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">
          Submit Self-Sourced Internship
        </h2>

        <p className="max-w-3xl leading-relaxed text-slate-500">
          Provide employer and role details for coordinator verification. Your submission will be
          reviewed before becoming available to apply to.
        </p>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-12 gap-10">
        {/* LEFT FORM */}
        <div className="col-span-8 space-y-8">
          {/* STEP 1 */}
          <section className="relative rounded-3xl border border-slate-100 bg-white p-9 shadow-sm transition hover:shadow-md">
            <div className="absolute top-6 right-6 rounded-full bg-rose-50 px-3 py-1 text-[10px] font-bold tracking-widest text-rose-600">
              Step 01
            </div>

            <h3 className="mb-1 text-sm font-bold text-slate-900">Company Details</h3>

            <p className="mb-8 text-xs text-slate-400">
              Basic information about the employer and role
            </p>

            <div className="space-y-7">
              {/* Employer */}
              <div>
                <label className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                  Employer Name <span className="text-rose-500">*</span>
                </label>
                <input
                  value={employerName}
                  onChange={(e) => setEmployerName(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm transition outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
                  placeholder="e.g. Atlassian, Canva"
                  required
                />
              </div>

              {/* Row */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                    Job Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm transition outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
                    placeholder="Software Engineer Intern"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                    Website
                  </label>
                  <input
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    type="url"
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm transition outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
                    placeholder="https://company.com"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* STEP 2 */}
          <section className="relative rounded-3xl border border-slate-100 bg-white p-9 shadow-sm transition hover:shadow-md">
            <div className="absolute top-6 right-6 rounded-full bg-rose-50 px-3 py-1 text-[10px] font-bold tracking-widest text-rose-600">
              Step 02
            </div>

            <h3 className="mb-1 text-sm font-bold text-slate-900">Position Description</h3>

            <p className="mb-8 text-xs text-slate-400">
              Describe responsibilities, tools, and learning outcomes
            </p>

            <textarea
              value={descriptionText}
              onChange={(e) => setDescriptionText(e.target.value)}
              rows={6}
              className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-4 text-sm transition outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
              placeholder="Detail your daily tasks, projects, technologies, and team structure..."
              required
            />
          </section>

          {/* ERROR */}
          {error && (
            <div className="rounded-2xl bg-red-50 px-5 py-3 text-sm text-red-600">{error}</div>
          )}

          {/* SUBMIT */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-rose-600 py-4 font-bold text-white shadow-md transition hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit for Coordinator Review'}
          </button>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="col-span-4 space-y-6">
          {/* INFO CARD */}
          <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-7 pt-7 pb-6">
              <p className="mb-1.5 text-[10px] font-bold tracking-widest text-rose-600 uppercase">
                Review Process
              </p>
              <h4 className="text-base font-bold text-slate-900">What happens next?</h4>
            </div>

            <ol className="px-7 py-5">
              <li className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-50 text-xs font-bold text-rose-600">
                    1
                  </span>
                  <div className="mt-2 h-10 w-px bg-slate-200" />
                </div>
                <p className="pt-0.5 pb-5 text-sm leading-relaxed text-slate-500">
                  Your submission is sent to a coordinator for verification.
                </p>
              </li>
              <li className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-50 text-xs font-bold text-rose-600">
                    2
                  </span>
                  <div className="mt-2 h-10 w-px bg-slate-200" />
                </div>
                <p className="pt-0.5 pb-5 text-sm leading-relaxed text-slate-500">
                  Once approved, the opportunity becomes available in your semester.
                </p>
              </li>
              <li className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-50 text-xs font-bold text-rose-600">
                    3
                  </span>
                </div>
                <p className="pt-0.5 text-sm leading-relaxed text-slate-500">
                  You can then apply and upload your offer letter.
                </p>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </form>
  )
}
