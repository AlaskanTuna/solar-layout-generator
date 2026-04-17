import { type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function InfoTooltip({
  text,
  children,
  open,
  contentClassName
}: {
  text?: string
  children?: ReactNode
  open?: boolean
  contentClassName?: string
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip open={open}>
        <TooltipTrigger asChild>
          <button type="button" className="ml-1 inline-flex align-middle text-muted-foreground hover:text-foreground">
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className={cn('max-w-xs whitespace-pre-line text-xs', contentClassName)}>
          {children ?? text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
