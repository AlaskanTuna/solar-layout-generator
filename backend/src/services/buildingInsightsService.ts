import { z } from 'zod'

const solarPanelSchema = z.object({}).passthrough()

const solarPotentialSchema = z.object({
  panelWidthMeters: z.number().positive().finite(),
  panelHeightMeters: z.number().positive().finite(),
  panelCapacityWatts: z.number().positive().finite(),
  solarPanels: z.array(solarPanelSchema).optional()
}).passthrough()

const latLngSchema = z.object({
  latitude: z.number().finite(),
  longitude: z.number().finite()
})

const buildingInsightsSchema = z.object({
  boundingBox: z.object({
    sw: latLngSchema,
    ne: latLngSchema
  }),
  solarPotential: solarPotentialSchema
}).passthrough()

export type PanelSpecs = z.infer<typeof solarPotentialSchema>
export type BuildingInsightsDto = z.infer<typeof buildingInsightsSchema>

export function parseBuildingInsights(buildingInsights: unknown): BuildingInsightsDto | null {
  const result = buildingInsightsSchema.safeParse(buildingInsights)
  if (!result.success) {
    return null
  }
  return result.data
}

export function parsePanelSpecs(buildingInsights: unknown): PanelSpecs | null {
  const result = z.object({ solarPotential: solarPotentialSchema }).safeParse(buildingInsights)
  if (!result.success) {
    return null
  }
  return result.data.solarPotential
}
