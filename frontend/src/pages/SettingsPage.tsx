import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell, CircleCheck, History, Palette, RotateCcw, Settings, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeaderCard } from '@/components/layout/PageHeaderCard'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useQuota } from '@/hooks/useQuota'
import { useTheme } from '@/hooks/useTheme'
import { notificationStore } from '@/lib/notificationStore'
import type { Notification } from '@/components/ui/NotificationPopover'

const TOUR_KEYS = ['slg-tour-map', 'slg-tour-workbench', 'slg-tour-analysis']
const RECENT_ACTIVITY_KEY = 'slg-recent-project-activity'

function SettingCard({
  icon: Icon,
  title,
  description,
  children
}: {
  icon: LucideIcon
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="glass-card p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-base font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </section>
  )
}

function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>(notificationStore.get)

  useEffect(() => {
    const unsubscribe = notificationStore.subscribe(setNotifications)
    return () => {
      unsubscribe()
    }
  }, [])

  return notifications
}

export function SettingsPage() {
  const { t } = useTranslation('settings')
  const { user } = useAuth()
  const quotaQuery = useQuota()
  const { theme, resolved, setTheme } = useTheme()
  const notifications = useNotifications()
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const tier = quotaQuery.data?.tier
  const planLabel = tier ? t('planLabel', { tier: tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase() }) : t('account.loadingPlan')
  const unreadCount = notifications.filter((notification) => !notification.read).length

  const THEME_OPTIONS = [
    { value: 'system', label: t('appearance.options.system.label'), detail: t('appearance.options.system.detail') },
    { value: 'light', label: t('appearance.options.light.label'), detail: t('appearance.options.light.detail') },
    { value: 'dark', label: t('appearance.options.dark.label'), detail: t('appearance.options.dark.detail') }
  ] as const

  function showStatus(message: string) {
    setStatusMessage(message)
  }

  function resetGuidedTours() {
    for (const key of TOUR_KEYS) localStorage.removeItem(key)
    showStatus(t('guidedTours.resetStatus'))
  }

  function clearNotifications() {
    notificationStore.clearAll()
    showStatus(t('notifications.clearStatus'))
  }

  function clearRecentActivity() {
    localStorage.removeItem(RECENT_ACTIVITY_KEY)
    showStatus(t('recentActivity.clearStatus'))
  }

  return (
    <PageContainer>
      <PageHeaderCard artSrc="/dashboard/settings.webp">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-heading text-3xl font-bold tracking-tight">{t('header.title')}</h1>
              <p className="mt-1 max-w-2xl text-muted-foreground">{t('header.subtitle')}</p>
            </div>
          </div>
          {statusMessage && (
            <div className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm">
              <CircleCheck className="h-4 w-4" />
              {statusMessage}
            </div>
          )}
        </div>
      </PageHeaderCard>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <SettingCard
          icon={UserRound}
          title={t('account.title')}
          description={t('account.description')}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card/50 p-3">
              <p className="text-xs font-medium text-muted-foreground">{t('account.emailLabel')}</p>
              <p className="mt-1 truncate text-sm font-semibold">{user?.email ?? t('account.emailFallback')}</p>
            </div>
            <div className="rounded-lg border border-border bg-card/50 p-3">
              <p className="text-xs font-medium text-muted-foreground">{t('account.planLabel')}</p>
              <p className="mt-1 text-sm font-semibold">{planLabel}</p>
            </div>
          </div>
        </SettingCard>

        <SettingCard
          icon={Palette}
          title={t('appearance.title')}
          description={t('appearance.description', { resolved })}
        >
          <div className="grid gap-2 sm:grid-cols-3">
            {THEME_OPTIONS.map((option) => {
              const active = theme === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card/50 hover:border-primary/40 hover:bg-muted/50'
                  }`}
                  onClick={() => {
                    setTheme(option.value)
                    showStatus(t('appearance.themeSet', { label: option.label }))
                  }}
                >
                  <span className="block text-sm font-semibold">{option.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{option.detail}</span>
                </button>
              )
            })}
          </div>
        </SettingCard>

        <SettingCard
          icon={Bell}
          title={t('notifications.title')}
          description={t('notifications.description')}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-semibold">{t('notifications.saved', { count: notifications.length })}</p>
              <p className="text-muted-foreground">{t('notifications.unread', { count: unreadCount })}</p>
            </div>
            <Button type="button" variant="outline" onClick={clearNotifications} disabled={notifications.length === 0}>
              {t('notifications.clearButton')}
            </Button>
          </div>
        </SettingCard>

        <SettingCard
          icon={RotateCcw}
          title={t('guidedTours.title')}
          description={t('guidedTours.description')}
        >
          <Button type="button" variant="outline" onClick={resetGuidedTours}>
            {t('guidedTours.resetButton')}
          </Button>
        </SettingCard>

        <SettingCard
          icon={History}
          title={t('recentActivity.title')}
          description={t('recentActivity.description')}
        >
          <Button type="button" variant="outline" onClick={clearRecentActivity}>
            {t('recentActivity.clearButton')}
          </Button>
        </SettingCard>
      </div>
    </PageContainer>
  )
}
