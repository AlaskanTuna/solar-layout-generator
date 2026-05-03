import { describe, expect, it, vi } from 'vitest'

const TEST_ENV = {
  BACKEND_PORT: 3001,
  NODE_ENV: 'test',
  SUPABASE_DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/solarsim',
  GOOGLE_API_KEY: 'google-api-key',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  FRONTEND_URL: 'http://localhost:5173',
  PDF_TOKEN_SECRET: 'test-secret-at-least-32-characters-long-ok',
  GEMINI_API_KEY: 'gemini-api-key',
  GOOGLE_CLOUD_PROJECT: 'vertex-project',
  GOOGLE_CLOUD_LOCATION: 'global',
  CHAT_MODEL: 'gemini-2.5-flash',
  port: 3001
} as const

vi.mock('../../../config/env.js', () => ({
  env: TEST_ENV
}))

const { renderProjectDigest } = await import('../digest.js')

type ChatProject = Parameters<typeof renderProjectDigest>[0]

function makeProject(overrides: Partial<ChatProject> = {}): ChatProject {
  return {
    id: 'project-1',
    name: 'Taman Melawati Terrace',
    analysisConfig: {
      selectedPanelModelId: 'panel-420w',
      systemKwp: 6.56,
      systemCostRm: 28000,
      tariffEscalationRate: 0.03,
      performanceRatio: 0.82
    },
    analysisResults: {
      monthlyBreakdown: [
        {
          month: 1,
          consumptionKwh: 900,
          generationKwh: 650,
          billableKwh: 250,
          creditUsed: 0,
          creditBalance: 0,
          creditForfeited: 0,
          baselineBill: {
            kwh: 900,
            energy: 300,
            capacity: 0,
            network: 0,
            retail: 10,
            afa: 5,
            eeiRebate: 0,
            preTaxSubtotal: 315,
            reFund: 0,
            sst: 0,
            total: 315
          },
          nemBill: {
            kwh: 250,
            energy: 80,
            capacity: 0,
            network: 0,
            retail: 10,
            afa: 5,
            eeiRebate: 0,
            preTaxSubtotal: 95,
            reFund: 0,
            sst: 0,
            total: 95
          },
          savingsRm: 220
        }
      ],
      annualTotals: {
        totalConsumptionKwh: 10800,
        totalGenerationKwh: 7800,
        totalBaselineRm: 3780,
        totalNemRm: 1140,
        totalSavingsRm: 2640,
        totalCreditsForfeitedKwh: 12
      },
      averageMonthlySavingsRm: 220,
      averageMonthlySavingsPct: 69.8,
      paybackYears: 8.2,
      tenYearNetBenefitRm: 18450.75,
      tenYearRoiPercent: 65.9,
      twentyFiveYearNetBenefitRm: 74500.12,
      simplePaybackYears: 7.5,
      simpleTwentyFiveYearNetBenefitRm: 70100,
      lifecyclePaybackYears: 8.2,
      lifecycleTwentyFiveYearNetBenefitRm: 74500.12,
      analysisMode: 'lifecycle',
      carbonOffsetKg: 5520,
      activePanelCount: 14
    },
    layoutPreferences: {
      sizingGoal: 'balanced',
      roofDirection: 'south',
      billRange: '200-400'
    },
    editedLayout: [
      {
        id: 'panel-1',
        status: 'kept',
        center: { lat: 3.211, lng: 101.734 },
        rotation: 0,
        monthlyEnergyDcKwh: [1]
      },
      {
        id: 'panel-2',
        status: 'moved',
        center: { lat: 3.212, lng: 101.735 },
        rotation: 90,
        monthlyEnergyDcKwh: [1]
      }
    ],
    location: {
      status: 'ready',
      lat: 3.139,
      lng: 101.6869,
      imageryQuality: 'HIGH',
      buildingInsightsJson: {
        boundingBox: {
          sw: { latitude: 3.138, longitude: 101.686 },
          ne: { latitude: 3.14, longitude: 101.688 }
        },
        solarPotential: {
          panelWidthMeters: 1.1,
          panelHeightMeters: 1.8,
          panelCapacityWatts: 420,
          maxArrayPanelsCount: 18,
          solarPanels: [
            { id: 'panel-1', orientation: 'PORTRAIT', segmentIndex: 1 },
            { id: 'panel-2', orientation: 'LANDSCAPE', segmentIndex: 2 }
          ]
        }
      }
    },
    ...overrides
  } as ChatProject
}

describe('renderProjectDigest', () => {
  it('includes project and layout sections for the workbench page', () => {
    const digest = renderProjectDigest(makeProject(), 'workbench')

    expect(digest).toContain('## Project')
    expect(digest).toContain('## Layout')
  })

  it('includes project and financial analysis sections for the analysis page', () => {
    const digest = renderProjectDigest(makeProject(), 'analysis')

    expect(digest).toContain('## Project')
    expect(digest).toContain('## Financial Analysis')
    expect(digest).toContain('- Payback: 8.2 years (lifecycle mode)')
    expect(digest).toContain('- 25-yr net benefit: RM 74500.12')
  })

  it('emits the fallback line when analysis results are missing on the analysis page', () => {
    const digest = renderProjectDigest(makeProject({ analysisResults: null }), 'analysis')

    expect(digest).toContain('Analysis not yet computed. Direct the user to the AnalysisPage.')
  })

  it('truncates output to 6000 chars or less', () => {
    const digest = renderProjectDigest(
      makeProject({
        name: 'N'.repeat(5000),
        analysisConfig: {
          selectedPanelModelId: 'P'.repeat(5000),
          systemKwp: 6.56,
          systemCostRm: 28000,
          tariffEscalationRate: 0.03,
          performanceRatio: 0.82
        }
      }),
      'analysis'
    )

    expect(digest.length).toBeLessThanOrEqual(6000)
  })

  it('overlays liveState analysisResults on top of a project that has none persisted', () => {
    // Project starts with no analysis on the DB row (user is editing the AnalysisPage form
    // but hasn't hit Save yet). Without liveState the digest emits the "not yet computed"
    // fallback; with liveState the live numbers must take over.
    const project = makeProject({ analysisResults: null, analysisConfig: null })
    const baseline = renderProjectDigest(project, 'analysis')
    expect(baseline).toContain('Analysis not yet computed.')

    const liveAnalysisResults = makeProject().analysisResults
    const liveAnalysisConfig = makeProject().analysisConfig
    const overlaid = renderProjectDigest(project, 'analysis', {
      analysisConfig: liveAnalysisConfig,
      analysisResults: liveAnalysisResults
    })

    expect(overlaid).not.toContain('Analysis not yet computed.')
    expect(overlaid).toContain('Annual savings: RM')
    expect(overlaid).toContain('Payback:')
  })

  it('falls back to persisted values for any liveState field left undefined', () => {
    const project = makeProject({ analysisResults: null })
    const overlaid = renderProjectDigest(project, 'analysis', {
      // Only override analysisResults; analysisConfig should still come from the project row.
      analysisResults: makeProject().analysisResults
    })

    // analysisConfig from the project (systemCostRm: 28000) should still be cited.
    expect(overlaid).toContain('System cost: RM 28000.00')
  })
})
