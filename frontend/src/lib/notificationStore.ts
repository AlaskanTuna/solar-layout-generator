/**
 * In-app notification store.
 *
 * Backs the bell icon in the app header with a localStorage-persisted list
 * (key `slg-notifications`, capped at 50 entries). Components subscribe via
 * `notificationStore.subscribe(listener)` and receive the full list on every
 * mutation; the convenience hook around this lives in
 * `components/ui/NotificationPopover.tsx`.
 */

import type { Notification } from '@/components/ui/NotificationPopover'

const STORAGE_KEY = 'slg-notifications'

/** Hydrates notifications from localStorage; returns `[]` on any parse error. */
function loadNotifications(): Notification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Array<Omit<Notification, 'timestamp'> & { timestamp: string }>
    return parsed.map((n) => ({ ...n, timestamp: new Date(n.timestamp) }))
  } catch {
    return []
  }
}

/** Serialises the notifications list to localStorage. */
function saveNotifications(notifications: Notification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications))
}

/** Subscriber callback type — receives the full notifications list. */
type Listener = (notifications: Notification[]) => void

let notifications: Notification[] = loadNotifications()
const listeners = new Set<Listener>()

/** Persists to localStorage and broadcasts the latest list to every listener. */
function emit() {
  saveNotifications(notifications)
  for (const listener of listeners) listener(notifications)
}

/**
 * App-wide toast/notification store backed by `localStorage` (key `slg-notifications`, max 50 entries).
 * Subscribers receive the full list on every mutation.
 */
export const notificationStore = {
  /** Returns the current notifications list (newest first). */
  get: () => notifications,

  /**
   * Prepends a new notification. Truncates to the 50-most-recent so the
   * bell never grows unbounded — older notifications drop off silently.
   */
  push: (title: string, description: string) => {
    notifications = [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title,
        description,
        timestamp: new Date(),
        read: false
      },
      ...notifications
    ].slice(0, 50) // keep max 50
    emit()
  },

  /** Marks a single notification as read by id. */
  markAsRead: (id: string) => {
    notifications = notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
    emit()
  },

  /** Removes a single notification by id. */
  dismiss: (id: string) => {
    notifications = notifications.filter((n) => n.id !== id)
    emit()
  },

  /** Removes every notification. */
  clearAll: () => {
    notifications = []
    emit()
  },

  /**
   * Registers a listener and returns an unsubscribe function. The listener
   * is called immediately with the current list and on every subsequent
   * mutation.
   */
  subscribe: (listener: Listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
}
