import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getLocationData } from '@/api/locations'
import { getProject } from '@/api/projects'
import { getTariffConfig } from '@/api/tariff'
import {
  aggregateMonthlyGeneration,
  applyPerformanceRatio,
  buildMonthlyBillChartData,
  applySeasonalProfile,
  buildAnalysisResults,
  buildThresholdWarnings,
  parseSavedAnalysisConfig,
  type AnalysisConfig
} from '@/lib/analysis'
import { parseBuildingInsights, parsePanelEdits } from '@/lib/buildingInsights'
import { runAnnualSimulation } from '@/lib/billingEngine'
import {
  BILL_RANGE_TO_KWH_PER_MONTH,
  computeSystemCost,
  getPanelModel,
  DEFAULT_PANEL_MODEL_ID
} from '@shared/types'
/**
 * Editable analysis settings excluding derived system size
 */
export type AnalysisFormState = Omit<AnalysisConfig, 'systemKwp'>

/**
 * Monthly bill chart point used by the analysis view
 */
export type ChartDataPoint = {
  month: string
  baselineBill: number
  nemBill: number
  cumulativeSavings: number
}

/**
 * Loads and derive the analysis form state for a project
 * @param {string | undefined} projectId - Project identifier
 * @returns {Object} Hook state for analysis form
 */
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
  const monthlyGenerationRaw = useMemo(() => aggregateMonthlyGeneration(activePanels), [activePanels])
  const monthlyGeneration = useMemo(
    () => applyPerformanceRatio(monthlyGenerationRaw, formState?.performanceRatio ?? 0.8),
    [monthlyGenerationRaw, formState?.performanceRatio]
  )
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

    const billRangeDefaultKwh =
      projectQuery.data.layoutPreferences?.billRange != null
        ? BILL_RANGE_TO_KWH_PER_MONTH[projectQuery.data.layoutPreferences.billRange]
        : 600

    setFormState({
      monthlyConsumptionKwh: savedConfig?.monthlyConsumptionKwh ?? billRangeDefaultKwh,
      connectionPhase,
      roofType,
      systemCostRm: resolvedSystemCostRm,
      afaRateSenPerKwh: savedConfig?.afaRateSenPerKwh ?? tariffQuery.data.afaRateDefault,
      degradationRate: savedConfig?.degradationRate ?? 0.005,
      tariffEscalationRate: savedConfig?.tariffEscalationRate ?? 0,
      tariffRatesOverride: savedConfig?.tariffRatesOverride,
      consumptionProfile: savedConfig?.consumptionProfile ?? 'flat',
      performanceRatio: savedConfig?.performanceRatio ?? 0.8,
      assumedLosses: savedConfig?.assumedLosses ?? 0.2,
      dcAcRatio: savedConfig?.dcAcRatio ?? 1.2,
      analysisMode: savedConfig?.analysisMode ?? 'simple',
      annualMaintenanceRm: savedConfig?.annualMaintenanceRm ?? 0,
      inverterReplacements: savedConfig?.inverterReplacements ?? []
    })
    initializedProjectIdRef.current = projectId
  }, [projectId, projectQuery.data, tariffQuery.data, buildingInsights, selectedPanelModel])

  const panelCostPerWp = useMemo(
    () => (selectedPanelModel?.costPerWp && selectedPanelModel.costPerWp > 0 ? selectedPanelModel.costPerWp : 0.95),
    [selectedPanelModel]
  )

  const costBreakdown = useMemo(() => {
    if (!formState || activePanels.length === 0 || panelCapacityWatts === 0) return null
    return computeSystemCost({
      panelCount: activePanels.length,
      panelWattageWp: panelCapacityWatts,
      panelCostPerWp,
      roofType: formState.roofType,
      supplyPhase: formState.connectionPhase
    })
  }, [formState?.roofType, formState?.connectionPhase, activePanels.length, panelCapacityWatts, panelCostPerWp])

  useEffect(() => {
    if (!costBreakdown) return
    setFormState((current) => {
      if (!current || current.systemCostRm === costBreakdown.total) return current
      return { ...current, systemCostRm: costBreakdown.total }
    })
  }, [costBreakdown])

  const billingConfig = useMemo(() => {
    if (!tariffQuery.data || !formState) return null
    return {
      rates: { ...tariffQuery.data.rates, ...(formState.tariffRatesOverride ?? {}) },
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
      degradationRate: formState.degradationRate,
      tariffEscalationRate: formState.tariffEscalationRate,
      analysisMode: formState.analysisMode ?? 'simple',
      annualMaintenanceRm: formState.annualMaintenanceRm ?? 0,
      inverterReplacements: formState.inverterReplacements
    })
  }, [activePanels.length, carbonOffsetFactorKgPerMwh, formState, simulation])

  const chartData = useMemo(() => (simulation ? buildMonthlyBillChartData(simulation.months) : []), [simulation])
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
    monthlyGenerationRaw,
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
    phaseCapacityCapKw,
    costBreakdown,
    panelCostPerWp
  }
}
