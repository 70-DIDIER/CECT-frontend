import { useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Panel } from '@/components/dashboard/Panel'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { btnOutline } from '@/components/ui/buttons'
import { getRaw } from '@/lib/api'
import { formatDateMedium, formatYem } from '@/lib/format'
import { useMemberDashboard } from '@/data/useMemberDashboard'
import type { MemberDashboardData } from '@/data/memberDashboard'

interface LedgerRow {
  id: string
  user_pack_id: string
  type: 'credit' | 'reserve' | 'release' | 'consume' | 'expire' | 'adjust'
  available_delta: string
  consumed_delta: string
  reason: string | null
  created_at: string
}

interface LedgerPage {
  data: LedgerRow[]
  next_cursor: string | null
}

const TYPE_LABELS: Record<LedgerRow['type'], string> = {
  credit: 'Crédit de quota',
  reserve: 'Réservation',
  release: 'Réservation libérée',
  consume: 'Achat confirmé',
  expire: 'Quota expiré',
  adjust: 'Ajustement',
}

const FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'Tous les mouvements' },
  { value: 'credit', label: 'Crédits' },
  { value: 'consume', label: 'Achats' },
  { value: 'reserve', label: 'Réservations' },
]

function magnitude(row: LedgerRow): { value: string; sign: '+' | '−' | '' } {
  const delta = Number.parseFloat(row.type === 'consume' ? row.consumed_delta : row.available_delta)
  if (!Number.isFinite(delta) || delta === 0) return { value: '0', sign: '' }
  return { value: String(Math.abs(delta)), sign: row.type === 'consume' || delta < 0 ? '−' : '+' }
}

function MonthlyBars({ data }: { data: MemberDashboardData['monthly_activity'] }) {
  const max = Math.max(...data.flatMap((month) => [month.credit, month.debit]), 1)
  const total = data.reduce((sum, month) => sum + month.credit + month.debit, 0)

  if (total === 0) {
    return <EmptyState title="Pas encore d’activité" description="Vos crédits et achats des six derniers mois s’afficheront ici." />
  }

  return (
    <div>
      <div className="flex h-44 items-end gap-3 sm:gap-5" role="img" aria-label={`Crédits et achats sur les six derniers mois : ${data.map((month) => `${month.month} ${month.credit} crédités, ${month.debit} dépensés`).join(' ; ')}`}>
        {data.map((month) => (
          <div key={month.month} className="flex h-full flex-1 flex-col justify-end gap-2">
            <div className="flex flex-1 items-end justify-center gap-1.5">
              <div className="w-full max-w-[22px] rounded-t-md bg-[var(--color-primary)]" style={{ height: `${(month.credit / max) * 100}%`, minHeight: month.credit > 0 ? 4 : 0 }} title={`${month.credit} YEM crédités`} />
              <div className="w-full max-w-[22px] rounded-t-md bg-[var(--lime)]" style={{ height: `${(month.debit / max) * 100}%`, minHeight: month.debit > 0 ? 4 : 0 }} title={`${month.debit} YEM dépensés`} />
            </div>
            <p className="text-center text-xs font-semibold capitalize text-[var(--color-text-muted)]">{month.month}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-5 text-xs font-semibold text-[var(--color-text-muted)]">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-[var(--color-primary)]" /> Crédités
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-[var(--lime)]" /> Dépensés
        </span>
      </div>
    </div>
  )
}

export default function ActivityPage() {
  const dashboard = useMemberDashboard()
  const [packId, setPackId] = useState('')
  const [type, setType] = useState('all')

  const ledger = useInfiniteQuery({
    queryKey: ['ledger', packId],
    queryFn: ({ pageParam }) => getRaw<LedgerPage>('/me/quota-ledger', { per_page: 25, ...(packId ? { user_pack_id: packId } : {}), ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: '',
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    staleTime: 0,
  })

  const packs = useMemo(() => dashboard.data?.packs ?? [], [dashboard.data?.packs])
  const packNames = useMemo(() => new Map(packs.map((pack) => [pack.id, pack.name])), [packs])
  const rows = (ledger.data?.pages.flatMap((page) => page.data) ?? []).filter((row) => type === 'all' || row.type === type)

  const columns: Column<LedgerRow>[] = [
    {
      key: 'label',
      header: 'Mouvement',
      render: (row) => (
        <span>
          <span className="block font-semibold">{row.reason && row.type === 'credit' ? row.reason : TYPE_LABELS[row.type]}</span>
          <span className="block text-xs text-[var(--color-text-muted)]">{packNames.get(row.user_pack_id) ?? 'Pack'}</span>
        </span>
      ),
    },
    { key: 'date', header: 'Date', render: (row) => formatDateMedium(row.created_at) },
    {
      key: 'state',
      header: 'Statut',
      render: (row) => (row.type === 'reserve' ? <StatusBadge label="Réservé" tone="warning" /> : <StatusBadge label="Comptabilisé" tone="success" />),
    },
    {
      key: 'quantity',
      header: 'Quantité',
      align: 'right',
      render: (row) => {
        const { value, sign } = magnitude(row)
        return (
          <span className={`font-bold ${sign === '+' ? 'text-[var(--tone-success-fg)]' : ''}`}>
            {sign}
            {formatYem(value)}
          </span>
        )
      },
    },
  ]

  return (
    <>
      <Helmet>
        <title>Activité — CECT Togo</title>
      </Helmet>

      <PageHeader title="Activité" description="Les crédits, achats et réservations de vos packs." />

      <div className="space-y-8">
        <Panel title="Six derniers mois" subtitle="YEM crédités et dépensés par mois">
          {dashboard.data ? <MonthlyBars data={dashboard.data.monthly_activity} /> : <div className="h-44 animate-pulse rounded-xl bg-[var(--chart-track)]" />}
        </Panel>

        <Panel
          title="Mouvements"
          action={
            <div className="flex flex-wrap gap-2">
              <label className="sr-only" htmlFor="filter-type">
                Type de mouvement
              </label>
              <select id="filter-type" value={type} onChange={(event) => setType(event.target.value)} className="min-h-[40px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
                {FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
              {packs.length > 1 && (
                <>
                  <label className="sr-only" htmlFor="filter-pack">
                    Pack
                  </label>
                  <select id="filter-pack" value={packId} onChange={(event) => setPackId(event.target.value)} className="min-h-[40px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
                    <option value="">Tous les packs</option>
                    {packs.map((pack) => (
                      <option key={pack.id} value={pack.id}>
                        {pack.name}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          }
          flush
        >
          {ledger.isPending && <div className="mx-6 mb-4 h-32 animate-pulse rounded-xl bg-[var(--chart-track)]" />}
          {ledger.isError && (
            <p role="alert" className="px-6 pb-5 text-sm">
              Impossible de charger les mouvements.{' '}
              <button type="button" onClick={() => void ledger.refetch()} className="font-semibold text-[var(--color-primary)] underline">
                Réessayer
              </button>
            </p>
          )}
          {ledger.data && <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} empty={<EmptyState title="Aucun mouvement" description="Aucun mouvement ne correspond à ces filtres." />} />}
          {ledger.hasNextPage && (
            <div className="border-t border-[var(--color-border)] p-4 text-center">
              <button type="button" onClick={() => void ledger.fetchNextPage()} disabled={ledger.isFetchingNextPage} className={btnOutline}>
                {ledger.isFetchingNextPage ? 'Chargement…' : 'Afficher plus'}
              </button>
            </div>
          )}
        </Panel>
      </div>
    </>
  )
}
