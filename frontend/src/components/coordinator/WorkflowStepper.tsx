'use client'

import { Fragment } from 'react'
import { CheckCircle2, Circle, CircleDot } from 'lucide-react'
import { cn } from '@/lib/utils'

export type WorkflowStepState = 'complete' | 'current' | 'upcoming' | 'rejected'

export interface WorkflowStepItem {
  id: string
  label: string
  state: WorkflowStepState
}

interface WorkflowStepperProps {
  steps: WorkflowStepItem[]
  className?: string
  /** Use in narrow list rows — dots + current step caption only. */
  variant?: 'full' | 'compact'
}

/** Centres the 2px connector on the 24px (h-6) step node. */
const CONNECTOR_ROW_CLASS = 'flex items-center self-start pt-3'

/**
 * One connector between each pair of circles (never two side-by-side).
 * Full variant adds a label under each node.
 */
export function WorkflowStepper({ steps, className, variant = 'full' }: WorkflowStepperProps) {
  if (steps.length === 0) return null

  if (variant === 'compact') {
    return <CompactWorkflowStepper steps={steps} className={className} />
  }

  return (
    <div className={cn('w-full', className)} aria-label="Workflow progress">
      <CircleRow steps={steps} showLabels />
    </div>
  )
}

function CompactWorkflowStepper({
  steps,
  className,
}: {
  steps: WorkflowStepItem[]
  className?: string
}) {
  const currentIndex = steps.findIndex((s) => s.state === 'current' || s.state === 'rejected')
  const activeIndex = currentIndex >= 0 ? currentIndex : steps.length - 1
  const active = steps[activeIndex]

  return (
    <div className={cn('w-full', className)} aria-label="Workflow progress">
      <CircleRow steps={steps} showLabels={false} />
      {active && (
        <p className="mt-2 text-xs font-bold text-slate-800">
          {active.label}
          <span className="font-semibold text-slate-500">
            {' '}
            · Step {activeIndex + 1} of {steps.length}
          </span>
        </p>
      )}
    </div>
  )
}

function CircleRow({ steps, showLabels }: { steps: WorkflowStepItem[]; showLabels: boolean }) {
  return (
    <div className="flex w-full items-start">
      {steps.map((step, index) => (
        <Fragment key={step.id}>
          {index > 0 && (
            <div className={cn(CONNECTOR_ROW_CLASS, 'min-w-[6px] flex-1')}>
              <ConnectorLine complete={steps[index - 1]?.state === 'complete'} />
            </div>
          )}
          <div
            className={cn(
              'relative z-10 flex shrink-0 flex-col items-center',
              showLabels && 'gap-2'
            )}
          >
            <StepNode state={step.state} />
            {showLabels && (
              <p
                className={cn(
                  'max-w-[5.5rem] text-center text-[10px] leading-tight font-bold sm:max-w-[6.25rem] sm:text-[11px]',
                  step.state === 'upcoming' ? 'text-slate-400' : 'text-slate-700'
                )}
              >
                {step.label}
              </p>
            )}
          </div>
        </Fragment>
      ))}
    </div>
  )
}

function ConnectorLine({ complete }: { complete: boolean }) {
  return (
    <div aria-hidden className={cn('h-0.5 w-full', complete ? 'bg-slate-950' : 'bg-slate-200')} />
  )
}

function StepNode({ state }: { state: WorkflowStepState }) {
  return (
    <span
      className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-white',
        state === 'rejected' && 'border-red-700 bg-red-700 text-white',
        state === 'complete' && 'border-slate-950 bg-slate-950 text-white',
        state === 'current' && 'border-red-700 text-red-700 ring-2 ring-red-100',
        state === 'upcoming' && 'border-slate-300 text-slate-400'
      )}
    >
      {state === 'complete' ? (
        <CheckCircle2 className="h-3 w-3" aria-hidden />
      ) : state === 'current' ? (
        <CircleDot className="h-3 w-3" aria-hidden />
      ) : (
        <Circle className="h-3 w-3" aria-hidden />
      )}
    </span>
  )
}

export function buildWorkflowStepItems(
  steps: Array<{ id: string; label: string; current: boolean }>,
  completedBeforeCurrent: number
): WorkflowStepItem[] {
  return steps.map((step, index) => {
    if (step.id === 'rejected' && step.current) {
      return { id: step.id, label: step.label, state: 'rejected' }
    }
    if (index < completedBeforeCurrent) {
      return { id: step.id, label: step.label, state: 'complete' }
    }
    if (step.current) {
      return { id: step.id, label: step.label, state: 'current' }
    }
    return { id: step.id, label: step.label, state: 'upcoming' }
  })
}
