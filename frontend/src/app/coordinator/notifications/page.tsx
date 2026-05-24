'use client'

import Link from 'next/link'
import { Bell, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import CoordinatorContentSkeleton from '@/components/coordinator/CoordinatorContentSkeleton'
import { CoordinatorPageHeader, SurfaceCard } from '@/components/coordinator/Premium'
import { coordinatorNotifications } from '@/lib/coordinator/mockData'
import { useCoordinatorApiResource } from '@/hooks/useCoordinatorApiResource'
import {
  listInternships,
  listNotifications,
  listOpportunities,
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
      const [response, internships, opportunities] = await Promise.all([
        listNotifications({ limit: 50 }),
        listInternships({ limit: 100 }),
        listOpportunities({ limit: 100 }),
      ])
      const internshipMap = new Map(internships.items.map((item) => [item.id, item]))
      const opportunityMap = new Map(opportunities.items.map((item) => [item.id, item]))

      return {
        items: response.items.map((item) =>
          mapNotification(item, { internships: internshipMap, opportunities: opportunityMap })
        ),
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
    const previousData = resource.data
    resource.setData({
      items: resource.data.items.map((item) => ({ ...item, unread: false })),
      unreadCount: 0,
    })
    try {
      await markAllNotificationsRead()
      toast.success('Notifications marked read.')
    } catch (error) {
      resource.setData(previousData)
      toast.info(
        error instanceof Error
          ? `Notification API unavailable: ${error.message}`
          : 'Notification API unavailable.'
      )
    }
  }

  const handleMarkRead = async (id: string) => {
    const notification = resource.data.items.find((item) => item.id === id)
    if (!notification?.unread) return

    const previousData = resource.data
    resource.setData({
      items: resource.data.items.map((item) =>
        item.id === id ? { ...item, unread: false } : item
      ),
      unreadCount: Math.max(0, resource.data.unreadCount - 1),
    })
    try {
      await markNotificationRead(id)
      toast.success('Notification marked read.')
    } catch {
      resource.setData(previousData)
      toast.info('Notification API integration unavailable for this record.')
    }
  }

  if (resource.loading) {
    return (
      <div className="space-y-6">
        <CoordinatorPageHeader
          eyebrow="Notification Center"
          title="Notifications"
          description="Workflow-linked alerts, student follow-ups, and system-generated approval updates."
        />
        <CoordinatorContentSkeleton title="Loading notifications..." />
      </div>
    )
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
            disabled={resource.data.unreadCount === 0}
            className="rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            Mark all read
          </button>
        }
      />
      {resource.error && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          {`Using isolated fallback data: ${resource.error}`}
        </div>
      )}
      <SurfaceCard className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600">
          {resource.data.unreadCount} unread notifications
        </div>
        <div className="divide-y divide-slate-100">
          {resource.data.items.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              {resource.source === 'api'
                ? 'Backend connected, but no records exist yet.'
                : 'No notifications to show.'}
            </div>
          )}
          {resource.data.items.map((notification, index) => (
            <div
              key={`${notification.id}-${index}`}
              className={[
                'flex gap-4 px-5 py-4 transition-all duration-200 ease-out',
                notification.unread
                  ? 'border-l-4 border-l-red-700 bg-red-50/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] hover:bg-red-50'
                  : 'border-l-4 border-l-transparent bg-white opacity-85 hover:bg-slate-50 hover:opacity-100',
              ].join(' ')}
            >
              <div
                className={[
                  'mt-0.5 transition-colors',
                  notification.unread ? 'text-red-700' : 'text-slate-300',
                ].join(' ')}
              >
                {notification.unread ? (
                  <Bell className="h-5 w-5" />
                ) : (
                  <CheckCircle2 className="h-5 w-5" />
                )}
              </div>
              <Link href={notification.href} className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    className={[
                      'transition-colors',
                      notification.unread
                        ? 'font-extrabold text-slate-950'
                        : 'font-bold text-slate-700',
                    ].join(' ')}
                  >
                    {notification.title}
                  </h2>
                  {notification.unread ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-2.5 py-1 text-xs font-bold text-red-700">
                      <span className="h-2 w-2 rounded-full bg-red-600" />
                      Unread
                    </span>
                  ) : (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-500">
                      Read
                    </span>
                  )}
                </div>
                <p
                  className={[
                    'mt-1 text-sm leading-6 transition-colors',
                    notification.unread ? 'text-slate-700' : 'text-slate-500',
                  ].join(' ')}
                >
                  {notification.body}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
                    {notification.workflowStage ?? 'Workflow update'}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
                    {notification.placementType ?? 'Placement workflow'}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
                    Updated {notification.updatedAt ?? 'recently'}
                  </span>
                </div>
              </Link>
              {notification.unread && (
                <button
                  type="button"
                  onClick={() => handleMarkRead(notification.id)}
                  className="h-9 shrink-0 rounded-xl border border-red-200 bg-white px-3 text-xs font-bold text-red-700 transition hover:bg-red-50"
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
