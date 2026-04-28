import { describe, expect, it } from 'vitest'
import {
  getProjectStatusLabel,
  getProjectStatusVariant,
  getProjectStatusTooltip,
  getProjectStatusConfig
} from '../projectStatus'
import type { ProjectStatus } from '@shared/types'

const ALL_STATUSES: ProjectStatus[] = ['draft', 'layout_saved', 'analysis_saved']

describe('getProjectStatusLabel', () => {
  it('returns the correct label for each status', () => {
    expect(getProjectStatusLabel('draft')).toBe('Draft')
    expect(getProjectStatusLabel('layout_saved')).toBe('Layout Saved')
    expect(getProjectStatusLabel('analysis_saved')).toBe('Analysis Saved')
  })
})

describe('getProjectStatusVariant', () => {
  it('returns outline for draft', () => {
    expect(getProjectStatusVariant('draft')).toBe('outline')
  })

  it('returns secondary for layout_saved', () => {
    expect(getProjectStatusVariant('layout_saved')).toBe('secondary')
  })

  it('returns default for analysis_saved', () => {
    expect(getProjectStatusVariant('analysis_saved')).toBe('default')
  })
})

describe('getProjectStatusTooltip', () => {
  it('returns a non-empty tooltip for every status', () => {
    for (const status of ALL_STATUSES) {
      expect(getProjectStatusTooltip(status).length).toBeGreaterThan(0)
    }
  })
})

describe('getProjectStatusConfig', () => {
  it('returns a config object with label, variant, icon, and tooltip for every status', () => {
    for (const status of ALL_STATUSES) {
      const config = getProjectStatusConfig(status)
      expect(config.label).toBeTruthy()
      expect(config.variant).toBeTruthy()
      expect(config.icon).toBeTruthy()
      expect(config.tooltip).toBeTruthy()
    }
  })

  it('analysis_saved label does not contain the word "Complete"', () => {
    expect(getProjectStatusLabel('analysis_saved')).not.toContain('Complete')
  })

  it('analysis_saved label does not contain the word "Ready"', () => {
    expect(getProjectStatusLabel('analysis_saved')).not.toContain('Ready')
  })
})
