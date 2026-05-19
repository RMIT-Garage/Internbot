import type { ReactNode } from 'react'

interface ReviewTwoPaneLayoutProps {
  leftTitle: string
  rightTitle: string
  left: ReactNode
  right: ReactNode
}

export function ReviewTwoPaneLayout({
  leftTitle,
  rightTitle,
  left,
  right,
}: ReviewTwoPaneLayoutProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">{leftTitle}</h2>
        <div className="mt-4">{left}</div>
      </section>
      <aside className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">{rightTitle}</h2>
        <div className="mt-4">{right}</div>
      </aside>
    </div>
  )
}
