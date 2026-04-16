import type { ProjectStatus } from '@shared/types'
import { Map, Wrench, BarChart3 } from 'lucide-react'
import type { ComponentType } from 'react'

type BadgeVariant = 'default' | 'secondary' | 'outline'

type StatusConfig = {
  label: string
  variant: BadgeVariant
  icon: ComponentType<{ className?: string }>
  tooltip: string
}

const STATUS_CONFIGS: Record<ProjectStatus, StatusConfig> = {
  draft: {
    label: 'Draft',
    variant: 'outline',
    icon: Map,
    tooltip: 'Location selected — layout not yet saved'
  },
  layout_saved: {
    label: 'Layout Saved',
    variant: 'secondary',
    icon: Wrench,
    tooltip: 'Panel layout committed — analysis not yet saved'
  },
  analysis_saved: {
    label: 'Analysis Saved',
    variant: 'default',
    icon: BarChart3,
    tooltip: 'Analysis results saved'
  }
}

export function getProjectStatusConfig(status: ProjectStatus): StatusConfig {
  return STATUS_CONFIGS[status] ?? STATUS_CONFIGS.draft
}

export function getProjectStatusLabel(status: ProjectStatus): string {
  return getProjectStatusConfig(status).label
}

export function getProjectStatusVariant(status: ProjectStatus): BadgeVariant {
  return getProjectStatusConfig(status).variant
}

export function getProjectStatusTooltip(status: ProjectStatus): string {
  return getProjectStatusConfig(status).tooltip
}
