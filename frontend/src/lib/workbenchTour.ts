/**
 * First-time workbench tour step definitions.
 *
 * Drives the guided overlay shown when a user lands on the workbench for the
 * first time. Step ids are not strictly sequential in this array because
 * the tour was reordered after the sidebar layout changed but the persisted
 * "last-seen step" key in localStorage still references the original ids —
 * renaming them would re-fire the tour for existing users.
 */

import type { TourStep } from '@/components/ui/GuidedTour'
import type { TFunction } from 'i18next'

/**
 * Returns the ordered tour step list. `t` is i18next's translation function so
 * step copy is locale-aware.
 */
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
      target: '[data-tour="chat-launcher"]',
      title: t('tour.step6Title'),
      description: t('tour.step6Body'),
      placement: 'left' as const
    },
    {
      target: '[data-tour="save-continue"]',
      title: t('tour.step5Title'),
      description: t('tour.step5Body')
    }
  ]
}
