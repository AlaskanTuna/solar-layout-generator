import type { TooltipProps } from 'recharts'
import { formatTooltipCurrency } from './formatters'

type TooltipEntry = {
  dataKey?: string | number
  name?: string
  value?: number
  color?: string
}

type ChartTooltipContentProps = {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
  getItemClassName?: (entry: TooltipEntry, index: number) => string
  valueFormatter?: (value: unknown) => string
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  getItemClassName,
  valueFormatter = formatTooltipCurrency
}: ChartTooltipContentProps) {
  if (!active || !payload?.length) return null

  return (
    <div className="min-w-[180px] space-y-1 rounded-md border border-border bg-background/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      {label !== undefined ? <p className="text-xs font-medium text-muted-foreground">{String(label)}</p> : null}
      <div className="space-y-1">
        {payload.map((entry: TooltipEntry, index: number) => {
          const itemClassName = getItemClassName?.(entry, index) ?? 'font-semibold text-foreground'
          const key = String(entry.dataKey ?? entry.name ?? index)

          return (
            <div key={key} className="flex items-center justify-between gap-6 text-xs">
              <span className={itemClassName}>{entry.name}</span>
              <span className="font-medium text-foreground">{valueFormatter(entry.value)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
