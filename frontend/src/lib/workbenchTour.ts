import type { TourStep } from '@/components/ui/GuidedTour'

export const WORKBENCH_TOUR_STEPS: TourStep[] = [
  {
    title: 'Your Roof Layout',
    description:
      'The blue rectangles are solar panels placed on your roof by satellite analysis. You can tweak this layout before calculating your savings. Hover the info icons beside each control for deeper detail.',
    placement: 'center' as const
  },
  {
    target: '[data-tour="layout-preset"]',
    title: 'Layout Preset',
    description:
      "Tell us your monthly bill and savings goal — we'll right-size the layout for you. You can re-open this anytime, or skip to keep the maximum-coverage default."
  },
  {
    target: '[data-tour="panel-model"]',
    title: 'Shape the Layout',
    description:
      'Pick a panel model and count from the sidebar, then click any panel on the canvas to drag, rotate or delete it.'
  },
  {
    target: '[data-tour="canvas-controls"]',
    title: 'Canvas Tools',
    description:
      'The toolbar handles the rest: undo/redo, marquee select to edit groups of panels at once, snap alignment for clean edges, zoom, and layer toggles for flux and satellite overlays.',
    placement: 'left' as const
  },
  {
    target: '[data-tour="save-continue"]',
    title: 'Save & Continue',
    description:
      'Happy with the layout? Click "Save & Continue" to move on to the savings analysis. You can always come back to adjust.'
  }
]
