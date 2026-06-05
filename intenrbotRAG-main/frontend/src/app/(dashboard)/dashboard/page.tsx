import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export default async function DashboardPage() {
  // Dashboard page is intentionally disabled for now.
  // return (
  //   <div className="space-y-6">
  //     <PageHeader
  //       title="Dashboard"
  //       description={`Welcome back${session?.email ? `, ${session.email}` : ''}.`}
  //     />
  //
  //     <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  //       {(['Usage coverage', 'Knowledge quality', 'Response confidence'] as const).map((title) => (
  //         <div key={title} className="rounded-2xl border bg-surface p-6 shadow-sm">
  //           <p className="text-sm font-medium text-zinc-500">{title}</p>
  //           <p className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-100">--</p>
  //           <p className="mt-2 text-xs text-zinc-500">Metric connection in progress for this environment.</p>
  //         </div>
  //       ))}
  //     </div>
  //   </div>
  // )
  redirect('/assistant')
}
