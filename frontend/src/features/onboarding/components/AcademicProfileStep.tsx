'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StudentUser, UpdateProfilePayload, ProgramLevel } from '@/features/profile/types'
import {
  OnboardingAlert,
  OnboardingFormActions,
  OnboardingFormCard,
  OnboardingPageFrame,
  OnboardingStepHeader,
  OnboardingStepper,
  onboardingInputCls,
  onboardingInputErrorCls,
  onboardingLabelCls,
} from './OnboardingUi'

const PROGRAM_MAP: Record<string, string> = {
  BP096: 'Bachelor of Software Engineering (Professional)',
  BP347: 'Bachelor of Computer Science (Professional)',
  BP348: 'Bachelor of Data Science (Professional)',
  BP349: 'Bachelor of Information Technology (Professional)',
  BP356: 'Bachelor of Cyber Security (Professional)',
}

const PROGRAMS = Object.entries(PROGRAM_MAP)

const schema = z.object({
  programName: z.string().min(1, 'Program name is required'),
  programCode: z.string().min(1, 'Program code is required'),
  programLevel: z.enum(['undergraduate', 'postgraduate']),
  gpa: z.preprocess(
    (v) => parseFloat(String(v)),
    z.number().min(0.01, 'GPA must be greater than 0').max(4, 'Max 4.0')
  ),
  unitsAttempted: z.preprocess(
    (v) => parseInt(String(v), 10),
    z.number().min(1, 'Units attempted must be at least 1')
  ),
  creditUnitsEarned: z.preprocess(
    (v) => parseInt(String(v), 10),
    z.number().min(1, 'Credit units earned must be at least 1')
  ),
  currentStudyLoad: z.enum(['full_time', 'part_time', 'unknown']),
})

type FormValues = z.infer<typeof schema>

interface Props {
  user: StudentUser
  onSave: (payload: UpdateProfilePayload) => Promise<void>
  saving: boolean
}

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
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      programCode: user.studentProfile.programCode ?? '',
      programName: PROGRAM_MAP[user.studentProfile.programCode ?? ''] ?? ai?.programName ?? '',
      programLevel: ai?.programLevel ?? 'undergraduate',
      gpa: ai?.gpa ?? undefined,
      unitsAttempted: ai?.unitsAttempted ?? undefined,
      creditUnitsEarned: ai?.creditUnitsEarned ?? undefined,
      currentStudyLoad: ai?.currentStudyLoad ?? 'full_time',
    },
  })

  const buildPayload = (values: FormValues): UpdateProfilePayload => ({
    studentProfile: {
      programCode: values.programCode,
      academicInfo: {
        programName: values.programName,
        programLevel: values.programLevel,
        gpa: values.gpa,
        unitsAttempted: values.unitsAttempted,
        creditUnitsEarned: values.creditUnitsEarned,
        currentStudyLoad: values.currentStudyLoad,
      },
    },
  })

  const onSubmit = async (values: FormValues) => {
    try {
      await onSave(buildPayload(values))
      toast.success('Academic info saved!')
      router.push('/onboarding/credits')
    } catch {
      toast.error('Failed to save. Please try again.')
    }
  }

  const watchedGpa = watch('gpa')
  const watchedUnitsAttempted = watch('unitsAttempted')
  const watchedCreditUnitsEarned = watch('creditUnitsEarned')
  const watchedProgramCode = watch('programCode')

  const isFormIncomplete =
    !watchedProgramCode ||
    watchedGpa === undefined ||
    watchedGpa === null ||
    String(watchedGpa) === '' ||
    watchedGpa <= 0 ||
    watchedUnitsAttempted === undefined ||
    watchedUnitsAttempted === null ||
    String(watchedUnitsAttempted) === '' ||
    watchedUnitsAttempted <= 0 ||
    watchedCreditUnitsEarned === undefined ||
    watchedCreditUnitsEarned === null ||
    String(watchedCreditUnitsEarned) === '' ||
    watchedCreditUnitsEarned <= 0

  const validationWarnings = [
    errors.programName?.message,
    errors.gpa?.message,
    errors.unitsAttempted?.message,
    errors.creditUnitsEarned?.message,
  ].filter(Boolean)

  const segmentBtn = (active: boolean) =>
    cn(
      'flex-1 rounded-lg py-2.5 text-sm font-bold transition',
      active
        ? 'border border-slate-200 bg-white text-red-700 shadow-sm'
        : 'text-slate-500 hover:text-slate-800'
    )

  return (
    <OnboardingPageFrame currentStep="academic">
      <OnboardingStepper currentStep="academic" />
      <OnboardingStepHeader
        eyebrow="Step 2 — Academic"
        title="Academic information"
        description="Provide your program details so we can match you with the right internship opportunities."
      />

      {validationWarnings.length > 0 && (
        <OnboardingAlert variant="error" title="Please fix the following fields">
          <ul className="mt-2 list-inside list-disc space-y-1">
            {validationWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </OnboardingAlert>
      )}

      <OnboardingFormCard>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label htmlFor="programCode" className={onboardingLabelCls}>
              Program
            </label>
            <div className="relative">
              <select
                id="programCode"
                {...register('programCode')}
                onChange={(e) => {
                  const code = e.target.value
                  setValue('programCode', code)
                  setValue('programName', PROGRAM_MAP[code] ?? '')
                }}
                className={cn(
                  onboardingInputCls,
                  'appearance-none pr-10',
                  errors.programCode && onboardingInputErrorCls
                )}
              >
                <option value="">Select your program</option>
                {PROGRAMS.map(([code, name]) => (
                  <option key={code} value={code}>
                    {code} — {name}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
            </div>
            {errors.programCode && (
              <p className="mt-1 text-xs text-red-600">{errors.programCode.message}</p>
            )}
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className={onboardingLabelCls}>Program level</p>
              <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setProgramLevel('undergraduate')
                    setValue('programLevel', 'undergraduate')
                  }}
                  className={segmentBtn(programLevel === 'undergraduate')}
                >
                  Undergraduate
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProgramLevel('postgraduate')
                    setValue('programLevel', 'postgraduate')
                  }}
                  className={segmentBtn(programLevel === 'postgraduate')}
                >
                  Postgraduate
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="gpa" className={onboardingLabelCls}>
                Current GPA (0.0 – 4.0)
              </label>
              <input
                id="gpa"
                {...register('gpa')}
                type="number"
                step="0.1"
                min="0"
                max="4"
                placeholder="3.8"
                className={cn(onboardingInputCls, errors.gpa && onboardingInputErrorCls)}
              />
              {errors.gpa && <p className="mt-1 text-xs text-red-600">{errors.gpa.message}</p>}
            </div>
          </div>

          <div>
            <p className={onboardingLabelCls}>Study load</p>
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              {(['full_time', 'part_time', 'unknown'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setValue('currentStudyLoad', option)}
                  className={segmentBtn(option === (watch('currentStudyLoad') ?? 'full_time'))}
                >
                  {option === 'full_time'
                    ? 'Full time'
                    : option === 'part_time'
                      ? 'Part time'
                      : 'Unknown'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="unitsAttempted" className={onboardingLabelCls}>
                Units attempted
              </label>
              <input
                id="unitsAttempted"
                {...register('unitsAttempted')}
                type="number"
                min="0"
                placeholder="24"
                className={cn(onboardingInputCls, errors.unitsAttempted && onboardingInputErrorCls)}
              />
              {errors.unitsAttempted && (
                <p className="mt-1 text-xs text-red-600">{errors.unitsAttempted.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="creditUnitsEarned" className={onboardingLabelCls}>
                Credit points earned
              </label>
              <input
                id="creditUnitsEarned"
                {...register('creditUnitsEarned')}
                type="number"
                min="0"
                placeholder="168"
                className={cn(
                  onboardingInputCls,
                  errors.creditUnitsEarned && onboardingInputErrorCls
                )}
              />
              {errors.creditUnitsEarned && (
                <p className="mt-1 text-xs text-red-600">{errors.creditUnitsEarned.message}</p>
              )}
            </div>
          </div>

          <OnboardingFormActions
            backLabel="Back to personal"
            onBack={() => router.push('/onboarding/personal')}
            submitLabel="Continue to credits"
            submitDisabled={isFormIncomplete}
            submitting={saving}
            showSave={false}
          />
        </form>
      </OnboardingFormCard>
    </OnboardingPageFrame>
  )
}
