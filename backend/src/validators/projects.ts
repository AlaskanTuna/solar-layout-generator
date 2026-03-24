import { z } from 'zod'

export const createProjectSchema = z.object({
  name: z.string().min(1),
  locationId: z.string().uuid()
})

export const saveLayoutSchema = z.object({
  editedLayout: z.array(
    z.object({
      id: z.string(),
      status: z.enum(['kept', 'moved', 'deleted']),
      center: z.object({
        lat: z.number(),
        lng: z.number()
      }),
      rotation: z.number(),
      monthlyEnergyDcKwh: z.array(z.number())
    })
  ),
  selectedPanelModelId: z.string().optional()
})

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
    monthlyConsumptionKwh: z.number(),
    connectionPhase: z.enum(['single', 'three']),
    systemCostRm: z.number(),
    afaRateSenPerKwh: z.number(),
    systemKwp: z.number()
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

export const saveAnalysisSchema = z.object({
  analysisConfig: analysisConfigSchema,
  analysisResults: analysisResultsSchema
})
