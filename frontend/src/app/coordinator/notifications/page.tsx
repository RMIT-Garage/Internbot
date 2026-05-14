'use client'

import Link from 'next/link'
import { Bell, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { CoordinatorPageHeader, SurfaceCard } from '@/components/coordinator/Premium'
import { coordinatorNotifications } from '@/lib/coordinator/mockData'
import { useCoordinatorApiResource } from '@/hooks/useCoordinatorApiResource'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/coordinator/api'
import { mapNotification } from '@/lib/coordinator/apiMappers'

export default function CoordinatorNotificationsPage() {
  const resource = useCoordinatorApiResource(
    async () => {
      if (process.env.NODE_ENV === 'development') {
        console.debug(
          '[coordinator/notifications] backend filters: limit only; read grouping is client-side'
        )
      }
      const response = await listNotifications({ limit: 50 })
      return {
        items: response.items.map(mapNotification),
        unreadCount: response.unreadCount,
      }
    },
    {
      items: coordinatorNotifications,
      unreadCount: coordinatorNotifications.filter((item) => item.unread).length,
    },
    'notifications',
    { emptyData: { items: [], unreadCount: 0 } }
  )

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead()
      resource.setData({
        items: resource.data.items.map((item) => ({ ...item, unread: false })),
        unreadCount: 0,
      })
      toast.success('Notifications marked read.')
    } catch (error) {
      toast.info(
        error instanceof Error
          ? `Notification API unavailable: ${error.message}`
          : 'Notification API unavailable.'
      )
    }
  }

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id)
      resource.setData({
        items: resource.data.items.map((item) =>
          item.id === id ? { ...item, unread: false } : item
        ),
        unreadCount: Math.max(0, resource.data.unreadCount - 1),
      })
      toast.success('Notification marked read.')
    } catch {
      toast.info('Notification API integration unavailable for this record.')
    }
  }

  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Notification Center"
        title="Notifications"
        description="Workflow-linked alerts, student follow-ups, and system-generated approval updates."
        actions={
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800"
          >
            Mark all read
          </button>
        }
      />
      {(resource.loading || resource.error) && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          {resource.loading
            ? 'Loading notifications from the workflow API...'
            : `Using isolated fallback data: ${resource.error}`}
        </div>
      )}
      <SurfaceCard className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600">
          {resource.data.unreadCount} unread notifications
        </div>
        <div className="divide-y divide-slate-100">
          {resource.data.items.map((notification) => (
            <div
              key={notification.id}
              className="flex gap-4 px-5 py-4 transition hover:bg-slate-50"
            >
              <div className={notification.unread ? 'text-red-700' : 'text-slate-400'}>
                {notification.unread ? (
                  <Bell className="h-5 w-5" />
                ) : (
                  <CheckCircle2 className="h-5 w-5" />
                )}
              </div>
              <Link href={notification.href} className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-slate-950">{notification.title}</h2>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                    {notification.urgency}
                  </span>
                  {notification.unread && <span className="h-2 w-2 rounded-full bg-red-600" />}
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-500">{notification.body}</p>
              </Link>
              {notification.unread && (
                <button
                  type="button"
                  onClick={() => handleMarkRead(notification.id)}
                  className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-white"
                >
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  )
}
