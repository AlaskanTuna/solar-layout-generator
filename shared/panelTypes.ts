import { z } from 'zod'

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

export type PanelEdit = z.infer<typeof panelEditSchema>

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
