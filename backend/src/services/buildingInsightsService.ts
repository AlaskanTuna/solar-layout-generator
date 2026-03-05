import { z } from 'zod'

const solarPotentialSchema = z.object({
  panelWidthMeters: z.number().positive().finite(),
  panelHeightMeters: z.number().positive().finite(),
  panelCapacityWatts: z.number().positive().finite()
})

const buildingInsightsSchema = z.object({
  solarPotential: solarPotentialSchema
})

export type PanelSpecs = z.infer<typeof solarPotentialSchema>

export function parsePanelSpecs(buildingInsights: unknown): PanelSpecs | null {
  const result = buildingInsightsSchema.safeParse(buildingInsights)
  if (!result.success) {
    return null
  }
  return result.data.solarPotential
}
