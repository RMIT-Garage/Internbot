import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Authentication',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background min-h-screen px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-sm">{children}</div>
    </div>
  )
}
