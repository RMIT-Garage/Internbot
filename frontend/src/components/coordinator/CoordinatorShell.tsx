'use client'

import type { ReactNode } from 'react'
import { CoordinatorTopbar } from './CoordinatorTopbar'
import { CoordinatorSidebar } from './CoordinatorSidebar'
export function CoordinatorShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-white text-slate-950">
      <CoordinatorSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <CoordinatorTopbar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 xl:p-8">{children}</main>
      </div>
    </div>
  )
}
