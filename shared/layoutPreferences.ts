import { z } from 'zod'

export const billRangeSchema = z.enum(['<100', '100-200', '200-400', '400-600', '600+', 'unknown'])
export const sizingGoalSchema = z.enum(['conservative', 'balanced', 'maximum', 'custom'])
export const roofDirectionSchema = z.enum(['any', 'south', 'east', 'west', 'north'])

export type BillRange = z.infer<typeof billRangeSchema>
export type SizingGoal = z.infer<typeof sizingGoalSchema>
export type RoofDirection = z.infer<typeof roofDirectionSchema>

export const layoutPreferencesSchema = z
  .object({
    billRange: billRangeSchema.optional(),
    sizingGoal: sizingGoalSchema,
    roofDirection: roofDirectionSchema.optional(),
    dismissedAt: z.string().datetime().optional()
  })
  .strict()

export const layoutPreferencesPartialSchema = layoutPreferencesSchema.partial()

export type LayoutPreferences = z.infer<typeof layoutPreferencesSchema>

/** Approximate monthly kWh consumption by bill bucket */
export const BILL_RANGE_TO_KWH_PER_MONTH: Record<BillRange, number> = {
  '<100': 250,
  '100-200': 450,
  '200-400': 800,
  '400-600': 1300,
  '600+': 1800,
  unknown: 600
}
