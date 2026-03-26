/** Centralized color tokens used across pages and charts. */
export const COLORS = {
  // Chart colors
  chartBaseline: '#ea580c',
  chartSolar: '#16a34a',
  chartCumulative: '#ca8a04',
  chartGrid: '#e5e7eb',
  chartTick: '#78716c',
  chartCursor: '#f5f5f4',
  chartBorder: '#e5e7eb',
  chartLabel: '#1c1917',

  // Canvas / workbench
  selectionCyan: '#22d3ee',

  // Overlay swatch gradients (Workbench canvas controls)
  overlayRgb: 'linear-gradient(135deg, #a7f3d0, #93c5fd, #c4b5fd, #fda4af)',
  overlayFlux: 'linear-gradient(135deg, #1e1b4b, #7e22ce, #f472b6, #fde68a, #fefce8)',
  overlayDsm: 'linear-gradient(135deg, #bfdbfe, #a5f3fc, #bbf7d0, #fef08a, #fecaca)',
  overlayMask: 'linear-gradient(135deg, #064e3b, #059669, #34d399, #d1fae5)',
  overlaySegments: 'linear-gradient(135deg, #f59e0b, #06b6d4, #8b5cf6, #ef4444)',

  // Legend color ramps
  legendFlux: 'linear-gradient(to bottom, #ffffff, #fadc32, #dc1e1e, #800080, #000000)',
  legendDsm: 'linear-gradient(to bottom, #dc0000, #f0f000, #00c800, #00b4dc, #0000b4)',

  // PDF report
  pdfBaselineFill: '#ea580c',
  pdfSolarFill: '#16a34a'
} as const

/** Shared Recharts tooltip style config. */
export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: '8px',
    border: `1px solid ${COLORS.chartBorder}`,
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
  },
  labelStyle: { color: COLORS.chartLabel, fontWeight: 600, paddingBottom: '4px' },
  cursor: { fill: COLORS.chartCursor }
} as const
