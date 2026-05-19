/**
 * Project view-model helpers.
 *
 * The Project row in Prisma stores three columns as opaque JSON (analysis
 * config, analysis results, layout preferences). This module centralises:
 *   - Zod schemas that describe the shape we expect inside those JSON columns,
 *     specialised for Malaysian NEM tariff data.
 *   - Parse / merge / serialise helpers used by `projectService` when reading
 *     and writing those columns.
 *   - Response shape builders (`normalizeProjectResponse`, `buildPdfProjectResponse`)
 *     used by route handlers and the PDF data endpoint.
 *
 * Domain note: the bill breakdown fields (`afa`, `eeiRebate`, `reFund`, `sst`)
 * come from the Malaysian NEM 3.0 / "Tariff Rakyat" structure. See `billingEngine.ts`
 * and `docs/TRD.md` for the full tariff calculation that produces these values.
 */

import type { Prisma } from '@prisma/client'
import type { LayoutPreferences } from '@shared/types'
import { z } from 'zod'
import type { ImageGeoTransform } from '../geoTiffService.js'

/**
 * Shape of a single billing breakdown record (one period — either the
 * baseline pre-solar bill or the NEM post-solar bill).
 *
 * Fields:
 *   - `kwh`            — billed energy in kWh (after credit offset, if any)
 *   - `energy`         — energy charge in RM
 *   - `capacity`       — capacity charge in RM (NEM 3.0 component)
 *   - `network`        — network charge in RM (NEM 3.0 component)
 *   - `retail`         — fixed retail charge in RM
 *   - `afa`            — Automatic Fuel Adjustment in RM (positive = surcharge)
 *   - `eeiRebate`      — Energy Efficiency Incentive rebate in RM (subtracted)
 *   - `preTaxSubtotal` — subtotal before reFund + SST
 *   - `reFund`         — Renewable Energy fund levy in RM (1.6% above threshold)
 *   - `sst`            — Sales & Service Tax in RM (above the exemption cliff)
 *   - `total`          — final billable amount in RM
 */
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

/**
 * One month of NEM simulation output, including both the baseline (pre-solar)
 * and NEM (post-solar) bills for side-by-side comparison.
 *
 * `creditUsed` / `creditBalance` / `creditForfeited` track the NEM credit
 * carry-over: surplus generation rolls into next month, but unused credit
 * forfeits at year end (Malaysian NEM 3.0 rule).
 */
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

/**
 * Persisted analysis inputs. All fields optional because older project rows
 * may have been written before any one of them existed; `.passthrough()` keeps
 * forward-compatible fields the frontend may have added.
 */
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

/**
 * Persisted analysis outputs (12-month breakdown plus annual rollups and
 * payback metrics). `.passthrough()` preserves fields added by newer
 * simulation versions without invalidating older rows.
 */
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

/**
 * Frontend-supplied sizing hints (bill range, sizing goal, roof direction).
 * `.strict()` here because the layout-preferences modal is the only writer
 * and we want unknown fields to fail loudly.
 */
const layoutPreferencesSchema = z
  .object({
    billRange: z.enum(['<100', '100-200', '200-400', '400-600', '600+', 'unknown']).optional(),
    sizingGoal: z.enum(['conservative', 'balanced', 'maximum', 'custom']).optional(),
    roofDirection: z.enum(['any', 'south', 'east', 'west', 'north']).optional(),
    dismissedAt: z.string().datetime().optional()
  })
  .strict()

/** DTO inferred from `analysisConfigSchema` */
export type AnalysisConfigDto = z.infer<typeof analysisConfigSchema>
/** DTO inferred from `analysisResultsSchema` */
export type AnalysisResultsDto = z.infer<typeof analysisResultsSchema>
/** Partial layout preferences accepted by the update endpoint */
export type LayoutPreferencesDto = Partial<LayoutPreferences>

/**
 * Minimum project shape `normalizeProjectResponse` operates on: the three
 * JSON columns it touches. Extended by callers via the `TProject` generic.
 */
export type JsonFieldsProject = {
  analysisConfig: Prisma.JsonValue | null
  analysisResults: Prisma.JsonValue | null
  layoutPreferences: Prisma.JsonValue | null
}

/**
 * Project response shape used by the PDF endpoint, with the signed RGB image
 * URL and the GeoTIFF transform parameters needed to project panel positions
 * onto the rendered image.
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
 * Parses a raw Prisma JSON value into a typed `AnalysisConfigDto`.
 * Returns `null` if the value fails the schema (older rows, corruption).
 */
export function parseAnalysisConfig(value: unknown): AnalysisConfigDto | null {
  return parseWithSchema(value, analysisConfigSchema)
}

/**
 * Parses a raw Prisma JSON value into a typed `AnalysisResultsDto`.
 * Returns `null` if the value fails the schema (older rows, corruption).
 */
export function parseAnalysisResults(value: unknown): AnalysisResultsDto | null {
  return parseWithSchema(value, analysisResultsSchema)
}

/**
 * Parses a raw Prisma JSON value into a partial `LayoutPreferences` object.
 * Returns `{}` if the value is missing or malformed so callers can spread
 * the result unconditionally.
 */
export function parseLayoutPreferences(value: unknown): LayoutPreferencesDto {
  const parsed = parseWithSchema(value, layoutPreferencesSchema)
  return parsed ?? {}
}

/**
 * Merges a partial config update into the existing stored analysis config.
 * The existing value is parsed first so corrupt rows get replaced wholesale
 * rather than half-merged.
 */
export function mergeAnalysisConfig(existingValue: unknown, nextValue: AnalysisConfigDto): AnalysisConfigDto {
  const existing = parseAnalysisConfig(existingValue)
  return existing ? { ...existing, ...nextValue } : nextValue
}

/**
 * Merges a partial layout-preferences update into the existing stored value.
 * Missing or corrupt existing rows resolve to `{}`, so the update always
 * succeeds.
 */
export function mergeLayoutPreferences(existingValue: unknown, partial: LayoutPreferencesDto): LayoutPreferencesDto {
  return { ...parseLayoutPreferences(existingValue), ...partial }
}

/**
 * Round-trips a value through JSON to coerce it into a Prisma-compatible
 * `InputJsonValue`. Strips class instances, undefined, and other non-JSON
 * artefacts that Prisma's JSON column would otherwise reject.
 */
export function serializeJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

/**
 * Response-boundary wrapper for project rows.
 *
 * NOTE: currently a pass-through that shallow-copies the project — both
 * branches of each `isJsonObject` ternary return the same value. It exists as
 * the single place to add response-time JSON normalisation (e.g. dropping
 * stale fields, migrating schema versions) without touching every service
 * function. Left in place rather than inlined so future normalisation logic
 * has an obvious home.
 *
 * @param project - Project row from Prisma
 * @returns A shallow copy of `project` (currently identical in shape)
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
 * Builds the PDF endpoint's project payload by running the project row through
 * `normalizeProjectResponse` and attaching the signed RGB image URL plus the
 * GeoTIFF transform parameters needed by the PDF renderer.
 *
 * @param project - Project row from Prisma
 * @param rgbSignedUrl - Time-limited signed URL for the RGB image, or `null`
 * @param imageGeoTransform - Pixel-to-latlng transform, or `null` if unavailable
 * @returns PDF-ready project response
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
