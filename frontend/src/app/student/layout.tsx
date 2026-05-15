'use client'

import { usePathname } from 'next/navigation'

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen flex-col">
      {/* You can later add a StudentNavbar or StudentShell here */}
      <main className="flex-1">{children}</main>
    </div>
  )
}
