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
  rotation: z.number()
})
