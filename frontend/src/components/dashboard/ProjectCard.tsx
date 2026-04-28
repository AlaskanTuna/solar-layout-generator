import type { ProjectResponse } from '@/api/projects'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trash2, Clock, FolderOpen, ArrowRight, Receipt, Zap, Leaf, Sun } from 'lucide-react'
import { formatRelativeDate } from './helpers'
import { getProjectStatusConfig } from '@/lib/projectStatus'

/** Render the project card */
export function ProjectCard({
  project,
  onOpen,
  onDelete,
}: {
  project: ProjectResponse
  onOpen: () => void
  onDelete: () => void
}) {
  const config = getProjectStatusConfig(project.status)
  const analysis = project.status === 'analysis_saved' ? project.analysisResults : null

  return (
    <div
      className="glass-card group cursor-pointer p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
      onClick={onOpen}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FolderOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-heading font-semibold">{project.name}</h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{formatRelativeDate(project.updatedAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant={config.variant} className="gap-1">
            <config.icon className="h-3 w-3" />
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

      {/* Inline metrics for completed projects */}
      {analysis && (
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-muted/40 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Receipt className="h-3 w-3 text-green-500" />
              Savings/mo
            </span>
            <span className="font-medium text-green-600 dark:text-green-400">RM {analysis.averageMonthlySavingsRm.toFixed(0)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Zap className="h-3 w-3 text-primary" />
              Annual
            </span>
            <span className="font-medium">{(analysis.annualTotals.totalGenerationKwh / 1000).toFixed(1)} MWh</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Leaf className="h-3 w-3 text-emerald-500" />
              CO2
            </span>
            <span className="font-medium">{(analysis.carbonOffsetKg / 1000).toFixed(1)} t/yr</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Sun className="h-3 w-3 text-amber-500" />
              Panels
            </span>
            <span className="font-medium">{analysis.activePanelCount}</span>
          </div>
        </div>
      )}

      {/* Progress bar for incomplete projects */}
      {project.status !== 'analysis_saved' && (
        <div className="mt-3">
          <div className="flex gap-1">
            <div className="h-1 flex-1 rounded-full bg-primary" />
            <div className={`h-1 flex-1 rounded-full ${project.status === 'layout_saved' ? 'bg-primary' : 'bg-muted'}`} />
            <div className="h-1 flex-1 rounded-full bg-muted" />
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            {project.status === 'draft' ? 'Next: Adjust your panel layout' : 'Next: View your savings analysis'}
          </p>
        </div>
      )}

      {/* Open link */}
      <div className="mt-2 flex items-center justify-end">
        <span className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          Open project
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </div>
  )
}
