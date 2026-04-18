import type { ProjectResponse } from '@/api/projects'
import { getPanelModel, DEFAULT_PANEL_MODEL_ID } from '@shared/types'
import { parsePanelEdits } from '@/lib/buildingInsights'

type Props = { project: ProjectResponse }

const ROOF_LABEL = { tile: 'Tile', metal: 'Metal', flat: 'Flat' } as const

export function PrintPage1Workbench({ project }: Props) {
  const activePanels = parsePanelEdits(project.editedLayout).filter((p) => p.status !== 'deleted')
  const panelModel = getPanelModel(project.analysisConfig?.selectedPanelModelId ?? DEFAULT_PANEL_MODEL_ID)
  const panelCapacityWp = panelModel?.capacityWp ?? 0
  const systemKwp = Math.round(((activePanels.length * panelCapacityWp) / 1000) * 100) / 100
  const roofType = project.analysisConfig?.roofType ?? 'tile'
  const generatedAt = new Date().toLocaleDateString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })

  return (
    <section className="pdf-page pdf-page-break">
      <header className="mb-8 border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <span className="text-lg font-bold text-primary-foreground">S</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Solar Installation Report</h1>
            <p className="text-sm text-muted-foreground">
              {project.name} &middot; Generated {generatedAt}
            </p>
          </div>
        </div>
      </header>

      <div>
        <h2 className="text-lg font-semibold text-foreground">Installation Overview</h2>
        <p className="text-sm text-muted-foreground">Panel layout and hardware selection from the Workbench.</p>

        {project.rgbSignedUrl && (
          <div className="mt-6 overflow-hidden rounded-lg border border-border">
            <img
              src={project.rgbSignedUrl}
              alt="Rooftop satellite view"
              className="block h-auto w-full object-contain"
            />
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-6">
          <StatTile label="Active panels" value={String(activePanels.length)} suffix="panels" />
          <StatTile label="System size" value={systemKwp.toString()} suffix="kWp" />
          <StatTile label="Panel model" value={panelModel?.name ?? '—'} suffix={panelModel ? `${panelCapacityWp} Wp` : ''} />
          <StatTile label="Roof type" value={ROOF_LABEL[roofType] ?? '—'} suffix="" />
        </div>
      </div>
    </section>
  )
}

function StatTile({ label, value, suffix }: { label: string; value: string; suffix: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      {suffix && <p className="text-xs text-muted-foreground">{suffix}</p>}
    </div>
  )
}
