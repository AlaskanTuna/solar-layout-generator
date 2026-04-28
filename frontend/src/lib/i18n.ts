import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import enCommon from '@/locales/en/common.json'
import enNav from '@/locales/en/nav.json'
import enAuth from '@/locales/en/auth.json'
import enLanding from '@/locales/en/landing.json'
import enDashboard from '@/locales/en/dashboard.json'
import enProjects from '@/locales/en/projects.json'
import enMap from '@/locales/en/map.json'
import enWorkbench from '@/locales/en/workbench.json'
import enAnalysis from '@/locales/en/analysis.json'
import enPdf from '@/locales/en/pdf.json'
import enFaq from '@/locales/en/faq.json'
import enSettings from '@/locales/en/settings.json'
import enNotifications from '@/locales/en/notifications.json'

import msCommon from '@/locales/ms/common.json'
import msNav from '@/locales/ms/nav.json'
import msAuth from '@/locales/ms/auth.json'
import msLanding from '@/locales/ms/landing.json'
import msDashboard from '@/locales/ms/dashboard.json'
import msProjects from '@/locales/ms/projects.json'
import msMap from '@/locales/ms/map.json'
import msWorkbench from '@/locales/ms/workbench.json'
import msAnalysis from '@/locales/ms/analysis.json'
import msPdf from '@/locales/ms/pdf.json'
import msFaq from '@/locales/ms/faq.json'
import msSettings from '@/locales/ms/settings.json'
import msNotifications from '@/locales/ms/notifications.json'

import zhCommon from '@/locales/zh/common.json'
import zhNav from '@/locales/zh/nav.json'
import zhAuth from '@/locales/zh/auth.json'
import zhLanding from '@/locales/zh/landing.json'
import zhDashboard from '@/locales/zh/dashboard.json'
import zhProjects from '@/locales/zh/projects.json'
import zhMap from '@/locales/zh/map.json'
import zhWorkbench from '@/locales/zh/workbench.json'
import zhAnalysis from '@/locales/zh/analysis.json'
import zhPdf from '@/locales/zh/pdf.json'
import zhFaq from '@/locales/zh/faq.json'
import zhSettings from '@/locales/zh/settings.json'
import zhNotifications from '@/locales/zh/notifications.json'

/** Locale codes the app ships translations for. First entry is the i18next fallback. */
export const SUPPORTED_LOCALES = ['en', 'ms', 'zh'] as const

/** Union of every locale code in {@link SUPPORTED_LOCALES}. */
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

/** Default locale used before the language detector resolves. */
export const DEFAULT_LOCALE: SupportedLocale = 'en'

/** localStorage key i18next reads/writes the active locale to. */
export const LOCALE_STORAGE_KEY = 'locale'

/** Human-readable label shown in the language switcher, keyed by locale code. */
export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  ms: 'Bahasa Melayu',
  zh: '中文'
}

/**
 * BCP 47 tags passed to `Intl.NumberFormat` / `Intl.DateTimeFormat`.
 * `zh-Hans-MY` pins the Chinese script to Simplified for the Malaysian audience.
 */
export const LOCALE_TO_INTL: Record<SupportedLocale, string> = {
  en: 'en-MY',
  ms: 'ms-MY',
  zh: 'zh-Hans-MY'
}

const resources = {
  en: {
    common: enCommon,
    nav: enNav,
    auth: enAuth,
    landing: enLanding,
    dashboard: enDashboard,
    projects: enProjects,
    map: enMap,
    workbench: enWorkbench,
    analysis: enAnalysis,
    pdf: enPdf,
    faq: enFaq,
    settings: enSettings,
    notifications: enNotifications
  },
  ms: {
    common: msCommon,
    nav: msNav,
    auth: msAuth,
    landing: msLanding,
    dashboard: msDashboard,
    projects: msProjects,
    map: msMap,
    workbench: msWorkbench,
    analysis: msAnalysis,
    pdf: msPdf,
    faq: msFaq,
    settings: msSettings,
    notifications: msNotifications
  },
  zh: {
    common: zhCommon,
    nav: zhNav,
    auth: zhAuth,
    landing: zhLanding,
    dashboard: zhDashboard,
    projects: zhProjects,
    map: zhMap,
    workbench: zhWorkbench,
    analysis: zhAnalysis,
    pdf: zhPdf,
    faq: zhFaq,
    settings: zhSettings,
    notifications: zhNotifications
  }
} as const

/**
 * Type guard for locale codes coming from external sources (URL params, localStorage, Supabase user metadata).
 *
 * @param value - Candidate locale string from an untrusted source
 * @returns `true` when `value` is one of {@link SUPPORTED_LOCALES}, narrowing it to `SupportedLocale`
 */
export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return value !== null && value !== undefined && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES as unknown as string[],
    nonExplicitSupportedLngs: true,
    defaultNS: 'common',
    ns: [
      'common',
      'nav',
      'auth',
      'landing',
      'dashboard',
      'projects',
      'map',
      'workbench',
      'analysis',
      'pdf',
      'faq',
      'settings',
      'notifications'
    ],
    interpolation: { escapeValue: false },
    detection: {
      order: ['querystring', 'localStorage', 'navigator', 'htmlTag'],
      lookupQuerystring: 'locale',
      lookupLocalStorage: LOCALE_STORAGE_KEY,
      caches: ['localStorage']
    }
  })

/** Configured i18next instance with all 13 namespaces registered for en/ms/zh. */
export default i18n
