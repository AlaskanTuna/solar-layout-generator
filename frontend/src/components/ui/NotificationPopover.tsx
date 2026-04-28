import { useEffect, useRef, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { notificationStore } from '@/lib/notificationStore'

export type Notification = {
  id: string
  title: string
  description: string
  timestamp: Date
  read: boolean
}

function useNotifications() {
  const [notifications, setNotifications] = useState(notificationStore.get)

  useEffect(() => {
    const unsub = notificationStore.subscribe(setNotifications)
    return () => {
      unsub()
    }
  }, [])

  return notifications
}

export function NotificationPopover() {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const notifications = useNotifications()
  const unreadCount = notifications.filter((n) => !n.read).length

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isOpen])

  return (
    <div ref={containerRef} className="relative">
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
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] max-h-[400px] overflow-x-hidden overflow-y-auto rounded-xl border border-border bg-card shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="text-sm font-semibold">Notifications</h3>
              {notifications.length > 0 && (
                <Button onClick={() => notificationStore.clearAll()} variant="ghost" size="sm" className="h-7 text-xs">
                  Clear all
                </Button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="p-6 text-center">
                <Bell className="mx-auto h-8 w-8 text-muted-foreground/40" />
                <p className="mt-2 text-sm text-muted-foreground">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((notification, index) => (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    className="group relative p-4 transition-colors hover:bg-accent/50"
                    onClick={() => notificationStore.markAsRead(notification.id)}
                  >
                    <div className="flex items-start gap-2 pr-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {!notification.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                          <h4 className="text-sm font-medium text-foreground">{notification.title}</h4>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{notification.description}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground/60">
                          {notification.timestamp.toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="absolute right-3 top-3 rounded-md p-0.5 text-muted-foreground/50 opacity-100 transition-opacity hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        notificationStore.dismiss(notification.id)
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
