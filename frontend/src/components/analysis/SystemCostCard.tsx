import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { useTheme } from '@/hooks/useTheme'
import { getChartTooltipStyle } from '@/lib/constants'
import { ChartTooltipContent } from './ChartTooltipContent'
import { formatCurrency } from './formatters'
import type { CostBreakdown, RoofType } from '@shared/types'

type SystemCostCardProps = {
  costBreakdown: CostBreakdown | null
  activePanelCount: number
  panelCapacityWp: number
  panelCostPerWp: number
  roofType: RoofType
}

const ROOF_LABEL: Record<RoofType, string> = { tile: 'tile', metal: 'metal', flat: 'flat' }

type Segment = { key: string; name: string; detail: string; value: number; color: string }

const SEGMENT_COLORS = {
  panels: '#16a34a',
  inverter: '#2563eb',
  mounting: '#9333ea',
  electricalBos: '#ea580c',
  scaffolding: '#db2777',
  permit: '#0891b2',
  labour: '#ca8a04',
  installerMargin: '#475569'
} as const

export function SystemCostCard({
  costBreakdown,
  activePanelCount,
  panelCapacityWp,
  panelCostPerWp,
  roofType
}: SystemCostCardProps) {
  const { resolved } = useTheme()
  const chartTooltipStyle = getChartTooltipStyle(resolved)

  const segments = useMemo<Segment[]>(() => {
    if (!costBreakdown) return []
    const items: Segment[] = [
      {
        key: 'panels',
        name: 'Panels',
        detail: `${activePanelCount} × ${panelCapacityWp} Wp @ RM ${panelCostPerWp.toFixed(2)}/Wp`,
        value: costBreakdown.panels,
        color: SEGMENT_COLORS.panels
      },
      {
        key: 'inverter',
        name: 'Inverter',
        detail: `${costBreakdown.inverterSku} · ${costBreakdown.inverterKwac} kWac`,
        value: costBreakdown.inverter,
        color: SEGMENT_COLORS.inverter
      },
      {
        key: 'mounting',
        name: 'Mounting',
        detail: `${ROOF_LABEL[roofType]} roof`,
        value: costBreakdown.mounting,
        color: SEGMENT_COLORS.mounting
      },
      {
        key: 'electricalBos',
        name: 'Electrical BOS',
        detail: 'Wiring, protection',
        value: costBreakdown.electricalBos,
        color: SEGMENT_COLORS.electricalBos
      }
    ]
    if (costBreakdown.scaffolding > 0) {
      items.push({
        key: 'scaffolding',
        name: 'Scaffolding',
        detail: 'Tile roof only',
        value: costBreakdown.scaffolding,
        color: SEGMENT_COLORS.scaffolding
      })
    }
    items.push({
      key: 'permit',
      name: 'Permit',
      detail: costBreakdown.cccFeeTriggered ? 'Incl. CCC fee' : 'SEDA registration',
      value: costBreakdown.permit,
      color: SEGMENT_COLORS.permit
    })
    items.push({
      key: 'labour',
      name: 'Labour',
      detail: '+18% of hardware',
      value: costBreakdown.labour,
      color: SEGMENT_COLORS.labour
    })
    items.push({
      key: 'installerMargin',
      name: 'Installer margin',
      detail: '+15% of hardware + labour',
      value: costBreakdown.installerMargin,
      color: SEGMENT_COLORS.installerMargin
    })
    return items
  }, [costBreakdown, activePanelCount, panelCapacityWp, panelCostPerWp, roofType])

  if (!costBreakdown) {
    return (
      <Card className="border-border bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle>System Cost</CardTitle>
          <CardDescription>Add panels on the Workbench to estimate installation cost.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="border-border bg-card/90 shadow-sm">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>
              System Cost
              <InfoTooltip text="Bottom-up turnkey estimate based on general residential solar cost model in Malaysia. Covers panels, inverter, mounting, electrical BOS, permits, labour and installer margin." />
            </CardTitle>
            <CardDescription>Estimated total turnkey installation cost.</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-3xl font-semibold text-foreground tabular-nums">{formatCurrency(costBreakdown.total)}</p>
            <p className="text-xs text-muted-foreground">±10% typical quote variance</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={segments}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={92}
                  paddingAngle={1.5}
                  stroke="transparent"
                >
                  {segments.map((segment) => (
                    <Cell key={segment.key} fill={segment.color} />
                  ))}
                </Pie>
                <Tooltip
                  cursor={chartTooltipStyle.cursor}
                  contentStyle={chartTooltipStyle.contentStyle}
                  labelStyle={chartTooltipStyle.labelStyle}
                  content={<ChartTooltipContent />}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1.5">
            {segments.map((segment) => {
              const rawPercent = (segment.value / costBreakdown.total) * 100
              const percent = Number.isFinite(rawPercent) ? rawPercent : 0
              return (
                <li key={segment.key} className="flex items-start gap-3 text-sm">
                  <span
                    className="mt-1.5 inline-block h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                    style={{ backgroundColor: segment.color }}
                    aria-hidden="true"
                  />
                  <div className="flex flex-1 items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{segment.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{segment.detail}</p>
                    </div>
                    <div className="text-right tabular-nums">
                      <p className="font-semibold text-foreground">{formatCurrency(segment.value)}</p>
                      <p className="text-xs text-muted-foreground">{percent.toFixed(0)}%</p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Mid-tier pricing from Solar ATAP (2026). Actual installer quotes typically land within ±10% of this figure.
        </p>
      </CardContent>
    </Card>
  )
}
