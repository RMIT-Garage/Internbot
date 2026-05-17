'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

import { NotificationsService } from '@/lib/api/openapi-client'
import type { NotificationResponse } from '@/lib/api/openapi-client'

function CoordinatorPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string
  title: string
  description: string
  actions?: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">{eyebrow}</p>
          <h1 className="text-2xl font-bold text-slate-950">{title}</h1>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
        {actions}
      </div>
    </div>
  )
}

function SurfaceCard({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white ${className}`}>{children}</div>
  )
}

function notifHref(notif: NotificationResponse): string {
  if (notif.relatedInternshipId) return `/student/contracts/${notif.relatedInternshipId}`
  if (notif.relatedOpportunityId) return `/student/opportunities`
  if (notif.relatedTicketId) return `/student/tickets/${notif.relatedTicketId}`
  return '#'
}

export default function StudentNotificationsPage() {
  const [items, setItems] = useState<NotificationResponse[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const res = await NotificationsService.listNotifications()
        setItems(res.items)
        setUnreadCount(res.unreadCount)
      } catch (err: any) {
        setError(err.message || 'Failed to load notifications')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleMarkAllRead = async () => {
    try {
      await NotificationsService.markAllNotificationsRead({ read: true })
      setItems((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })))
      setUnreadCount(0)
      toast.success('All notifications marked as read.')
    } catch {
      toast.error('Failed to mark notifications as read.')
    }
  }

  const handleMarkRead = async (id: string) => {
    try {
      await NotificationsService.markNotificationRead(id, { read: true })
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      )
      setUnreadCount((c) => Math.max(0, c - 1))
      toast.success('Notification marked as read.')
    } catch {
      toast.error('Failed to mark notification as read.')
    }
  }

  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Notification Center"
        title="Notifications"
        description="Workflow-linked alerts, status updates, and coordinator messages."
        actions={
          unreadCount > 0 ? (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800"
            >
              Mark all read
            </button>
          ) : undefined
        }
      />

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Loading notifications...
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {!loading && !error && (
        <SurfaceCard className="overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600">
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </div>

          <div className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-500">
                No notifications yet.
              </div>
            ) : (
              items.map((notif) => {
                const isUnread = notif.readAt === null
                return (
                  <div key={notif.id} className="flex gap-4 px-5 py-4 transition hover:bg-slate-50">
                    <div className={isUnread ? 'text-red-700' : 'text-slate-400'}>
                      {isUnread ? (
                        <Bell className="h-5 w-5" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5" />
                      )}
                    </div>

                    <Link href={notifHref(notif)} className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-bold text-slate-950">{notif.title}</h2>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 capitalize">
                          {notif.type.replace(/_/g, ' ')}
                        </span>
                        {isUnread && <span className="h-2 w-2 rounded-full bg-red-600" />}
                      </div>

                      <p className="mt-1 text-sm leading-6 text-slate-500">{notif.body}</p>

                      <p className="mt-1 text-xs text-slate-400">
                        {new Date(notif.createdAt).toLocaleString()}
                      </p>
                    </Link>

                    {isUnread && (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(notif.id)}
                        className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-white"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </SurfaceCard>
      )}
    </div>
  )
}
