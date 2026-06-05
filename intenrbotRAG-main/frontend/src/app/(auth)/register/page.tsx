import Link from 'next/link'

export default function RegisterPage() {
  return (
    <div className="bg-surface my-8 space-y-6 rounded-2xl border p-8 shadow-[var(--shadow-soft)]">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          No account needed
        </h1>
        <p className="text-sm text-zinc-500">
          Registration has been removed for this demo experience.
        </p>
      </div>
      <Link
        href="/assistant"
        className="bg-brand-500 hover:bg-brand-600 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white"
      >
        Launch assistant
      </Link>
    </div>
  )
}
