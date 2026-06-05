import { Skeleton } from '@/components/ui/ContentSkeleton'

interface CoordinatorContentSkeletonProps {
  title?: string
}

export function CoordinatorContentSkeleton({ title }: CoordinatorContentSkeletonProps) {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <Skeleton className="h-3 w-32 bg-red-100" />
        <Skeleton className="mt-3 h-7 w-full max-w-sm bg-slate-200" />
        <Skeleton className="mt-2 h-4 w-full max-w-xl" />
        <p className="sr-only">{title}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-12 bg-slate-200" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <Skeleton className="h-4 w-40 bg-slate-200" />
        </div>
        <div className="divide-y divide-slate-100">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="mx-5 my-3 h-12 rounded-xl bg-slate-50" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default CoordinatorContentSkeleton
