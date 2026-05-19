/**
 * Panel-related types shared between backend and frontend.
 *
 * Defines the `PanelEdit` payload that represents one user-modified panel on
 * the workbench, and the `PanelModel` metadata describing a manufacturer's
 * panel SKU (used by the panel-model drawer and cost model).
 */

import { z } from 'zod'

/**
 * Zod schema for a saved panel edit.
 *
 * `status` tracks the panel's lifecycle relative to Google's default layout:
 *   - `kept`    — unmodified from Solar API's default
 *   - `moved`   — center / rotation user-adjusted
 *   - `deleted` — removed from the layout (but preserved here so undo works)
 *
 * `monthlyEnergyDcKwh` is a 12-element array of DC energy estimates produced
 * by the flux recompute endpoint (index 0 = January).
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

/** Panel edit payload shared between backend and frontend. */
export type PanelEdit = z.infer<typeof panelEditSchema>

/**
 * Canonical panel model metadata used by the panel-model drawer and the cost
 * model. `widthM` / `heightM` give the physical panel dimensions; `capacityWp`
 * is the nameplate watts and `efficiency` the rated module efficiency. The
 * `tagline` is human-facing marketing copy shown in the picker.
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
