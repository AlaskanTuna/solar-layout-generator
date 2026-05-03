import { z } from 'zod'
import {
  analysisResultsSchema,
  buildingInsightsSchema,
  layoutPreferencesSchema,
  panelEditSchema,
  type AnalysisResultsDto,
  type BuildingInsightsDto,
  type LayoutPreferences,
  type PanelEdit,
  storedAnalysisConfigSchema,
  type StoredAnalysisConfigDto
} from '@shared/types'
import * as projectService from '../projectService.js'
import type { ChatLiveState } from '../../validators/chat.js'

// Raised from 6000 when the digest gained the monthly breakdown table, lifecycle
// assumption rows, and additional analysisConfig fields (Phase 11 §9). Gemini Flash
// handles 8000-char prompts comfortably with no measurable first-token latency hit.
const MAX_DIGEST_CHARS = 8000

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const solarPanelSchema = z
  .object({
    id: z.string(),
    orientation: z.enum(['PORTRAIT', 'LANDSCAPE']).optional(),
    segmentIndex: z.number().int().nonnegative().optional()
  })
  .passthrough()

type ChatProject = NonNullable<Awaited<ReturnType<typeof projectService.getProject>>>
type ChatPage = 'workbench' | 'analysis'

/**
 * Renders a page-aware project digest for chat grounding.
 *
 * `liveState` (optional) overlays the persisted Project row with values the user is actively
 * editing in the frontend but hasn't saved yet. Each field independently overrides the
 * corresponding persisted field; missing/null fields fall through to the DB value. This lets
 * Sol answer questions about an in-progress AnalysisPage form, an unsaved WorkbenchPage
 * layout tweak, etc., without requiring an explicit Save first.
 */
export function renderProjectDigest(project: ChatProject, page: ChatPage, liveState?: ChatLiveState): string {
  const analysisConfig = liveState?.analysisConfig ?? parseAnalysisConfig(project.analysisConfig)
  const analysisResults = liveState?.analysisResults ?? parseAnalysisResults(project.analysisResults)
  const layoutPreferences = liveState?.layoutPreferences ?? parseLayoutPreferences(project.layoutPreferences)
  const editedLayout = liveState?.editedLayout ?? parseEditedLayout(project.editedLayout)
  const buildingInsights = parseBuildingInsights(project.location?.buildingInsightsJson)

  const blocks = [renderProjectBlock(project, analysisConfig, editedLayout, buildingInsights)]
  blocks.push(
    page === 'workbench'
      ? renderLayoutBlock(layoutPreferences, editedLayout, buildingInsights)
      : renderAnalysisBlock(analysisConfig, analysisResults)
  )

  return blocks.join('\n\n').slice(0, MAX_DIGEST_CHARS)
}

function renderProjectBlock(
  project: ChatProject,
  analysisConfig: StoredAnalysisConfigDto | null,
  editedLayout: PanelEdit[],
  buildingInsights: BuildingInsightsDto | null
): string {
  const maxPanels = buildingInsights?.solarPotential.maxArrayPanelsCount ?? '—'
  const lat = project.location?.lat
  const lng = project.location?.lng
  const locationText = typeof lat === 'number' && typeof lng === 'number' ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : '—'

  return [
    '## Project',
    `- Name: ${project.name}`,
    `- System size: ${formatMaybeNumber(analysisConfig?.systemKwp)} kWp`,
    `- Active panels: ${countActivePanels(editedLayout)} of ${maxPanels} max`,
    `- Panel model: ${analysisConfig?.selectedPanelModelId ?? '—'}`,
    `- Connection: ${analysisConfig?.connectionPhase ?? '—'}-phase, ${analysisConfig?.roofType ?? '—'} roof`,
    `- Location: ${locationText}`,
    `- Imagery quality: ${project.location?.imageryQuality ?? 'unknown'}`
  ].join('\n')
}

function renderLayoutBlock(
  layoutPreferences: LayoutPreferences | null,
  editedLayout: PanelEdit[],
  buildingInsights: BuildingInsightsDto | null
): string {
  return [
    '## Layout',
    `- Sizing goal: ${layoutPreferences?.sizingGoal ?? '—'}`,
    `- Roof direction filter: ${layoutPreferences?.roofDirection ?? '—'}`,
    `- Bill range tier: ${layoutPreferences?.billRange ?? '—'}`,
    `- Panel orientation buckets: ${bucketByOrientation(editedLayout, buildingInsights)}`,
    `- Roof segments: ${countSegmentsUsed(editedLayout, buildingInsights)}`
  ].join('\n')
}

function renderAnalysisBlock(
  analysisConfig: StoredAnalysisConfigDto | null,
  analysisResults: AnalysisResultsDto | null
): string {
  if (!analysisResults) {
    return '## Financial Analysis\n- Analysis not yet computed. Direct the user to the AnalysisPage.'
  }

  const isLifecycle = analysisResults.analysisMode === 'lifecycle'
  const billInput = analysisConfig?.monthlyConsumptionKwh
  const profile = analysisConfig?.consumptionProfile

  const headerLines = [
    '## Financial Analysis',
    `- User's stated bill: ${typeof billInput === 'number' ? `${billInput.toFixed(0)} kWh/month` : '—'} (${profile ?? '—'} profile)`,
    `- Annual generation: ${formatNumber(analysisResults.annualTotals.totalGenerationKwh)} kWh`,
    `- Annual baseline bill: RM ${formatRm(analysisResults.annualTotals.totalBaselineRm)}`,
    `- Annual NEM bill: RM ${formatRm(analysisResults.annualTotals.totalNemRm)}`,
    `- Annual savings: RM ${formatRm(analysisResults.annualTotals.totalSavingsRm)}`,
    `- Avg monthly savings: RM ${formatRm(analysisResults.averageMonthlySavingsRm)} (${formatPercent(analysisResults.averageMonthlySavingsPct)}%)`,
    `- Payback: ${analysisResults.paybackYears ?? 'n/a'} years (${analysisResults.analysisMode} mode)`,
    `- 10-yr net benefit: RM ${formatRm(analysisResults.tenYearNetBenefitRm)} (ROI ${analysisResults.tenYearRoiPercent ?? 'n/a'}%)`,
    `- 25-yr net benefit: RM ${formatRm(analysisResults.twentyFiveYearNetBenefitRm)}`,
    `- Annual NEM credits forfeited: ${formatNumber(analysisResults.annualTotals.totalCreditsForfeitedKwh)} kWh`,
    `- Carbon offset: ${formatNumber(analysisResults.carbonOffsetKg)} kg/yr`
  ]

  const assumptionLines = [
    '',
    '### Assumptions',
    `- System cost: RM ${formatRm(analysisConfig?.systemCostRm)}`,
    `- Tariff escalation: ${formatRate(analysisConfig?.tariffEscalationRate)}`,
    `- Panel degradation: ${formatRate(analysisConfig?.degradationRate)}/year`,
    `- Performance ratio: ${formatMaybeNumber(analysisConfig?.performanceRatio)}`,
    `- DC/AC ratio: ${formatMaybeNumber(analysisConfig?.dcAcRatio)}`,
    `- AFA rate: ${formatMaybeNumber(analysisConfig?.afaRateSenPerKwh)} sen/kWh`
  ]

  if (isLifecycle) {
    assumptionLines.push(
      `- Annual maintenance: RM ${formatRm(analysisConfig?.annualMaintenanceRm)}`,
      `- Inverter replacements: ${describeInverterReplacements(analysisConfig)}`
    )
  }

  return [...headerLines, ...assumptionLines, '', renderMonthlyBreakdownTable(analysisResults)].join('\n')
}

/**
 * Renders a compact pipe-formatted 12-month breakdown so Sol can answer
 * "what's my June bill?" / "which month do I forfeit credits?" /
 * "show me the seasonal generation pattern" without hand-waving.
 * Always 12 rows, ~600 chars total.
 */
function renderMonthlyBreakdownTable(analysisResults: AnalysisResultsDto): string {
  const rows = analysisResults.monthlyBreakdown
    .slice(0, 12)
    .map((entry) => {
      const label = MONTH_LABELS[entry.month - 1] ?? `M${entry.month}`
      const inKwh = formatNumber(entry.consumptionKwh).padStart(7)
      const genKwh = formatNumber(entry.generationKwh).padStart(7)
      const bill = formatRm(entry.nemBill.total).padStart(8)
      const saved = formatRm(entry.savingsRm).padStart(7)
      const credit = entry.creditForfeited > 0 ? ` ⚠ forfeit ${formatNumber(entry.creditForfeited)} kWh` : ''
      return `| ${label} | ${inKwh} | ${genKwh} | ${bill} | ${saved} |${credit}`
    })
    .join('\n')

  return ['### Monthly Breakdown (kWh in / kWh gen / NEM bill RM / savings RM)', rows].join('\n')
}

/**
 * Compresses the inverter-replacement schedule into a single human line.
 */
function describeInverterReplacements(analysisConfig: StoredAnalysisConfigDto | null): string {
  const list = analysisConfig?.inverterReplacements
  if (Array.isArray(list) && list.length > 0) {
    return list.map((entry) => `year ${entry.year} (RM ${formatRm(entry.costRm)})`).join(', ')
  }
  const legacyYear = analysisConfig?.inverterReplacementYear
  const legacyCost = analysisConfig?.inverterReplacementCostRm
  if (typeof legacyYear === 'number' && typeof legacyCost === 'number') {
    return `year ${legacyYear} (RM ${formatRm(legacyCost)})`
  }
  return 'none scheduled'
}

function parseAnalysisConfig(value: unknown): StoredAnalysisConfigDto | null {
  const result = storedAnalysisConfigSchema.safeParse(value)
  return result.success ? result.data : null
}

function parseAnalysisResults(value: unknown): AnalysisResultsDto | null {
  const result = analysisResultsSchema.safeParse(value)
  return result.success ? result.data : null
}

function parseLayoutPreferences(value: unknown): LayoutPreferences | null {
  const result = layoutPreferencesSchema.safeParse(value)
  return result.success ? result.data : null
}

function parseEditedLayout(value: unknown): PanelEdit[] {
  const result = z.array(panelEditSchema).safeParse(value)
  return result.success ? result.data : []
}

function parseBuildingInsights(value: unknown): BuildingInsightsDto | null {
  const result = buildingInsightsSchema.safeParse(value)
  return result.success ? result.data : null
}

function countActivePanels(editedLayout: PanelEdit[]): number {
  return editedLayout.filter((panel) => panel.status !== 'deleted').length
}

function bucketByOrientation(editedLayout: PanelEdit[], buildingInsights: BuildingInsightsDto | null): string {
  const activePanelIds = new Set(editedLayout.filter((panel) => panel.status !== 'deleted').map((panel) => panel.id))

  const counters = {
    portrait: 0,
    landscape: 0,
    unknown: 0
  }

  const rawSolarPanels = Array.isArray(buildingInsights?.solarPotential.solarPanels)
    ? buildingInsights.solarPotential.solarPanels
    : []

  for (const rawPanel of rawSolarPanels) {
    const parsed = solarPanelSchema.safeParse(rawPanel)
    if (!parsed.success || !activePanelIds.has(parsed.data.id)) {
      continue
    }

    if (parsed.data.orientation === 'PORTRAIT') {
      counters.portrait += 1
    } else if (parsed.data.orientation === 'LANDSCAPE') {
      counters.landscape += 1
    } else {
      counters.unknown += 1
    }
  }

  const matchedCount = counters.portrait + counters.landscape + counters.unknown
  const unmatchedCount = Math.max(0, activePanelIds.size - matchedCount)
  counters.unknown += unmatchedCount

  return `portrait ${counters.portrait}, landscape ${counters.landscape}, unknown ${counters.unknown}`
}

function countSegmentsUsed(editedLayout: PanelEdit[], buildingInsights: BuildingInsightsDto | null): string {
  const activePanelIds = new Set(editedLayout.filter((panel) => panel.status !== 'deleted').map((panel) => panel.id))
  const segmentIndexes = new Set<number>()

  const rawSolarPanels = Array.isArray(buildingInsights?.solarPotential.solarPanels)
    ? buildingInsights.solarPotential.solarPanels
    : []

  for (const rawPanel of rawSolarPanels) {
    const parsed = solarPanelSchema.safeParse(rawPanel)
    if (!parsed.success || !activePanelIds.has(parsed.data.id) || parsed.data.segmentIndex === undefined) {
      continue
    }
    segmentIndexes.add(parsed.data.segmentIndex)
  }

  return segmentIndexes.size > 0 ? String(segmentIndexes.size) : 'unknown'
}

function formatRm(value: number | null | undefined): string {
  return typeof value === 'number' ? value.toFixed(2) : '—'
}

function formatNumber(value: number | null | undefined): string {
  return typeof value === 'number' ? value.toFixed(2) : '—'
}

function formatMaybeNumber(value: number | null | undefined): string {
  return typeof value === 'number' ? String(value) : '—'
}

function formatPercent(value: number | null | undefined): string {
  return typeof value === 'number' ? value.toFixed(1) : '—'
}

function formatRate(value: number | null | undefined): string {
  return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '—'
}
