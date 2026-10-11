import { useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, Circle } from 'lucide-react'
import { getRaw, http } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'

interface NotificationItem {
  id: string
  event: string
  title: string
  message: string
  data: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

interface NotificationResponse {
  data: NotificationItem[]
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
    unread: number
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function NotificationsPage() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['member-notifications'],
    queryFn: () => getRaw<NotificationResponse>('/me/notifications', { per_page: 50 }),
    staleTime: 15_000,
  })

  const items = query.data?.data ?? []
  const unread = query.data?.meta.unread ?? 0

  const markRead = useMutation({
    mutationFn: async (id: string) => { await http.patch(\`/me/notifications/\${id}/read\`) },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['member-notifications'] }),
  })

  const markAll = useMutation({
    mutationFn: async () => { await http.patch('/me/notifications/read-all') },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['member-notifications'] }),
  })

  const grouped = useMemo(() => {
    const today = new Date().toDateString()
    const recent: NotificationItem[] = []
    const older: NotificationItem[] = []
    for (const item of items) {
      if (new Date(item.created_at).toDateString() === today) recent.push(item)
      else older.push(item)
    }
    return { recent, older }
  }, [items])

  function section(title: string, notifications: NotificationItem[]) {
    if (notifications.length === 0) return null
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{title}</h2>
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--dash-card)]">
          {notifications.map((item) => (
            <article key={item.id} className="flex gap-4 border-b border-[var(--color-border)] p-4 last:border-b-0 sm:p-5">
              <span className={\`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl \${item.read_at ? 'bg-[var(--chart-track)] text-[var(--color-text-muted)]' : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'}\`}>
                {item.read_at ? <Bell size={16} aria-hidden /> : <Circle size={10} fill="currentColor" aria-label="Non lue" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--color-text)]">{item.title}</h3>
                    <p className="mt-1 whitespace-pre-line text-sm leading-6 text-[var(--color-text-muted)]">{item.message}</p>
                  </div>
                  <time className="shrink-0 text-xs text-[var(--color-text-muted)]">{formatDate(item.created_at)}</time>
                </div>
                {!item.read_at && (
                  <button type="button" disabled={markRead.isPending} onClick={() => markRead.mutate(item.id)} className="mt-3 text-xs font-bold text-[var(--color-primary)] hover:underline disabled:opacity-50">
                    Marquer comme lue
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    )
  }

  return (
    <>
      <Helmet><title>Notifications — CECT</title></Helmet>
      <div className="space-y-6">
        <PageHeader title="Notifications" description="Historique des événements importants liés à votre adhésion, vos packs, vos opérations YEM et vos paiements." />
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--dash-card)] px-4 py-3">
          <p className="text-sm text-[var(--color-text-muted)]"><strong className="text-[var(--color-text)]">{unread}</strong> notification(s) non lue(s)</p>
          {unread > 0 && (
            <button type="button" disabled={markAll.isPending} onClick={() => markAll.mutate()} className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--dash-bg)] disabled:opacity-50">
              <CheckCheck size={16} aria-hidden /> Tout marquer comme lu
            </button>
          )}
        </div>
        {query.isPending && <div className="h-48 animate-pulse rounded-2xl bg-[var(--chart-track)]" />}
        {query.isError && <p role="alert" className="rounded-2xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 p-4 text-sm text-[var(--color-danger)]">Impossible de charger les notifications.</p>}
        {!query.isPending && !query.isError && items.length === 0 && <EmptyState icon={Bell} title="Aucune notification" description="Les événements importants de votre compte apparaîtront ici." />}
        {section("Aujourd'hui", grouped.recent)}
        {section('Plus anciennes', grouped.older)}
      </div>
    </>
  )
}
