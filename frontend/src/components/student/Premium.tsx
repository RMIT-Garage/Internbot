import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { ArrowRight, BrainCircuit, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CoordinatorPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div className="pointer-events-none absolute top-0 right-0 h-28 w-72 rounded-bl-full bg-gradient-to-l from-red-50 via-slate-50 to-transparent" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          {eyebrow && (
            <p className="text-xs font-bold tracking-[0.18em] text-red-700 uppercase">{eyebrow}</p>
          )}
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

export function SurfaceCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50',
        className
      )}
    >
      {children}
    </section>
  )
}

export function KPIStatCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = 'red',
  progress,
}: {
  title: string
  value: string | number
  detail: string
  icon: LucideIcon
  tone?: 'red' | 'charcoal' | 'neutral'
  progress?: number
}) {
  const tones = {
    red: 'bg-red-50 text-red-700 ring-red-100',
    charcoal: 'bg-slate-950 text-white ring-slate-900',
    neutral: 'bg-slate-100 text-slate-800 ring-slate-200',
  }

  return (
    <SurfaceCard className="p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/80">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
          <p className="mt-1 text-sm text-slate-500">{detail}</p>
        </div>
        <div className={cn('rounded-xl p-2.5 ring-1', tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {typeof progress === 'number' && (
        <div className="mt-5 h-2 rounded-full bg-slate-100">
          <div
            className="h-2 rounded-full bg-red-700"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </SurfaceCard>
  )
}

export function AIInsightCard({
  title,
  insight,
  confidence,
  href,
}: {
  title: string
  insight: string
  confidence?: number
  href?: string
}) {
  const content = (
    <SurfaceCard className="relative overflow-hidden border-red-100 bg-gradient-to-br from-white via-white to-red-50 p-5 shadow-slate-200/70">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-red-700" />
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-slate-950 p-3 text-white shadow-sm">
          <BrainCircuit className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-slate-950">{title}</h2>
            {typeof confidence === 'number' && (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-950 ring-1 ring-slate-200">
                {confidence}% confidence
              </span>
            )}
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{insight}</p>
        </div>
        {href && <ArrowRight className="mt-1 h-4 w-4 text-red-700" />}
      </div>
    </SurfaceCard>
  )

  return href ? <Link href={href}>{content}</Link> : content
}

export function AnalyticsStrip({
  items,
}: {
  items: Array<{
    label: string
    value: string | number
    detail: string
    tone?: 'red' | 'charcoal' | 'neutral'
  }>
}) {
  const toneClasses = {
    red: 'text-red-700 bg-red-50',
    charcoal: 'text-slate-950 bg-white ring-1 ring-slate-200',
    neutral: 'text-slate-800 bg-slate-100',
  }

  return (
    <SurfaceCard className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">{item.label}</p>
          <p
            className={cn(
              'mt-3 inline-flex rounded-xl px-3 py-1 text-2xl font-bold',
              toneClasses[item.tone ?? 'charcoal']
            )}
          >
            {item.value}
          </p>
          <p className="mt-3 text-sm text-slate-500">{item.detail}</p>
        </div>
      ))}
    </SurfaceCard>
  )
}

export function AICommandCard({
  title,
  description,
  metric,
}: {
  title: string
  description: string
  metric: string
}) {
  return (
    <SurfaceCard className="group relative overflow-hidden border-red-200 bg-slate-950 p-5 text-white shadow-slate-950/20 transition hover:-translate-y-0.5 hover:shadow-xl">
      <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-red-700/30 blur-3xl transition group-hover:bg-red-600/30" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div className="rounded-2xl bg-white/10 p-3 text-white ring-1 ring-white/15">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-950 ring-1 ring-slate-200">
            {metric}
          </span>
        </div>
        <h3 className="mt-5 text-lg font-bold">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
      </div>
    </SurfaceCard>
  )
}

export function TimelineFeed({
  items,
}: {
  items: Array<{
    title: string
    description?: string
    time: string
    tone?: 'red' | 'charcoal' | 'neutral'
  }>
}) {
  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={`${item.title}-${item.time}-${index}`} className="flex gap-3">
          <div
            className={cn(
              'mt-1 h-2.5 w-2.5 rounded-full ring-4',
              item.tone === 'charcoal' && 'bg-slate-950 ring-slate-100',
              item.tone === 'neutral' && 'bg-slate-500 ring-slate-100',
              (!item.tone || item.tone === 'red') && 'bg-red-600 ring-red-50'
            )}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-950">{item.title}</p>
            {item.description && (
              <p className="mt-1 text-sm leading-5 text-slate-500">{item.description}</p>
            )}
            <p className="mt-1 text-xs font-medium text-slate-400">{item.time}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export function PillButton({
  children,
  href,
  variant = 'primary',
}: {
  children: React.ReactNode
  href: string
  variant?: 'primary' | 'secondary'
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-bold transition',
        variant === 'primary'
          ? 'bg-red-700 text-white shadow-sm hover:bg-red-800'
          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      )}
    >
      {children}
    </Link>
  )
}
