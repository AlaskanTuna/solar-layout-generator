import type { Notification } from '@/components/ui/notification-popover'

const STORAGE_KEY = 'slg-notifications'

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

function saveNotifications(notifications: Notification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications))
}

type Listener = (notifications: Notification[]) => void

let notifications: Notification[] = loadNotifications()
const listeners = new Set<Listener>()

function emit() {
  saveNotifications(notifications)
  for (const listener of listeners) listener(notifications)
}

export const notificationStore = {
  get: () => notifications,

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

  markAsRead: (id: string) => {
    notifications = notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
    emit()
  },

  dismiss: (id: string) => {
    notifications = notifications.filter((n) => n.id !== id)
    emit()
  },

  clearAll: () => {
    notifications = []
    emit()
  },

  subscribe: (listener: Listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
}
