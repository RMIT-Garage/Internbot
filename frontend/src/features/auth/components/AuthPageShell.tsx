import { cn } from '@/lib/utils'

interface AuthPageShellProps {
  children: React.ReactNode
  maxWidth?: 'md' | 'xl'
}

export function AuthPageShell({ children, maxWidth = 'md' }: AuthPageShellProps) {
  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden bg-zinc-950 text-white">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[url('/RMIT.jpg')] bg-cover bg-center"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-br from-black/50 to-black/70"
      />

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:py-14">
        <div className={cn('w-full space-y-8', maxWidth === 'xl' ? 'max-w-xl' : 'max-w-md')}>
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Welcome to Internbot
            </h1>
            <p className="text-[11px] font-semibold tracking-[0.25em] text-zinc-300 uppercase">
              Institutional Internship Portal
            </p>
          </div>
          <div className="rounded-xl bg-white p-6 text-zinc-900 shadow-2xl ring-1 ring-black/5 sm:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
