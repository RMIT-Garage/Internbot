import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'size-4 border-2',
  md: 'size-8 border-2',
  lg: 'size-12 border-4',
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        'border-t-brand-500 dark:border-t-brand-600 animate-spin rounded-full border-zinc-300 dark:border-zinc-700',
        sizeClasses[size],
        className
      )}
    />
  )
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  )
}
