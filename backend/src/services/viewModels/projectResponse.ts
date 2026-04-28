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

export type AnalysisConfigDto = z.infer<typeof analysisConfigSchema>
export type AnalysisResultsDto = z.infer<typeof analysisResultsSchema>
export type LayoutPreferencesDto = Partial<LayoutPreferences>
export type JsonFieldsProject = {
  analysisConfig: Prisma.JsonValue | null
  analysisResults: Prisma.JsonValue | null
  layoutPreferences: Prisma.JsonValue | null
}
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

export function parseAnalysisConfig(value: unknown): AnalysisConfigDto | null {
  return parseWithSchema(value, analysisConfigSchema)
}

export function parseAnalysisResults(value: unknown): AnalysisResultsDto | null {
  return parseWithSchema(value, analysisResultsSchema)
}

export function parseLayoutPreferences(value: unknown): LayoutPreferencesDto {
  const parsed = parseWithSchema(value, layoutPreferencesSchema)
  return parsed ?? {}
}

export function mergeAnalysisConfig(
  existingValue: unknown,
  nextValue: AnalysisConfigDto
): AnalysisConfigDto {
  const existing = parseAnalysisConfig(existingValue)
  return existing ? { ...existing, ...nextValue } : nextValue
}

export function mergeLayoutPreferences(
  existingValue: unknown,
  partial: LayoutPreferencesDto
): LayoutPreferencesDto {
  return { ...parseLayoutPreferences(existingValue), ...partial }
}

export function serializeJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

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
