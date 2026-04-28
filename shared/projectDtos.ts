import { z } from 'zod'
import { layoutPreferencesPartialSchema } from './layoutPreferences.ts'
import { panelEditSchema } from './panelTypes.ts'

const latLngSchema = z.object({
  latitude: z.number().finite(),
  longitude: z.number().finite()
})

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

const inverterReplacementSchema = z
  .object({
    year: z.number().int().min(1),
    costRm: z.number().min(0)
  })
  .strict()

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

export const storedAnalysisConfigSchema = analysisConfigSchema.partial().extend({
  selectedPanelModelId: z.string().optional()
})

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

export const createProjectRequestSchema = z
  .object({
    name: z.string().min(1),
    locationId: z.string().uuid()
  })
  .strict()

export const saveLayoutRequestSchema = z
  .object({
    editedLayout: z.array(panelEditSchema),
    selectedPanelModelId: z.string().optional()
  })
  .strict()

export const saveAnalysisRequestSchema = z
  .object({
    analysisConfig: analysisConfigSchema,
    analysisResults: analysisResultsSchema
  })
  .strict()

export const updateLayoutPreferencesRequestSchema = z
  .object({
    layoutPreferences: layoutPreferencesPartialSchema
  })
  .strict()

export type BuildingInsightsDto = z.infer<typeof buildingInsightsSchema>
export type AnalysisConfigDto = z.infer<typeof analysisConfigSchema>
export type StoredAnalysisConfigDto = z.infer<typeof storedAnalysisConfigSchema>
export type AnalysisResultsDto = z.infer<typeof analysisResultsSchema>
