import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Settings',
}

export default function SettingsPage() {
  // Settings page is intentionally disabled for now.
  // return (
  //   <div className="max-w-2xl space-y-6">
  //     <PageHeader title="Settings" description="Manage your application settings." />
  //
  //     <div className="rounded-2xl border bg-surface p-6 shadow-sm">
  //       <p className="text-sm text-zinc-500">Workspace preferences and notifications will appear here in the next iteration.</p>
  //     </div>
  //   </div>
  // )
  redirect('/assistant')
}
