import type { TourStep } from '@/components/ui/GuidedTour'
import type { TFunction } from 'i18next'

export function getWorkbenchTourSteps(t: TFunction): TourStep[] {
  return [
    {
      title: t('tour.step1Title'),
      description: t('tour.step1Body'),
      placement: 'center' as const
    },
    {
      target: '[data-tour="layout-preset"]',
      title: t('tour.step2Title'),
      description: t('tour.step2Body')
    },
    {
      target: '[data-tour="panel-model"]',
      title: t('tour.step3Title'),
      description: t('tour.step3Body')
    },
    {
      target: '[data-tour="canvas-controls"]',
      title: t('tour.step4Title'),
      description: t('tour.step4Body'),
      placement: 'left' as const
    },
    {
      target: '[data-tour="save-continue"]',
      title: t('tour.step5Title'),
      description: t('tour.step5Body')
    }
  ]
}
