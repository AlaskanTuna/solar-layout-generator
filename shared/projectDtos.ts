/**
 * Project DTO schemas shared between backend and frontend.
 *
 * Defines Zod schemas for every payload the project endpoints accept or
 * persist, including building insights, analysis config, analysis results,
 * and the layout-preferences patches. The DTO types inferred from these
 * schemas are re-exported so the API client (frontend) and route handlers
 * (backend) agree on shape.
 *
 * Domain note: the bill-breakdown and tariff fields are specific to the
 * Malaysian NEM 3.0 / Tariff Rakyat structure. See `docs/TRD.md` for the
 * full tariff specification and `backend/src/services/billingEngine.ts`
 * (legacy) / `frontend/src/lib/billingEngine.ts` for the calculation that
 * produces these values.
 */

import { z } from 'zod'
import { layoutPreferencesPartialSchema } from './layoutPreferences.ts'
import { panelEditSchema } from './panelTypes.ts'

const latLngSchema = z.object({
  latitude: z.number().finite(),
  longitude: z.number().finite()
})

/**
 * Subset of the Google Solar API `buildingInsights` payload we validate before
 * storing. `.passthrough()` keeps the rest of Google's response intact (panels
 * list, roof segments, etc.) without us having to enumerate every nested key.
 */
export const buildingInsightsSchema = z
  .object({
    boundingBox: z.object({
      sw: latLngSchema,
      ne: latLngSchema
    }),
    solarPotential: z
      .object({
        panelWidthMeters: z.number().positive().finite(),
        panelHeightMeters: z.number().positive().finite(),
        panelCapacityWatts: z.number().positive().finite(),
        maxArrayPanelsCount: z.number().int().nonnegative().optional(),
        carbonOffsetFactorKgPerMwh: z.number().finite().optional(),
        panelLifetimeYears: z.number().finite().nullable().optional(),
        roofSegmentStats: z.array(z.object({}).passthrough()).optional(),
        solarPanels: z.array(z.object({}).passthrough()).optional()
      })
      .passthrough()
  })
  .passthrough()

/**
 * Per-tier and surcharge rates that drive the NEM tariff calculation.
 *
 * - `energyLow`       — energy charge below the tiered cliff (RM/kWh)
 * - `energyHigh`      — energy charge above the cliff (RM/kWh)
 * - `capacity`        — capacity charge (RM/kWh, NEM 3.0 component)
 * - `network`         — network charge (RM/kWh, NEM 3.0 component)
 * - `retailChargeRm`  — fixed retail service charge (RM)
 * - `sstRate`         — Sales & Service Tax fraction (e.g. 0.08)
 * - `reFundRate`      — Renewable Energy fund levy fraction (e.g. 0.016)
 * - `minChargeRm`     — minimum monthly bill in RM
 */
const tariffRatesSchema = z
  .object({
    energyLow: z.number(),
    energyHigh: z.number(),
    capacity: z.number(),
    network: z.number(),
    retailChargeRm: z.number(),
    sstRate: z.number(),
    reFundRate: z.number(),
    minChargeRm: z.number()
  })
  .strict()

/**
 * Single-period billing breakdown (either the baseline pre-solar bill or the
 * NEM post-solar bill for one month).
 *
 * - `kwh`            — billed energy in kWh (after credit offset)
 * - `energy`         — energy charge in RM (sum of low + high tiers)
 * - `capacity`       — capacity charge in RM
 * - `network`        — network charge in RM
 * - `retail`         — fixed retail charge in RM
 * - `afa`            — Automatic Fuel Adjustment in RM (signed)
 * - `eeiRebate`      — Energy Efficiency Incentive rebate (subtracted, positive value)
 * - `preTaxSubtotal` — subtotal before reFund + SST
 * - `reFund`         — Renewable Energy fund levy in RM
 * - `sst`            — Sales & Service Tax in RM (above the exemption cliff)
 * - `total`          — final billable amount in RM
 */
const billBreakdownSchema = z
  .object({
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
  .strict()

/**
 * One month of NEM simulation output.
 *
 * Holds the baseline (pre-solar) bill and the NEM (post-solar) bill
 * side-by-side, plus the credit accounting for that month: `creditUsed`
 * draws from the running balance, `creditBalance` is the new balance, and
 * `creditForfeited` is the kWh discarded at year end (Malaysian NEM rule:
 * surplus credits do not roll across the calendar year).
 */
const monthlyBreakdownSchema = z
  .object({
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
  .strict()

/**
 * A scheduled inverter replacement entry used by the lifecycle analysis mode.
 * Inverters typically last 10–15 years; the analysis page lets users plan
 * one or more replacements over the 25-year project lifetime.
 */
const inverterReplacementSchema = z
  .object({
    year: z.number().int().min(1),
    costRm: z.number().min(0)
  })
  .strict()

/**
 * Analysis configuration payload accepted by `PATCH /projects/:id/analysis`.
 *
 * Captures every user-tunable input on the analysis page: monthly consumption,
 * system sizing, tariff overrides, escalation/degradation rates, panel model,
 * and (when in lifecycle mode) maintenance and inverter replacement costs.
 * `.strict()` here because the analysis form is the only writer.
 */
export const analysisConfigSchema = z
  .object({
    monthlyConsumptionKwh: z.number(),
    connectionPhase: z.enum(['single', 'three']),
    roofType: z.enum(['metal', 'tile', 'flat']),
    systemCostRm: z.number(),
    afaRateSenPerKwh: z.number(),
    systemKwp: z.number(),
    degradationRate: z.number(),
    tariffEscalationRate: z.number(),
    consumptionProfile: z.enum(['flat', 'seasonal']),
    performanceRatio: z.number(),
    assumedLosses: z.number(),
    dcAcRatio: z.number(),
    tariffRatesOverride: tariffRatesSchema.partial().optional(),
    analysisMode: z.enum(['simple', 'lifecycle']).optional(),
    annualMaintenanceRm: z.number().optional(),
    inverterReplacements: z.array(inverterReplacementSchema).optional(),
    inverterReplacementCostRm: z.number().optional(),
    inverterReplacementYear: z.number().int().min(1).optional(),
    selectedPanelModelId: z.string().optional()
  })
  .strict()

/**
 * Persisted-on-database variant of the analysis config. All fields optional
 * because layout saves write only `selectedPanelModelId` and don't supply the
 * other analysis inputs yet.
 */
export const storedAnalysisConfigSchema = analysisConfigSchema.partial().extend({
  selectedPanelModelId: z.string().optional()
})

/**
 * Analysis simulation output persisted with each project.
 *
 * `paybackYears` / `tenYearRoiPercent` / `lifecyclePaybackYears` are nullable
 * because some scenarios never reach payback (e.g. tiny systems where the
 * fixed retail charge dominates).
 */
export const analysisResultsSchema = z
  .object({
    monthlyBreakdown: z.array(monthlyBreakdownSchema),
    annualTotals: z
      .object({
        totalConsumptionKwh: z.number(),
        totalGenerationKwh: z.number(),
        totalBaselineRm: z.number(),
        totalNemRm: z.number(),
        totalSavingsRm: z.number(),
        totalCreditsForfeitedKwh: z.number()
      })
      .strict(),
    averageMonthlySavingsRm: z.number(),
    averageMonthlySavingsPct: z.number(),
    paybackYears: z.number().nullable(),
    tenYearNetBenefitRm: z.number(),
    tenYearRoiPercent: z.number().nullable(),
    twentyFiveYearNetBenefitRm: z.number(),
    simplePaybackYears: z.number().nullable(),
    simpleTwentyFiveYearNetBenefitRm: z.number(),
    lifecyclePaybackYears: z.number().nullable(),
    lifecycleTwentyFiveYearNetBenefitRm: z.number(),
    analysisMode: z.enum(['simple', 'lifecycle']),
    carbonOffsetKg: z.number(),
    activePanelCount: z.number().int().min(0)
  })
  .strict()

/** Body for `POST /projects` — create a project anchored to a Location. */
export const createProjectRequestSchema = z
  .object({
    name: z.string().min(1),
    locationId: z.string().uuid()
  })
  .strict()

/** Body for `PATCH /projects/:id/layout` — persist the workbench layout. */
export const saveLayoutRequestSchema = z
  .object({
    editedLayout: z.array(panelEditSchema),
    selectedPanelModelId: z.string().optional()
  })
  .strict()

/** Body for `PATCH /projects/:id/analysis` — persist analysis inputs + results. */
export const saveAnalysisRequestSchema = z
  .object({
    analysisConfig: analysisConfigSchema,
    analysisResults: analysisResultsSchema
  })
  .strict()

/** Body for `PATCH /projects/:id/layout-preferences` — sizing-modal updates. */
export const updateLayoutPreferencesRequestSchema = z
  .object({
    layoutPreferences: layoutPreferencesPartialSchema
  })
  .strict()

/** DTO inferred from `buildingInsightsSchema` */
export type BuildingInsightsDto = z.infer<typeof buildingInsightsSchema>
/** DTO inferred from `analysisConfigSchema` */
export type AnalysisConfigDto = z.infer<typeof analysisConfigSchema>
/** DTO inferred from `storedAnalysisConfigSchema` */
export type StoredAnalysisConfigDto = z.infer<typeof storedAnalysisConfigSchema>
/** DTO inferred from `analysisResultsSchema` */
export type AnalysisResultsDto = z.infer<typeof analysisResultsSchema>
