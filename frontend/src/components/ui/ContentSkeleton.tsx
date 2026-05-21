import { cn } from '@/lib/utils'

/**
 * Low-level shimmer block. Compose larger skeletons from these so layout
 * dimensions stay in sync with the real content and CLS stays at zero.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('animate-pulse rounded-full bg-slate-100', className)} />
  )
}

export function ContentSkeleton({ title }: { title: string }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <Skeleton className="h-3 w-32 bg-red-100" />
        <Skeleton className="mt-4 h-8 w-full max-w-md bg-slate-200" />
        <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
        <p className="sr-only">{title}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <Skeleton className="h-5 w-48 bg-slate-200" />
        <div className="mt-5 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 rounded-xl bg-slate-50" />
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Single KPI card placeholder. Mirrors `KPIStatCard` from `student/Premium.tsx`
 * exactly — title/value/detail on the left, icon block on the right, progress
 * bar at the bottom — so cards don't grow vertically when data lands.
 */
export function KpiCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-2 h-8 w-16 bg-slate-200" />
          <Skeleton className="mt-1 h-3 w-32" />
        </div>
        <Skeleton className="h-10 w-10 shrink-0 rounded-xl bg-slate-100" />
      </div>
      <Skeleton className="mt-5 h-2 w-full rounded-full bg-slate-100" />
    </div>
  )
}

/**
 * Four-tile horizontal strip mirroring `AnalyticsStrip` from `student/Premium`.
 * Drop in directly below the KPI grid on dashboard-style pages.
 */
export function AnalyticsStripSkeleton() {
  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl bg-slate-50 p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-7 w-16 rounded-xl bg-slate-200" />
          <Skeleton className="mt-3 h-3 w-28" />
        </div>
      ))}
    </div>
  )
}

/**
 * Grid of opportunity-style cards. Matches `grid gap-4 lg:grid-cols-3` plus
 * the {title + badge}/{2-col stats}/{button} card layout so the real Apply
 * button lands on the same coordinates the skeleton reserved.
 */
export function CardGridSkeleton({ count = 6, label }: { count?: number; label: string }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <p className="sr-only">{label}</p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4 bg-slate-200" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Skeleton className="h-16 rounded-xl bg-slate-50" />
              <Skeleton className="h-16 rounded-xl bg-slate-50" />
            </div>
            <Skeleton className="mt-4 h-9 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Vertical stack of list rows. Use when the loaded UI is one card per row. */
export function ListRowsSkeleton({ count = 4, label }: { count?: number; label: string }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <p className="sr-only">{label}</p>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5 bg-slate-200" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="ml-4 h-7 w-20" />
        </div>
      ))}
    </div>
  )
}

/**
 * Detail-view skeleton: hero header + two-column stat grid. Use as the
 * placeholder for "view this internship/opportunity" pages.
 */
export function DetailHeroSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <p className="sr-only">{label}</p>
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <Skeleton className="h-3 w-28 bg-red-100" />
        <Skeleton className="mt-4 h-8 w-2/3 bg-slate-200" />
        <Skeleton className="mt-3 h-4 w-1/2" />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <Skeleton className="h-5 w-40 bg-slate-200" />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl bg-slate-50" />
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Skeleton rows for a `<table>` that shadows the loaded table. Pass the same
 * column count the real table uses so widths stay aligned.
 */
export function TableRowsSkeleton({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <tbody className="divide-y divide-slate-100">
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r}>
          {Array.from({ length: columns }, (_, c) => (
            <td key={c} className="px-4 py-3">
              <Skeleton
                className={cn(
                  'h-4',
                  // Vary widths slightly so the placeholder doesn't look like a barcode.
                  c === 0 ? 'w-32 bg-slate-200' : c === columns - 1 ? 'w-12' : 'w-24'
                )}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}
