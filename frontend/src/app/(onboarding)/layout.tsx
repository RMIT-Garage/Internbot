import type { ReactNode } from 'react'

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <div className="flex h-screen overflow-hidden bg-slate-50">{children}</div>
}
