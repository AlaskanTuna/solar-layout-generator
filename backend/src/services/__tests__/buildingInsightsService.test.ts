import { describe, expect, it } from 'vitest'
import { parsePanelSpecs } from '../buildingInsightsService.js'

describe('parsePanelSpecs', () => {
  it('returns panel specs for valid building insights', () => {
    const parsed = parsePanelSpecs({
      solarPotential: {
        panelWidthMeters: 1.0,
        panelHeightMeters: 1.8,
        panelCapacityWatts: 450
      }
    })

    expect(parsed).toEqual({
      panelWidthMeters: 1.0,
      panelHeightMeters: 1.8,
      panelCapacityWatts: 450
    })
  })

  it('returns null when solarPotential is missing', () => {
    const parsed = parsePanelSpecs({})
    expect(parsed).toBeNull()
  })

  it('returns null when values are non-positive', () => {
    const parsed = parsePanelSpecs({
      solarPotential: {
        panelWidthMeters: 0,
        panelHeightMeters: -1,
        panelCapacityWatts: 450
      }
    })

    expect(parsed).toBeNull()
  })
})
