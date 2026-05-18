import { cn } from '@/lib/utils'

export function AuthLogo({ className }: { className?: string }) {
  return (
    <div className={cn('inline-flex flex-col items-center gap-1.5', className)}>
      <div
        aria-hidden="true"
        className="bg-brand-500 flex size-10 items-center justify-center rounded-md text-white shadow-sm"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
        >
          <path d="M12 2 14.39 8.26 21 9.27l-4.78 4.66L17.34 21 12 17.77 6.66 21l1.12-7.07L3 9.27l6.61-1.01L12 2Z" />
        </svg>
      </div>
      <span className="text-[10px] font-bold tracking-[0.2em] text-zinc-700">INTERNBOT</span>
    </div>
  )
}
