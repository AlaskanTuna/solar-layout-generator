import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
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

type Segment = { key: string; name: string; detail: string; value: number; color: string }

/**
 * Renders the systemcost card
 * @param {SystemCostCardProps} props - Props for the component
 */
export function SystemCostCard({
  costBreakdown,
  activePanelCount,
  panelCapacityWp,
  panelCostPerWp,
  roofType
}: SystemCostCardProps) {
  const { t } = useTranslation('analysis')
  const { resolved } = useTheme()
  const chartTooltipStyle = getChartTooltipStyle(resolved)

  const segments = useMemo<Segment[]>(() => {
    if (!costBreakdown) return []
    const items: Segment[] = [
      {
        key: 'panels',
        name: t('systemCost.segments.panels'),
        detail: `${activePanelCount} × ${panelCapacityWp} Wp @ RM ${panelCostPerWp.toFixed(2)}/Wp`,
        value: costBreakdown.panels,
        color: SEGMENT_COLORS.panels
      },
      {
        key: 'inverter',
        name: t('systemCost.segments.inverter'),
        detail: `${costBreakdown.inverterSku} · ${costBreakdown.inverterKwac} kWac`,
        value: costBreakdown.inverter,
        color: SEGMENT_COLORS.inverter
      },
      {
        key: 'mounting',
        name: t('systemCost.segments.mounting'),
        detail: `${t(`systemCost.roofLabels.${roofType}`)} Roof`,
        value: costBreakdown.mounting,
        color: SEGMENT_COLORS.mounting
      },
      {
        key: 'electricalBos',
        name: t('systemCost.segments.electricalBos'),
        detail: t('systemCost.segments.electricalBosDetail'),
        value: costBreakdown.electricalBos,
        color: SEGMENT_COLORS.electricalBos
      }
    ]
    if (costBreakdown.scaffolding > 0) {
      items.push({
        key: 'scaffolding',
        name: t('systemCost.segments.scaffolding'),
        detail: t('systemCost.segments.scaffoldingDetail'),
        value: costBreakdown.scaffolding,
        color: SEGMENT_COLORS.scaffolding
      })
    }
    items.push({
      key: 'permit',
      name: t('systemCost.segments.permit'),
      detail: costBreakdown.cccFeeTriggered
        ? t('systemCost.segments.permitCcc')
        : t('systemCost.segments.permitSeda'),
      value: costBreakdown.permit,
      color: SEGMENT_COLORS.permit
    })
    items.push({
      key: 'labour',
      name: t('systemCost.segments.labour'),
      detail: t('systemCost.segments.labourDetail'),
      value: costBreakdown.labour,
      color: SEGMENT_COLORS.labour
    })
    items.push({
      key: 'installerMargin',
      name: t('systemCost.segments.installerMargin'),
      detail: t('systemCost.segments.installerMarginDetail'),
      value: costBreakdown.installerMargin,
      color: SEGMENT_COLORS.installerMargin
    })
    return items
  }, [costBreakdown, activePanelCount, panelCapacityWp, panelCostPerWp, roofType, t])

  if (!costBreakdown) {
    return (
      <Card className="border-border bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle>{t('systemCost.titleEmpty')}</CardTitle>
          <CardDescription>{t('systemCost.descriptionEmpty')}</CardDescription>
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
              {t('systemCost.title')}
              <InfoTooltip text={t('systemCost.titleTooltip')} />
            </CardTitle>
            <CardDescription>{t('systemCost.description')}</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-3xl font-semibold text-foreground tabular-nums">{formatCurrency(costBreakdown.total)}</p>
            <p className="text-xs text-muted-foreground">{t('systemCost.quoteVariance')}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  <linearGradient id="systemCostGradient-panels" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SEGMENT_COLORS.panels} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={SEGMENT_COLORS.panels} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="systemCostGradient-inverter" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SEGMENT_COLORS.inverter} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={SEGMENT_COLORS.inverter} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="systemCostGradient-mounting" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SEGMENT_COLORS.mounting} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={SEGMENT_COLORS.mounting} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="systemCostGradient-electricalBos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SEGMENT_COLORS.electricalBos} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={SEGMENT_COLORS.electricalBos} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="systemCostGradient-scaffolding" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SEGMENT_COLORS.scaffolding} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={SEGMENT_COLORS.scaffolding} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="systemCostGradient-permit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SEGMENT_COLORS.permit} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={SEGMENT_COLORS.permit} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="systemCostGradient-labour" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SEGMENT_COLORS.labour} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={SEGMENT_COLORS.labour} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="systemCostGradient-installerMargin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SEGMENT_COLORS.installerMargin} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={SEGMENT_COLORS.installerMargin} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <Pie
                  data={segments}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={92}
                  paddingAngle={0}
                >
                  {segments.map((segment) => (
                    <Cell
                      key={segment.key}
                      fill={`url(#systemCostGradient-${segment.key})`}
                      stroke={segment.color}
                      strokeWidth={2}
                    />
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
        <p className="mt-4 text-xs text-muted-foreground">{t('systemCost.pricingNote')}</p>
      </CardContent>
    </Card>
  )
}
