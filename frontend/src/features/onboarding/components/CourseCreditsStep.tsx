'use client'

import { useRouter } from 'next/navigation'
import {
  Bell,
  UserCircle,
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

            {/* Audit insight banner */}
            <div className="flex gap-4 rounded-r-xl border border-l-4 border-gray-100 border-l-blue-500 bg-white p-6 shadow-sm">
              <div className="h-fit shrink-0 rounded-lg bg-blue-50 p-2">
                <Sparkles size={20} className="text-blue-600" />
              </div>
              <div>
                <h3 className="mb-1 font-bold text-slate-800">Academic Audit Insight</h3>
                <p className="text-sm leading-relaxed text-blue-800/80">
                  Our system has detected{' '}
                  <span className="font-bold">{earnedCP} completed credit points</span> from your
                  academic record.{' '}
                  {remaining > 0 ? (
                    <>
                      Once you confirm the final{' '}
                      <span className="font-bold">{remaining} points</span>, your professional
                      internship path will automatically activate.
                    </>
                  ) : (
                    'Your credit requirements are complete — your internship path is ready to activate.'
                  )}
                </p>
              </div>
            </div>

            {/* Requirement cards */}
            <div className="grid grid-cols-2 gap-4">
              <RequirementCard
                icon={BarChart3}
                label="CORE REQUIREMENT"
                title={`${totalCP} Credit Points`}
                tag="CP-CORE-180"
                completed={earnedCP >= totalCP}
              />
              <RequirementCard
                icon={Code2}
                label="SEF30012"
                title="Software Engineering Fundamentals"
                details={['Semester 1', 'Grade: HD']}
                completed
              />
              <RequirementCard
                icon={TerminalSquare}
                label="APT40005"
                title="Advanced Programming Techniques"
                statusText="Awaiting final assessment results"
                completed={false}
              />
              <RequirementCard
                icon={Scale}
                label="PCP20019"
                title="Professional Computing Practice"
                tag="Ethics Certified"
                completed
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-8">
              <button
                onClick={() => router.push('/onboarding/academic')}
                className="rounded-lg border border-gray-200 px-8 py-3 text-sm font-bold text-red-600 transition hover:bg-gray-50"
              >
                Previous Step
              </button>
              <button
                onClick={() => router.push('/onboarding/review')}
                className="rounded-lg bg-red-700 px-10 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-100 transition hover:bg-red-800"
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
                      to unlock Software Architect and Lead Developer pathways.
                    </>
                  ) : (
                    <span className="font-bold text-green-600">All credit requirements met!</span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-dashed border-gray-200 bg-white/40 p-4 opacity-60">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gray-100">
                  <Lock size={16} className="text-gray-400" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500">Senior Internship Pool</p>
                  <p className="text-[9px] text-gray-400">Restricted access</p>
                </div>
              </div>
            </div>

            {/* Visual card */}
            <div className="flex h-44 items-center justify-center overflow-hidden rounded-2xl border border-gray-100 bg-gray-100 text-sm text-gray-400">
              Tech Career Pathways
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
}

function RequirementCard({
  icon: Icon,
  label,
  title,
  tag,
  details,
  statusText,
  completed,
}: RequirementCardProps) {
  return (
    <div className="relative rounded-xl border border-gray-100 bg-white p-6 transition-shadow hover:shadow-md">
      <div
        className={`absolute top-4 right-4 flex h-6 w-6 items-center justify-center rounded border transition-colors ${
          completed
            ? 'border-red-600 bg-red-600 text-white'
            : 'border-gray-200 bg-white text-transparent'
        }`}
      >
        <Check size={14} />
      </div>

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
