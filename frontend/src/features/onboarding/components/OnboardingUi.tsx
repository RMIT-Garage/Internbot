'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { CoordinatorPageHeader, SurfaceCard } from '@/components/student/Premium'
import {
  ONBOARDING_STEPS,
  type OnboardingStepKey,
  getOnboardingStepIndex,
  isOnboardingStepReached,
} from '../constants'

export const onboardingInputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:outline-none'

export const onboardingInputErrorCls =
  'border-red-300 bg-red-50 text-red-800 focus:border-red-500 focus:ring-red-500/20'

export const onboardingLabelCls =
  'mb-2 block text-xs font-bold tracking-wide text-slate-500 uppercase'

interface OnboardingPageFrameProps {
  currentStep: OnboardingStepKey
  children: React.ReactNode
  maxWidth?: 'md' | 'lg' | 'xl'
}

export function OnboardingPageFrame({
  currentStep,
  children,
  maxWidth = 'lg',
}: OnboardingPageFrameProps) {
  const widthClass = maxWidth === 'xl' ? 'max-w-5xl' : maxWidth === 'md' ? 'max-w-3xl' : 'max-w-4xl'

  return (
    <>
      <OnboardingSidebar currentStep={currentStep} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <p className="text-xs font-bold text-red-700">
            Step {getOnboardingStepIndex(currentStep) + 1} of {ONBOARDING_STEPS.length}
          </p>
          <p className="text-sm font-bold text-slate-950">
            {ONBOARDING_STEPS[getOnboardingStepIndex(currentStep)]?.label}
          </p>
        </div>
        <main className="flex-1 overflow-y-auto p-6">
          <div className={cn('mx-auto space-y-6', widthClass)}>{children}</div>
        </main>
      </div>
    </>
  )
}

interface OnboardingSidebarProps {
  currentStep: OnboardingStepKey
}

export function OnboardingSidebar({ currentStep }: OnboardingSidebarProps) {
  const router = useRouter()
  const { signOut } = useAuth()
  const currentIndex = getOnboardingStepIndex(currentStep)
  const progressPct = Math.round(((currentIndex + 1) / ONBOARDING_STEPS.length) * 100)

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="border-b border-slate-200 px-5 py-5">
        <p className="text-xs font-bold tracking-[0.18em] text-red-700 uppercase">Profile setup</p>
        <h1 className="mt-1 text-lg font-bold text-slate-950">Onboarding</h1>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Step {currentIndex + 1} of {ONBOARDING_STEPS.length}
        </p>
        <div className="mt-4 h-2 rounded-full bg-slate-100">
          <div
            className="h-2 rounded-full bg-red-700 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {ONBOARDING_STEPS.map((step) => {
          const active = step.key === currentStep
          const reached = isOnboardingStepReached(currentStep, step.key)
          const completed = getOnboardingStepIndex(step.key) < currentIndex

          const content = (
            <>
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                  active && 'bg-red-700 text-white',
                  !active && completed && 'bg-slate-900 text-white',
                  !active && !completed && reached && 'bg-red-50 text-red-700 ring-1 ring-red-100',
                  !reached && 'bg-slate-100 text-slate-400'
                )}
              >
                {completed && !active ? <Check className="h-3.5 w-3.5" /> : step.number}
              </span>
              <span className="min-w-0 truncate">{step.label}</span>
            </>
          )

          if (!reached) {
            return (
              <div
                key={step.key}
                className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400"
              >
                {content}
              </div>
            )
          }

          return (
            <Link
              key={step.key}
              href={step.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                active
                  ? 'bg-red-50 text-red-700 ring-1 ring-red-100'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
              )}
            >
              {content}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          <LogOut className="h-4 w-4 text-slate-400" aria-hidden />
          Sign out
        </button>
      </div>
    </aside>
  )
}

export function OnboardingStepper({ currentStep }: { currentStep: OnboardingStepKey }) {
  const currentIndex = getOnboardingStepIndex(currentStep)

  return (
    <div className="relative flex items-center justify-between gap-2 sm:gap-4">
      <div
        aria-hidden
        className="absolute top-5 right-8 left-8 hidden h-px bg-slate-200 sm:block"
      />
      {ONBOARDING_STEPS.map((step) => {
        const index = getOnboardingStepIndex(step.key)
        const active = step.key === currentStep
        const completed = index < currentIndex

        return (
          <div key={step.key} className="relative flex flex-1 flex-col items-center gap-2">
            <div
              className={cn(
                'z-10 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ring-4 ring-slate-50',
                active && 'bg-red-700 text-white ring-red-50',
                completed && !active && 'bg-slate-900 text-white',
                !active && !completed && 'border-2 border-slate-200 bg-white text-slate-400'
              )}
            >
              {completed && !active ? <Check className="h-4 w-4" /> : step.number}
            </div>
            <span
              className={cn(
                'hidden text-center text-[10px] font-bold tracking-wide uppercase sm:block',
                active && 'text-red-700',
                completed && !active && 'text-slate-800',
                !active && !completed && 'text-slate-400'
              )}
            >
              {step.shortLabel}
            </span>
          </div>
        )
      })}
    </div>
  )
}

interface OnboardingStepHeaderProps {
  eyebrow: string
  title: string
  description: string
}

export function OnboardingStepHeader({ eyebrow, title, description }: OnboardingStepHeaderProps) {
  return <CoordinatorPageHeader eyebrow={eyebrow} title={title} description={description} />
}

export function OnboardingAlert({
  variant,
  title,
  children,
}: {
  variant: 'warning' | 'error' | 'info'
  title: string
  children: React.ReactNode
}) {
  const styles = {
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-red-200 bg-red-50 text-red-900',
    info: 'border-slate-200 bg-slate-50 text-slate-900',
  }

  return (
    <div className={cn('rounded-2xl border p-4', styles[variant])}>
      <h3 className="text-sm font-bold">{title}</h3>
      <div className="mt-2 text-sm leading-6 opacity-90">{children}</div>
    </div>
  )
}

export function OnboardingFormCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <SurfaceCard className={cn('p-6 sm:p-8', className)}>{children}</SurfaceCard>
}

interface OnboardingFormActionsProps {
  backLabel?: string
  onBack?: () => void
  saveLabel?: string
  onSave?: () => void
  saveDisabled?: boolean
  submitLabel: string
  submitDisabled?: boolean
  submitting?: boolean
  showSave?: boolean
}

export function OnboardingFormActions({
  backLabel,
  onBack,
  saveLabel = 'Save progress',
  onSave,
  saveDisabled,
  submitLabel,
  submitDisabled,
  submitting,
  showSave = true,
}: OnboardingFormActionsProps) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-4">
        {onBack && backLabel && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-red-700 hover:text-red-800"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {backLabel}
          </button>
        )}
        {showSave && onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saveDisabled || submitting}
            className="text-sm font-bold text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            {saveLabel}
          </button>
        )}
      </div>
      <button
        type="submit"
        disabled={submitDisabled || submitting}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-700 px-8 text-sm font-bold text-white shadow-sm transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Saving…' : submitLabel}
        {!submitting && <ArrowRight className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  )
}

export function OnboardingLockedField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className={onboardingLabelCls}>{label}</p>
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-100/80 px-4 py-3 text-sm font-medium text-slate-700">
        <span className="truncate">{value}</span>
        <span className="shrink-0 text-[10px] font-bold tracking-wide text-slate-400 uppercase">
          Locked
        </span>
      </div>
    </div>
  )
}
