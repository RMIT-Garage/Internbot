import { Suspense, type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Navbar } from './Navbar'

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background flex h-screen overflow-hidden">
      <Suspense fallback={<aside className="bg-surface hidden w-72 border-r lg:flex" />}>
        <Sidebar />
      </Suspense>
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5">{children}</main>
      </div>
    </div>
  )
}
