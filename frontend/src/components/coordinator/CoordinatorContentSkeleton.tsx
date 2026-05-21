import { KpiCardSkeleton, Skeleton } from '@/components/ui/ContentSkeleton'

export function CoordinatorContentSkeleton({ title }: { title: string }) {
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
