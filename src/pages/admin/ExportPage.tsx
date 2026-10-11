import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, FileSpreadsheet, History, RotateCcw, Upload } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { Panel } from '@/components/dashboard/Panel'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { downloadFile, ensureCsrfCookie, get, http, newIdempotencyKey, post } from '@/lib/api'
import { formatDateMedium } from '@/lib/format'
import { authErrorMessage } from '@/features/auth/errors'

const EXPORTS = [
  { type: 'members', title: 'Liste des membres', desc: 'Identité, Pernum, statut du compte et de l’adhésion, familles de packs, solde YEM.' },
  { type: 'payments', title: 'Paiements', desc: 'Paiements avec date, membre, objet, montant, frais et moyen de paiement.' },
  { type: 'subscriptions', title: 'Souscriptions', desc: 'Packs souscrits avec dates de début et de fin, quotas et soldes.' },
  { type: 'merchant_payments', title: 'Paiements marchands', desc: 'Paiements de YEM aux marchands avec leur statut de confirmation.' },
  { type: 'exchanges', title: 'Échanges YEM', desc: 'Demandes de vente/cession, quantités, cours, statuts et confirmations.' },
  { type: 'payouts', title: 'Versements FCFA', desc: 'Montants dus, payés, restant dus, route, moyen et statut.' },
  { type: 'audit', title: 'Journal d’audit', desc: 'Actions sensibles autorisées avec acteur, objet, résultat, corrélation et empreinte.' },
] as const

interface Snapshot {
  id: string
  version: number
  status: string
  trigger: string
  size_bytes: number | null
  generated_at: string | null
  created_at: string
}

interface ImportJob {
  id: string
  dataset: string
  status: 'staged' | 'applied' | 'canceled' | string
  base_snapshot_id: string
  file_name: string
  sha256: string
  summary: { rows: number; unchanged: number; change: number; conflict: number; error: number }
  can_be_applied: boolean
  uploaded_by: string
  decided_by: string | null
  decision_reason: string | null
  decided_at: string | null
  applied_at: string | null
  created_at: string
}

function formatSize(bytes: number | null): string {
  if (bytes === null) return '—'
  return bytes > 1_048_576 ? `${(bytes / 1_048_576).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`
}

export default function ExportPage() {
  const { can, user } = useAuth()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [baseSnapshotId, setBaseSnapshotId] = useState('')

  const snapshots = useQuery({ queryKey: ['snapshots'], queryFn: () => get<Snapshot[]>('/admin/snapshots'), enabled: can('reports.view'), staleTime: 0 })
  const imports = useQuery({ queryKey: ['imports'], queryFn: () => get<ImportJob[]>('/admin/imports'), enabled: can('imports.manage'), staleTime: 0 })

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key)
    setError(null)
    try {
      await action()
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Helmet>
        <title>Exports — CECT Admin</title>
      </Helmet>

      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)]">Exports</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Fichiers CSV (séparateur « ; », UTF-8) à ouvrir directement dans Excel. Chaque export demande une confirmation par code e-mail.</p>
        </header>

        {error && (
          <p role="alert" className="rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-4 py-3 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {EXPORTS.map((item) => (
            <article key={item.type} className="flex flex-col rounded-3xl border border-[var(--color-border)] bg-[var(--dash-card)] p-5 shadow-[var(--shadow-card)]">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                <FileSpreadsheet size={20} aria-hidden />
              </span>
              <h2 className="mt-3 text-base font-bold text-[var(--color-text)]">{item.title}</h2>
              <p className="mt-1 flex-1 text-sm text-[var(--color-text-muted)]">{item.desc}</p>
              <button
                type="button"
                disabled={!can('reports.export') || busy !== null}
                onClick={() => void run(item.type, () => downloadFile(`/admin/exports/${item.type}`, `${item.type}.csv`))}
                className="mt-4 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
              >
                <Download size={16} aria-hidden />
                {busy === item.type ? 'Préparation…' : 'Télécharger'}
              </button>
            </article>
          ))}
        </div>

        {can('imports.manage') && (
          <Panel
            title="Réimport contrôlé"
            subtitle="Téléversez un membres.csv issu d’un snapshot, vérifiez le diff puis faites approuver par une autre personne habilitée."
          >
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-[var(--color-text)]">Snapshot de référence</span>
                <select
                  value={baseSnapshotId}
                  onChange={(event) => setBaseSnapshotId(event.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm"
                >
                  <option value="">Choisir un snapshot prêt</option>
                  {(snapshots.data ?? []).filter((snapshot) => snapshot.status === 'ready').map((snapshot) => (
                    <option key={snapshot.id} value={snapshot.id}>Version {snapshot.version} · {formatDateMedium(snapshot.generated_at ?? snapshot.created_at)}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-[var(--color-text)]">Fichier membres.csv modifié</span>
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                  className="block min-h-[44px] w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                />
              </label>
              <button
                type="button"
                disabled={!baseSnapshotId || !importFile || busy !== null}
                onClick={() => void run('import-stage', async () => {
                  if (!importFile || !baseSnapshotId) return
                  await ensureCsrfCookie()
                  const body = new FormData()
                  body.append('file', importFile)
                  body.append('base_snapshot_id', baseSnapshotId)
                  await http.post('/admin/imports', body, { headers: { 'Idempotency-Key': newIdempotencyKey() } })
                  setImportFile(null)
                  await queryClient.invalidateQueries({ queryKey: ['imports'] })
                })}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
              >
                <Upload size={16} aria-hidden />
                {busy === 'import-stage' ? 'Analyse…' : 'Analyser le fichier'}
              </button>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-muted)]">
              Rien n’est appliqué au téléversement : le serveur produit d’abord un diff. Une importation avec conflit ou erreur est bloquée, et l’auteur du téléversement ne peut pas approuver sa propre modification.
            </p>

            <div className="mt-5 divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)]">
              {imports.isPending && <div className="m-4 h-16 animate-pulse rounded-xl bg-[var(--chart-track)]" />}
              {imports.data && imports.data.length === 0 && <p className="p-4 text-sm text-[var(--color-text-muted)]">Aucun réimport contrôlé pour le moment.</p>}
              {imports.data?.map((job) => {
                const isOwn = user?.id === job.uploaded_by
                return (
                  <div key={job.id} className="flex flex-wrap items-center gap-4 p-4">
                    <span className="min-w-0 flex-1 basis-64">
                      <span className="block truncate text-sm font-bold text-[var(--color-text)]">{job.file_name}</span>
                      <span className="mt-1 block text-xs text-[var(--color-text-muted)]">
                        {formatDateMedium(job.created_at)} · {job.summary.rows} ligne(s) · {job.summary.change} changement(s) · {job.summary.conflict} conflit(s) · {job.summary.error} erreur(s)
                      </span>
                    </span>
                    <StatusBadge
                      label={job.status === 'staged' ? 'À valider' : job.status === 'applied' ? 'Appliqué' : job.status === 'canceled' ? 'Annulé' : job.status}
                      tone={job.status === 'applied' ? 'success' : job.status === 'canceled' ? 'neutral' : job.summary.error || job.summary.conflict ? 'danger' : 'warning'}
                    />
                    {job.status === 'staged' && (
                      <span className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={!job.can_be_applied || isOwn || busy !== null}
                          title={isOwn ? 'Une autre personne habilitée doit approuver cet import.' : undefined}
                          onClick={() => void run(`approve-${job.id}`, async () => {
                            await post(`/admin/imports/${job.id}/approve`, { comment: 'Diff contrôlé et approuvé depuis le back-office.' }, newIdempotencyKey())
                            await queryClient.invalidateQueries({ queryKey: ['imports'] })
                            await queryClient.invalidateQueries({ queryKey: ['members'] })
                          })}
                          className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-xs font-bold text-white disabled:opacity-40"
                        >
                          <RotateCcw size={14} aria-hidden /> Approuver
                        </button>
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => void run(`cancel-${job.id}`, async () => {
                            const reason = window.prompt('Motif d’annulation de cet import :')?.trim()
                            if (!reason) return
                            await post(`/admin/imports/${job.id}/cancel`, { reason })
                            await queryClient.invalidateQueries({ queryKey: ['imports'] })
                          })}
                          className="inline-flex min-h-[40px] items-center rounded-xl border border-[var(--color-border)] px-4 text-xs font-bold hover:bg-[var(--dash-bg)] disabled:opacity-40"
                        >
                          Annuler
                        </button>
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </Panel>
        )}

        {can('reports.view') && (
          <Panel
            title="Snapshots consolidés"
            subtitle="Sauvegardes complètes des données, contrôlables par empreinte"
            action={
              can('reports.export') ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    void run('snapshot', async () => {
                      await post('/admin/snapshots')
                      await queryClient.invalidateQueries({ queryKey: ['snapshots'] })
                    })
                  }
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--dash-bg)] disabled:opacity-50"
                >
                  <History size={15} aria-hidden />
                  Générer
                </button>
              ) : undefined
            }
            flush
          >
            {snapshots.isPending && <div className="mx-5 mb-4 h-20 animate-pulse rounded-2xl bg-[var(--chart-track)]" />}
            {snapshots.data && snapshots.data.length === 0 && <p className="px-6 pb-5 text-sm text-[var(--color-text-muted)]">Aucun snapshot pour le moment.</p>}
            <ul className="divide-y divide-[var(--color-border)]">
              {snapshots.data?.map((snapshot) => (
                <li key={snapshot.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 sm:px-6">
                  <span className="min-w-0 flex-1 basis-40">
                    <span className="block text-sm font-bold text-[var(--color-text)]">Version {snapshot.version}</span>
                    <span className="block text-xs text-[var(--color-text-muted)]">
                      {formatDateMedium(snapshot.generated_at ?? snapshot.created_at)} · {formatSize(snapshot.size_bytes)}
                    </span>
                  </span>
                  <StatusBadge label={snapshot.status === 'ready' ? 'Prêt' : snapshot.status === 'failed' ? 'Échec' : 'En cours'} tone={snapshot.status === 'ready' ? 'success' : snapshot.status === 'failed' ? 'danger' : 'info'} />
                  {snapshot.status === 'ready' && can('reports.export') && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void run(snapshot.id, () => downloadFile(`/admin/snapshots/${snapshot.id}/download`, `snapshot-${snapshot.version}.zip`))}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[var(--color-border)] px-3 text-xs font-bold hover:bg-[var(--dash-bg)] disabled:opacity-50"
                    >
                      <Download size={14} aria-hidden />
                      Télécharger
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </>
  )
}
