import type { TourStep } from '@/components/ui/GuidedTour'

export const WORKBENCH_TOUR_STEPS: TourStep[] = [
  {
    title: 'Your Roof Layout',
    description:
      'Welcome! This page shows solar panels placed on your rooftop by satellite analysis. The blue rectangles are solar panels — you can customise this layout before calculating your savings.'
  },
  {
    target: '[data-tour="panel-model"]',
    title: 'Choose Your Panel Model',
    description:
      'Pick a solar panel brand and model. Different panels have different sizes, efficiency, and prices. The default (Jinko Tiger Neo) is a popular choice in Malaysia.'
  },
  {
    target: '[data-tour="panel-count"]',
    title: 'How Many Panels?',
    description:
      'Slide left to remove panels, right to add more. The system keeps the highest-performing panels first. More panels = more savings, but also higher installation cost.'
  },
  {
    title: 'Arrange Your Panels',
    description:
      'Click a panel to select it. Drag to reposition, use the sidebar slider to rotate, or press Delete to remove. Hold spacebar to pan around while keeping your current selection.',
    placement: 'center' as const
  },
  {
    target: '[data-tour="canvas-controls"]',
    title: 'Canvas Controls',
    description:
      'Undo/redo your edits, use the marquee tool to drag-select groups of panels, toggle snap alignment for precise placement, zoom in/out, and switch overlay views.',
    placement: 'left' as const
  },
  {
    target: '[data-tour="save-continue"]',
    title: 'Save & Continue',
    description:
      'Happy with the layout? Click "Save & Continue" to save your arrangement and move to the savings analysis page. You can always come back to adjust later.'
  }
]
