'use client'

import type { FormEvent, ReactNode } from 'react'
import { X } from 'lucide-react'
import { SurfaceCard } from '@/components/coordinator/Premium'
import { formatSemesterLabel } from '@/lib/semester/display'
import type { SemesterResponse } from '@/types/api'
import {
  type OpportunityEditFormState,
  type OpportunityEditTarget,
  opportunityRowToEditForm,
} from './opportunityEdit'

type OpportunityType = OpportunityEditFormState['type']

function getSourceUrlError(type: OpportunityType, value: string) {
  const trimmed = value.trim()
  if (!trimmed) return 'A listing URL is required.'

  try {
    const url = new URL(trimmed)
    if (type === 'pre_approved') {
      if (url.protocol !== 'https:') return 'CareerHub links must use https.'
      const ok = ['rmit.careercentre.me', 'careerhub.rmit.edu.au'].some(
        (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`)
      )
      if (!ok) return 'Use an RMIT CareerHub opportunity URL.'
      return undefined
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return 'Use a valid http(s) URL.'
    }
    return undefined
  } catch {
    return 'Enter a valid URL.'
  }
}

export function OpportunityEditModal({
  open,
  target,
  form,
  semesters,
  saving,
  onFormChange,
  onClose,
  onSubmit,
}: {
  open: boolean
  target: OpportunityEditTarget | null
  form: OpportunityEditFormState
  semesters: SemesterResponse[]
  saving: boolean
  onFormChange: (form: OpportunityEditFormState) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>, id: string) => void
}) {
  if (!open || !target) return null

  const sourceUrlError = getSourceUrlError(form.type, form.sourceUrl)
  const typeLabel =
    form.type === 'pre_approved' ? 'CareerHub listing' : 'Coordinator-published listing'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <SurfaceCard className="relative z-10 flex max-h-[min(90vh,820px)] w-full max-w-2xl flex-col overflow-hidden shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wide text-red-700 uppercase">Edit opportunity</p>
            <h2 className="mt-1 truncate text-xl font-bold text-slate-950">{target.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{typeLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          className="flex flex-1 flex-col overflow-hidden"
          onSubmit={(event) => onSubmit(event, target.id)}
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Job title">
                <input
                  value={form.title}
                  onChange={(event) => onFormChange({ ...form, title: event.target.value })}
                  className={inputClass}
                  required
                />
              </Field>
              <Field label="Employer">
                <input
                  value={form.company}
                  onChange={(event) => onFormChange({ ...form, company: event.target.value })}
                  className={inputClass}
                  required
                />
              </Field>
              <Field label="Semester">
                <select
                  value={form.semesterId}
                  onChange={(event) => onFormChange({ ...form, semesterId: event.target.value })}
                  className={inputClass}
                  required
                >
                  {semesters.map((semester) => (
                    <option key={semester.id} value={semester.id}>
                      {formatSemesterLabel(semester)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Work mode">
                <select
                  value={form.workMode}
                  onChange={(event) =>
                    onFormChange({ ...form, workMode: event.target.value as OpportunityEditFormState['workMode'] })
                  }
                  className={inputClass}
                >
                  <option value="onsite">Onsite</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="remote">Remote</option>
                </select>
              </Field>
              <Field label="Location" className="sm:col-span-2">
                <input
                  value={form.location}
                  onChange={(event) => onFormChange({ ...form, location: event.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label={form.type === 'pre_approved' ? 'CareerHub link' : 'Job listing URL'} className="sm:col-span-2">
                <input
                  value={form.sourceUrl}
                  onChange={(event) => onFormChange({ ...form, sourceUrl: event.target.value })}
                  className={[inputClass, sourceUrlError ? 'border-red-300 bg-red-50/40' : ''].join(' ')}
                />
                {sourceUrlError && (
                  <p className="mt-1 text-xs font-medium text-red-700">{sourceUrlError}</p>
                )}
              </Field>
            </div>
            <Field label="Description">
              <textarea
                value={form.descriptionText}
                onChange={(event) => onFormChange({ ...form, descriptionText: event.target.value })}
                className="min-h-32 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-red-500"
                required
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || Boolean(sourceUrlError) || !form.title.trim() || !form.company.trim()}
              className="inline-flex h-10 items-center rounded-xl bg-slate-950 px-5 text-sm font-bold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </SurfaceCard>
    </div>
  )
}

export function openEditFormForTarget(target: OpportunityEditTarget): OpportunityEditFormState {
  return opportunityRowToEditForm(target)
}

const inputClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-red-500'

function Field({
  label,
  children,
  className = '',
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={['grid gap-1.5', className].join(' ')}>
      <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">{label}</span>
      {children}
    </label>
  )
}
