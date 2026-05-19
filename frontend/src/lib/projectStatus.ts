/**
 * Project status presentation helpers.
 *
 * Maps the three `ProjectStatus` values (`draft`, `layout_saved`,
 * `analysis_saved`) to UI metadata: label, badge variant, icon, and tooltip.
 * Used by the projects list, project card, and breadcrumbs to keep status
 * styling consistent across the app.
 */

import type { ProjectStatus } from '@shared/types'
import { Map, Wrench, BarChart3 } from 'lucide-react'
import type { ComponentType } from 'react'

type BadgeVariant = 'default' | 'secondary' | 'outline'

/** Per-status UI metadata used everywhere a status badge is rendered. */
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

/**
 * Returns the full UI config for a project status (label, variant, icon,
 * tooltip). Falls back to `draft` for unknown statuses so the badge always
 * renders something sensible.
 */
export function getProjectStatusConfig(status: ProjectStatus): StatusConfig {
  return STATUS_CONFIGS[status] ?? STATUS_CONFIGS.draft
}

/** Returns the human-facing label for a project status. */
export function getProjectStatusLabel(status: ProjectStatus): string {
  return getProjectStatusConfig(status).label
}

/** Returns the shadcn Badge variant to use for a project status. */
export function getProjectStatusVariant(status: ProjectStatus): BadgeVariant {
  return getProjectStatusConfig(status).variant
}

/** Returns the tooltip text explaining what a project status means. */
export function getProjectStatusTooltip(status: ProjectStatus): string {
  return getProjectStatusConfig(status).tooltip
}
