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
  canReview: boolean
  reviewedStatus: CoordinatorStatus
  backHref: string
  onSuccess?: (decision: ReviewDecision, notes: string) => void
  onAlreadyReviewed?: () => Promise<void> | void
}

const notesRequiredMessage = 'Reviewer notes are required for reject or request changes.'

export function ReviewDecisionPanel(props: ReviewDecisionPanelProps) {
  const { id, kind, canReview, reviewedStatus, backHref, onSuccess, onAlreadyReviewed } = props
  const [notes, setNotes] = useState('')
  const [commentDecision, setCommentDecision] = useState<Exclude<
    ReviewDecision,
    'approved'
  > | null>(null)
  const [submitting, setSubmitting] = useState<ReviewDecision | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const submit = async (decision: ReviewDecision) => {
    const trimmedNotes = notes.trim()

    setError(null)
    setSuccess(null)
    if ((decision === 'rejected' || decision === 'changes_requested') && !trimmedNotes) {
      setError(notesRequiredMessage)
      setCommentDecision(decision)
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
      const message = decisionMessage(decision, kind)
      setSuccess(message)
      if (decision === 'rejected' || decision === 'changes_requested') {
        setCommentDecision(null)
      }
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
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <StatusBadge status={reviewedStatus} />
          <Link
            href={backHref}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
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
      {canReview && commentDecision && (
        <div className="mt-4 space-y-3">
          <label className="grid gap-2 text-xs font-bold tracking-wide text-slate-500 uppercase">
            Coordinator comment
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={isSubmitting}
              rows={kind === 'contract' ? 5 : 4}
              placeholder={
                commentDecision === 'rejected'
                  ? 'Enter the rejection reason for the student record.'
                  : 'Enter the changes required before this placement can proceed.'
              }
              className="w-full rounded-xl border border-slate-200 p-3 text-sm font-medium tracking-normal text-slate-900 normal-case outline-none focus:border-red-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <DecisionButton
              pending={submitting === commentDecision}
              disabled={isSubmitting}
              onClick={() => submit(commentDecision)}
              className={
                commentDecision === 'rejected'
                  ? 'border-red-200 text-red-700 hover:bg-red-50'
                  : undefined
              }
            >
              {commentDecision === 'rejected' ? (
                <>
                  <X className="h-4 w-4" /> Submit rejection
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" /> Submit changes
                </>
              )}
            </DecisionButton>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setCommentDecision(null)
                setError(null)
              }}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {canReview && !commentDecision && (
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
            onClick={() => {
              setNotes('')
              setError(null)
              setCommentDecision('changes_requested')
            }}
          >
            <RotateCcw className="h-4 w-4" /> Request Changes
          </DecisionButton>
          <DecisionButton
            pending={submitting === 'rejected'}
            disabled={isSubmitting}
            onClick={() => {
              setNotes('')
              setError(null)
              setCommentDecision('rejected')
            }}
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

function decisionMessage(decision: ReviewDecision, kind: ReviewDecisionPanelProps['kind']) {
  if (decision === 'approved' && kind === 'job') {
    return 'Approved Opportunity. The student can now upload their offer letter and placement documents to begin placement processing.'
  }
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
