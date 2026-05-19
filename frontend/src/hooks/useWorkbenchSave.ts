/**
 * Workbench save hook.
 *
 * Bundles the two-step save flow used when the user clicks "Save & Continue"
 * on the workbench:
 *   1. Batch-recompute monthly energy for every active (non-deleted) panel,
 *      since panel positions and the selected panel model may have changed
 *      since the last recompute.
 *   2. PATCH the project layout with the freshened `monthlyEnergyDcKwh`
 *      values and navigate to the analysis page.
 *
 * Toasts user-visible progress at each step and surfaces errors via `notify.error`.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { recomputeFluxBatch } from '@/api/locations'
import { saveLayout } from '@/api/projects'
import { notify } from '@/components/ui/toastConfig'
import type { PanelEdit, PanelModel } from '@shared/types'

/**
 * Inputs to `useWorkbenchSave`.
 *
 * - `projectId`              — current project id (may be undefined while loading)
 * - `locationId`             — location id used for flux recompute
 * - `selectedPanelModel`     — physical dimensions + capacity passed to the recompute
 * - `selectedPanelModelId`   — id persisted alongside the layout
 * - `serializeLayout`        — pulls the current panel edits from `usePanelState`
 * - `updatePanelEnergy`      — store mutator used after batch recompute returns
 */
type UseWorkbenchSaveOptions = {
  projectId: string | undefined
  locationId: string | undefined
  selectedPanelModel: PanelModel
  selectedPanelModelId: string
  serializeLayout: () => PanelEdit[]
  updatePanelEnergy: (panelId: string, monthlyEnergyDcKwh: number[]) => void
}

/**
 * Returns `{ isSaving, isBatchRecomputing, handleSave }` for wiring to the
 * workbench "Save & Continue" button. `isBatchRecomputing` is a sub-state of
 * `isSaving` exposed separately so the UI can show distinct messages during
 * the recompute and save phases.
 */
export function useWorkbenchSave({
  projectId,
  locationId,
  selectedPanelModel,
  selectedPanelModelId,
  serializeLayout,
  updatePanelEnergy
}: UseWorkbenchSaveOptions) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isSaving, setIsSaving] = useState(false)
  const [isBatchRecomputing, setIsBatchRecomputing] = useState(false)

  async function handleSave() {
    if (!projectId || !locationId) return

    setIsSaving(true)
    setIsBatchRecomputing(true)

    try {
      const serializedLayout = serializeLayout()
      const activePanels = serializedLayout.filter((panel) => panel.status !== 'deleted')

      notify.info(`Recomputing monthly energy for ${activePanels.length} active panels before saving...`)

      const batchResponse = await recomputeFluxBatch(locationId, {
        panels: activePanels.map((panel) => ({
          panelId: panel.id,
          center: panel.center,
          rotation: panel.rotation,
          widthM: selectedPanelModel.widthM,
          heightM: selectedPanelModel.heightM,
          capacityWp: selectedPanelModel.capacityWp
        }))
      })

      const energyByPanelId = new Map(
        batchResponse.results.map((result) => [result.panelId, result.monthlyEnergyDcKwh] as const)
      )
      const incompletePanels = activePanels.filter((panel) => {
        const monthlyEnergyDcKwh = energyByPanelId.get(panel.id)
        return !monthlyEnergyDcKwh || monthlyEnergyDcKwh.length !== 12
      })

      if (incompletePanels.length > 0) {
        throw new Error(
          `Batch recompute returned incomplete results for ${incompletePanels.length} panel(s). Please retry.`
        )
      }

      const nextLayout = serializedLayout.map((panel) => {
        const monthlyEnergyDcKwh = energyByPanelId.get(panel.id)
        return monthlyEnergyDcKwh ? { ...panel, monthlyEnergyDcKwh } : panel
      })

      setIsBatchRecomputing(false)
      notify.info('Saving the refreshed layout to your project...')
      const updatedProject = await saveLayout(projectId, { editedLayout: nextLayout, selectedPanelModelId })
      queryClient.setQueryData(['project', projectId], updatedProject)
      navigate(`/project/${projectId}/analysis`)
    } catch (saveError) {
      notify.error(
        saveError instanceof Error
          ? saveError.message
          : 'Failed to recompute and save the current layout. Please retry.'
      )
    } finally {
      setIsBatchRecomputing(false)
      setIsSaving(false)
    }
  }

  return { isSaving, isBatchRecomputing, handleSave }
}
