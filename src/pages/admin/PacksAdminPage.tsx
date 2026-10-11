import { useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Boxes, Copy, Eye, PauseCircle, PlayCircle, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { Panel } from '@/components/dashboard/Panel'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { FormDialog, type FormField } from '@/components/ui/FormDialog'
import { get, http, newIdempotencyKey, post } from '@/lib/api'
import { formatBps, formatXof, formatYem } from '@/lib/format'
import type { PackFamily } from '@/features/packs/types'
import type { Tone } from '@/components/dashboard/tones'

type PlanStatus = 'draft' | 'published' | 'suspended' | 'retired' | 'archived'

interface AdminPackVersion {
  id: string
  version: number
  price_xof: number
  currency: string
  period: { unit: 'day' | 'week' | 'month'; every: number; cycles: number } | null
  quota_per_period: string | null
  total_quota: string | null
  cumulative: boolean | null
  end_of_term: 'expire' | 'keep' | null
  min_operation: string | null
  max_operation: string | null
  eligible_person_types: string[]
  rules: Record<string, unknown>
  published_at: string | null
  created_at: string
  reason?: string
}

interface AdminPackPlan {
  id: string
  family: PackFamily
  code: string
  name: string
  level: number | null
  description: string | null
  status: PlanStatus
  published_at: string | null
  current_version: AdminPackVersion | null
  versions?: AdminPackVersion[]
}

const FAMILY_LABELS: Record<PackFamily, string> = {
  VENDEUR: 'Vendeur',
  CONSOMMATEUR: 'Consommateur',
  PERSONNEL: 'Personnel',
  MARCHAND: 'Marchand',
}

const STATUS_META: Record<PlanStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Brouillon', tone: 'neutral' },
  published: { label: 'Publié', tone: 'success' },
  suspended: { label: 'Suspendu', tone: 'warning' },
  retired: { label: 'Retiré', tone: 'danger' },
  archived: { label: 'Archivé', tone: 'neutral' },
}

const TRANSITIONS: Record<PlanStatus, ReadonlyArray<{ value: PlanStatus; label: string }>> = {
  draft: [
    { value: 'published', label: 'Publier le plan' },
    { value: 'archived', label: 'Archiver le plan' },
  ],
  published: [
    { value: 'suspended', label: 'Suspendre le plan' },
    { value: 'retired', label: 'Retirer le plan' },
  ],
  suspended: [
    { value: 'published', label: 'Republier le plan' },
    { value: 'retired', label: 'Retirer le plan' },
  ],
  retired: [{ value: 'archived', label: 'Archiver le plan' }],
  archived: [],
}

const btnPrimary =
  'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60'
const btnSecondary =
  'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--dash-bg)] disabled:opacity-60'
const btnDanger =
  'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-[var(--color-danger)]/30 px-4 text-sm font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5 disabled:opacity-60'

function versionFacts(version: AdminPackVersion | null): string[] {
  if (!version) return ['Aucune version publiée']
  const facts = [formatXof(version.price_xof)]
  if (version.quota_per_period) facts.push(`${formatYem(version.quota_per_period)} / période`)
  if (version.period) facts.push(`${version.period.cycles} × ${version.period.every} ${version.period.unit === 'month' ? 'mois' : version.period.unit}`)
  const discount = version.rules.discount_bps
  if (typeof discount === 'number' && discount > 0) facts.push(`remise ${formatBps(discount)}`)
  return facts
}

function currentTemplate(plan: AdminPackPlan): AdminPackVersion | null {
  const versions = plan.versions ?? []
  return [...versions].sort((a, b) => b.version - a.version)[0] ?? plan.current_version
}

function planFields(): FormField[] {
  return [
    {
      name: 'family',
      label: 'Famille',
      type: 'select',
      required: true,
      options: (Object.keys(FAMILY_LABELS) as PackFamily[]).map((value) => ({ value, label: FAMILY_LABELS[value] })),
    },
    { name: 'code', label: 'Code', required: true },
    { name: 'name', label: 'Nom', required: true },
    { name: 'level', label: 'Niveau (facultatif)', type: 'number' },
    { name: 'description', label: 'Description', type: 'textarea' },
  ]
}

function versionFields(plan: AdminPackPlan): FormField[] {
  const template = currentTemplate(plan)
  const periodic = plan.family !== 'PERSONNEL'
  const rules = template?.rules ?? {}
  const eligible = template?.eligible_person_types ?? (plan.family === 'MARCHAND' ? ['legal'] : ['natural', 'legal'])
  const eligibleScope = eligible.includes('natural') && eligible.includes('legal') ? 'all' : eligible.includes('legal') ? 'legal' : 'natural'

  const fields: FormField[] = [
    { name: 'price_xof', label: plan.family === 'CONSOMMATEUR' ? 'Prix FCFA (laisser vide si calculé depuis la valeur de référence)' : 'Prix FCFA', type: 'number', required: plan.family !== 'CONSOMMATEUR', initial: template ? String(template.price_xof) : '' },
    {
      name: 'eligible_scope',
      label: 'Comptes autorisés à voir et souscrire ce pack',
      type: 'select',
      required: true,
      initial: eligibleScope,
      options: [
        { value: 'all', label: 'Personnes physiques et morales' },
        { value: 'natural', label: 'Personnes physiques uniquement' },
        { value: 'legal', label: 'Personnes morales uniquement' },
      ],
    },
  ]

  if (periodic) {
    fields.push(
      {
        name: 'period_unit',
        label: 'Unité de période',
        type: 'select',
        required: true,
        initial: template?.period?.unit ?? 'month',
        options: [
          { value: 'day', label: 'Jour' },
          { value: 'week', label: 'Semaine' },
          { value: 'month', label: 'Mois' },
        ],
      },
      { name: 'period_every', label: 'Tous les…', type: 'number', required: true, initial: String(template?.period?.every ?? 1) },
      { name: 'period_cycles', label: 'Nombre de cycles', type: 'number', required: true, initial: String(template?.period?.cycles ?? 12) },
      { name: 'quota_per_period', label: plan.family === 'CONSOMMATEUR' ? 'Quota YEM / période (laisser vide si calculé automatiquement)' : 'Quota YEM / période', required: plan.family !== 'CONSOMMATEUR', initial: template?.quota_per_period ?? '' },
      {
        name: 'cumulative',
        label: 'Quota cumulable',
        type: 'select',
        required: true,
        initial: template?.cumulative ? 'true' : 'false',
        options: [
          { value: 'true', label: 'Oui' },
          { value: 'false', label: 'Non' },
        ],
      },
      {
        name: 'end_of_term',
        label: 'Fin de période',
        type: 'select',
        required: true,
        initial: template?.end_of_term ?? 'expire',
        options: [
          { value: 'expire', label: 'Expire' },
          { value: 'keep', label: 'Conserver le solde' },
        ],
      },
    )
  }

  fields.push(
    { name: 'min_operation', label: 'Opération minimum YEM (facultatif)', initial: template?.min_operation ?? '' },
    { name: 'max_operation', label: 'Opération maximum YEM (facultatif)', initial: template?.max_operation ?? '' },
  )

  if (plan.family === 'CONSOMMATEUR') {
    fields.push(
      { name: 'reference_value_xof', label: 'Valeur de référence FCFA', type: 'number', required: true, initial: String(typeof rules.reference_value_xof === 'number' ? rules.reference_value_xof : '') },
      { name: 'discount_bps', label: 'Remise en points de base (4,5 % = 450)', type: 'number', required: true, initial: String(typeof rules.discount_bps === 'number' ? rules.discount_bps : 0) },
      {
        name: 'rate_setting_key',
        label: 'Taux de conversion',
        type: 'select',
        required: true,
        initial: typeof rules.rate_setting_key === 'string' ? rules.rate_setting_key : 'rates.sale_xof_per_yem',
        options: [
          { value: 'rates.sale_xof_per_yem', label: 'Vente YEM' },
          { value: 'rates.purchase_xof_per_yem', label: 'Achat YEM' },
          { value: 'rates.transfer_xof_per_yem', label: 'Cession YEM' },
        ],
      },
    )
  } else if (plan.family === 'PERSONNEL') {
    fields.push(
      { name: 'discount_bps', label: 'Remise en points de base (4,5 % = 450)', type: 'number', required: true, initial: String(typeof rules.discount_bps === 'number' ? rules.discount_bps : 0) },
      { name: 'min_topup_xof', label: 'Rechargement minimum FCFA', type: 'number', required: true, initial: String(typeof rules.min_topup_xof === 'number' ? rules.min_topup_xof : 5000) },
      {
        name: 'rate_setting_key',
        label: 'Taux de conversion',
        type: 'select',
        required: true,
        initial: typeof rules.rate_setting_key === 'string' ? rules.rate_setting_key : 'rates.sale_xof_per_yem',
        options: [
          { value: 'rates.sale_xof_per_yem', label: 'Vente YEM' },
          { value: 'rates.purchase_xof_per_yem', label: 'Achat YEM' },
          { value: 'rates.transfer_xof_per_yem', label: 'Cession YEM' },
        ],
      },
    )
  } else {
    fields.push({
      name: 'rate_setting_key',
      label: 'Taux de référence',
      type: 'select',
      required: true,
      initial:
        typeof rules.rate_setting_key === 'string'
          ? rules.rate_setting_key
          : plan.family === 'VENDEUR'
            ? 'rates.purchase_xof_per_yem'
            : 'rates.transfer_xof_per_yem',
      options: [
        { value: 'rates.purchase_xof_per_yem', label: 'Achat YEM' },
        { value: 'rates.sale_xof_per_yem', label: 'Vente YEM' },
        { value: 'rates.transfer_xof_per_yem', label: 'Cession YEM' },
      ],
    })
  }

  fields.push({ name: 'reason', label: 'Motif de cette version', type: 'textarea', required: true, initial: 'Mise à jour de la grille des packs' })
  return fields
}

function versionPayload(plan: AdminPackPlan, values: Record<string, string>): Record<string, unknown> {
  const periodic = plan.family !== 'PERSONNEL'
  const rules: Record<string, unknown> = {}

  if (values.discount_bps !== undefined && values.discount_bps !== '') rules.discount_bps = Number(values.discount_bps)
  if (values.reference_value_xof !== undefined && values.reference_value_xof !== '') rules.reference_value_xof = Number(values.reference_value_xof)
  if (values.min_topup_xof !== undefined && values.min_topup_xof !== '') rules.min_topup_xof = Number(values.min_topup_xof)
  if (values.rate_setting_key) rules.rate_setting_key = values.rate_setting_key

  const eligiblePersonTypes = values.eligible_scope === 'legal' ? ['legal'] : values.eligible_scope === 'natural' ? ['natural'] : ['natural', 'legal']

  const payload: Record<string, unknown> = {
    reason: values.reason,
    min_operation: values.min_operation || null,
    max_operation: values.max_operation || null,
    eligible_person_types: eligiblePersonTypes,
    rules,
  }

  if (values.price_xof !== '') payload.price_xof = Number(values.price_xof)

  if (periodic) {
    payload.period = {
      unit: values.period_unit,
      every: Number(values.period_every),
      cycles: Number(values.period_cycles),
    }
    if (values.quota_per_period !== '') payload.quota_per_period = values.quota_per_period
    payload.cumulative = values.cumulative === 'true'
    payload.end_of_term = values.end_of_term
  }

  return payload
}

function nextTransitionLabel(plan: AdminPackPlan): string {
  const transitions = TRANSITIONS[plan.status]
  if (transitions.length === 0) return 'Aucune transition disponible'
  return transitions.length === 1 ? transitions[0].label : 'Changer le statut'
}

export default function PacksAdminPage() {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const canManage = can('packs.manage')

  const [family, setFamily] = useState<string>('all')
  const [status, setStatus] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'plan' | 'version' | 'transition' | 'duplicate' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const list = useQuery({
    queryKey: ['admin-pack-plans', family, status, search],
    queryFn: () =>
      get<AdminPackPlan[]>('/admin/packs/plans', {
        ...(family !== 'all' ? { family } : {}),
        ...(status !== 'all' ? { status } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
        per_page: 100,
      }),
    staleTime: 0,
  })

  const detail = useQuery({
    queryKey: ['admin-pack-plan', selectedId],
    queryFn: () => get<AdminPackPlan>(`/admin/packs/plans/${selectedId}`),
    enabled: selectedId !== null,
    staleTime: 0,
  })

  const selected = detail.data ?? list.data?.find((plan) => plan.id === selectedId) ?? null

  const families = useMemo(
    () =>
      (Object.keys(FAMILY_LABELS) as PackFamily[]).map((value) => ({
        value,
        label: FAMILY_LABELS[value],
        count: (list.data ?? []).filter((plan) => plan.family === value).length,
      })),
    [list.data],
  )

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-pack-plans'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-pack-plan'] }),
      queryClient.invalidateQueries({ queryKey: ['public-packs'] }),
      queryClient.invalidateQueries({ queryKey: ['packs-catalog'] }),
    ])
  }

  const publishVersion = useMutation({
    mutationFn: async (version: AdminPackVersion) => {
      if (!selected) return
      await post(`/admin/packs/plans/${selected.id}/versions/${version.id}/publish`)
    },
    onSuccess: () => void refresh(),
    onError: (error: Error) => setActionError(error.message),
  })

  const discardVersion = useMutation({
    mutationFn: async (version: AdminPackVersion) => {
      if (!selected) return
      await http.delete(`/admin/packs/plans/${selected.id}/versions/${version.id}`)
    },
    onSuccess: () => void refresh(),
    onError: (error: Error) => setActionError(error.message),
  })

  return (
    <>
      <Helmet>
        <title>Packs — CECT Admin</title>
      </Helmet>

      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)]">Catalogue des packs</h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-muted)]">
              Créez les formules, versionnez leurs conditions, publiez la bonne version et pilotez leur cycle de vie. Une version publiée est immuable.
            </p>
          </div>
          {canManage && (
            <button type="button" className={btnPrimary} onClick={() => setDialog('plan')}>
              <Plus size={16} aria-hidden />
              Nouveau pack
            </button>
          )}
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {families.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFamily(family === item.value ? 'all' : item.value)}
              className={`rounded-2xl border p-4 text-left transition-colors ${
                family === item.value ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5' : 'border-[var(--color-border)] bg-[var(--dash-card)] hover:bg-[var(--dash-bg)]'
              }`}
            >
              <p className="text-sm font-bold text-[var(--color-text)]">{item.label}</p>
              <p className="mt-1 text-2xl font-extrabold text-[var(--color-primary)]">{item.count}</p>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher par code ou nom"
            className="min-h-[44px] min-w-0 flex-1 basis-60 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="min-h-[44px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm"
          >
            <option value="all">Tous les statuts</option>
            {(Object.keys(STATUS_META) as PlanStatus[]).map((value) => (
              <option key={value} value={value}>
                {STATUS_META[value].label}
              </option>
            ))}
          </select>
          <button type="button" className={btnSecondary} onClick={() => void list.refetch()}>
            <RefreshCw size={15} aria-hidden />
            Actualiser
          </button>
        </div>

        <Panel title="Packs" subtitle={list.data ? `${list.data.length} formule(s)` : 'Chargement…'} flush>
          {list.isPending && <div className="mx-5 mb-4 h-40 animate-pulse rounded-2xl bg-[var(--chart-track)]" />}
          {list.isError && <p className="px-6 pb-5 text-sm text-[var(--color-danger)]">Impossible de charger le catalogue back-office.</p>}
          {list.data && list.data.length === 0 && <p className="px-6 pb-5 text-sm text-[var(--color-text-muted)]">Aucun pack ne correspond aux filtres.</p>}

          <div className="divide-y divide-[var(--color-border)]">
            {(list.data ?? []).map((plan) => {
              const statusMeta = STATUS_META[plan.status]
              const facts = versionFacts(plan.current_version)
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(plan.id)
                    setActionError(null)
                  }}
                  className={`flex w-full flex-wrap items-center gap-4 px-5 py-4 text-left hover:bg-[var(--dash-bg)] sm:px-6 ${
                    selectedId === plan.id ? 'bg-[var(--color-primary)]/5' : ''
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                    <Boxes size={18} aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1 basis-56">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm text-[var(--color-text)]">{plan.name}</strong>
                      <code className="rounded bg-[var(--chart-track)] px-1.5 py-0.5 text-xs">{plan.code}</code>
                      <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {FAMILY_LABELS[plan.family]}
                      {plan.level !== null ? ` · Niveau ${plan.level}` : ''}
                    </p>
                  </div>
                  <div className="min-w-0 basis-56 text-sm text-[var(--color-text-muted)]">
                    {facts.map((fact) => (
                      <span key={fact} className="mr-2 inline-block">
                        {fact}
                      </span>
                    ))}
                  </div>
                  <Eye size={16} className="text-[var(--color-text-muted)]" aria-hidden />
                </button>
              )
            })}
          </div>
        </Panel>

        {selected && (
          <Panel
            title={`${selected.name} · ${selected.code}`}
            subtitle={selected.description ?? FAMILY_LABELS[selected.family]}
            action={
              <div className="flex flex-wrap gap-2">
                {canManage && selected.status !== 'archived' && (
                  <button type="button" className={btnPrimary} onClick={() => setDialog('version')}>
                    <Plus size={15} aria-hidden />
                    Nouvelle version
                  </button>
                )}
                {canManage && TRANSITIONS[selected.status].length > 0 && (
                  <button type="button" className={btnSecondary} onClick={() => setDialog('transition')}>
                    {selected.status === 'published' ? <PauseCircle size={15} aria-hidden /> : <PlayCircle size={15} aria-hidden />}
                    {nextTransitionLabel(selected)}
                  </button>
                )}
                {canManage && (
                  <button type="button" className={btnSecondary} onClick={() => setDialog('duplicate')}>
                    <Copy size={15} aria-hidden />
                    Dupliquer
                  </button>
                )}
              </div>
            }
          >
            {detail.isFetching && <p className="mb-3 text-xs text-[var(--color-text-muted)]">Actualisation des versions…</p>}
            {actionError && <p className="mb-4 rounded-xl bg-[var(--color-danger)]/5 px-4 py-3 text-sm text-[var(--color-danger)]">{actionError}</p>}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-[var(--dash-bg)] p-4">
                <p className="text-xs text-[var(--color-text-muted)]">Statut du plan</p>
                <div className="mt-2">
                  <StatusBadge label={STATUS_META[selected.status].label} tone={STATUS_META[selected.status].tone} />
                </div>
              </div>
              <div className="rounded-xl bg-[var(--dash-bg)] p-4">
                <p className="text-xs text-[var(--color-text-muted)]">Version en production</p>
                <p className="mt-1 text-lg font-extrabold text-[var(--color-text)]">{selected.current_version ? `v${selected.current_version.version}` : 'Aucune'}</p>
              </div>
              <div className="rounded-xl bg-[var(--dash-bg)] p-4">
                <p className="text-xs text-[var(--color-text-muted)]">Versions connues</p>
                <p className="mt-1 text-lg font-extrabold text-[var(--color-text)]">{selected.versions?.length ?? 0}</p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {(selected.versions ?? [])
                .slice()
                .sort((a, b) => b.version - a.version)
                .map((version) => (
                  <div key={version.id} className="rounded-2xl border border-[var(--color-border)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-sm text-[var(--color-text)]">Version {version.version}</strong>
                          <StatusBadge label={version.published_at ? 'Publiée' : 'Brouillon'} tone={version.published_at ? 'success' : 'warning'} />
                          {selected.current_version?.id === version.id && <StatusBadge label="Courante" tone="primary" />}
                        </div>
                        <p className="mt-1 text-xs text-[var(--color-text-muted)]">{version.reason ?? 'Aucun motif renseigné'}</p>
                      </div>
                      {canManage && !version.published_at && selected.status !== 'archived' && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={btnPrimary}
                            disabled={publishVersion.isPending}
                            onClick={() => {
                              setActionError(null)
                              publishVersion.mutate(version)
                            }}
                          >
                            <PlayCircle size={15} aria-hidden />
                            Publier cette version
                          </button>
                          <button
                            type="button"
                            className={btnDanger}
                            disabled={discardVersion.isPending}
                            onClick={() => {
                              if (!window.confirm(`Supprimer définitivement la version ${version.version} non publiée ?`)) return
                              setActionError(null)
                              discardVersion.mutate(version)
                            }}
                          >
                            <Trash2 size={15} aria-hidden />
                            Supprimer
                          </button>
                        </div>
                      )}
                    </div>

                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <dt className="text-xs text-[var(--color-text-muted)]">Prix</dt>
                        <dd className="font-semibold text-[var(--color-text)]">{formatXof(version.price_xof)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--color-text-muted)]">Quota</dt>
                        <dd className="font-semibold text-[var(--color-text)]">{version.quota_per_period ? formatYem(version.quota_per_period) : 'À la demande'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--color-text-muted)]">Période</dt>
                        <dd className="font-semibold text-[var(--color-text)]">
                          {version.period ? `${version.period.cycles} cycle(s) de ${version.period.every} ${version.period.unit}` : 'Non périodique'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--color-text-muted)]">Éligibilité</dt>
                        <dd className="font-semibold text-[var(--color-text)]">{version.eligible_person_types.join(', ')}</dd>
                      </div>
                    </dl>

                    {Object.keys(version.rules ?? {}).length > 0 && (
                      <div className="mt-3 rounded-xl bg-[var(--dash-bg)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
                        Règles : {JSON.stringify(version.rules)}
                      </div>
                    )}
                  </div>
                ))}

              {selected.versions && selected.versions.length === 0 && (
                <p className="rounded-xl border border-dashed border-[var(--color-border)] p-5 text-sm text-[var(--color-text-muted)]">
                  Ce plan n’a encore aucune version. Créez une version puis publiez-la avant de publier le plan.
                </p>
              )}
            </div>
          </Panel>
        )}
      </div>

      {dialog === 'plan' && (
        <FormDialog
          title="Créer un pack"
          subtitle="Le plan est créé en brouillon. Ajoutez ensuite une version."
          submitLabel="Créer le pack"
          fields={planFields()}
          onClose={() => setDialog(null)}
          onSubmit={async (values) => {
            await post(
              '/admin/packs/plans',
              {
                family: values.family,
                code: values.code.trim().toUpperCase(),
                name: values.name.trim(),
                level: values.level ? Number(values.level) : null,
                description: values.description.trim() || null,
              },
              newIdempotencyKey(),
            )
            await refresh()
          }}
        />
      )}

      {dialog === 'version' && selected && (
        <FormDialog
          title="Créer une nouvelle version"
          subtitle={`${selected.name} · ${selected.code}`}
          submitLabel="Créer la version"
          fields={versionFields(selected)}
          onClose={() => setDialog(null)}
          onSubmit={async (values) => {
            await post(`/admin/packs/plans/${selected.id}/versions`, versionPayload(selected, values), newIdempotencyKey())
            await refresh()
          }}
        >
          <p className="rounded-xl bg-[var(--dash-bg)] p-3 text-xs leading-relaxed text-[var(--color-text-muted)]">
            Une version publiée devient immuable. Pour modifier un tarif ou un quota déjà publié, créez une nouvelle version et publiez-la.
          </p>
        </FormDialog>
      )}

      {dialog === 'transition' && selected && (
        <FormDialog
          title="Changer le statut du pack"
          subtitle={`${selected.code} · ${STATUS_META[selected.status].label}`}
          submitLabel="Confirmer le changement"
          fields={[
            {
              name: 'to',
              label: 'Nouveau statut',
              type: 'select',
              required: true,
              options: TRANSITIONS[selected.status],
            },
            { name: 'reason', label: 'Motif', type: 'textarea', required: true },
          ]}
          onClose={() => setDialog(null)}
          onSubmit={async (values) => {
            await post(`/admin/packs/plans/${selected.id}/transition`, { to: values.to, reason: values.reason })
            await refresh()
          }}
        />
      )}

      {dialog === 'duplicate' && selected && (
        <FormDialog
          title="Dupliquer le pack"
          subtitle={`Copie de ${selected.code}`}
          submitLabel="Créer la copie"
          fields={[
            { name: 'code', label: 'Nouveau code', required: true, initial: `${selected.code}-BIS` },
            { name: 'name', label: 'Nouveau nom', required: true, initial: `${selected.name} copie` },
          ]}
          onClose={() => setDialog(null)}
          onSubmit={async (values) => {
            await post(
              `/admin/packs/plans/${selected.id}/duplicate`,
              { code: values.code.trim().toUpperCase(), name: values.name.trim() },
              newIdempotencyKey(),
            )
            await refresh()
          }}
        />
      )}
    </>
  )
}
