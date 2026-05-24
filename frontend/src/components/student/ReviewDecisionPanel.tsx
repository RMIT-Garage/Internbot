'use client'

import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { Check, RotateCcw, X } from 'lucide-react'
import {
  decideInternship,
  getInternship,
  getOpportunity,
  verifyOpportunity,
} from '@/lib/coordinator/api'
import { StatusBadge, type CoordinatorStatus } from '@/components/coordinator/StatusBadge'
import { cn } from '@/lib/utils'

export type ReviewDecision = 'approved' | 'rejected' | 'changes_requested'

interface ReviewDecisionPanelProps {
  id: string
  kind: 'contract' | 'job'
  defaultNotes: string
  canReview?: boolean
  reviewedStatus?: CoordinatorStatus
  backHref?: string
  onSuccess?: (decision: ReviewDecision, notes: string) => void
  onAlreadyReviewed?: () => Promise<void> | void
}

const notesRequiredMessage = 'Reviewer notes are required for reject or request changes.'

export function ReviewDecisionPanel({
  id,
  kind,
  defaultNotes,
  canReview = true,
  reviewedStatus = 'pending',
  backHref = kind === 'contract' ? '/student/applications' : '/student/jobs',
  onSuccess,
  onAlreadyReviewed,
}: ReviewDecisionPanelProps) {
  const [notes, setNotes] = useState(defaultNotes)
  const [submitting, setSubmitting] = useState<ReviewDecision | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const submit = async (decision: ReviewDecision) => {
    const trimmedNotes = notes.trim()

    setError(null)
    setSuccess(null)
    if ((decision === 'rejected' || decision === 'changes_requested') && !trimmedNotes) {
      setError(notesRequiredMessage)
      return
    }

    setSubmitting(decision)
    try {
      if (kind === 'contract') {
        const internship = await getInternship(id)
        if (internship.status !== 'offer_pending_review') {
          await handleAlreadyReviewed()
          return
        }
        await decideInternship(internship, decision, trimmedNotes || undefined)
      } else {
        const opportunity = await getOpportunity(id)
        if (opportunity.status !== 'pending_verification') {
          await handleAlreadyReviewed()
          return
        }
        const opportunityDecision = decision === 'approved' ? 'approved' : 'rejected'
        await verifyOpportunity(opportunity, opportunityDecision, trimmedNotes || undefined)
      }
      const message = decisionMessage(decision)
      setSuccess(message)
      onSuccess?.(decision, trimmedNotes)
      toast.success('Decision sent to the workflow API.')
    } catch (error) {
      if (isAlreadyReviewedError(error)) {
        await handleAlreadyReviewed()
        return
      }
      const message =
        error instanceof Error
          ? `API integration unavailable for this record: ${error.message}`
          : 'API integration unavailable for this record.'
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(null)
    }
  }

  const handleAlreadyReviewed = async () => {
    const message = 'This item has already been reviewed.'
    setError(null)
    setSuccess(message)
    try {
      await onAlreadyReviewed?.()
    } catch (error) {
      console.debug('[ReviewDecisionPanel] failed to refresh already-reviewed item', error)
    }
    toast.info(message)
  }

  const isSubmitting = submitting !== null
  const isReadOnly = !canReview

  return (
    <>
      {isReadOnly && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-950">Reviewed status</p>
              <p className="mt-1 text-sm text-slate-600">
                This item is complete and can no longer be submitted for review.
              </p>
            </div>
            <StatusBadge status={reviewedStatus} />
          </div>
          <Link
            href={backHref}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-black"
          >
            Back to queue
          </Link>
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-900">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
          {success}
        </div>
      )}
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        disabled={isSubmitting || isReadOnly}
        rows={kind === 'contract' ? 6 : 5}
        className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-red-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
      />
      {canReview && (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <DecisionButton
            pending={submitting === 'approved'}
            disabled={isSubmitting}
            onClick={() => submit('approved')}
            className="border-slate-950 bg-slate-950 text-white hover:bg-black"
          >
            <Check className="h-4 w-4" /> Approve
          </DecisionButton>
          <DecisionButton
            pending={submitting === 'changes_requested'}
            disabled={isSubmitting}
            onClick={() => submit('changes_requested')}
          >
            <RotateCcw className="h-4 w-4" /> Changes
          </DecisionButton>
          <DecisionButton
            pending={submitting === 'rejected'}
            disabled={isSubmitting}
            onClick={() => submit('rejected')}
            className="border-red-200 text-red-700 hover:bg-red-50"
          >
            <X className="h-4 w-4" /> Reject
          </DecisionButton>
        </div>
      )}
    </>
  )
}

function isAlreadyReviewedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return (
    message.includes('not pending') ||
    message.includes('already reviewed') ||
    message.includes('already been reviewed') ||
    message.includes('not pending verification') ||
    message.includes('not pending review')
  )
}

function decisionMessage(decision: ReviewDecision) {
  if (decision === 'approved') return 'Approved. The review state has been updated.'
  if (decision === 'rejected') return 'Rejected. The review state has been updated.'
  return 'Changes requested. The review state has been updated.'
}

function DecisionButton({
  children,
  className,
  pending,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  className?: string
  pending: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
    >
      {pending ? 'Sending...' : children}
    </button>
  )
}
