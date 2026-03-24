import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { usePanelState } from './usePanelState'

const solarPanels = [
  {
    id: 'panel_0',
    center: { lat: 3.14, lng: 101.68 },
    orientation: 'LANDSCAPE' as const,
    yearlyEnergyDcKwh: 520,
    segmentIndex: 0
  },
  {
    id: 'panel_1',
    center: { lat: 3.141, lng: 101.681 },
    orientation: 'PORTRAIT' as const,
    yearlyEnergyDcKwh: 510,
    segmentIndex: 0
  },
  {
    id: 'panel_2',
    center: { lat: 3.142, lng: 101.682 },
    orientation: 'LANDSCAPE' as const,
    yearlyEnergyDcKwh: 500,
    segmentIndex: 1
  },
  {
    id: 'panel_3',
    center: { lat: 3.143, lng: 101.683 },
    orientation: 'LANDSCAPE' as const,
    yearlyEnergyDcKwh: 490,
    segmentIndex: 1
  },
  {
    id: 'panel_4',
    center: { lat: 3.144, lng: 101.684 },
    orientation: 'PORTRAIT' as const,
    yearlyEnergyDcKwh: 480,
    segmentIndex: 0
  },
  {
    id: 'panel_5',
    center: { lat: 3.145, lng: 101.685 },
    orientation: 'LANDSCAPE' as const,
    yearlyEnergyDcKwh: 470,
    segmentIndex: 1
  }
]

const roofSegments = [{ azimuthDegrees: 180 }, { azimuthDegrees: 135 }]

describe('usePanelState', () => {
  it('hydrates saved edits and restores saved visible panel count', () => {
    const editedLayout = [
      {
        id: 'panel_1',
        status: 'moved' as const,
        center: { lat: 3.2, lng: 101.7 },
        rotation: 45,
        monthlyEnergyDcKwh: [10, 20, 30]
      },
      {
        id: 'panel_4',
        status: 'deleted' as const,
        center: solarPanels[4].center,
        rotation: 180,
        monthlyEnergyDcKwh: []
      }
    ]

    const { result } = renderHook(() =>
      usePanelState({
        projectId: 'project_1',
        solarPanels,
        roofSegments,
        editedLayout,
        maxArrayPanelsCount: 5,
        carbonOffsetFactorKgPerMwh: 700
      })
    )

    expect(result.current.visibleCount).toBe(5)
    expect(result.current.getPanel('panel_1')?.center).toEqual({ lat: 3.2, lng: 101.7 })
    expect(result.current.getPanel('panel_1')?.rotation).toBe(45)
    expect(result.current.getPanel('panel_4')?.deleted).toBe(true)
  })

  it('serializes moved, deleted, and slider-hidden panels correctly', () => {
    const { result } = renderHook(() =>
      usePanelState({
        projectId: 'project_1',
        solarPanels,
        roofSegments,
        editedLayout: null,
        maxArrayPanelsCount: 6,
        carbonOffsetFactorKgPerMwh: 700
      })
    )

    act(() => {
      result.current.movePanel('panel_0', { lat: 3.15, lng: 101.69 })
      result.current.rotatePanel('panel_1', 450)
      result.current.deletePanel('panel_2')
      result.current.updatePanelEnergy('panel_1', [50, 50, 50, 50])
      result.current.setVisibleCount(4)
    })

    const serialized = result.current.serializeLayout()

    expect(serialized.find((panel) => panel.id === 'panel_0')).toMatchObject({
      status: 'moved',
      center: { lat: 3.15, lng: 101.69 }
    })
    expect(serialized.find((panel) => panel.id === 'panel_1')).toMatchObject({
      status: 'moved',
      rotation: 90,
      monthlyEnergyDcKwh: [50, 50, 50, 50]
    })
    expect(serialized.find((panel) => panel.id === 'panel_2')).toMatchObject({
      status: 'deleted'
    })
    expect(serialized.find((panel) => panel.id === 'panel_5')).toMatchObject({
      status: 'deleted'
    })
  })
})
