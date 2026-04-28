import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartTooltipContent } from '@/components/analysis/ChartTooltipContent'
import { formatCurrency } from '@/components/analysis/formatters'
import { getChartTooltipStyle } from '@/lib/constants'
import { SummaryTile } from './PdfSummaryCards'
import type { CostBreakdown, RoofType } from '@shared/types'

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

export function PdfSystemCost({
  costBreakdown,
  activePanelCount,
  panelCapacityWp,
  panelCostPerWp,
  roofType,
  tooltipStyle,
  assumptionTiles
}: {
  costBreakdown: CostBreakdown
  activePanelCount: number
  panelCapacityWp: number
  panelCostPerWp: number
  roofType: RoofType
  tooltipStyle: ReturnType<typeof getChartTooltipStyle>
  assumptionTiles: { label: string; value: string; detail?: string }[]
}) {
  const { t } = useTranslation('pdf')

  const segments = useMemo<Segment[]>(() => {
    const roofLabel = t(`page5.systemCost.roofLabels.${roofType}` as const) ?? roofType
    const items: Segment[] = [
      {
        key: 'panels',
        name: t('page5.systemCost.segments.panels'),
        detail: `${activePanelCount} × ${panelCapacityWp} Wp @ RM ${panelCostPerWp.toFixed(2)}/Wp`,
        value: costBreakdown.panels,
        color: SEGMENT_COLORS.panels
      },
      {
        key: 'inverter',
        name: t('page5.systemCost.segments.inverter'),
        detail: `${costBreakdown.inverterSku} · ${costBreakdown.inverterKwac} kWac`,
        value: costBreakdown.inverter,
        color: SEGMENT_COLORS.inverter
      },
      {
        key: 'mounting',
        name: t('page5.systemCost.segments.mounting'),
        detail: `${roofLabel} Roof`,
        value: costBreakdown.mounting,
        color: SEGMENT_COLORS.mounting
      },
      {
        key: 'electricalBos',
        name: t('page5.systemCost.segments.electricalBos'),
        detail: t('page5.systemCost.segments.electricalBosDetail'),
        value: costBreakdown.electricalBos,
        color: SEGMENT_COLORS.electricalBos
      }
    ]

    if (costBreakdown.scaffolding > 0) {
      items.push({
        key: 'scaffolding',
        name: t('page5.systemCost.segments.scaffolding'),
        detail: t('page5.systemCost.segments.scaffoldingDetail'),
        value: costBreakdown.scaffolding,
        color: SEGMENT_COLORS.scaffolding
      })
    }

    items.push({
      key: 'permit',
      name: t('page5.systemCost.segments.permit'),
      detail: costBreakdown.cccFeeTriggered
        ? t('page5.systemCost.segments.permitCcc')
        : t('page5.systemCost.segments.permitSeda'),
      value: costBreakdown.permit,
      color: SEGMENT_COLORS.permit
    })
    items.push({
      key: 'labour',
      name: t('page5.systemCost.segments.labour'),
      detail: t('page5.systemCost.segments.labourDetail'),
      value: costBreakdown.labour,
      color: SEGMENT_COLORS.labour
    })
    items.push({
      key: 'installerMargin',
      name: t('page5.systemCost.segments.installerMargin'),
      detail: t('page5.systemCost.segments.installerMarginDetail'),
      value: costBreakdown.installerMargin,
      color: SEGMENT_COLORS.installerMargin
    })

    return items
  }, [activePanelCount, costBreakdown, panelCapacityWp, panelCostPerWp, roofType, t])

  return (
    <Card className="border-border bg-card/90 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm">{t('page5.systemCost.title')}</CardTitle>
            <CardDescription className="text-xs">{t('page5.systemCost.description')}</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold text-foreground tabular-nums">{formatCurrency(costBreakdown.total)}</p>
            <p className="text-[9px] text-muted-foreground">{t('page5.systemCost.quoteVariance')}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pb-3">
        <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)] items-center gap-4">
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  {(Object.keys(SEGMENT_COLORS) as (keyof typeof SEGMENT_COLORS)[]).map((key) => (
                    <linearGradient key={key} id={`pdfSystemCost-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={SEGMENT_COLORS[key]} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={SEGMENT_COLORS[key]} stopOpacity={0.05} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie data={segments} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={38} outerRadius={65} paddingAngle={0}>
                  {segments.map((segment) => (
                    <Cell key={segment.key} fill={`url(#pdfSystemCost-${segment.key})`} stroke={segment.color} strokeWidth={1.5} />
                  ))}
                </Pie>
                <Tooltip
                  cursor={tooltipStyle.cursor}
                  contentStyle={tooltipStyle.contentStyle}
                  labelStyle={tooltipStyle.labelStyle}
                  content={<ChartTooltipContent />}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-0.5 text-[10px]">
            {segments.map((segment) => {
              const rawPercent = (segment.value / costBreakdown.total) * 100
              const percent = Number.isFinite(rawPercent) ? rawPercent : 0

              return (
                <li key={segment.key} className="flex items-start gap-2">
                  <span
                    className="mt-1 inline-block h-2 w-2 flex-shrink-0 rounded-sm"
                    style={{ backgroundColor: segment.color }}
                    aria-hidden="true"
                  />
                  <div className="flex flex-1 items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{segment.name}</p>
                      <p className="truncate text-[9px] text-muted-foreground">{segment.detail}</p>
                    </div>
                    <div className="text-right tabular-nums">
                      <p className="font-semibold text-foreground">{formatCurrency(segment.value)}</p>
                      <p className="text-[9px] text-muted-foreground">{percent.toFixed(0)}%</p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
        <p className="text-[9px] text-muted-foreground">{t('page5.systemCost.pricingNote')}</p>
        <div className="border-t border-border pt-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('page5.assumptions.sectionTitle')}
          </p>
          <div className="grid grid-cols-6 gap-1.5">
            {assumptionTiles.map((tile) => (
              <SummaryTile key={tile.label} {...tile} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
