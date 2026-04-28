import type { Prisma } from '@prisma/client'
import type { LayoutPreferences } from '@shared/types'
import { z } from 'zod'
import type { ImageGeoTransform } from '../geoTiffService.js'

const billBreakdownSchema = z.object({
  kwh: z.number(),
  energy: z.number(),
  capacity: z.number(),
  network: z.number(),
  retail: z.number(),
  afa: z.number(),
  eeiRebate: z.number(),
  preTaxSubtotal: z.number(),
  reFund: z.number(),
  sst: z.number(),
  total: z.number()
})

const monthlyBreakdownSchema = z.object({
  month: z.number().int().min(1).max(12),
  consumptionKwh: z.number(),
  generationKwh: z.number(),
  billableKwh: z.number(),
  creditUsed: z.number(),
  creditBalance: z.number(),
  creditForfeited: z.number(),
  baselineBill: billBreakdownSchema,
  nemBill: billBreakdownSchema,
  savingsRm: z.number()
})

const analysisConfigSchema = z
  .object({
    monthlyConsumptionKwh: z.number().optional(),
    connectionPhase: z.enum(['single', 'three']).optional(),
    systemCostRm: z.number().optional(),
    afaRateSenPerKwh: z.number().optional(),
    systemKwp: z.number().optional(),
    selectedPanelModelId: z.string().optional()
  })
  .passthrough()

const analysisResultsSchema = z
  .object({
    monthlyBreakdown: z.array(monthlyBreakdownSchema),
    annualTotals: z.object({
      totalConsumptionKwh: z.number(),
      totalGenerationKwh: z.number(),
      totalBaselineRm: z.number(),
      totalNemRm: z.number(),
      totalSavingsRm: z.number(),
      totalCreditsForfeitedKwh: z.number()
    }),
    averageMonthlySavingsRm: z.number(),
    averageMonthlySavingsPct: z.number(),
    paybackYears: z.number().nullable(),
    tenYearNetBenefitRm: z.number(),
    tenYearRoiPercent: z.number().nullable(),
    carbonOffsetKg: z.number(),
    activePanelCount: z.number().int().min(0)
  })
  .passthrough()

const layoutPreferencesSchema = z
  .object({
    billRange: z.enum(['<100', '100-200', '200-400', '400-600', '600+', 'unknown']).optional(),
    sizingGoal: z.enum(['conservative', 'balanced', 'maximum', 'custom']).optional(),
    roofDirection: z.enum(['any', 'south', 'east', 'west', 'north']).optional(),
    dismissedAt: z.string().datetime().optional()
  })
  .strict()

/**
 * Analysis config DTO used by project view models
 */
export type AnalysisConfigDto = z.infer<typeof analysisConfigSchema>
/**
 * Analysis results DTO used by project view models
 */
export type AnalysisResultsDto = z.infer<typeof analysisResultsSchema>
/**
 * Partial layout preferences DTO used by project view models
 */
export type LayoutPreferencesDto = Partial<LayoutPreferences>
/**
 * Projects shape containing JSON-backed fields
 */
export type JsonFieldsProject = {
  analysisConfig: Prisma.JsonValue | null
  analysisResults: Prisma.JsonValue | null
  layoutPreferences: Prisma.JsonValue | null
}
/**
 * Projects payload enriched for PDF
 */
export type PdfProjectResponse<TProject extends JsonFieldsProject> = TProject & {
  rgbSignedUrl: string | null
  imageGeoTransform: ImageGeoTransform | null
}

function isJsonObject(value: unknown): value is Prisma.JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseWithSchema<T>(value: unknown, schema: z.ZodType<T>): T | null {
  const parsed = schema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/**
 * Parses analysis config JSON
 * @param {unknown} value - Value to process
 * @returns {Object} The parsed analysis config
 */
export function parseAnalysisConfig(value: unknown): AnalysisConfigDto | null {
  return parseWithSchema(value, analysisConfigSchema)
}

/**
 * Parses analysis results JSON
 * @param {unknown} value - Value to process
 * @returns {Object} The parsed analysis results
 */
export function parseAnalysisResults(value: unknown): AnalysisResultsDto | null {
  return parseWithSchema(value, analysisResultsSchema)
}

/**
 * Parses layout preferences JSON
 * @param {unknown} value - Value to process
 * @returns {Object} The parsed layout preferences
 */
export function parseLayoutPreferences(value: unknown): LayoutPreferencesDto {
  const parsed = parseWithSchema(value, layoutPreferencesSchema)
  return parsed ?? {}
}

/**
 * Merges analysis config updates into stored JSON
 * @param {unknown} existingValue - Value used for existing value
 * @param {AnalysisConfigDto} nextValue - Value used for next value
 * @returns {Object} The merged analysis config
 */
export function mergeAnalysisConfig(
  existingValue: unknown,
  nextValue: AnalysisConfigDto
): AnalysisConfigDto {
  const existing = parseAnalysisConfig(existingValue)
  return existing ? { ...existing, ...nextValue } : nextValue
}

/**
 * Merges layout preference updates into stored JSON
 * @param {unknown} existingValue - Value used for existing value
 * @param {LayoutPreferencesDto} partial - Partial values to merge into the record
 * @returns {Object} The merged layout preferences
 */
export function mergeLayoutPreferences(
  existingValue: unknown,
  partial: LayoutPreferencesDto
): LayoutPreferencesDto {
  return { ...parseLayoutPreferences(existingValue), ...partial }
}

/**
 * Serializes a value for Prisma JSON columns
 * @param {unknown} value - Value to process
 * @returns {InputJsonValue} The serialized json value
 */
export function serializeJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

/**
 * Normalizes a project row before returning it to callers
 * @param {TProject} project - Project record to process
 * @returns {TProject} The normalized project response
 */
export function normalizeProjectResponse<TProject extends JsonFieldsProject>(project: TProject): TProject {
  const analysisConfig = isJsonObject(project.analysisConfig) ? project.analysisConfig : project.analysisConfig
  const analysisResults = isJsonObject(project.analysisResults) ? project.analysisResults : project.analysisResults
  const layoutPreferences = isJsonObject(project.layoutPreferences)
    ? project.layoutPreferences
    : project.layoutPreferences

  return {
    ...project,
    analysisConfig,
    analysisResults,
    layoutPreferences
  }
}

/**
 * Builds a PDF-ready project payload
 * @param {JsonFieldsProject} project - Project record to process
 * @param {string | null} rgbSignedUrl - Rgb signed url value
 * @param {ImageGeoTransform | null} imageGeoTransform - Value used for image geo transform
 * @returns {PdfProjectResponse<JsonFieldsProject>} The built pdf project response
 */
export function buildPdfProjectResponse(
  project: JsonFieldsProject,
  rgbSignedUrl: string | null,
  imageGeoTransform: ImageGeoTransform | null
): PdfProjectResponse<typeof project> {
  return {
    ...normalizeProjectResponse(project),
    rgbSignedUrl,
    imageGeoTransform
  }
}
