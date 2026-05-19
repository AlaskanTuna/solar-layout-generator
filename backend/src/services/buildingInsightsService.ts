/**
 * Validation helpers for Google Solar API building-insights payloads.
 *
 * Narrows the raw Solar API response to the fields required by location data
 * responses and panel-energy recomputation.
 */

import { z } from 'zod'

const solarPanelSchema = z.object({}).passthrough()

const solarPotentialSchema = z
  .object({
    panelWidthMeters: z.number().positive().finite(),
    panelHeightMeters: z.number().positive().finite(),
    panelCapacityWatts: z.number().positive().finite(),
    solarPanels: z.array(solarPanelSchema).optional()
  })
  .passthrough()

const latLngSchema = z.object({
  latitude: z.number().finite(),
  longitude: z.number().finite()
})

const buildingInsightsSchema = z
  .object({
    boundingBox: z.object({
      sw: latLngSchema,
      ne: latLngSchema
    }),
    solarPotential: solarPotentialSchema
  })
  .passthrough()

/**
 * Solar potential subset used to size and recompute panels.
 */
export type PanelSpecs = z.infer<typeof solarPotentialSchema>
/**
 * Building insights payload validated for downstream use.
 */
export type BuildingInsightsDto = z.infer<typeof buildingInsightsSchema>

/**
 * Parses the Solar API building-insights payload used by the app.
 *
 * @param buildingInsights - Raw payload returned by Solar API or loaded from the database
 * @returns Validated building insights, or `null` when required fields are missing
 */
export function parseBuildingInsights(buildingInsights: unknown): BuildingInsightsDto | null {
  const result = buildingInsightsSchema.safeParse(buildingInsights)
  if (!result.success) {
    return null
  }
  return result.data
}

/**
 * Extracts only the panel dimensions, capacity, and optional panel list.
 *
 * @param buildingInsights - Raw payload containing a `solarPotential` object
 * @returns Validated panel specs, or `null` when Solar API omitted sizing data
 */
export function parsePanelSpecs(buildingInsights: unknown): PanelSpecs | null {
  const result = z.object({ solarPotential: solarPotentialSchema }).safeParse(buildingInsights)
  if (!result.success) {
    return null
  }
  return result.data.solarPotential
}
