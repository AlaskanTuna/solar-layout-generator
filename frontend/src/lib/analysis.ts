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
  type AnalysisResultsRecord,
  type NemFit,
  type NemFitClassification
} from './analysis/results'

export const ANALYSIS_DISCLAIMER_KEYS = [
  'tnbTariff',
  'afaRate',
  'eeiRebate',
  'solarGeneration',
  'creditForfeiture',
  'systemCost',
  'paybackProjections'
] as const

export type AnalysisDisclaimerKey = (typeof ANALYSIS_DISCLAIMER_KEYS)[number]
