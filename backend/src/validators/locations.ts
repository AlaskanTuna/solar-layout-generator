import { z } from 'zod'

/**
 * Resolves location request schema
 */
export const resolveLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  projectId: z.string().uuid().optional(),
  requiredQuality: z.enum(['HIGH', 'BASE']).optional(),
  expandedCoverage: z.boolean().optional()
})

/**
 * Probes location query schema
 */
export const probeLocationSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180)
})

/**
 * Single-panel flux recompute schema
 */
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

/**
 * Batch flux recompute schema
 */
export const fluxRecomputeBatchSchema = z.object({
  panels: z.array(fluxRecomputeSchema).min(1).max(500)
})
