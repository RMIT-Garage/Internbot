import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Profile',
}

export default async function ProfilePage() {
  // Profile page is intentionally disabled for now.
  // return (
  //   <div className="max-w-2xl space-y-6">
  //     <PageHeader title="Profile" description="Manage your account details." />
  //
  //     <div className="space-y-4 rounded-2xl border bg-surface p-6 shadow-sm">
  //       <div>
  //         <p className="text-xs text-zinc-400 uppercase tracking-wide font-medium">Email</p>
  //         <p className="mt-1 text-sm">{session?.email ?? '—'}</p>
  //       </div>
  //       <div>
  //         <p className="text-xs text-zinc-400 uppercase tracking-wide font-medium">User ID</p>
  //         <p className="mt-1 text-sm font-mono text-zinc-500">{session?.uid ?? '—'}</p>
  //       </div>
  //     </div>
  //   </div>
  // )
  redirect('/assistant')
}
