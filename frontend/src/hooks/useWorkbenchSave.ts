import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { recomputeFluxBatch } from '@/api/locations'
import { saveLayout } from '@/api/projects'
import { notify } from '@/components/ui/toastConfig'
import type { PanelEdit, PanelModel } from '@shared/types'

type UseWorkbenchSaveOptions = {
  projectId: string | undefined
  locationId: string | undefined
  selectedPanelModel: PanelModel
  selectedPanelModelId: string
  serializeLayout: () => PanelEdit[]
  updatePanelEnergy: (panelId: string, monthlyEnergyDcKwh: number[]) => void
}

/**
 * Provides the workbenchSave hook
 * @param {UseWorkbenchSaveOptions} options - Value used for options
 * @returns {Function} Hook state for workbench save
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
