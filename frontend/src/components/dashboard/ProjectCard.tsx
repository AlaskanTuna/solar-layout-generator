import type { ProjectResponse } from '@/api/projects'
import type { AnalysisResultsRecord } from '@/lib/analysis'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Trash2, Clock, FolderOpen, ArrowRight, Map, Wrench, BarChart3, Receipt, Zap, Leaf, Sun } from 'lucide-react'
import { formatRelativeDate } from './helpers'

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline'; icon: React.ReactNode }
> = {
  draft: { label: 'Draft', variant: 'outline', icon: <Map className="h-3 w-3" /> },
  layout_saved: { label: 'Layout Saved', variant: 'secondary', icon: <Wrench className="h-3 w-3" /> },
  analysis_saved: { label: 'Analysis Complete', variant: 'default', icon: <BarChart3 className="h-3 w-3" /> }
}

function ProjectMetricsTooltip({ analysis }: { analysis: AnalysisResultsRecord }) {
  const energyKwh = analysis.annualTotals.totalGenerationKwh
  const carbonKg = analysis.carbonOffsetKg
  const panels = analysis.activePanelCount
  const savings = analysis.averageMonthlySavingsRm

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-white">
      <div className="flex items-center gap-1.5">
        <Receipt className="h-3 w-3 text-green-400" />
        Savings/mo
      </div>
      <div className="font-medium text-green-400">RM {savings.toFixed(0)}</div>

      <div className="flex items-center gap-1.5">
        <Zap className="h-3 w-3 text-green-400" />
        Annual Energy
      </div>
      <div className="font-medium text-white">{(energyKwh / 1000).toFixed(1)} MWh</div>

      <div className="flex items-center gap-1.5">
        <Leaf className="h-3 w-3 text-green-400" />
        CO2 Offset
      </div>
      <div className="font-medium text-white">{(carbonKg / 1000).toFixed(1)} t/yr</div>

      <div className="flex items-center gap-1.5">
        <Sun className="h-3 w-3 text-green-400" />
        Panels
      </div>
      <div className="font-medium text-white">{panels}</div>
    </div>
  )
}

export function ProjectCard({
  project,
  onOpen,
  onDelete
}: {
  project: ProjectResponse
  onOpen: () => void
  onDelete: () => void
}) {
  const config = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.draft
  const analysis = project.status === 'analysis_saved' ? project.analysisResults : null

  return (
    <div
      className="glass-card group cursor-pointer p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FolderOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate font-heading font-semibold">{project.name}</h3>
              {analysis && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="shrink-0 rounded-full p-0.5 text-muted-foreground transition-colors hover:text-primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <BarChart3 className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="p-3">
                      <ProjectMetricsTooltip analysis={analysis} />
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{formatRelativeDate(project.updatedAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant={config.variant} className="gap-1">
            {config.icon}
            <span className="hidden sm:inline">{config.label}</span>
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {project.status !== 'analysis_saved' && (
        <div className="mt-3">
          <div className="flex gap-1">
            <div className="h-1 flex-1 rounded-full bg-primary" />
            <div
              className={`h-1 flex-1 rounded-full ${project.status === 'layout_saved' ? 'bg-primary' : 'bg-muted'}`}
            />
            <div className="h-1 flex-1 rounded-full bg-muted" />
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            {project.status === 'draft' ? 'Next: Adjust your panel layout' : 'Next: View your savings analysis'}
          </p>
        </div>
      )}

      <div className="mt-2 flex items-center justify-end">
        <span className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          Open project
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </div>
  )
}
