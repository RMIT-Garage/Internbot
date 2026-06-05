import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CoordinatorPageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  actions?: React.ReactNode
}

export function CoordinatorPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: CoordinatorPageHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="pointer-events-none absolute top-0 right-0 h-28 w-72 rounded-bl-full bg-gradient-to-l from-red-50 via-slate-50 to-transparent" />
      <div className="relative flex w-full flex-col gap-4 md:flex-row md:items-start md:justify-between lg:items-center">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="text-xs font-bold tracking-[0.18em] text-red-700 uppercase">{eyebrow}</p>
          )}
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{title}</h1>
          {description && (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center md:ml-auto">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

interface SurfaceCardProps {
  children: React.ReactNode
  className?: string
}

export function SurfaceCard({ children, className }: SurfaceCardProps) {
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

/** Shared list/table section header — matches student dashboard panels. */
export function SurfaceCardHeader({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4',
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="text-base font-bold text-slate-950">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}

interface KPIStatCardProps {
  title: string
  value: string | number
  detail: string
  icon: LucideIcon
  tone?: 'red' | 'charcoal' | 'neutral'
  progress?: number
}

export function KPIStatCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = 'red',
  progress,
}: KPIStatCardProps) {
  const iconTones = {
    red: 'bg-red-50 text-red-600',
    charcoal: 'bg-slate-100 text-slate-600',
    neutral: 'bg-slate-100 text-slate-500',
  }

  const valueTones = {
    red: 'text-red-600',
    charcoal: 'text-slate-950',
    neutral: 'text-slate-900',
  }

  return (
    <SurfaceCard className="flex items-center gap-3 p-4">
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
          iconTones[tone]
        )}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">{title}</p>
        <p className={cn('text-xl leading-tight font-bold', valueTones[tone])}>{value}</p>
        <p className="text-[11px] text-slate-400">{detail}</p>
        {typeof progress === 'number' && (
          <div className="mt-2 h-1.5 rounded-full bg-slate-100">
            <div
              className="h-1.5 rounded-full bg-red-700"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        )}
      </div>
    </SurfaceCard>
  )
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
  const valueTones = {
    red: 'text-red-600',
    charcoal: 'text-slate-950',
    neutral: 'text-slate-900',
  }

  return (
    <SurfaceCard className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-slate-50 p-3">
          <p className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">
            {item.label}
          </p>
          <p
            className={cn(
              'mt-1 text-xl leading-tight font-bold',
              valueTones[item.tone ?? 'charcoal']
            )}
          >
            {item.value}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">{item.detail}</p>
        </div>
      ))}
    </SurfaceCard>
  )
}

export function TimelineFeed({
  items,
}: {
  items: Array<{
    title: string
    description: string
    time: string
    tone?: 'red' | 'charcoal' | 'neutral'
  }>
}) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={`${item.title}-${item.time}-${index}`} className="flex gap-3">
          <div
            className={cn(
              'mt-1 h-2 w-2 shrink-0 rounded-full ring-4',
              item.tone === 'charcoal' && 'bg-slate-950 ring-slate-100',
              item.tone === 'neutral' && 'bg-slate-500 ring-slate-100',
              (!item.tone || item.tone === 'red') && 'bg-red-600 ring-red-50'
            )}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-950">{item.title}</p>
            <p className="mt-0.5 text-sm leading-5 text-slate-500">{item.description}</p>
            <p className="mt-0.5 text-xs font-medium text-slate-400">{item.time}</p>
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
