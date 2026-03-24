import { z } from 'zod'

export const resolveLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  projectId: z.string().uuid().optional()
})

export const fluxRecomputeSchema = z.object({
  panelId: z.string().min(1),
  center: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180)
  }),
  rotation: z.number(),
  widthM: z.number().positive().optional(),
  heightM: z.number().positive().optional(),
  capacityWp: z.number().positive().optional()
})

export const fluxRecomputeBatchSchema = z.object({
  panels: z.array(fluxRecomputeSchema).min(1).max(500)
})
