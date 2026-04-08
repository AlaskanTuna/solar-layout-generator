import { describe, expect, it } from 'vitest'
import {
  annualEnergyFromMonthly,
  getInitialPanelRotation,
  normalizeRotation,
  parseBuildingInsights,
  parsePanelEdits
} from '../buildingInsights'

describe('buildingInsights', () => {
  it('parses building insights and falls back optional values safely', () => {
    const parsed = parseBuildingInsights({
      boundingBox: {
        sw: { latitude: 3.1, longitude: 101.6 },
        ne: { latitude: 3.2, longitude: 101.7 }
      },
      solarPotential: {
        panelWidthMeters: 1.134,
        panelHeightMeters: 2.278,
        panelCapacityWatts: 450,
        roofSegmentStats: [{ azimuthDegrees: 180, pitchDegrees: 15 }],
        solarPanels: [
          {
            id: 'panel_0',
            center: { latitude: 3.15, longitude: 101.65 },
            orientation: 'PORTRAIT',
            yearlyEnergyDcKwh: 540.2,
            segmentIndex: 0
          }
        ]
      }
    })

    expect(parsed).not.toBeNull()
    expect(parsed?.solarPotential.maxArrayPanelsCount).toBe(1)
    expect(parsed?.solarPotential.carbonOffsetFactorKgPerMwh).toBe(0)
    expect(parsed?.solarPotential.solarPanels[0]).toEqual({
      id: 'panel_0',
      center: { lat: 3.15, lng: 101.65 },
      orientation: 'PORTRAIT',
      yearlyEnergyDcKwh: 540.2,
      segmentIndex: 0
    })
  })

  it('rejects invalid building insights payloads and filters invalid panel edits', () => {
    expect(
      parseBuildingInsights({
        boundingBox: { sw: { latitude: 3.1, longitude: 101.6 }, ne: { latitude: 3.2, longitude: 101.7 } },
        solarPotential: { panelHeightMeters: 2.278, panelCapacityWatts: 450 }
      })
    ).toBeNull()

    expect(
      parsePanelEdits([
        {
          id: 'panel_0',
          status: 'moved',
          center: { lat: 3.15, lng: 101.65 },
          rotation: 450,
          monthlyEnergyDcKwh: [10, 20, 'oops', 30]
        },
        { id: 'panel_1', status: 'bad-status', center: { lat: 0, lng: 0 }, rotation: 0 }
      ])
    ).toEqual([
      {
        id: 'panel_0',
        status: 'moved',
        center: { lat: 3.15, lng: 101.65 },
        rotation: 450,
        monthlyEnergyDcKwh: [10, 20, 30]
      }
    ])
  })

  it('normalizes rotations and derives initial panel rotations from orientation and roof azimuth', () => {
    expect(normalizeRotation(-45)).toBe(315)
    expect(normalizeRotation(725)).toBe(5)

    expect(
      getInitialPanelRotation(
        {
          id: 'panel_0',
          center: { lat: 0, lng: 0 },
          orientation: 'PORTRAIT',
          yearlyEnergyDcKwh: 100,
          segmentIndex: 0
        },
        [{ azimuthDegrees: 180 }]
      )
    ).toBe(180)

    expect(annualEnergyFromMonthly([10, 20, 30])).toBe(60)
  })
})
