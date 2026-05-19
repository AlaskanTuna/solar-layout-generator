/**
 * Location route request validators.
 *
 * Validates coordinate bounds, Solar API quality options, and flux recompute
 * payloads before service-layer location work starts.
 */

import { z } from 'zod'

/**
 * Validates the resolve-location request body.
 *
 * Coordinates must be WGS84 latitude/longitude bounds; `projectId` is optional
 * because the shared location cache can be warmed before a project is linked.
 */
export const resolveLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  projectId: z.string().uuid().optional(),
  requiredQuality: z.enum(['HIGH', 'BASE']).optional(),
  expandedCoverage: z.boolean().optional()
})

/**
 * Validates the probe-location query parameters.
 *
 * Coordinates are coerced from query-string values before WGS84 bounds checks.
 */
export const probeLocationSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180)
})

/**
 * Validates a single-panel flux recompute request body.
 *
 * Optional dimensions and capacity must be positive when supplied; omitted
 * values fall back to Solar API panel specs.
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
 * Validates a batch flux recompute request body.
 *
 * Requires at least one panel and caps the batch at 500 panels to keep raster
 * sampling work bounded per request.
 */
export const fluxRecomputeBatchSchema = z.object({
  panels: z.array(fluxRecomputeSchema).min(1).max(500)
})
