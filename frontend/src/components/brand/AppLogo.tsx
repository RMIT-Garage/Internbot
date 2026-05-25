import Image from 'next/image'
import { cn } from '@/lib/utils'

const sizePixels = {
  sm: 24,
  md: 40,
} as const

const sizeClasses = {
  sm: 'rounded-md',
  md: 'rounded-xl',
} as const

interface AppLogoProps {
  className?: string
  size?: keyof typeof sizePixels
}

/** Brand mark from /brand/icon.png (connected placement network on RMIT red). */
export function AppLogo({ className, size = 'md' }: AppLogoProps) {
  const px = sizePixels[size]

  return (
    <Image
      src="/brand/icon.png"
      alt=""
      width={px}
      height={px}
      unoptimized
      className={cn('shrink-0 shadow-sm ring-1 ring-black/10', sizeClasses[size], className)}
      aria-hidden
    />
  )
}
