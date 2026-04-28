/**
 * Re-exports shared helpers
 */
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
/**
 * Re-exports shared helpers
 */
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
/**
 * Re-exports shared helpers
 */
export {
  buildNetBenefitSeries,
  computeDegradedSavings,
  normalizeInverterReplacements,
  type NetBenefitPoint
} from './analysis/projections'
/**
 * Re-exports shared helpers
 */
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
 * Defines the ANALYSIS_DISCLAIMER_KEYS constant
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

/**
 * Defines the AnalysisDisclaimerKey type
 */
export type AnalysisDisclaimerKey = (typeof ANALYSIS_DISCLAIMER_KEYS)[number]
