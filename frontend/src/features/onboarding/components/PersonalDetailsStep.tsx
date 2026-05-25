'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { StudentUser, UpdateProfilePayload } from '@/features/profile/types'
import {
  OnboardingAlert,
  OnboardingFormActions,
  OnboardingFormCard,
  OnboardingLockedField,
  OnboardingPageFrame,
  OnboardingStepHeader,
  OnboardingStepper,
  onboardingInputCls,
  onboardingInputErrorCls,
  onboardingLabelCls,
} from './OnboardingUi'

const schema = z.object({
  displayName: z.string().min(1, 'Student name is required'),
  phone: z.string().min(1, 'Phone number is required'),
})

type FormValues = z.infer<typeof schema>

interface Props {
  user: StudentUser
  onSave: (payload: UpdateProfilePayload) => Promise<void>
  saving: boolean
}

export function PersonalDetailsStep({ user, onSave, saving }: Props) {
  const router = useRouter()
  const { studentProfile, displayName, email } = user

  const missingFields = [
    !displayName && 'Student name missing from RMIT records',
    !studentProfile.phone && 'Phone number not provided',
  ].filter((field): field is string => Boolean(field))

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: displayName ?? '',
      phone: studentProfile.phone ?? '',
    },
  })

  const onSubmit = async (values: FormValues) => {
    try {
      await onSave({
        studentProfile: { phone: values.phone },
        displayName: values.displayName,
      })
      toast.success('Progress saved!')
      router.push('/onboarding/academic')
    } catch {
      toast.error('Failed to save. Please try again.')
    }
  }

  const handleSaveProgress = handleSubmit(async (values) => {
    try {
      await onSave({ studentProfile: { phone: values.phone }, displayName: values.displayName })
      toast.success('Progress saved!')
    } catch {
      toast.error('Failed to save.')
    }
  })

  return (
    <OnboardingPageFrame currentStep="personal">
      <OnboardingStepper currentStep="personal" />
      <OnboardingStepHeader
        eyebrow="Step 1 — Identity"
        title="Personal details"
        description="Verify and complete your identity information for your academic record and placement applications."
      />

      {missingFields.length > 0 && (
        <OnboardingAlert variant="warning" title="Some required fields are incomplete">
          <ul className="mt-2 list-inside list-disc space-y-1">
            {missingFields.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        </OnboardingAlert>
      )}

      <OnboardingFormCard>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label htmlFor="displayName" className={onboardingLabelCls}>
              Student name
            </label>
            <input
              id="displayName"
              type="text"
              {...register('displayName')}
              placeholder="Your full name"
              className={cn(onboardingInputCls, errors.displayName && onboardingInputErrorCls)}
            />
            {errors.displayName && (
              <p className="mt-1 text-xs text-red-600">{errors.displayName.message}</p>
            )}
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <OnboardingLockedField label="Student number" value={studentProfile.studentNumber} />
            <OnboardingLockedField label="RMIT email" value={email} />
          </div>

          <div>
            <label htmlFor="phone" className={onboardingLabelCls}>
              Phone number
            </label>
            <input
              id="phone"
              type="tel"
              {...register('phone')}
              placeholder="+61 400 000 000"
              className={cn(onboardingInputCls, errors.phone && onboardingInputErrorCls)}
            />
            {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
          </div>

          <OnboardingFormActions
            onSave={handleSaveProgress}
            saveDisabled={saving}
            submitting={saving}
            submitLabel="Continue to academic"
            showSave
          />
        </form>
      </OnboardingFormCard>
    </OnboardingPageFrame>
  )
}
