'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Check, RotateCcw, X } from 'lucide-react'
import {
  decideInternship,
  getInternship,
  getOpportunity,
  verifyOpportunity,
} from '@/lib/coordinator/api'
import { cn } from '@/lib/utils'

interface ReviewDecisionPanelProps {
  id: string
  kind: 'contract' | 'job'
  defaultNotes: string
}

export function ReviewDecisionPanel({ id, kind, defaultNotes }: ReviewDecisionPanelProps) {
  const [notes, setNotes] = useState(defaultNotes)
  const [submitting, setSubmitting] = useState<string | null>(null)

  const submit = async (decision: 'approved' | 'rejected' | 'changes_requested') => {
    setSubmitting(decision)
    try {
      if (kind === 'contract') {
        const internship = await getInternship(id)
        await decideInternship(internship, decision, notes.trim() || undefined)
      } else {
        const opportunity = await getOpportunity(id)
        if (decision === 'changes_requested') {
          toast.info(
            'Opportunity verification supports approve/reject only. Request changes API integration pending.'
          )
          return
        }
        await verifyOpportunity(opportunity, decision, notes.trim() || undefined)
      }
      toast.success('Decision sent to the workflow API.')
    } catch (error) {
      toast.info(
        error instanceof Error
          ? `API integration unavailable for this record: ${error.message}`
          : 'API integration unavailable for this record.'
      )
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <>
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        rows={kind === 'contract' ? 6 : 5}
        className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-red-500"
      />
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <DecisionButton
          pending={submitting === 'approved'}
          onClick={() => submit('approved')}
          className="border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Check className="h-4 w-4" /> Approve
        </DecisionButton>
        <DecisionButton
          pending={submitting === 'changes_requested'}
          onClick={() => submit('changes_requested')}
        >
          <RotateCcw className="h-4 w-4" /> Changes
        </DecisionButton>
        <DecisionButton
          pending={submitting === 'rejected'}
          onClick={() => submit('rejected')}
          className="border-red-200 text-red-700 hover:bg-red-50"
        >
          <X className="h-4 w-4" /> Reject
        </DecisionButton>
      </div>
    </>
  )
}

function DecisionButton({
  children,
  className,
  pending,
  onClick,
}: {
  children: React.ReactNode
  className?: string
  pending: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={pending}
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
