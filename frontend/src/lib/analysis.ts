export {
  DEFAULT_ANNUAL_MAINTENANCE_RM,
  DEFAULT_INVERTER_REPLACEMENT,
  parseSavedAnalysisConfig,
  type AnalysisConfig,
  type AnalysisMode,
  type ConnectionPhase,
  type ConsumptionProfile,
  type InverterReplacement
} from './analysis/config'
export {
  aggregateMonthlyGeneration,
  applyPerformanceRatio,
  applySeasonalProfile,
  azimuthToCompass,
  buildMonthlyBillChartData,
  isSeasonalProfile,
  MONTH_LABELS,
  SEASONAL_MULTIPLIERS,
  summarizeLayoutOrientation,
  type AnalysisChartDataPoint,
  type LayoutOrientationSummary
} from './analysis/presentation'
export {
  buildNetBenefitSeries,
  computeDegradedSavings,
  normalizeInverterReplacements,
  type NetBenefitPoint
} from './analysis/projections'
export {
  buildAnalysisResults,
  buildThresholdWarnings,
  classifyNemFit,
  computeNemFitMetrics,
  type AnalysisResultsRecord,
  type NemFit,
  type NemFitClassification,
  type NemFitMetrics
} from './analysis/results'

/**
 * i18n keys identifying each analysis-page disclaimer paragraph.
 * Render via `t(\`page8.disclaimers.\${key}\`)` so the on-screen + PDF copy stay in sync across locales.
 */
export const ANALYSIS_DISCLAIMER_KEYS = [
  'tnbTariff',
  'afaRate',
  'eeiRebate',
  'solarGeneration',
  'creditForfeiture',
  'systemCost',
  'paybackProjections'
] as const

/** Union of every key in {@link ANALYSIS_DISCLAIMER_KEYS}. */
export type AnalysisDisclaimerKey = (typeof ANALYSIS_DISCLAIMER_KEYS)[number]
