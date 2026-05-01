'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Bell, UserCircle, ShieldCheck, Lightbulb, ChevronDown, ArrowRight } from 'lucide-react'
import type { StudentUser, UpdateProfilePayload, ProgramLevel } from '@/features/profile/types'

const PROGRAMS = [
  'Bachelor of Software Engineering (Professional)',
  'Bachelor of Computer Science',
  'Bachelor of Information Technology',
  'Bachelor of Business Information Systems',
  'Master of Information Technology',
  'Master of Engineering (Software)',
]

const schema = z.object({
  programName: z.string().min(1, 'Program name is required'),
  programLevel: z.enum(['undergraduate', 'postgraduate']),
  gpa: z.coerce
    .number({ invalid_type_error: 'GPA must be a number' })
    .min(0, 'Min 0.0')
    .max(4, 'Max 4.0'),
  unitsAttempted: z.coerce.number({ invalid_type_error: 'Must be a number' }).min(0),
  creditUnitsEarned: z.coerce.number({ invalid_type_error: 'Must be a number' }).min(0),
})

type FormValues = z.infer<typeof schema>

interface Props {
  user: StudentUser
  onSave: (payload: UpdateProfilePayload) => Promise<void>
  saving: boolean
}

const STEPS = [
  { key: 'personal', label: 'Identity', number: '1' },
  { key: 'academic', label: 'Academic', number: '2' },
  { key: 'credits', label: 'Credits', number: '3' },
  { key: 'review', label: 'Finalize', number: '4' },
] as const

export function AcademicProfileStep({ user, onSave, saving }: Props) {
  const router = useRouter()
  const ai = user.studentProfile.academicInfo

  const [programLevel, setProgramLevel] = useState<ProgramLevel>(
    ai?.programLevel ?? 'undergraduate'
  )

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      programName: ai?.programName ?? PROGRAMS[0],
      programLevel: ai?.programLevel ?? 'undergraduate',
      gpa: ai?.gpa ?? undefined,
      unitsAttempted: ai?.unitsAttempted ?? undefined,
      creditUnitsEarned: ai?.creditUnitsEarned ?? undefined,
    },
  })

  const buildPayload = (values: FormValues): UpdateProfilePayload => ({
    studentProfile: {
      academicInfo: {
        programName: values.programName,
        programLevel: values.programLevel,
        gpa: values.gpa,
        unitsAttempted: values.unitsAttempted,
        creditUnitsEarned: values.creditUnitsEarned,
      },
    },
  })

  const onSubmit = async (values: FormValues) => {
    try {
      await onSave(buildPayload(values))
      toast.success('Academic info saved!')
      router.push('/onboarding/review')
    } catch {
      toast.error('Failed to save. Please try again.')
    }
  }

  const handleBack = () => router.push('/onboarding/personal')

  const handleLevelToggle = (level: ProgramLevel) => {
    setProgramLevel(level)
    setValue('programLevel', level)
  }

  return (
    <main className="flex-1 bg-white">
      {/* Header */}
      <header className="flex items-center justify-end gap-6 border-b border-gray-100 p-6">
        <Bell size={24} className="cursor-pointer text-gray-400 hover:text-gray-600" />
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-slate-100">
          <UserCircle size={28} className="text-gray-500" />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-8 py-12">
        {/* Stepper */}
        <div className="relative mb-16 flex items-center justify-center">
          <div className="absolute top-5 left-0 -z-10 h-px w-full bg-gray-100" />
          <div className="flex w-full max-w-2xl justify-between">
            {STEPS.map((step) => {
              const isActive = step.key === 'academic'
              const isCompleted = step.key === 'personal'
              const isDisabled = step.key === 'credits' || step.key === 'review'

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

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          {/* Form — 8 cols */}
          <div className="space-y-8 lg:col-span-8">
            <div>
              <h1 className="mb-4 text-4xl font-semibold text-slate-800">Academic Information</h1>
              <p className="text-lg leading-relaxed text-slate-500">
                Provide your current program details to help us curate your academic experience and
                personalised audit reports.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-10 shadow-sm">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                {/* Program name */}
                <div>
                  <label className="mb-2 block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                    Program Name
                  </label>
                  <div className="relative">
                    <select
                      {...register('programName')}
                      className="w-full appearance-none rounded-xl border border-gray-200 bg-slate-50 px-5 py-4 font-medium text-slate-700 transition-all outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10"
                    >
                      {PROGRAMS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={20}
                      className="pointer-events-none absolute top-1/2 right-5 -translate-y-1/2 text-slate-400"
                    />
                  </div>
                  {errors.programName && (
                    <p className="mt-1 text-xs text-red-500">{errors.programName.message}</p>
                  )}
                </div>

                {/* Level + GPA */}
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                      Program Level
                    </label>
                    <div className="flex rounded-xl border border-gray-100 bg-slate-50 p-1">
                      <button
                        type="button"
                        onClick={() => handleLevelToggle('undergraduate')}
                        className={`flex-1 rounded-lg py-3 text-sm font-bold transition ${
                          programLevel === 'undergraduate'
                            ? 'border border-gray-100 bg-white text-red-600 shadow-sm'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        Undergraduate
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLevelToggle('postgraduate')}
                        className={`flex-1 rounded-lg py-3 text-sm font-bold transition ${
                          programLevel === 'postgraduate'
                            ? 'border border-gray-100 bg-white text-red-600 shadow-sm'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        Postgraduate
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                      Current GPA (0.0 – 4.0)
                    </label>
                    <input
                      {...register('gpa')}
                      type="number"
                      step="0.1"
                      min="0"
                      max="4"
                      placeholder="3.8"
                      className="w-full rounded-xl border border-gray-100 bg-slate-100/50 px-5 py-3 text-lg font-medium text-slate-600 transition outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/10"
                    />
                    {errors.gpa && (
                      <p className="mt-1 text-xs text-red-500">{errors.gpa.message}</p>
                    )}
                  </div>
                </div>

                {/* Units */}
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                      Units Attempted
                    </label>
                    <input
                      {...register('unitsAttempted')}
                      type="number"
                      min="0"
                      placeholder="24"
                      className="w-full rounded-xl border border-gray-100 bg-slate-100/50 px-5 py-3 text-lg font-medium text-slate-600 transition outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/10"
                    />
                    {errors.unitsAttempted && (
                      <p className="mt-1 text-xs text-red-500">{errors.unitsAttempted.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                      Credit Units Earned
                    </label>
                    <input
                      {...register('creditUnitsEarned')}
                      type="number"
                      min="0"
                      placeholder="18"
                      className="w-full rounded-xl border border-gray-100 bg-slate-100/50 px-5 py-3 text-lg font-medium text-slate-600 transition outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/10"
                    />
                    {errors.creditUnitsEarned && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.creditUnitsEarned.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-6">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="text-sm font-bold text-red-600 hover:underline"
                  >
                    Back to Personal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 rounded-xl bg-red-700 px-10 py-4 font-bold text-white shadow-lg shadow-red-100 transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Continue to Credits'}
                    <ArrowRight size={20} />
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right panels — 4 cols */}
          <div className="space-y-6 lg:col-span-4">
            {/* Verification card */}
            <div className="rounded-2xl bg-blue-600 p-8 text-white">
              <div className="mb-4 flex items-center gap-3">
                <ShieldCheck size={24} className="text-blue-100" />
                <h3 className="text-sm font-bold tracking-widest uppercase">Data Verification</h3>
              </div>
              <p className="mb-6 text-sm leading-relaxed font-medium text-blue-50">
                All academic information provided must match your official RMIT transcript exactly.
                Discrepancies may delay your graduation audit or course credit processing.
              </p>
              <a
                href="#"
                className="border-b border-blue-300 pb-0.5 text-xs font-bold transition hover:text-white"
              >
                Request Official Transcript →
              </a>
            </div>

            {/* Pro tip */}
            <div className="rounded-2xl border border-gray-100 bg-slate-50 p-8">
              <div className="flex gap-4">
                <div className="h-fit shrink-0 rounded-xl bg-white p-3 shadow-sm">
                  <Lightbulb size={24} className="text-red-500" />
                </div>
                <div>
                  <h4 className="mb-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                    Pro Tip
                  </h4>
                  <p className="text-xs leading-relaxed font-medium text-slate-500">
                    Your GPA is calculated on a 4.0 scale for international comparability. If your
                    transcript uses a different scale, use the RMIT conversion guide.
                  </p>
                </div>
              </div>
            </div>

            {/* Image card */}
            <div className="group relative overflow-hidden rounded-2xl border border-gray-100 grayscale">
              <div className="flex h-48 w-full items-center justify-center bg-gray-200 text-sm text-gray-400">
                RMIT Campus
              </div>
              <div className="absolute bottom-4 left-4">
                <p className="text-[10px] font-black tracking-[0.2em] text-white uppercase drop-shadow-md">
                  Institutional Integrity
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
