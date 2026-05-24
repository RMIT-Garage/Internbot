'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import type { StudentUser, UpdateProfilePayload } from '../types'
import type { Resolver, SubmitHandler } from 'react-hook-form'

const schema = z.object({
  phone: z.string().min(1, 'Phone is required'),
  programName: z.string().min(1, 'Program name is required'),
  programLevel: z.enum(['undergraduate', 'postgraduate']),
  currentStudyLoad: z.enum(['full_time', 'part_time', 'unknown']),
  majors: z.string().optional(),
  minors: z.string().optional(),
  gpa: z.coerce.number().min(0.01, 'GPA is required').max(4),
  creditUnitsEarned: z.coerce.number().min(1, 'Credit units earned is required'),
  unitsAttempted: z.coerce.number().min(1, 'Units attempted is required'),
})

type FormValues = z.infer<typeof schema>

interface Props {
  user: StudentUser
  onSave: (payload: UpdateProfilePayload) => Promise<void>
  onCancel: () => void
  saving: boolean
}

export function ProfileEditForm({ user, onSave, onCancel, saving }: Props) {
  const ai = user.studentProfile.academicInfo

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      phone: user.studentProfile.phone ?? '',
      programName: ai?.programName ?? '',
      programLevel: ai?.programLevel ?? 'undergraduate',
      currentStudyLoad: ai?.currentStudyLoad ?? 'full_time',
      majors: ai?.majors?.join(', ') ?? '',
      minors: ai?.minors?.join(', ') ?? '',
      gpa: ai?.gpa ?? 0,
      creditUnitsEarned: ai?.creditUnitsEarned ?? 0,
      unitsAttempted: ai?.unitsAttempted ?? 0,
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    const splitList = (s?: string) =>
      s
        ? s
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
        : undefined

    const payload: UpdateProfilePayload = {
      studentProfile: {
        phone: values.phone,
        academicInfo: {
          programName: values.programName,
          programLevel: values.programLevel,
          currentStudyLoad: values.currentStudyLoad,
          majors: splitList(values.majors),
          minors: splitList(values.minors),
          gpa: values.gpa,
          creditUnitsEarned: values.creditUnitsEarned,
          unitsAttempted: values.unitsAttempted,
        },
      },
    }

    try {
      await onSave(payload)
      toast.success('Profile saved!')
    } catch {
      toast.error('Failed to save profile. Please try again.')
    }
  }

  const { watch } = form

  const watchedGpa = watch('gpa')
  const watchedUnitsAttempted = watch('unitsAttempted')
  const watchedCreditUnitsEarned = watch('creditUnitsEarned')

  const isFormIncomplete =
    !watchedGpa ||
    watchedGpa <= 0 ||
    !watchedUnitsAttempted ||
    watchedUnitsAttempted <= 0 ||
    !watchedCreditUnitsEarned ||
    watchedCreditUnitsEarned <= 0

  return (
    // Backdrop
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-6">
          <div>
            <h2 className="text-lg font-bold">Edit Profile</h2>
            <p className="mt-0.5 text-xs text-gray-400">
              Fill all fields to mark your profile as complete
            </p>
          </div>
          <button
            onClick={onCancel}
            className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 p-6">
          {isFormIncomplete && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-xs text-red-700">
              GPA, credit units earned, and units attempted must all be greater than 0 to complete
              your profile.
            </div>
          )}

          {/* Personal */}
          <fieldset>
            <legend className="mb-3 text-xs font-bold tracking-wider text-gray-400 uppercase">
              Personal
            </legend>
            <Field label="Phone Number" error={errors.phone?.message}>
              <input {...register('phone')} placeholder="+61 400 000 000" className={inputCls} />
            </Field>
          </fieldset>

          {/* Academic program */}
          <fieldset>
            <legend className="mb-3 text-xs font-bold tracking-wider text-gray-400 uppercase">
              Academic Program
            </legend>
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Program Name"
                error={errors.programName?.message}
                className="col-span-2"
              >
                <input
                  {...register('programName')}
                  placeholder="Bachelor of Software Engineering"
                  className={inputCls}
                />
              </Field>
              <Field label="Program Level" error={errors.programLevel?.message}>
                <select {...register('programLevel')} className={inputCls}>
                  <option value="undergraduate">Undergraduate</option>
                  <option value="postgraduate">Postgraduate</option>
                </select>
              </Field>
              <Field label="Study Load" error={errors.currentStudyLoad?.message}>
                <select {...register('currentStudyLoad')} className={inputCls}>
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="unknown">Unknown</option>
                </select>
              </Field>
              <Field label="Majors (comma-separated)" error={errors.majors?.message}>
                <input
                  {...register('majors')}
                  placeholder="Software Engineering, Cloud Computing"
                  className={inputCls}
                />
              </Field>
              <Field label="Minors (comma-separated)" error={errors.minors?.message}>
                <input {...register('minors')} placeholder="Cyber Security" className={inputCls} />
              </Field>
            </div>
          </fieldset>

          {/* Academic record */}
          <fieldset>
            <legend className="mb-3 text-xs font-bold tracking-wider text-gray-400 uppercase">
              Academic Record
            </legend>
            <div className="grid grid-cols-3 gap-4">
              <Field label="GPA (0–4.0)" error={errors.gpa?.message}>
                <input
                  {...register('gpa')}
                  type="number"
                  step="0.1"
                  min="0"
                  max="4"
                  placeholder="3.2"
                  className={inputCls}
                />
              </Field>
              <Field label="Credit Points Earned" error={errors.creditUnitsEarned?.message}>
                <input
                  {...register('creditUnitsEarned')}
                  type="number"
                  placeholder="168"
                  className={inputCls}
                />
              </Field>
              <Field label="Units Attempted" error={errors.unitsAttempted?.message}>
                <input
                  {...register('unitsAttempted')}
                  type="number"
                  placeholder="192"
                  className={inputCls}
                />
              </Field>
            </div>
          </fieldset>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || isFormIncomplete}
              className="flex-1 rounded-lg bg-red-600 py-3 text-sm font-bold text-white shadow-lg shadow-red-100 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'SAVE CHANGES'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-lg border border-gray-200 bg-white py-3 text-sm font-bold text-gray-400 transition hover:bg-gray-50"
            >
              DISCARD EDITS
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 bg-gray-50 placeholder:text-gray-300'

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string
  error?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <label className="text-xs font-medium text-gray-600">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
