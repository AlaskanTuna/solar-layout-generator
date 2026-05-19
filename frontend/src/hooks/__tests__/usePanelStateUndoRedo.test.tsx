import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { usePanelState } from '../usePanelState'

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
  }
]

const roofSegments = [{ azimuthDegrees: 180 }]

function setup() {
  return renderHook(() =>
    usePanelState({
      projectId: 'project_1',
      locationId: undefined,
      solarPanels,
      roofSegments,
      editedLayout: null,
      maxArrayPanelsCount: 2,
      carbonOffsetFactorKgPerMwh: 700
    })
  )
}

describe('usePanelState undo/redo', () => {
  it('undo then redo restores the post-action state', () => {
    const { result } = setup()

    act(() => {
      result.current.movePanel('panel_0', { lat: 3.2, lng: 101.7 })
    })
    expect(result.current.getPanel('panel_0')?.center).toEqual({ lat: 3.2, lng: 101.7 })

    act(() => {
      result.current.undo()
    })
    expect(result.current.getPanel('panel_0')?.center).toEqual({ lat: 3.14, lng: 101.68 })

    act(() => {
      result.current.redo()
    })
    // The bug: previously this returned the pre-move state instead of the post-move state.
    expect(result.current.getPanel('panel_0')?.center).toEqual({ lat: 3.2, lng: 101.7 })
  })

  it('redo after a chain of moves restores the latest state', () => {
    const { result } = setup()

    act(() => {
      result.current.movePanel('panel_0', { lat: 3.2, lng: 101.7 })
      result.current.movePanel('panel_1', { lat: 3.3, lng: 101.8 })
    })

    act(() => {
      result.current.undo()
    })
    expect(result.current.getPanel('panel_1')?.center).toEqual({ lat: 3.141, lng: 101.681 })

    act(() => {
      result.current.redo()
    })
    expect(result.current.getPanel('panel_1')?.center).toEqual({ lat: 3.3, lng: 101.8 })
  })

  it('redo after rotate restores the rotated state', () => {
    const { result } = setup()

    act(() => {
      result.current.rotatePanel('panel_0', 90)
    })
    expect(result.current.getPanel('panel_0')?.rotation).toBe(90)

    act(() => {
      result.current.undo()
    })

    act(() => {
      result.current.redo()
    })
    expect(result.current.getPanel('panel_0')?.rotation).toBe(90)
  })

  it('redo after delete restores the deleted state', () => {
    const { result } = setup()

    act(() => {
      result.current.deletePanel('panel_0')
    })
    expect(result.current.getPanel('panel_0')?.deleted).toBe(true)

    act(() => {
      result.current.undo()
    })
    expect(result.current.getPanel('panel_0')?.deleted).toBe(false)

    act(() => {
      result.current.redo()
    })
    expect(result.current.getPanel('panel_0')?.deleted).toBe(true)
  })
})
