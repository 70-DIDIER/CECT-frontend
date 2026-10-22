import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarClock, CheckCircle2, ChevronDown, ChevronUp, Clock3, CreditCard, Download, ReceiptText, RefreshCw, Wallet2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/app/AuthContext'
import { get } from '@/lib/api'
import { formatXof, formatYem } from '@/lib/format'
import type { UserPack } from '@/features/packs/types'

type PaymentState = 'paid' | 'pending' | 'canceled' | 'free'
type PaymentFilter = 'all' | PaymentState
type ViewMode = 'payments' | 'credits'

interface MemberStatementRow {
  id: string
  type: 'membership' | 'pack' | 'topup'
  label: string
  pack_id: string | null
  family: string | null
  contract_amount_xof: number
  fee_amount_xof: number
  total_amount_xof: number
  status: PaymentState
  payment_method: string | null
  provider: string | null
  provider_reference: string | null
  created_at: string | null
  paid_at: string | null
}
interface MemberStatement {
  person_type: 'natural' | 'legal'
  currency: 'XOF'
  payment_mode: 'upfront_once'
  installments_allowed: false
  summary: {
    confirmed_payments_count: number
    pending_payments_count: number
    confirmed_total_xof: number
    confirmed_contract_total_xof: number
    confirmed_fees_xof: number
  }
  payments: MemberStatementRow[]
}
interface PackPeriod {
  number: number
  starts_at: string
  ends_at: string
  quota: string
  credited: boolean
}
interface PackDetail extends UserPack {
  paid_at: string | null
  created_at: string | null
  periods: PackPeriod[]
}
interface PackTopup {
  id: string
  status: string
  amount_xof: number
  created_at: string
  credited_at: string | null
}
interface PaymentRow {
  id: string
  label: string
  category: string
  date: string | null
  amount: number
  contractAmount: number
  fee: number
  state: PaymentState
  packId?: string
  provider?: string | null
  method?: string | null
  reference?: string | null
}

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

function displayDate(value: string | null) {
  if (!value) return 'À confirmer'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'À confirmer' : DATE_FORMAT.format(date)
}

function StateTag({ state }: { state: PaymentState }) {
  const label = state === 'paid' ? 'Réglé' : state === 'canceled' ? 'Annulé' : state === 'free' ? 'Gratuit' : 'En attente'
  const palette = state === 'paid'
    ? 'bg-emerald-400/10 text-emerald-500'
    : state === 'free' ? 'bg-sky-400/10 text-sky-500' : state === 'canceled' ? 'bg-rose-400/10 text-rose-500' : 'bg-amber-400/10 text-amber-500'
  return <span className={'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ' + palette}>{state === 'paid' ? <CheckCircle2 size={13} aria-hidden /> : <Clock3 size={13} aria-hidden />}{label}</span>
}

function PackSchedule({ id }: { id: string }) {
  const [section, setSection] = useState<'credits' | 'topups'>('credits')
  const detail = useQuery({
    queryKey: ['payment-calendar', 'pack', id],
    queryFn: () => get<PackDetail>(`/me/packs/${id}`),
    staleTime: 15_000,
  })
  const topups = useQuery({
    queryKey: ['payment-calendar', 'topups', id],
    queryFn: () => get<PackTopup[]>(`/me/packs/${id}/topups`),
    enabled: section === 'topups',
    staleTime: 15_000,
  })
  return (
    <div className="space-y-5 border-t border-[var(--color-border)] bg-[var(--dash-bg)] px-5 py-6 sm:px-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[var(--color-text)]">Fiche de la formule</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">Le pack se paie intégralement à la souscription ; les crédits YEM suivent leur propre échéancier.</p>
        </div>
        <div className="inline-flex rounded-xl border border-[var(--color-border)] bg-[var(--dash-card)] p-1" role="group" aria-label="Type d'historique">
          <button type="button" aria-pressed={section === 'credits'} onClick={() => setSection('credits')} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${section === 'credits' ? 'bg-emerald-600 text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}>Crédits YEM</button>
          <button type="button" aria-pressed={section === 'topups'} onClick={() => setSection('topups')} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${section === 'topups' ? 'bg-emerald-600 text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}>Rechargements</button>
        </div>
      </div>
      {detail.data && (
        <dl className="grid gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--dash-card)] p-4 sm:grid-cols-2 xl:grid-cols-4">
          <div><dt className="text-xs text-[var(--color-text-muted)]">Date d'activation</dt><dd className="mt-1.5 text-sm font-extrabold text-[var(--color-text)]">{displayDate(detail.data.activated_at)}</dd></div>
          <div><dt className="text-xs text-[var(--color-text-muted)]">Prix de souscription</dt><dd className="mt-1.5 text-sm font-extrabold tabular-nums text-[var(--color-text)]">{formatXof(detail.data.price_xof)}</dd></div>
          <div><dt className="text-xs text-[var(--color-text-muted)]">Date de fin</dt><dd className="mt-1.5 text-sm font-extrabold text-[var(--color-text)]">{displayDate(detail.data.expires_at)}</dd></div>
          <div><dt className="text-xs text-[var(--color-text-muted)]">État du pack</dt><dd className="mt-1.5 text-sm font-extrabold text-[var(--color-text)]">{detail.data.status === 'active' ? 'Actif' : detail.data.status === 'pending_payment' ? 'En attente de paiement' : detail.data.status === 'expired' ? 'Expiré' : 'Clôturé'}</dd></div>
        </dl>
      )}
      {section === 'credits' && (
        <>
          {detail.isPending && <p className="text-sm text-[var(--color-text-muted)]">Chargement de l'échéancier…</p>}
          {detail.isError && <p role="alert" className="text-sm text-rose-500">Impossible de récupérer les périodes du pack. <button type="button" onClick={() => void detail.refetch()} className="underline">Réessayer</button></p>}
          {detail.data && detail.data.periods.length === 0 && <p className="text-sm leading-6 text-[var(--color-text-muted)]">Aucun crédit périodique prévu pour cette formule. Les droits et les rechargements dépendent du type de pack.</p>}
          {detail.data && detail.data.periods.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--dash-card)]">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="border-b border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
                  <tr><th scope="col" className="px-5 py-4">Période</th><th scope="col" className="px-5 py-4">Date prévue</th><th scope="col" className="px-5 py-4">Crédit YEM</th><th scope="col" className="px-5 py-4">État</th></tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {detail.data.periods.map((period) => (
                    <tr key={period.number} className="transition hover:bg-emerald-500/[.045]">
                      <td className="px-5 py-4 font-bold text-[var(--color-text)]">{String(period.number).padStart(2, '0')}</td>
                      <td className="px-5 py-4 text-[var(--color-text-muted)]">{displayDate(period.starts_at)}</td>
                      <td className="px-5 py-4 font-bold tabular-nums text-[var(--color-text)]">{formatYem(period.quota)}</td>
                      <td className="px-5 py-4">{period.credited ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-500"><CheckCircle2 size={13} aria-hidden />Crédité</span> : <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-500">À créditer</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {section === 'topups' && (
        <>
          {topups.isPending && <p className="text-sm text-[var(--color-text-muted)]">Chargement des rechargements…</p>}
          {topups.isError && <p role="alert" className="text-sm text-rose-500">Historique indisponible. <button type="button" onClick={() => void topups.refetch()} className="underline">Réessayer</button></p>}
          {topups.data?.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">Aucun rechargement enregistré pour ce pack.</p>}
          {topups.data && topups.data.length > 0 && <ul className="divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)] bg-[var(--dash-card)]">
            {topups.data.map((topup) => <li key={topup.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm"><span className="text-[var(--color-text-muted)]">{displayDate(topup.created_at)} · Recharge</span><strong className="tabular-nums">{formatXof(topup.amount_xof)}</strong><StateTag state={topup.credited_at ? 'paid' : topup.status === 'canceled' ? 'canceled' : 'pending'} /></li>)}
          </ul>}
        </>
      )}
    </div>
  )
}

export default function PaymentCalendarPage() {
  const { user } = useAuth()
  const [filter, setFilter] = useState<PaymentFilter>('all')
  const [view, setView] = useState<ViewMode>('payments')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Monetary truth comes from server-verified PaymentIntents, never from pack activation flags.
  const statement = useQuery({ queryKey: ['payment-calendar', 'statement'], queryFn: () => get<MemberStatement>('/me/payment-statement'), staleTime: 15_000 })
  const packs = useQuery({ queryKey: ['payment-calendar', 'packs'], queryFn: () => get<UserPack[]>('/me/packs'), staleTime: 15_000 })

  const rows: PaymentRow[] = (statement.data?.payments ?? []).map((item) => ({
    id: item.id,
    label: item.label,
    category: item.type === 'membership' ? 'Cotisation initiale · paiement unique' : item.type === 'topup' ? 'Rechargement ponctuel · paiement unique' : 'Souscription · paiement intégral · ' + (item.family ?? ''),
    date: item.paid_at ?? item.created_at,
    amount: item.total_amount_xof,
    contractAmount: item.contract_amount_xof,
    fee: item.fee_amount_xof,
    state: item.status,
    packId: item.type === 'pack' ? item.pack_id ?? undefined : undefined,
    provider: item.provider,
    method: item.payment_method,
    reference: item.provider_reference,
  }))
  const visible = rows.filter((row) => filter === 'all' || filter === row.state)
  const paid = rows.filter((row) => row.state === 'paid')
  const totalPaid = statement.data?.summary.confirmed_total_xof ?? 0
  const selectedPack = (packs.data ?? []).find((item) => item.id === expandedId)
  const legal = user?.personType === 'legal'
  const unavailable = statement.isError || packs.isError
  return (
    <>
      <Helmet><title>Fiche des règlements — CECT Togo</title></Helmet>
      <PageHeader title="Mes règlements et échéanciers" description={legal
        ? 'Une fiche de suivi pour les paiements et les droits de votre structure.'
        : 'Vos paiements, souscriptions et crédits YEM en un seul endroit.'}
        actions={<button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--dash-card)] px-4 text-sm font-bold text-[var(--color-text)] hover:border-[var(--color-primary)]"><Download size={16} aria-hidden /> Imprimer la fiche</button>}
      />
      <div className="relative mb-6 overflow-hidden rounded-[26px] bg-[#0a2d23] p-6 text-white sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-12 -top-20 h-60 w-60 rounded-full bg-[#caff2e]/[.11] blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#caff2e]"><ReceiptText size={14} aria-hidden /> Fiche financière personnelle</span>
            <h2 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">{legal ? 'Suivi des règlements de votre entreprise' : 'Votre historique de règlements'}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">Paiement à 100 % lors de la souscription. Les crédits YEM arrivent selon leur calendrier contractuel : ce ne sont pas des mensualités à régler.</p>
          </div>
          <CalendarClock size={42} className="text-[#caff2e]" aria-hidden />
        </div>
        <dl className="relative mt-7 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[.07] p-4"><dt className="text-xs text-white/65">Paiements uniques confirmés</dt><dd className="mt-2 text-2xl font-extrabold tabular-nums">{paid.length}</dd></div>
          <div className="rounded-2xl border border-white/10 bg-white/[.07] p-4"><dt className="text-xs text-white/65">Montant confirmé, recharges et frais inclus</dt><dd className="mt-2 text-2xl font-extrabold tabular-nums">{formatXof(totalPaid)}</dd></div>
          <div className="rounded-2xl border border-white/10 bg-white/[.07] p-4"><dt className="text-xs text-white/65">Règlements en attente</dt><dd className="mt-2 text-2xl font-extrabold tabular-nums">{statement.data?.summary.pending_payments_count ?? 0}</dd></div>
        </dl>
      </div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-[var(--color-border)] bg-[var(--dash-card)] p-1" role="group" aria-label="Type de fiche">
          <button type="button" aria-pressed={view === 'payments'} onClick={() => setView('payments')} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${view === 'payments' ? 'bg-emerald-600 text-white' : 'text-[var(--color-text-muted)]'}`}><CreditCard size={15} className="mr-1.5 inline" aria-hidden /> Paiements</button>
          <button type="button" aria-pressed={view === 'credits'} onClick={() => setView('credits')} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${view === 'credits' ? 'bg-emerald-600 text-white' : 'text-[var(--color-text-muted)]'}`}><Wallet2 size={15} className="mr-1.5 inline" aria-hidden /> Échéancier YEM</button>
        </div>
        {view === 'payments' && <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
          {([['all', 'Tous'], ['paid', 'Réglés'], ['pending', 'En attente'], ['canceled', 'Annulés'], ['free', 'Gratuits']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition ${filter === value ? 'border-[var(--color-primary)] bg-emerald-500/10 text-[var(--color-primary)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}>{label}</button>)}
        </div>}
      </div>
      {unavailable && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 p-5 text-sm text-[var(--color-text)]">Le suivi ne peut pas être chargé pour le moment.<button type="button" onClick={() => { void statement.refetch(); void packs.refetch() }} className="inline-flex items-center gap-2 font-bold text-rose-500"><RefreshCw size={15} aria-hidden /> Réessayer</button></div>}
      {(statement.isPending || packs.isPending) && <div className="h-52 animate-pulse rounded-2xl bg-[var(--chart-track)]" aria-busy />}
      {!unavailable && !statement.isPending && !packs.isPending && (
        <section className="overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-[var(--dash-card)] shadow-[var(--shadow-card)]">
          {view === 'payments' ? (
            <>
              <div className="border-b border-[var(--color-border)] px-6 py-5"><h2 className="text-base font-extrabold text-[var(--color-text)]">Historique de paiement</h2><p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">Un seul paiement intégral par pack payant ; les frais de transaction et les rechargements sont détaillés séparément. Les paiements simulés ne correspondent pas à de vrais encaissements.</p></div>
              {visible.length === 0 ? <div className="px-6 py-14 text-center text-sm text-[var(--color-text-muted)]">Aucun règlement ne correspond à ce filtre.</div> : (
                <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm">
                  <thead className="border-b border-[var(--color-border)] text-xs text-[var(--color-text-muted)]"><tr><th scope="col" className="px-6 py-4">Opération</th><th scope="col" className="px-6 py-4">Date</th><th scope="col" className="px-6 py-4">Montant</th><th scope="col" className="px-6 py-4">Statut</th><th scope="col" className="px-6 py-4">Détails</th></tr></thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {visible.map((row) => <tr key={row.id} className="transition hover:bg-emerald-500/[.035]">
                      <td className="px-6 py-4"><strong className="block text-[var(--color-text)]">{row.label}</strong><span className="mt-1 block text-xs text-[var(--color-text-muted)]">{row.category}</span>{row.provider === 'fake' && <span className="mt-1 block text-xs font-bold text-amber-500">Simulation · aucun mouvement réel</span>}{row.reference && <span className="mt-1 block text-xs text-[var(--color-text-muted)]">Réf. : {row.reference}</span>}</td>
                      <td className="px-6 py-4 text-[var(--color-text-muted)]">{displayDate(row.date)}</td>
                      <td className="px-6 py-4 tabular-nums"><strong className="block text-[var(--color-text)]">{row.state === 'free' ? 'Gratuit' : formatXof(row.amount)}</strong>{row.fee > 0 && <span className="mt-1 block text-xs text-[var(--color-text-muted)]">Dont frais : {formatXof(row.fee)}</span>}</td>
                      <td className="px-6 py-4"><StateTag state={row.state} /></td>
                      <td className="px-6 py-4">{row.packId ? <button type="button" aria-expanded={expandedId === row.packId} onClick={() => setExpandedId(expandedId === row.packId ? null : row.packId ?? null)} className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-bold text-[var(--color-primary)]">{expandedId === row.packId ? 'Masquer' : 'Afficher le calendrier'}{expandedId === row.packId ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}</button> : <span className="text-xs text-[var(--color-text-muted)]">Adhésion</span>}</td>
                    </tr>)}
                  </tbody>
                </table></div>
              )}
              {selectedPack && visible.some((row) => row.packId === selectedPack.id) && <PackSchedule key={selectedPack.id} id={selectedPack.id} />}
            </>
          ) : (
            <div className="p-6">
              <div className="mb-5"><h2 className="text-base font-extrabold text-[var(--color-text)]">Calendrier de vos crédits YEM</h2><p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">Ces dates correspondent aux quotas prévus par vos packs, et non à des sommes à rembourser.</p></div>
              {(packs.data ?? []).length === 0 ? <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">Aucun pack souscrit. <Link to="/espace/packs" className="font-bold text-[var(--color-primary)]">Consulter le catalogue <ArrowRight size={13} className="inline" aria-hidden /></Link></div> : (packs.data ?? []).map((pack) => <div key={pack.id} className="mb-4 overflow-hidden rounded-2xl border border-[var(--color-border)] last:mb-0"><button type="button" aria-expanded={expandedId === pack.id} onClick={() => setExpandedId(expandedId === pack.id ? null : pack.id)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left font-bold text-[var(--color-text)] transition hover:bg-emerald-500/[.035]"><span>{pack.plan.name} <span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">{pack.family}</span></span>{expandedId === pack.id ? <ChevronUp size={19} aria-hidden /> : <ChevronDown size={19} aria-hidden />}</button>{expandedId === pack.id && <PackSchedule id={pack.id} />}</div>)}
            </div>
          )}
        </section>
      )}
    </>
  )
}
