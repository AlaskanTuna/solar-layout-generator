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
  )
})

export const saveAnalysisSchema = z.object({
  analysisConfig: z.record(z.unknown()),
  analysisResults: z.record(z.unknown())
})
