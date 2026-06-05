'use client'

import Link from 'next/link'
import { Menu } from 'lucide-react'

const mobileLinks = [
  { href: '/assistant?feature=faq-rag', label: 'FAQ Assistant' },
  { href: '/assistant?feature=contract-checker', label: 'Contract Checker' },
  { href: '/assistant?feature=job-checker', label: 'Job Checker' },
]

export function Navbar() {
  return (
    <header className="bg-surface flex h-14 items-center justify-between border-b px-4 sm:px-5">
      <div className="flex items-center gap-3">
        <details className="relative lg:hidden">
          <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-lg border bg-white text-zinc-700 hover:bg-zinc-50">
            <Menu className="size-4" />
          </summary>
          <div className="bg-surface absolute left-0 top-11 z-20 w-56 rounded-xl border p-2 shadow-lg">
            {mobileLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </details>
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {process.env.NEXT_PUBLIC_APP_NAME ?? 'Internbot'}
          </p>
          <p className="hidden text-xs text-zinc-500 sm:block">Student and coordinator console</p>
        </div>
      </div>
      <span className="hidden rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600 md:block">
        Live mode
      </span>
    </header>
  )
}
