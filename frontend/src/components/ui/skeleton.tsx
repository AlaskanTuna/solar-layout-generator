import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-md bg-gradient-to-r from-primary/[0.08] via-primary/15 to-primary/[0.08] bg-[length:200%_100%] animate-shimmer',
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
