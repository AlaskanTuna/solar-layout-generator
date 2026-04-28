import { z } from 'zod'

/**
 * Bill range buckets used to infer monthly consumption
 */
export const billRangeSchema = z.enum(['<100', '100-200', '200-400', '400-600', '600+', 'unknown'])
/**
 * Panel sizing strategies supported by the UI
 */
export const sizingGoalSchema = z.enum(['conservative', 'balanced', 'maximum', 'custom'])
/**
 * Roof orientation options used by layout preferences
 */
export const roofDirectionSchema = z.enum(['any', 'south', 'east', 'west', 'north'])

/**
 * Bill range inferred from the schema
 */
export type BillRange = z.infer<typeof billRangeSchema>
/**
 * Sizing goal inferred from the schema
 */
export type SizingGoal = z.infer<typeof sizingGoalSchema>
/**
 * Roof direction inferred from the schema
 */
export type RoofDirection = z.infer<typeof roofDirectionSchema>

/**
 * Layout preferences accepted by the API
 */
export const layoutPreferencesSchema = z
  .object({
    billRange: billRangeSchema.optional(),
    sizingGoal: sizingGoalSchema,
    roofDirection: roofDirectionSchema.optional(),
    dismissedAt: z.string().datetime().optional()
  })
  .strict()

/**
 * Partial layout preferences for patch updates
 */
export const layoutPreferencesPartialSchema = layoutPreferencesSchema.partial()

/**
 * Stored layout preferences for a project
 */
export type LayoutPreferences = z.infer<typeof layoutPreferencesSchema>

/**
 * Approximate monthly kWh consumption by bill bucket
 */
export const BILL_RANGE_TO_KWH_PER_MONTH: Record<BillRange, number> = {
  '<100': 250,
  '100-200': 450,
  '200-400': 800,
  '400-600': 1300,
  '600+': 1800,
  unknown: 600
}
