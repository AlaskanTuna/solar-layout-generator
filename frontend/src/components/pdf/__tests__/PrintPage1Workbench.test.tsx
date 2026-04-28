import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PrintPage1Workbench } from '../PrintPage1Workbench'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@shared/types', () => ({
  DEFAULT_PANEL_MODEL_ID: 'default-panel',
  getPanelModel: () => ({
    name: 'Test Panel',
    capacityWp: 450,
    widthM: 1.1,
    heightM: 1.9
  })
}))

vi.mock('@/lib/buildingInsights', () => ({
  parsePanelEdits: () => [
    {
      status: 'active',
      center: { lat: 1.23, lng: 4.56 },
      rotation: 0
    }
  ]
}))

vi.mock('@/lib/canvasTransforms', () => ({
  createCanvasGeo: vi.fn(),
  latLngToPixel: vi.fn(),
  panelMetersToPixels: () => ({
    width: 10,
    height: 20
  })
}))

describe('PrintPage1Workbench', () => {
  it('keeps the workbench hero image within the first-page print height budget', () => {
    render(
      <PrintPage1Workbench
        project={
          {
            editedLayout: [],
            analysisConfig: { selectedPanelModelId: 'default-panel', roofType: 'tile' },
            imageGeoTransform: null,
            rgbSignedUrl: 'https://example.com/workbench.png'
          } as never
        }
      />
    )

    const image = screen.getByRole('img', { name: 'page1.imageAlt' })
    const imageFrame = image.parentElement
    const contentColumn = imageFrame?.parentElement?.parentElement

    expect(image.getAttribute('style')).toContain('max-height: 136mm')
    expect(contentColumn?.className).toContain('gap-2')
  })
})
