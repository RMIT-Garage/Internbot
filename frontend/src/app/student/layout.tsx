'use client'

import { ReactNode } from 'react'
import { StudentSidebar } from '@/components/student/StudentSidebar'
import { StudentTopbar } from '@/components/student/StudentTopbar'

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* SIDEBAR */}
      <StudentSidebar />

      {/* MAIN COLUMN */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* TOPBAR */}
        <StudentTopbar />

        {/* PAGE CONTENT */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
