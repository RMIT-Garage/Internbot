'use client'

import { useRouter } from 'next/navigation'
import {
  Sparkles,
  Lock,
  Check,
  BarChart3,
  Code2,
  TerminalSquare,
  Scale,
  type LucideIcon,
} from 'lucide-react'
import type { StudentUser } from '@/features/profile/types'
import { Navbar } from '@/components/layout/Navbar'
import { useState } from 'react'

interface Props {
  user: StudentUser
}

const STEPS = [
  { key: 'personal', label: 'Identity', number: '1' },
  { key: 'academic', label: 'Academic', number: '2' },
  { key: 'credits', label: 'Credits', number: '3' },
  { key: 'review', label: 'Finalize', number: '4' },
] as const

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
    setChecks((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  return (
    <main className="flex-1 bg-white">
      {/* Header */}
      <Navbar />

      <div className="mx-auto max-w-6xl px-10 py-12">
        {/* Stepper */}
        <div className="relative mb-16 flex items-center justify-center">
          <div className="absolute top-5 left-0 -z-10 h-px w-full bg-gray-100" />

          <div className="flex w-full max-w-2xl justify-between">
            {STEPS.map((step) => {
              const isActive = step.key === 'credits'
              const isCompleted = step.key === 'personal' || step.key === 'academic'

              let circleClass =
                'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm z-10 bg-white border-2 border-gray-100 text-gray-300'

              let labelClass = 'text-[10px] tracking-widest uppercase text-gray-300'

              if (isActive) {
                circleClass =
                  'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm z-10 bg-red-700 border-2 border-red-700 text-white scale-110 shadow-lg shadow-red-100'

                labelClass = 'text-[10px] tracking-widest uppercase text-red-700 font-bold'
              } else if (isCompleted) {
                circleClass =
                  'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm z-10 bg-slate-800 border-2 border-slate-800 text-white'

                labelClass = 'text-[10px] tracking-widest uppercase text-slate-800 font-bold'
              }

              return (
                <div key={step.key} className="flex flex-col items-center gap-3">
                  <div className={circleClass}>{step.number}</div>
                  <span className={labelClass}>{step.label}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="grid grid-cols-12 gap-12">
          {/* Left — 8 cols */}
          <div className="col-span-8 space-y-8">
            <div>
              <span className="mb-4 inline-block rounded bg-gray-100 px-3 py-1 text-[10px] font-bold text-gray-500">
                STEP 3 OF 4
              </span>
              <h1 className="mb-4 text-4xl font-semibold text-slate-800">
                Prerequisites & Credits
              </h1>
              <p className="text-lg leading-relaxed text-slate-500">
                Confirm your foundational requirements for{' '}
                <span className="font-medium text-slate-700">
                  {ai?.programName ?? 'your program'}
                </span>{' '}
                to unlock elective pathways.
              </p>
            </div>

            {/* Validation Warning Banner */}
            {!allRequirementsMet && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />

                  <div>
                    <h3 className="text-sm font-bold text-red-800">
                      Prerequisites still incomplete
                    </h3>

                    <p className="mt-1 text-sm text-red-700">
                      Complete all required courses and credit requirements before continuing to the
                      final onboarding stage.
                    </p>

                    <ul className="mt-3 space-y-1 text-sm text-red-700">
                      {incompleteRequirements.map((req) => (
                        <li key={req}>• {req}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Requirement cards */}
            <div className="grid grid-cols-2 gap-4">
              <RequirementCard
                icon={BarChart3}
                label="CORE REQUIREMENT"
                title={`${totalCP} Credit Points`}
                // tag="CP-CORE-180"
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

            {/* Actions */}
            <div className="flex items-center justify-between pt-8">
              <button
                type="button"
                onClick={() => router.push('/onboarding/academic')}
                className="text-sm font-bold text-red-600 hover:underline"
              >
                Back to Academics
              </button>
              <button
                onClick={() => router.push('/onboarding/review')}
                disabled={!allRequirementsMet}
                className="rounded-lg bg-red-700 px-10 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-100 transition hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none"
              >
                Confirm & Continue
              </button>
            </div>
          </div>

          {/* Right — 4 cols */}
          <div className="col-span-4 space-y-6">
            {/* Career path locked card */}
            <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-gray-50/50 p-8">
              <Lock className="absolute -top-4 -right-4 h-24 w-24 text-gray-100" />

              <div className="mb-6 flex items-center gap-2">
                <Lock size={16} className="text-slate-800" />
                <h3 className="text-[11px] font-black tracking-[0.15em] text-slate-800 uppercase">
                  Career Path Locked
                </h3>
              </div>

              <div className="mb-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                <p className="mb-4 text-[9px] font-bold tracking-wider text-gray-400 uppercase">
                  Requirement Tracker
                </p>
                <div className="mb-2 flex items-center justify-between">
                  <div className="mr-4 h-1.5 flex-1 rounded-full bg-gray-100">
                    <div
                      className="h-1.5 rounded-full bg-red-600 transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="text-xs leading-none font-black text-slate-800">
                    {progressPct}%
                  </span>
                </div>
                <p className="text-[10px] leading-relaxed text-gray-500">
                  {remaining > 0 ? (
                    <>
                      Complete{' '}
                      <span className="font-bold text-red-600">{remaining} more credit points</span>{' '}
                      to unlock your Internship pathways.
                    </>
                  ) : (
                    <span className="font-bold text-green-600">All credit requirements met!</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

// ── Requirement card ──────────────────────────────────────────

interface RequirementCardProps {
  icon: LucideIcon
  label: string
  title: string
  tag?: string
  details?: string[]
  statusText?: string
  completed: boolean
  onToggle?: () => void
}

function RequirementCard({
  icon: Icon,
  label,
  title,
  tag,
  details,
  statusText,
  completed,
  onToggle,
}: RequirementCardProps) {
  return (
    <div
      className={`relative rounded-xl border p-6 transition ${
        completed ? 'border-green-200 bg-white' : 'border-red-200 bg-red-50/40'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`absolute top-4 right-4 flex h-6 w-6 items-center justify-center rounded border transition-colors ${
          completed
            ? 'border-red-600 bg-red-600 text-white'
            : 'border-gray-200 bg-white text-transparent'
        }`}
      >
        <Check size={14} />
      </button>

      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50">
        <Icon size={20} className="text-red-600" />
      </div>

      <p className="mb-1 text-[10px] font-bold tracking-widest text-gray-400 uppercase">{label}</p>
      <h4 className="mb-3 pr-8 text-sm leading-tight font-bold text-slate-800">{title}</h4>

      {tag && (
        <span
          className={`rounded px-2 py-1 text-[9px] font-bold uppercase ${
            tag === 'CP-CORE-180' ? 'bg-blue-100 text-blue-600' : 'bg-indigo-100 text-indigo-600'
          }`}
        >
          {tag}
        </span>
      )}

      {details && (
        <div className="flex gap-2">
          {details.map((d) => (
            <span
              key={d}
              className="rounded bg-gray-100 px-2 py-1 text-[10px] font-medium text-gray-500"
            >
              {d}
            </span>
          ))}
        </div>
      )}

      {statusText && <p className="text-[10px] font-medium text-red-600 italic">{statusText}</p>}
    </div>
  )
}
