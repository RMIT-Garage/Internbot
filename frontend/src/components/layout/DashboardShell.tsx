import type { ReactNode } from 'react'
import { StudentTopbar } from '../student/StudentTopbar'
import { StudentSidebar } from '../student/StudentSidebar'

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-black">
      <StudentSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <StudentTopbar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
