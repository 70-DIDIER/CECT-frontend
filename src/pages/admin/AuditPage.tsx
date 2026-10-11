import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { Activity, Download, RefreshCw, ShieldAlert, ShieldCheck, Webhook } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { Panel } from '@/components/dashboard/Panel'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { downloadFile, get } from '@/lib/api'

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

type Tab = 'audit' | 'security' | 'payments' | 'ops'

interface AuditEvent {
  id: string
  position: number
  occurred_at: string
  actor_type: string
  actor_id: string | null
  action: string
  subject_type: string | null
  subject_id: string | null
  result: string
  reason: string | null
  correlation_id: string | null
}

interface SecurityEvent {
  id: string
  occurred_at: string
  event_type: string
  severity: 'info' | 'warning' | 'critical' | string
  user_id: string | null
  identifier: string | null
  correlation_id: string | null
}

interface WebhookEvent {
  id: string
  provider: string
  provider_event_id: string
  event_name: string | null
  provider_transaction_id: string | null
  status: string
  received_at: string
  processed_at: string | null
  error: string | null
}

interface PaymentAttempt {
  id: string
  provider: string
  method: string | null
  status: string
  amount: number
  fee_amount: number
  provider_transaction_id: string | null
  requires_review: boolean
  created_at: string
  intent?: { user_id: string; purpose: string } | null
}

interface OpsHealth {
  status: 'ok' | 'degraded' | 'critical'
  checks: Array<{ name?: string; key?: string; ok: boolean; severity: string; message?: string }>
  queue: { pending_jobs: number; failed_jobs: number }
  latest_snapshot: Record<string, unknown> | null
  checked_at: string
}

const btnSecondary = 'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--dash-bg)] disabled:opacity-60'
const TABS: Array<{ value: Tab; label: string; icon: typeof Activity }> = [
  { value: 'audit', label: 'Audit métier', icon: ShieldCheck },
  { value: 'security', label: 'Sécurité', icon: ShieldAlert },
  { value: 'payments', label: 'Paiements & webhooks', icon: Webhook },
  { value: 'ops', label: 'Supervision', icon: Activity },
]

function Empty({ children }: { children: string }) {
  return <p className="px-6 pb-5 text-sm text-[var(--color-text-muted)]">{children}</p>
}

export default function AuditPage() {
  const { can } = useAuth()
  const [tab, setTab] = useState<Tab>(can('audit.view') ? 'audit' : can('security_events.view') ? 'security' : can('payments.view') ? 'payments' : 'ops')
  const [action, setAction] = useState('')
  const [severity, setSeverity] = useState('all')
  const [provider, setProvider] = useState('all')

  const audit = useQuery({
    queryKey: ['audit-events', action],
    queryFn: () => get<AuditEvent[]>('/admin/audit-events', { ...(action.trim() ? { action: action.trim() } : {}), per_page: 100 }),
    enabled: tab === 'audit' && can('audit.view'),
    staleTime: 0,
  })
  const security = useQuery({
    queryKey: ['security-events', severity],
    queryFn: () => get<SecurityEvent[]>('/admin/security-events', { ...(severity !== 'all' ? { severity } : {}), per_page: 100 }),
    enabled: tab === 'security' && can('security_events.view'),
    staleTime: 0,
  })
  const webhooks = useQuery({
    queryKey: ['payment-webhooks', provider],
    queryFn: () => get<WebhookEvent[]>('/admin/payments/webhook-events', { ...(provider !== 'all' ? { provider } : {}), per_page: 100 }),
    enabled: tab === 'payments' && can('payments.view'),
    staleTime: 0,
  })
  const attempts = useQuery({
    queryKey: ['payment-attempts-review'],
    queryFn: () => get<PaymentAttempt[]>('/admin/payments/attempts', { requires_review: true, per_page: 100 }),
    enabled: tab === 'payments' && can('payments.view'),
    staleTime: 0,
  })
  const ops = useQuery({
    queryKey: ['ops-health'],
    queryFn: () => get<OpsHealth>('/admin/ops/health'),
    enabled: tab === 'ops',
    staleTime: 0,
  })

  const visibleTabs = TABS.filter((item) => {
    if (item.value === 'audit') return can('audit.view')
    if (item.value === 'security') return can('security_events.view')
    if (item.value === 'payments') return can('payments.view')
    return can('security_events.view')
  })

  return (
    <>
      <Helmet><title>Audit & supervision — CECT Admin</title></Helmet>
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)]">Audit & supervision</h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-muted)]">
              Journal métier, sécurité, intégrité des webhooks et état opérationnel de la plateforme.
            </p>
          </div>
          {can('reports.export') && can('audit.view') && (
            <button type="button" className={btnSecondary} onClick={() => void downloadFile('/admin/exports/audit', 'cect-audit.csv')}>
              <Download size={15} /> Exporter l’audit CSV
            </button>
          )}
        </header>

        <div className="flex flex-wrap gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--dash-card)] p-2">
          {visibleTabs.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl px-4 text-sm font-semibold ${
                tab === value ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text)] hover:bg-[var(--dash-bg)]'
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {tab === 'audit' && can('audit.view') && (
          <Panel
            title="Journal d’audit métier"
            subtitle="Actions sensibles et modifications de configuration, ordre inverse chronologique."
            action={<button type="button" className={btnSecondary} onClick={() => void audit.refetch()}><RefreshCw size={15} /> Actualiser</button>}
            flush
          >
            <div className="px-5 pb-4 sm:px-6">
              <input
                value={action}
                onChange={(event) => setAction(event.target.value)}
                placeholder="Filtrer par action exacte (ex. packs.version_published)"
                className="min-h-[44px] w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 text-sm"
              />
            </div>
            {audit.isPending && <div className="mx-5 mb-4 h-32 animate-pulse rounded-xl bg-[var(--chart-track)]" />}
            {audit.data?.length === 0 && <Empty>Aucun événement d’audit pour ce filtre.</Empty>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-y border-[var(--color-border)] bg-[var(--dash-bg)] text-xs text-[var(--color-text-muted)]">
                  <tr><th className="px-5 py-3">#</th><th className="px-3 py-3">Date</th><th className="px-3 py-3">Action</th><th className="px-3 py-3">Acteur</th><th className="px-3 py-3">Objet</th><th className="px-3 py-3">Résultat</th><th className="px-3 py-3">Corrélation</th></tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {(audit.data ?? []).map((event) => (
                    <tr key={event.id}>
                      <td className="px-5 py-3 font-mono text-xs">{event.position}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{formatDateTime(event.occurred_at)}</td>
                      <td className="px-3 py-3 font-mono text-xs font-semibold">{event.action}</td>
                      <td className="px-3 py-3 text-xs">{event.actor_id ?? event.actor_type}</td>
                      <td className="px-3 py-3 text-xs">{event.subject_type ? `${event.subject_type} · ${event.subject_id ?? '—'}` : '—'}</td>
                      <td className="px-3 py-3"><StatusBadge label={event.result} tone={event.result === 'success' ? 'success' : 'warning'} /></td>
                      <td className="px-3 py-3 font-mono text-xs">{event.correlation_id ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {tab === 'security' && can('security_events.view') && (
          <Panel title="Journal de sécurité" subtitle="Authentification, OTP, privilèges, sessions et événements sensibles." action={<button type="button" className={btnSecondary} onClick={() => void security.refetch()}><RefreshCw size={15} /> Actualiser</button>} flush>
            <div className="px-5 pb-4 sm:px-6">
              <select value={severity} onChange={(event) => setSeverity(event.target.value)} className="min-h-[44px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm">
                <option value="all">Toutes sévérités</option>
                <option value="info">Information</option>
                <option value="warning">Avertissement</option>
                <option value="critical">Critique</option>
              </select>
            </div>
            {security.data?.length === 0 && <Empty>Aucun événement de sécurité.</Empty>}
            <div className="divide-y divide-[var(--color-border)]">
              {(security.data ?? []).map((event) => (
                <div key={event.id} className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
                  <div className="min-w-0 flex-1 basis-64">
                    <p className="font-mono text-xs font-semibold text-[var(--color-text)]">{event.event_type}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">{formatDateTime(event.occurred_at)} · {event.identifier ?? event.user_id ?? 'système'}</p>
                  </div>
                  <StatusBadge label={event.severity} tone={event.severity === 'critical' ? 'danger' : event.severity === 'warning' ? 'warning' : 'info'} />
                  <code className="text-xs text-[var(--color-text-muted)]">{event.correlation_id ?? '—'}</code>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {tab === 'payments' && can('payments.view') && (
          <div className="space-y-6">
            <Panel title="Tentatives nécessitant une revue" subtitle="Écarts ou cas signalés par le moteur de paiement." flush>
              {attempts.data?.length === 0 && <Empty>Aucune tentative nécessitant une revue.</Empty>}
              <div className="divide-y divide-[var(--color-border)]">
                {(attempts.data ?? []).map((attempt) => (
                  <div key={attempt.id} className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
                    <div className="min-w-0 flex-1 basis-60">
                      <p className="font-mono text-xs font-semibold">{attempt.id}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">{attempt.provider} · {attempt.method ?? '—'} · {attempt.provider_transaction_id ?? 'sans ID prestataire'}</p>
                    </div>
                    <StatusBadge label={attempt.status} tone={attempt.status === 'approved' ? 'success' : 'warning'} />
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Webhooks prestataires" subtitle="Événements reçus et état de leur traitement." action={<button type="button" className={btnSecondary} onClick={() => void webhooks.refetch()}><RefreshCw size={15} /> Actualiser</button>} flush>
              <div className="px-5 pb-4 sm:px-6">
                <select value={provider} onChange={(event) => setProvider(event.target.value)} className="min-h-[44px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm">
                  <option value="all">Tous les prestataires</option>
                  <option value="fedapay">FedaPay</option>
                  <option value="manual">Manuel</option>
                </select>
              </div>
              {webhooks.data?.length === 0 && <Empty>Aucun webhook reçu.</Empty>}
              <div className="divide-y divide-[var(--color-border)]">
                {(webhooks.data ?? []).map((event) => (
                  <div key={event.id} className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
                    <div className="min-w-0 flex-1 basis-64">
                      <p className="font-mono text-xs font-semibold">{event.event_name ?? event.provider_event_id}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">{event.provider} · tx {event.provider_transaction_id ?? '—'} · {formatDateTime(event.received_at)}</p>
                      {event.error && <p className="mt-1 text-xs text-[var(--color-danger)]">{event.error}</p>}
                    </div>
                    <StatusBadge label={event.status} tone={event.status === 'processed' ? 'success' : event.status === 'failed' ? 'danger' : 'warning'} />
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {tab === 'ops' && (
          <Panel title="État opérationnel" subtitle={ops.data ? `Dernier contrôle : ${formatDateTime(ops.data.checked_at)}` : 'Contrôle en cours…'} action={<button type="button" className={btnSecondary} onClick={() => void ops.refetch()}><RefreshCw size={15} /> Recontrôler</button>}>
            {ops.data && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge label={ops.data.status.toUpperCase()} tone={ops.data.status === 'ok' ? 'success' : ops.data.status === 'critical' ? 'danger' : 'warning'} />
                  <span className="text-sm text-[var(--color-text-muted)]">Queue : {ops.data.queue.pending_jobs} en attente · {ops.data.queue.failed_jobs} échec(s)</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {ops.data.checks.map((check, index) => (
                    <div key={check.name ?? check.key ?? index} className="rounded-xl border border-[var(--color-border)] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-sm text-[var(--color-text)]">{check.name ?? check.key ?? `Contrôle ${index + 1}`}</strong>
                        <StatusBadge label={check.ok ? 'OK' : check.severity} tone={check.ok ? 'success' : check.severity === 'critical' ? 'danger' : 'warning'} />
                      </div>
                      {check.message && <p className="mt-2 text-xs text-[var(--color-text-muted)]">{check.message}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        )}
      </div>
    </>
  )
}
