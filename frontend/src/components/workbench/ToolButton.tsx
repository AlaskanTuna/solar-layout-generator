/**
 * Shared toolbar button primitives for the workbench canvas controls.
 * Provides pin-aware tooltips for icon buttons and overlay swatches without duplicating tooltip state logic.
 */

import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** Shared tooltip controller state — `pinned` keeps the tooltip open after click. */
export type TooltipState = { label: string | null; pinned: boolean }

/** Props for {@link ToolButton}. */
export type ToolButtonProps = {
  onClick: () => void
  disabled?: boolean
  active?: boolean
  tooltip: string
  className?: string
  tooltipState: TooltipState
  setTooltipState: React.Dispatch<React.SetStateAction<TooltipState>>
  children: React.ReactNode
}

/**
 * Renders one square workbench toolbar icon button with controlled hover/click tooltip state.
 * Expects a tooltip label, click handler, shared tooltip state, and optional active/disabled styling.
 */
export function ToolButton({
  onClick,
  disabled,
  active,
  tooltip,
  className,
  tooltipState,
  setTooltipState,
  children
}: ToolButtonProps) {
  const isTooltipOpen = tooltipState.label === tooltip

  return (
    <Tooltip open={isTooltipOpen}>
      <TooltipTrigger asChild>
        <button
          onClick={() => {
            onClick()
            setTooltipState({ label: tooltip, pinned: true })
          }}
          disabled={disabled}
          onPointerEnter={() => setTooltipState({ label: tooltip, pinned: false })}
          onPointerLeave={() => {
            setTimeout(() => {
              setTooltipState((current) =>
                current.label === tooltip && !current.pinned ? { label: null, pinned: false } : current
              )
            }, 1500)
          }}
          aria-label={tooltip}
          className={cn(
            'relative z-20 flex h-8 w-8 items-center justify-center rounded-md text-sm shadow-md transition-all active:scale-90 disabled:cursor-not-allowed disabled:opacity-40',
            active
              ? 'border border-primary/40 bg-primary text-primary-foreground shadow-lg ring-1 ring-primary/30'
              : 'bg-card/90 text-foreground hover:bg-foreground hover:text-background dark:hover:bg-background dark:hover:text-foreground',
            className
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="left"
        sideOffset={8}
        className="z-[80] border border-border bg-foreground text-background dark:bg-background dark:text-foreground"
      >
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

/** Props for {@link SwatchButton}. */
export type SwatchButtonProps = {
  active: boolean
  background: string
  label: string
  onClick: () => void
  tooltipState: TooltipState
  setTooltipState: React.Dispatch<React.SetStateAction<TooltipState>>
}

/**
 * Renders one colour swatch button with the same tooltip controller used by toolbar icons.
 * Expects the swatch background, label, active state, click handler, and shared tooltip state.
 */
export function SwatchButton({ active, background, label, onClick, tooltipState, setTooltipState }: SwatchButtonProps) {
  const isTooltipOpen = tooltipState.label === label

  return (
    <Tooltip open={isTooltipOpen}>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          onPointerEnter={() => setTooltipState({ label, pinned: false })}
          onPointerLeave={() => {
            setTooltipState((current) =>
              current.label === label && !current.pinned ? { label: null, pinned: false } : current
            )
          }}
          onFocus={() => setTooltipState({ label, pinned: false })}
          onBlur={() => {
            setTooltipState((current) =>
              current.label === label && !current.pinned ? { label: null, pinned: false } : current
            )
          }}
          onMouseDown={() => setTooltipState({ label, pinned: true })}
          aria-label={label}
          className={cn(
            'relative z-20 h-8 w-8 rounded-md shadow-md transition-all active:scale-90',
            active ? 'outline outline-1 outline-foreground' : ''
          )}
          style={{ background }}
          title={label}
        />
      </TooltipTrigger>
      <TooltipContent
        side="left"
        sideOffset={8}
        className="border border-border bg-foreground text-background dark:bg-background dark:text-foreground"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
