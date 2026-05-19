/**
 * Small `(i)` info icon that reveals a tooltip on hover.
 *
 * Used throughout the analysis page beside form labels to expose explanatory
 * copy (NEM-specific terminology, billing thresholds, etc.) without crowding
 * the label. The button itself has `tabIndex={-1}` so keyboard users tab past
 * it — the surrounding label is the focusable element.
 *
 * The `pdf-hide` class strips the icon from the PDF render so the printed
 * report stays clean.
 */

import { type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * @param text - Plain-string tooltip body (alternative to `children`)
 * @param children - Rich-content tooltip body; takes precedence over `text`
 * @param open - Controlled open state; omit for hover-driven behaviour
 * @param contentClassName - Tailwind classes applied to the tooltip content panel
 */
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
          <button
            type="button"
            tabIndex={-1}
            className="pdf-hide ml-1 inline-flex align-middle text-muted-foreground hover:text-foreground"
          >
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
