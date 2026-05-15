import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

interface QuickActionCardProps {
  href: string
  title: string
  description: string
  icon: LucideIcon
}

export function QuickActionCard({ href, title, description, icon: Icon }: QuickActionCardProps) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50/50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-red-900/70 dark:hover:bg-red-950/20"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-700 transition-colors group-hover:bg-red-100 group-hover:text-red-700 dark:bg-zinc-800 dark:text-zinc-300 dark:group-hover:bg-red-950 dark:group-hover:text-red-300">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>
    </Link>
  )
}
