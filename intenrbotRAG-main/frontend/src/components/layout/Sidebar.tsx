'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Bot, BriefcaseBusiness, FileCheck } from 'lucide-react'

const navItems = [
  { href: '/assistant?feature=faq-rag', label: 'FAQ Assistant', icon: Bot, match: 'faq-rag' },
  {
    href: '/assistant?feature=contract-checker',
    label: 'Contract Checker',
    icon: FileCheck,
    match: 'contract-checker',
  },
  {
    href: '/assistant?feature=job-checker',
    label: 'Job Checker',
    icon: BriefcaseBusiness,
    match: 'job-checker',
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return (
    <aside className="bg-surface hidden w-72 flex-col border-r lg:flex">
      <div className="flex h-16 items-center border-b px-5">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {process.env.NEXT_PUBLIC_APP_NAME ?? 'Internbot'}
          </p>
          <p className="text-xs text-zinc-500">Workspace</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
          Main
        </p>
        {navItems.map(({ href, label, icon: Icon, match }) => {
          const isActive =
            pathname === match ||
            (pathname === '/assistant' && searchParams.get('feature') === match)

          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                isActive
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
              }`}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="bg-background m-3 rounded-xl border p-3">
        <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">Tip</p>
        <p className="mt-1 text-xs text-zinc-500">
          Use each assistant mode to compare grounded responses across features.
        </p>
      </div>
    </aside>
  )
}
