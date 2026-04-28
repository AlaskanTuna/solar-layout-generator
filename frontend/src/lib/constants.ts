/** Canonical color tokens for charts, overlays, legends, and PDF exports. */
export const COLORS = {
  chartBaseline: '#ea580c',
  chartSolar: '#16a34a',
  chartCumulative: '#ca8a04',
  chartGrid: '#e5e7eb',
  chartTick: '#78716c',
  chartCursor: '#f5f5f4',
  chartBorder: '#e5e7eb',
  chartLabel: '#1c1917',

  selectionCyan: '#22d3ee',

  overlayRgb: 'linear-gradient(135deg, #a7f3d0, #93c5fd, #c4b5fd, #fda4af)',
  overlayFlux: 'linear-gradient(135deg, #1e1b4b, #7e22ce, #f472b6, #fde68a, #fefce8)',
  overlayDsm: 'linear-gradient(135deg, #bfdbfe, #a5f3fc, #bbf7d0, #fef08a, #fecaca)',
  overlayMask: 'linear-gradient(135deg, #064e3b, #059669, #34d399, #d1fae5)',
  overlaySegments: 'linear-gradient(135deg, #f59e0b, #06b6d4, #8b5cf6, #ef4444)',

  legendFlux: 'linear-gradient(to bottom, #ffffff, #fadc32, #dc1e1e, #800080, #000000)',
  legendDsm: 'linear-gradient(to bottom, #dc0000, #f0f000, #00c800, #00b4dc, #0000b4)',

  pdfBaselineFill: '#ea580c',
  pdfSolarFill: '#16a34a'
} as const

type ThemeMode = 'light' | 'dark'

/**
 * Builds the Recharts `<Tooltip>` style props for the active theme.
 *
 * @param theme - Resolved color scheme; `'dark'` swaps to dark surfaces and stronger shadow
 * @returns Object with `contentStyle`, `labelStyle`, and `cursor` props ready to spread onto `<Tooltip>`
 */
export function getChartTooltipStyle(theme: ThemeMode) {
  const isDark = theme === 'dark'

  return {
    contentStyle: {
      borderRadius: '8px',
      border: `1px solid ${isDark ? '#44403c' : COLORS.chartBorder}`,
      backgroundColor: isDark ? '#1c1917' : '#ffffff',
      color: isDark ? '#fafaf9' : '#1c1917',
      boxShadow: isDark ? '0 8px 24px -6px rgb(0 0 0 / 0.45)' : '0 4px 6px -1px rgb(0 0 0 / 0.1)'
    },
    labelStyle: {
      color: isDark ? '#fafaf9' : COLORS.chartLabel,
      fontWeight: 600,
      paddingBottom: '4px'
    },
    cursor: {
      fill: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'
    }
  } as const
}

/** Light-theme chart tooltip style. Prefer {@link getChartTooltipStyle} when theme is dynamic. */
export const CHART_TOOLTIP_STYLE = getChartTooltipStyle('light')
