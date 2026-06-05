import Link from 'next/link'

export default function ForgotPasswordPage() {
  return (
    <div className="bg-surface space-y-6 rounded-2xl border p-8 shadow-[var(--shadow-soft)]">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Password reset disabled
        </h1>
        <p className="text-sm text-zinc-500">
          This demo no longer requires accounts or password management.
        </p>
      </div>
      <p className="text-center text-sm text-zinc-500">
        Continue directly to the workspace:{' '}
        <Link
          href="/assistant"
          className="text-brand-500 hover:text-brand-600 font-medium hover:underline"
        >
          Launch assistant
        </Link>
      </p>
    </div>
  )
}
