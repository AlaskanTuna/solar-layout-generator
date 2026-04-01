import React, { useState } from 'react'
import { Bell } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type Notification = {
  id: string
  title: string
  description: string
  timestamp: Date
  read: boolean
}

function NotificationItem({
  notification,
  index,
  onMarkAsRead
}: {
  notification: Notification
  index: number
  onMarkAsRead: (id: string) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20, filter: 'blur(10px)' }}
      animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      key={notification.id}
      className="cursor-pointer p-4 transition-colors hover:bg-accent/50"
      onClick={() => onMarkAsRead(notification.id)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {!notification.read && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
          <h4 className="text-sm font-medium text-foreground">{notification.title}</h4>
        </div>
        <span className="text-xs text-muted-foreground">{notification.timestamp.toLocaleDateString()}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{notification.description}</p>
    </motion.div>
  )
}

export function NotificationPopover({
  notifications: initialNotifications = [],
  onNotificationsChange
}: {
  notifications?: Notification[]
  onNotificationsChange?: (notifications: Notification[]) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)

  const unreadCount = notifications.filter((n) => !n.read).length

  const markAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }))
    setNotifications(updated)
    onNotificationsChange?.(updated)
  }

  const markAsRead = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
    setNotifications(updated)
    onNotificationsChange?.(updated)
  }

  return (
    <div className="relative">
      <Button onClick={() => setIsOpen(!isOpen)} variant="ghost" size="icon" className="relative h-9 w-9">
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {unreadCount}
          </span>
        )}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="glass-card absolute right-0 z-50 mt-2 w-80 max-h-[400px] overflow-y-auto shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-border p-4">
                <h3 className="text-sm font-semibold">Notifications</h3>
                {unreadCount > 0 && (
                  <Button onClick={markAllAsRead} variant="ghost" size="sm" className="h-7 text-xs">
                    Mark all as read
                  </Button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <Bell className="mx-auto h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-2 text-sm text-muted-foreground">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map((notification, index) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      index={index}
                      onMarkAsRead={markAsRead}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
