import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getLocationData } from '@/api/locations'
import { getProject } from '@/api/projects'
import { getTariffConfig } from '@/api/tariff'
import {
  MONTH_LABELS,
  aggregateMonthlyGeneration,
  applySeasonalProfile,
  buildAnalysisResults,
  buildThresholdWarnings,
  parseSavedAnalysisConfig,
  type AnalysisConfig
} from '@/lib/analysis'
import { parseBuildingInsights, parsePanelEdits } from '@/lib/buildingInsights'
import { runAnnualSimulation, type AnnualSimulationResult } from '@/lib/billingEngine'
import { computeSystemCost, getPanelModel, DEFAULT_PANEL_MODEL_ID } from '@shared/types'
export type AnalysisFormState = Omit<AnalysisConfig, 'systemKwp'>

export type ChartDataPoint = {
  month: string
  baselineBill: number
  nemBill: number
  cumulativeSavings: number
}

function buildChartData(simulation: AnnualSimulationResult): ChartDataPoint[] {
  let cumulativeSavings = 0

  return simulation.months.map((month, index) => {
    cumulativeSavings += month.savingsRm
    return {
      month: MONTH_LABELS[index],
      baselineBill: month.baselineBill.total,
      nemBill: month.nemBill.total,
      cumulativeSavings: Math.round(cumulativeSavings * 100) / 100
    }
  })
}

export function useAnalysisForm(projectId: string | undefined) {
  const initializedProjectIdRef = useRef<string | null>(null)

  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0)
  const [formState, setFormState] = useState<AnalysisFormState | null>(null)
  const [viewMode, setViewMode] = useState<'simple' | 'advanced'>('simple')
  const [monthTableOpen, setMonthTableOpen] = useState(false)

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId!),
    enabled: !!projectId
  })

  const tariffQuery = useQuery({
    queryKey: ['tariffConfig'],
    queryFn: getTariffConfig
  })

  const locationId = projectQuery.data?.locationId
  const locationQuery = useQuery({
    queryKey: ['locationData', locationId],
    queryFn: () => getLocationData(locationId!),
    enabled: !!locationId
  })

  const buildingInsights = useMemo(
    () => (locationQuery.data ? parseBuildingInsights(locationQuery.data.buildingInsights) : null),
    [locationQuery.data]
  )
  const activePanels = useMemo(
    () => parsePanelEdits(projectQuery.data?.editedLayout).filter((panel) => panel.status !== 'deleted'),
    [projectQuery.data?.editedLayout]
  )
  const panelsMissingMonthlyEnergy = useMemo(
    () => activePanels.filter((panel) => panel.monthlyEnergyDcKwh.length !== 12),
    [activePanels]
  )
  const monthlyGeneration = useMemo(() => aggregateMonthlyGeneration(activePanels), [activePanels])
  const savedPanelModelId = useMemo(() => {
    const cfg = projectQuery.data?.analysisConfig
    if (cfg?.selectedPanelModelId) return cfg.selectedPanelModelId
    if (projectQuery.data?.status === 'layout_saved' || projectQuery.data?.status === 'analysis_saved') {
      return DEFAULT_PANEL_MODEL_ID
    }
    return undefined
  }, [projectQuery.data?.analysisConfig, projectQuery.data?.status])
  const selectedPanelModel = savedPanelModelId ? getPanelModel(savedPanelModelId) : undefined
  const panelCapacityWatts = selectedPanelModel?.capacityWp ?? buildingInsights?.solarPotential.panelCapacityWatts ?? 0
  const systemKwp = useMemo(
    () => Math.round(((activePanels.length * panelCapacityWatts) / 1000) * 100) / 100,
    [activePanels.length, panelCapacityWatts]
  )
  const carbonOffsetFactorKgPerMwh = buildingInsights?.solarPotential.carbonOffsetFactorKgPerMwh ?? 0

  useEffect(() => {
    if (!projectId || !projectQuery.data || !tariffQuery.data || !buildingInsights) return
    if (initializedProjectIdRef.current === projectId) return

    const savedConfig = parseSavedAnalysisConfig(projectQuery.data.analysisConfig)
    const localPanels = parsePanelEdits(projectQuery.data.editedLayout).filter((p) => p.status !== 'deleted')
    const localPanelCapacity = selectedPanelModel?.capacityWp ?? buildingInsights.solarPotential.panelCapacityWatts ?? 0

    const roofType = savedConfig?.roofType ?? 'tile'
    const connectionPhase = savedConfig?.connectionPhase ?? 'single'
    const panelCostPerWp = selectedPanelModel?.costPerWp && selectedPanelModel.costPerWp > 0 ? selectedPanelModel.costPerWp : 0.95
    const defaultSystemCostRm = computeSystemCost({
      panelCount: localPanels.length,
      panelWattageWp: localPanelCapacity,
      panelCostPerWp,
      roofType,
      supplyPhase: connectionPhase
    }).total

    const resolvedSystemCostRm = savedConfig?.systemCostRm ?? defaultSystemCostRm

    setFormState({
      monthlyConsumptionKwh: savedConfig?.monthlyConsumptionKwh ?? 600,
      connectionPhase,
      roofType,
      systemCostRm: resolvedSystemCostRm,
      afaRateSenPerKwh: savedConfig?.afaRateSenPerKwh ?? tariffQuery.data.afaRateDefault,
      degradationRate: savedConfig?.degradationRate ?? 0.005,
      consumptionProfile: savedConfig?.consumptionProfile ?? 'flat',
      performanceRatio: savedConfig?.performanceRatio ?? 0.8,
      assumedLosses: savedConfig?.assumedLosses ?? 0.2,
      dcAcRatio: savedConfig?.dcAcRatio ?? 1.2
    })
    initializedProjectIdRef.current = projectId
  }, [projectId, projectQuery.data, tariffQuery.data, buildingInsights, selectedPanelModel])

  const billingConfig = useMemo(() => {
    if (!tariffQuery.data || !formState) return null
    return {
      rates: tariffQuery.data.rates,
      thresholds: tariffQuery.data.thresholds,
      eeiTable: tariffQuery.data.eeiTable,
      afaRate: formState.afaRateSenPerKwh
    }
  }, [tariffQuery.data, formState])

  const monthlyConsumption = useMemo(() => {
    if (!formState) return null
    return formState.consumptionProfile === 'seasonal'
      ? applySeasonalProfile(formState.monthlyConsumptionKwh)
      : formState.monthlyConsumptionKwh
  }, [formState])

  const simulation = useMemo(() => {
    if (!formState || !billingConfig || monthlyConsumption == null) return null
    return runAnnualSimulation(monthlyConsumption, monthlyGeneration, billingConfig)
  }, [billingConfig, formState, monthlyConsumption, monthlyGeneration])

  const analysisResults = useMemo(() => {
    if (!simulation || !formState) return null
    return buildAnalysisResults({
      simulation,
      systemCostRm: formState.systemCostRm,
      carbonOffsetFactorKgPerMwh,
      activePanelCount: activePanels.length,
      degradationRate: formState.degradationRate
    })
  }, [activePanels.length, carbonOffsetFactorKgPerMwh, formState, simulation])

  const chartData = useMemo(() => (simulation ? buildChartData(simulation) : []), [simulation])
  const selectedMonth = useMemo(() => simulation?.months[selectedMonthIndex] ?? null, [simulation, selectedMonthIndex])
  const thresholdWarnings = useMemo(() => {
    if (!selectedMonth || !tariffQuery.data) return []
    return buildThresholdWarnings(selectedMonth, tariffQuery.data.thresholds)
  }, [selectedMonth, tariffQuery.data])

  const phaseCapacityCapKw = useMemo(() => {
    if (!tariffQuery.data || !formState) return 0
    return formState.connectionPhase === 'single'
      ? tariffQuery.data.defaults.nemCapSinglePhaseKw
      : tariffQuery.data.defaults.nemCapThreePhaseKw
  }, [tariffQuery.data, formState])

  return {
    projectQuery,
    tariffQuery,
    locationQuery,
    buildingInsights,
    activePanels,
    panelsMissingMonthlyEnergy,
    monthlyGeneration,
    selectedPanelModel,
    panelCapacityWatts,
    systemKwp,
    carbonOffsetFactorKgPerMwh,
    formState,
    setFormState,
    viewMode,
    setViewMode,
    selectedMonthIndex,
    setSelectedMonthIndex,
    monthTableOpen,
    setMonthTableOpen,
    billingConfig,
    monthlyConsumption,
    simulation,
    analysisResults,
    chartData,
    selectedMonth,
    thresholdWarnings,
    phaseCapacityCapKw
  }
}
