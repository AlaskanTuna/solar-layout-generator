import type { TooltipProps } from 'recharts'
import { formatTooltipCurrency } from './formatters'

type TooltipEntry = NonNullable<TooltipProps<number, string>['payload']>[number]

type ChartTooltipContentProps = TooltipProps<number, string> & {
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
    <div className="space-y-1">
      {label !== undefined ? <p className="text-xs font-medium text-muted-foreground">{label}</p> : null}
      <div className="space-y-1">
        {payload.map((entry, index) => {
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
