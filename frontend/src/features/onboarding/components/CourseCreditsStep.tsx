'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, Check, Code2, Lock, Scale, TerminalSquare, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StudentUser } from '@/features/profile/types'
import { SurfaceCard } from '@/components/student/Premium'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import {
  OnboardingAlert,
  OnboardingPageFrame,
  OnboardingStepHeader,
  OnboardingStepper,
} from './OnboardingUi'

interface Props {
  user: StudentUser
}

export function CourseCreditsStep({ user }: Props) {
  const router = useRouter()
  const ai = user.studentProfile.academicInfo

  const earnedCP = ai?.creditUnitsEarned ?? 0
  const totalCP = 180
  const progressPct = Math.min(Math.round((earnedCP / totalCP) * 100), 100)
  const remaining = Math.max(totalCP - earnedCP, 0)

  const [checks, setChecks] = useState({
    sef: false,
    apt: false,
    pcp: false,
  })

  const incompleteRequirements = [
    !checks.sef && 'SEF30012 must be completed',
    !checks.apt && 'APT40005 must be completed',
    !checks.pcp && 'PCP20019 must be completed',
    earnedCP < totalCP && `You still need ${remaining} more credit points`,
  ].filter((item): item is string => Boolean(item))

  const allRequirementsMet = incompleteRequirements.length === 0

  const toggleCheck = (key: keyof typeof checks) => {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <OnboardingPageFrame currentStep="credits" maxWidth="xl">
      <OnboardingStepper currentStep="credits" />
      <OnboardingStepHeader
        eyebrow="Step 3 — Credits"
        title="Prerequisites & credits"
        description={`Confirm foundational requirements for ${ai?.programName ?? 'your program'} before final review.`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {!allRequirementsMet && (
            <OnboardingAlert variant="error" title="Prerequisites still incomplete">
              <ul className="mt-2 list-inside list-disc space-y-1">
                {incompleteRequirements.map((req) => (
                  <li key={req}>{req}</li>
                ))}
              </ul>
            </OnboardingAlert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <RequirementCard
              icon={BarChart3}
              label="Core requirement"
              title={`${totalCP} credit points`}
              completed={earnedCP >= totalCP}
            />
            <RequirementCard
              icon={Code2}
              label="SEF30012"
              title="Software Engineering Fundamentals"
              completed={checks.sef}
              onToggle={() => toggleCheck('sef')}
            />
            <RequirementCard
              icon={TerminalSquare}
              label="APT40005"
              title="Programming Studio 2"
              completed={checks.apt}
              onToggle={() => toggleCheck('apt')}
            />
            <RequirementCard
              icon={Scale}
              label="PCP20019"
              title="Algorithms and Analysis"
              completed={checks.pcp}
              onToggle={() => toggleCheck('pcp')}
            />
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => router.push('/onboarding/academic')}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-red-700 hover:text-red-800"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to academic
            </button>
            <button
              type="button"
              onClick={() => router.push('/onboarding/review')}
              disabled={!allRequirementsMet}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-700 px-8 text-sm font-bold text-white shadow-sm transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue to review
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <SurfaceCard className="p-6">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-red-700" aria-hidden />
            <h3 className="text-sm font-bold text-slate-950">Career path progress</h3>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Complete credit and prerequisite requirements to unlock internship pathways.
          </p>
          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
              Credit progress
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-2 flex-1 rounded-full bg-slate-200">
                <div
                  className="h-2 rounded-full bg-red-700 transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-sm font-bold text-slate-950">{progressPct}%</span>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-600">
              {remaining > 0 ? (
                <>
                  <span className="font-bold text-red-700">{remaining} credit points</span>{' '}
                  remaining to reach the program threshold.
                </>
              ) : (
                <span className="font-bold text-green-700">Credit requirements met.</span>
              )}
            </p>
          </div>
        </SurfaceCard>
      </div>
    </OnboardingPageFrame>
  )
}

function RequirementCard({
  icon: Icon,
  label,
  title,
  completed,
  onToggle,
}: {
  icon: LucideIcon
  label: string
  title: string
  completed: boolean
  onToggle?: () => void
}) {
  return (
    <SurfaceCard
      className={cn(
        'relative p-5 transition',
        completed ? 'ring-1 ring-green-100' : 'ring-1 ring-red-100'
      )}
    >
      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={completed ? 'Mark incomplete' : 'Mark complete'}
          className={cn(
            'absolute top-4 right-4 flex h-6 w-6 items-center justify-center rounded-md border transition',
            completed
              ? 'border-red-700 bg-red-700 text-white'
              : 'border-slate-200 bg-white text-transparent'
          )}
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      )}
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 ring-1 ring-red-100">
        <Icon className="h-5 w-5 text-red-700" aria-hidden />
      </div>
      <p className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">{label}</p>
      <h4 className="mt-1 pr-8 text-sm leading-snug font-bold text-slate-950">{title}</h4>
    </SurfaceCard>
  )
}
