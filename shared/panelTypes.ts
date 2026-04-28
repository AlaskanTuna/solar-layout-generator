import { z } from 'zod'

/**
 * Zod schema for a saved panel edit
 */
export const panelEditSchema = z
  .object({
    id: z.string(),
    status: z.enum(['kept', 'moved', 'deleted']),
    center: z.object({
      lat: z.number(),
      lng: z.number()
    }),
    rotation: z.number(),
    monthlyEnergyDcKwh: z.array(z.number())
  })
  .strict()

/**
 * Panel edit payload shared between backend and frontend
 */
export type PanelEdit = z.infer<typeof panelEditSchema>

/**
 * Canonical panel model metadata
 */
export interface PanelModel {
  id: string
  name: string
  manufacturer: string
  widthM: number
  heightM: number
  capacityWp: number
  efficiency: number
  costPerWp: number
  tagline?: string
}
