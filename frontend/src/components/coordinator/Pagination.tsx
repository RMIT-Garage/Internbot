import Link from 'next/link'
import { cn } from '@/lib/utils'

interface PaginationProps {
  page: number
  totalPages: number
  getHref: (page: number) => string
}

export function Pagination({ page, totalPages, getHref }: PaginationProps) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <p className="text-zinc-500">
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={getHref(Math.max(page - 1, 1))}
          aria-disabled={page === 1}
          className={cn(
            'rounded-md border border-zinc-200 px-3 py-2 font-medium transition-colors dark:border-zinc-800',
            page === 1
              ? 'pointer-events-none text-zinc-400'
              : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800'
          )}
        >
          Previous
        </Link>
        <Link
          href={getHref(Math.min(page + 1, totalPages))}
          aria-disabled={page === totalPages}
          className={cn(
            'rounded-md border border-zinc-200 px-3 py-2 font-medium transition-colors dark:border-zinc-800',
            page === totalPages
              ? 'pointer-events-none text-zinc-400'
              : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800'
          )}
        >
          Next
        </Link>
      </div>
    </div>
  )
}
