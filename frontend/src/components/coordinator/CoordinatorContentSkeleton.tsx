export function CoordinatorContentSkeleton({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-3 w-32 animate-pulse rounded-full bg-red-100" />
        <div className="mt-4 h-8 w-full max-w-md animate-pulse rounded-full bg-slate-200" />
        <div className="mt-3 h-4 w-full max-w-2xl animate-pulse rounded-full bg-slate-100" />
        <p className="sr-only">{title}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="h-4 w-24 animate-pulse rounded-full bg-slate-100" />
            <div className="mt-4 h-8 w-16 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-3 h-3 w-32 animate-pulse rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="h-5 w-48 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-5 space-y-3">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-12 animate-pulse rounded-xl bg-slate-50" />
          ))}
        </div>
      </div>
    </div>
  )
}
