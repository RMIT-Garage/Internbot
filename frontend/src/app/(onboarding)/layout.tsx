import type { ReactNode } from 'react'

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50 font-sans text-gray-900 antialiased">
      {children}
    </div>
  )
}
