/**
 * Layout preferences shared schemas.
 *
 * The "Layout Preferences" modal collects three hints from the user before
 * placing panels: their typical monthly bill (used to infer consumption),
 * their sizing goal (conservative vs. balanced vs. maximum), and a preferred
 * roof direction. These feed the panel auto-layout heuristics in the
 * workbench.
 */

import { z } from 'zod'

/** Monthly bill bucket used to infer typical kWh consumption. */
export const billRangeSchema = z.enum(['<100', '100-200', '200-400', '400-600', '600+', 'unknown'])
/** Sizing strategy when the auto-layout picks how many panels to place. */
export const sizingGoalSchema = z.enum(['conservative', 'balanced', 'maximum', 'custom'])
/** Roof orientation hint used to bias the auto-layout. */
export const roofDirectionSchema = z.enum(['any', 'south', 'east', 'west', 'north'])

/** Bill range inferred from the schema */
export type BillRange = z.infer<typeof billRangeSchema>
/** Sizing goal inferred from the schema */
export type SizingGoal = z.infer<typeof sizingGoalSchema>
/** Roof direction inferred from the schema */
export type RoofDirection = z.infer<typeof roofDirectionSchema>

/**
 * Full layout preferences object. `dismissedAt` marks when the user closed the
 * modal so we don't reprompt; presence of the field counts as "user has set
 * preferences at least once".
 */
export const layoutPreferencesSchema = z
  .object({
    billRange: billRangeSchema.optional(),
    sizingGoal: sizingGoalSchema,
    roofDirection: roofDirectionSchema.optional(),
    dismissedAt: z.string().datetime().optional()
  })
  .strict()

/** Patch variant — every field optional so the PATCH endpoint accepts deltas. */
export const layoutPreferencesPartialSchema = layoutPreferencesSchema.partial()

/** Stored layout preferences for a project */
export type LayoutPreferences = z.infer<typeof layoutPreferencesSchema>

/**
 * Mapping from bill bucket to assumed monthly kWh consumption.
 *
 * Anchored to the Malaysian TNB residential tariff: a ~RM 200 bill at
 * around RM 0.218/kWh implies roughly 800 kWh once base charges are netted
 * out. The `unknown` bucket falls back to a national-average estimate.
 */
export const BILL_RANGE_TO_KWH_PER_MONTH: Record<BillRange, number> = {
  '<100': 250,
  '100-200': 450,
  '200-400': 800,
  '400-600': 1300,
  '600+': 1800,
  unknown: 600
}
