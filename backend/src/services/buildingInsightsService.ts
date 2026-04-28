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

/**
 * Solar potential subset used to size and recompute panels
 */
export type PanelSpecs = z.infer<typeof solarPotentialSchema>
/**
 * Building insights payload validated for downstream use
 */
export type BuildingInsightsDto = z.infer<typeof buildingInsightsSchema>

/**
 * Parses a building insights payload
 * @param {unknown} buildingInsights - Value used for building insights
 * @returns {Object} The parsed building insights
 */
export function parseBuildingInsights(buildingInsights: unknown): BuildingInsightsDto | null {
  const result = buildingInsightsSchema.safeParse(buildingInsights)
  if (!result.success) {
    return null
  }
  return result.data
}

/**
 * Parses just the panel sizing fields from building insights
 * @param {unknown} buildingInsights - Value used for building insights
 * @returns {Object} The parsed panel specs
 */
export function parsePanelSpecs(buildingInsights: unknown): PanelSpecs | null {
  const result = z.object({ solarPotential: solarPotentialSchema }).safeParse(buildingInsights)
  if (!result.success) {
    return null
  }
  return result.data.solarPotential
}
