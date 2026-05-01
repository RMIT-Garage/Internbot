'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Lock, Bell, UserCircle, GraduationCap, ArrowRight } from 'lucide-react'
import type { StudentUser, UpdateProfilePayload } from '@/features/profile/types'

const schema = z.object({
  phone: z.string().min(1, 'Phone number is required'),
})

type FormValues = z.infer<typeof schema>

const STEPS = ['Personal', 'Academic', 'Course', 'Review']

interface Props {
  user: StudentUser
  onSave: (payload: UpdateProfilePayload) => Promise<void>
  saving: boolean
}

export function PersonalDetailsStep({ user, onSave, saving }: Props) {
  const router = useRouter()
  const { studentProfile, displayName, email } = user

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      phone: studentProfile.phone ?? '',
    },
  })

  const onSubmit = async (values: FormValues) => {
    try {
      await onSave({
        studentProfile: { phone: values.phone },
      })
      toast.success('Progress saved!')
      router.push('/onboarding/academic')
    } catch {
      toast.error('Failed to save. Please try again.')
    }
  }

  const handleSaveProgress = handleSubmit(async (values) => {
    try {
      await onSave({ studentProfile: { phone: values.phone } })
      toast.success('Progress saved!')
    } catch {
      toast.error('Failed to save.')
    }
  })

  return (
    <main className="flex-1 bg-white">
      {/* Header */}
      <header className="flex items-center justify-end gap-5 border-b border-gray-100 p-8">
        <Bell size={24} className="cursor-pointer text-gray-400 hover:text-gray-600" />
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
          <UserCircle size={32} className="text-gray-400" />
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl p-12 lg:p-16">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
          {/* Left — form */}
          <div className="space-y-10 lg:col-span-2">
            {/* Title */}
            <div>
              <span className="mb-5 inline-block rounded bg-gray-100 px-3 py-1.5 text-[11px] font-bold tracking-wide text-gray-500 uppercase">
                Stage 01 — Identity
              </span>
              <h2 className="mb-3 text-4xl font-semibold">Personal Details</h2>
              <p className="max-w-2xl leading-relaxed text-gray-600">
                Please verify and complete your identity information. These details will be used for
                your official academic record and graduation certificates.
              </p>
            </div>

            {/* Progress bar */}
            <div className="border-t border-gray-100 pt-1">
              <div className="grid grid-cols-4 gap-1">
                {STEPS.map((step, i) => (
                  <div key={step} className="pt-2">
                    <div className={`h-1 rounded ${i === 0 ? 'bg-red-600' : 'bg-gray-200'}`} />
                    <span
                      className={`mt-1 text-[10px] font-bold uppercase ${
                        i === 0 ? 'text-red-600' : 'text-gray-400'
                      }`}
                    >
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Form card */}
            <div className="rounded-xl border border-gray-100 p-8 shadow-sm lg:p-10">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                {/* Student name — locked */}
                <div>
                  <label className="mb-2 block text-[10px] font-medium text-gray-500 uppercase">
                    Student Name
                  </label>
                  <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-5 py-4">
                    <span className="text-lg font-medium tracking-wide text-gray-900 uppercase">
                      {displayName ?? '—'}
                    </span>
                    <div className="flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-2.5 py-1.5 text-[10px] font-medium text-gray-400 uppercase">
                      <Lock size={14} className="text-gray-400" />
                      RMIT Core
                    </div>
                  </div>
                  <p className="mt-2.5 text-[11px] text-gray-500 italic">
                    Contact Student Connect if your legal name has changed.
                  </p>
                </div>

                {/* Student number + email — locked */}
                <div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-[10px] font-medium text-gray-500 uppercase">
                      Student Number
                    </label>
                    <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-5 py-4">
                      <span className="text-lg text-gray-900">{studentProfile.studentNumber}</span>
                      <Lock size={16} className="text-gray-300" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-medium text-gray-500 uppercase">
                      RMIT Email
                    </label>
                    <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-5 py-4">
                      <span className="text-sm text-gray-900">{email}</span>
                      <Lock size={16} className="text-gray-300" />
                    </div>
                  </div>
                </div>

                {/* Phone — editable */}
                <div>
                  <label
                    htmlFor="phone"
                    className="mb-2 block text-[10px] font-medium text-gray-500 uppercase"
                  >
                    Phone Number
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    {...register('phone')}
                    placeholder="+61 400 000 000"
                    className="w-full rounded-lg border border-gray-100 bg-gray-100/50 px-5 py-4 text-lg text-gray-600 transition-colors outline-none placeholder:text-gray-400 focus:border-red-600/20 focus:bg-white focus:ring-2 focus:ring-red-600/20"
                  />
                  {errors.phone && (
                    <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>
                  )}
                </div>

                <div className="border-t border-gray-100 pt-8" />

                {/* Actions */}
                <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleSaveProgress}
                    disabled={saving}
                    className="text-sm font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    Save Progress
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 rounded-xl bg-red-600 px-10 py-3.5 font-bold text-white shadow-lg shadow-red-100 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Next Step'}
                    <ArrowRight size={20} />
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right — info panels */}
          <div className="space-y-12">
            {/* AI advisor */}
            <div className="rounded-xl bg-blue-500 p-8 text-white">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                  <GraduationCap size={24} className="text-white" />
                </div>
                <div>
                  <h4 className="text-lg leading-tight font-semibold">Academic Advisor AI</h4>
                  <p className="text-[10px] font-medium tracking-wider text-white/70 uppercase">
                    System Tip
                  </p>
                </div>
              </div>
              <p className="mb-6 text-[13px] leading-relaxed font-medium text-blue-50/80">
                Identity verification is a mandatory legal requirement for Australian Higher
                Education. The name provided here must match your government-issued ID exactly to
                ensure your Testamur and Academic Transcripts are valid upon graduation.
              </p>
              <a
                href="#"
                className="inline-flex items-center gap-2 text-xs font-semibold text-blue-100 hover:text-white"
              >
                Read Graduation Policy
                <ArrowRight size={16} />
              </a>
            </div>

            {/* Identity verification panel */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-bold tracking-wide text-gray-500 uppercase">
                Identity Verification
              </h4>
              <div className="overflow-hidden rounded-xl border border-gray-100">
                <div className="flex h-40 w-full items-center justify-center bg-gray-100 text-sm text-gray-400">
                  RMIT City Campus
                </div>
                <div className="bg-gray-50 p-4">
                  <p className="text-[11px] font-medium text-gray-700">RMIT City Campus</p>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-gray-500">
                Your identity data is encrypted and stored according to Australian Privacy
                Principles (APP).
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
