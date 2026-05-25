'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api/client'

const TICKET_CATEGORIES = [
  { label: 'Eligibility', value: 'eligibility' },
  { label: 'Credit Points', value: 'credit_points' },
  { label: 'Self-Sourcing', value: 'self_sourcing' },
  { label: 'CareerHub', value: 'careerhub' },
  { label: 'Other', value: 'other' },
] as const

type CategoryValue = (typeof TICKET_CATEGORIES)[number]['value']

const schema = z.object({
  subject: z.string().min(1, 'Subject is required').max(200, 'Too long'),
  body: z.string().min(1, 'Message is required').max(5000, 'Too long'),
  category: z.enum(['eligibility', 'credit_points', 'self_sourcing', 'careerhub', 'other'] as [
    CategoryValue,
    ...CategoryValue[],
  ]),
})

type FormValues = z.infer<typeof schema>

interface TicketFormProps {
  onSuccess: () => void
}

export function TicketForm({ onSuccess }: TicketFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { category: 'eligibility' },
  })

  const onSubmit = async (values: FormValues) => {
    await apiFetch('/api/v1/tickets', { method: 'POST', body: values })
    toast.success('Ticket submitted — a coordinator will respond soon.')
    reset()
    onSuccess()
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-zinc-900">New ticket</h2>
      <p className="mb-5 text-xs text-zinc-500">
        Describe your issue and a coordinator will get back to you.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Subject" error={errors.subject?.message}>
          <input
            id="subject"
            type="text"
            placeholder="e.g. Credit point mismatch"
            {...register('subject')}
            className={inputClass}
          />
        </Field>

        <Field label="Category" error={errors.category?.message}>
          <select id="category" {...register('category')} className={inputClass}>
            {TICKET_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Message" error={errors.body?.message}>
          <textarea
            id="body"
            rows={5}
            placeholder="Describe your issue in detail…"
            {...register('body')}
            className={`${inputClass} resize-none`}
          />
        </Field>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? 'Submitting…' : 'Submit ticket'}
        </button>
      </form>
    </div>
  )
}

const inputClass =
  'block w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-100 transition'

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-zinc-600">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
