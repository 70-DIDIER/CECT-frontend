import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarClock, CheckCircle2, ChevronDown, ChevronUp, Clock3, CreditCard, Download, ReceiptText, RefreshCw, Wallet2, HandCoins, ShieldCheck, Sparkles, LockKeyhole, Timer } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/app/AuthContext'
import { get } from '@/lib/api'
import { formatXof, formatYem } from '@/lib/format'
import { periodLabel, type PackVersion, type UserPack } from '@/features/packs/types'

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
  version: PackVersion
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
  family?: string | null
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
  const detail = useQuery({
    queryKey: ['payment-calendar', 'pack', id],
    queryFn: () => get<PackDetail>(`/me/packs/${id}`),
    staleTime: 15_000,
  })
  const isPersonal = detail.data?.family === 'PERSONNEL'
  const isSeller = detail.data?.family === 'VENDEUR'
  const isMerchant = detail.data?.family === 'MARCHAND'
  const topups = useQuery({
    queryKey: ['payment-calendar', 'topups', id],
    queryFn: () => get<PackTopup[]>(`/me/packs/${id}/topups`),
    enabled: isPersonal,
    staleTime: 15_000,
  })
  const periods = detail.data?.periods ?? []
  const rightsTotal = periods.reduce((sum, period) => sum + Number(period.quota), 0)
  const unlocked = periods.filter(period => period.credited).reduce((sum, period) => sum + Number(period.quota), 0)
  const available = detail.data?.balance?.available ?? '0'
  const reserved = detail.data?.balance?.reserved ?? '0'
  const consumed = detail.data?.balance?.consumed ?? '0'
  const remaining = Math.max(0, rightsTotal - unlocked)
  const nextPeriod = periods.find(period => !period.credited)
  const progress = rightsTotal > 0 ? Math.min(100, Math.max(0, 100 * unlocked / rightsTotal)) : 0
  const familyLabel = isSeller ? 'Vendeur' : isMerchant ? 'Marchand' : isPersonal ? 'Personnel' : 'Consommateur'
  const title = isSeller ? 'Vos autorisations de vente à la CECT' : isMerchant ? 'Vos plafonds de rééchange Marchand' : isPersonal ? 'Vos achats et rechargements de YEM' : 'Vos distributions de YEM'
  const explanation = isSeller
    ? 'Chaque période ouvre un droit de céder une quantité maximale de vos propres YEM à la CECT. Il ne s’agit ni de YEM versés par la coopérative, ni de paiements FCFA automatiques. Vous devez initier une vente, transférer vos YEM et attendre la validation comptable.'
    : isMerchant
      ? 'Ces quotas représentent vos plafonds de rééchange contractuels. Ils ne sont pas des YEM crédités par la CECT : vous devez d’abord recevoir les YEM de vos clients puis demander leur rachat.'
      : isPersonal
        ? 'Aucune période, aucun calendrier : vous achetez des YEM quand vous le souhaitez. Le solde est crédité après confirmation de chaque achat.'
        : 'Le pack est payé intégralement à la souscription. Les YEM du consommateur sont ensuite débloqués selon la fréquence configurée par le Superadmin.'
  const metrics = isSeller ? [
    { label: 'Autorisé sur le contrat', value: String(rightsTotal), note: 'Total des droits sur toutes les périodes', icon: HandCoins },
    { label: 'Disponible à vendre', value: available, note: 'Quota déjà ouvert et non engagé', icon: Wallet2 },
    { label: 'Réservé', value: reserved, note: 'Ventes en cours de traitement', icon: LockKeyhole },
    { label: 'Déjà cédé', value: consumed, note: 'Ventes validées et décomptées', icon: CheckCircle2 },
  ] : isMerchant ? [
    { label: 'Plafond contractuel', value: String(rightsTotal), note: 'Capacité sur toutes les périodes', icon: ShieldCheck },
    { label: 'Capacité disponible', value: available, note: 'Quota de rééchange déjà ouvert', icon: Wallet2 },
    { label: 'Réservé', value: reserved, note: 'Demandes de rééchange engagées', icon: LockKeyhole },
    { label: 'Déjà utilisé', value: consumed, note: 'Quota définitivement décompté', icon: CheckCircle2 },
  ] : [
    { label: 'Total prévu', value: String(rightsTotal), note: 'Droits YEM du contrat', icon: Wallet2 },
    { label: 'YEM disponibles', value: available, note: 'Crédits débloqués, non dépensés', icon: CheckCircle2 },
    { label: 'Réservés', value: reserved, note: 'Paiements en cours', icon: LockKeyhole },
    { label: 'Consommés', value: consumed, note: 'YEM déjà dépensés', icon: CreditCard },
  ]
  const actionTo = isSeller ? '/espace/vendre' : isMerchant ? '/espace/marchand' : '/espace/payer'
  const actionLabel = isSeller ? 'Vendre mes YEM' : isMerchant ? 'Accéder aux rachats Marchand' : 'Payer un marchand'
  const periodTitle = isSeller ? 'Droit de vente ouvert' : isMerchant ? 'Plafond ouvert' : 'YEM débloqués'
  const pendingTitle = isSeller ? 'Droit non ouvert' : isMerchant ? 'Plafond à venir' : 'Crédit à venir'
  const quotaTitle = isSeller ? 'Quantité cessible autorisée' : isMerchant ? 'Plafond de rééchange' : 'YEM à débloquer'
  return (
    <section className="space-y-5 border-t border-[var(--color-border)] bg-[var(--dash-bg)] px-4 py-5 sm:px-7 sm:py-6" aria-label={`Détail de la formule ${familyLabel}`}>
      {detail.isPending && <p className="text-sm text-[var(--color-text-muted)]">Chargement de votre fiche…</p>}
      {detail.isError && <p role="alert" className="text-sm text-rose-500">Impossible de récupérer les conditions. <button type="button" onClick={() => void detail.refetch()} className="underline">Réessayer</button></p>}
      {detail.data && <>
        <div className="rounded-[22px] border border-[var(--color-border)] bg-[var(--dash-card)] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-bold uppercase tracking-[.16em] text-[var(--color-primary)]">{familyLabel} · {isPersonal ? 'Sans échéance' : periodLabel(detail.data.version)}</span>
              <h3 className="mt-1 text-lg font-extrabold text-[var(--color-text)] sm:text-xl">{title}</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-text-muted)]">{explanation}</p>
            </div>
            {!isPersonal && <Link to={actionTo} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white transition hover:bg-emerald-700">{actionLabel}<ArrowRight size={15} aria-hidden /></Link>}
            {isPersonal && <Link to="/espace/packs" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white">Acheter des YEM<ArrowRight size={15} aria-hidden /></Link>}
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
            <div><dt className="text-xs text-[var(--color-text-muted)]">Activation</dt><dd className="mt-1 font-bold">{displayDate(detail.data.activated_at)}</dd></div>
            <div><dt className="text-xs text-[var(--color-text-muted)]">Souscription payée</dt><dd className="mt-1 font-bold tabular-nums">{formatXof(detail.data.price_xof)}</dd></div>
            <div><dt className="text-xs text-[var(--color-text-muted)]">Fin du contrat</dt><dd className="mt-1 font-bold">{isPersonal ? 'Sans échéance' : displayDate(detail.data.expires_at)}</dd></div>
            <div><dt className="text-xs text-[var(--color-text-muted)]">Statut</dt><dd className="mt-1 font-bold">{detail.data.status === 'active' ? 'Actif' : detail.data.status === 'pending_payment' ? 'Paiement en attente' : detail.data.status === 'expired' ? 'Terminé' : detail.data.status}</dd></div>
          </dl>
          <p className="mt-3 text-[11px] text-[var(--color-text-muted)]">Référence du contrat : {detail.data.id}</p>
        </div>
        {!isPersonal ? <>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            {metrics.map(({label,value,note,icon:Icon}) => <div key={label} title={note} className="min-w-0 rounded-2xl border border-[var(--color-border)] bg-[var(--dash-card)] p-3 sm:p-4"><dt className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-muted)]"><Icon size={14} aria-hidden />{label}</dt><dd className="mt-2 text-lg font-extrabold tabular-nums text-[var(--color-text)] sm:text-xl">{formatYem(value)}<span className="ml-1 text-[10px] font-semibold text-[var(--color-text-muted)]">YEM</span></dd><p className="mt-1 text-[11px] leading-4 text-[var(--color-text-muted)]">{note}</p></div>)}
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--dash-card)] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-extrabold text-[var(--color-text)]">{isSeller ? 'Déblocage des droits de vente' : isMerchant ? 'Ouverture des plafonds' : 'Déblocage des crédits YEM'}</p><p className="mt-1 text-xs text-[var(--color-text-muted)]">{periods.filter(period => period.credited).length} / {periods.length} périodes ouvertes</p></div><strong className="text-sm tabular-nums text-[var(--color-primary)]">{formatYem(String(unlocked))} / {formatYem(String(rightsTotal))} YEM</strong></div>
            <div role="progressbar" aria-label="Droits périodiques ouverts" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--chart-track)]"><div className="h-full rounded-full bg-emerald-500" style={{width:`${progress}%`}} /></div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-text-muted)]"><span>{formatYem(String(remaining))} YEM contractuels à ouvrir</span>{nextPeriod && <span className="inline-flex items-center gap-1.5 font-bold text-[var(--color-primary)]"><Timer size={14} aria-hidden />Prochaine ouverture : {displayDate(nextPeriod.starts_at)}</span>}</div>
            {isSeller && <p className="mt-3 border-t border-[var(--color-border)] pt-3 text-xs leading-5 text-[var(--color-text-muted)]">Important : « ouvert » signifie <strong>autorisé à la vente</strong> et non « versé ». Les YEM à céder proviennent de votre propre portefeuille. Le versement FCFA intervient seulement après la transaction et sa validation.</p>}
          </div>
          <div>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2"><h4 className="text-base font-extrabold text-[var(--color-text)]">{isSeller ? 'Fiche des autorisations par période' : isMerchant ? 'Fiche des plafonds par période' : 'Fiche des crédits programmés'}</h4><span className="text-xs text-[var(--color-text-muted)]">Fréquence : {periodLabel(detail.data.version)} · {periods.length} cycles</span></div>
            {periods.length === 0 ? <p className="rounded-xl border border-[var(--color-border)] p-4 text-sm text-[var(--color-text-muted)]">Aucune période contractuelle pour cette formule.</p> : <>
              <ul className="space-y-2 md:hidden" aria-label="Périodes du contrat">
                {periods.map(period => <li key={period.number} className="rounded-2xl border border-[var(--color-border)] bg-[var(--dash-card)] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-[var(--color-text-muted)]">Période {String(period.number).padStart(2, '0')} · {displayDate(period.starts_at)}</p><p className="mt-1 text-base font-extrabold tabular-nums">{formatYem(period.quota)} YEM</p><p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{quotaTitle}</p></div><span className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold ${period.credited ? 'bg-emerald-400/10 text-emerald-500' : 'bg-amber-400/10 text-amber-500'}`}>{period.credited ? periodTitle : new Date(period.starts_at).getTime() <= Date.now() ? 'En cours de traitement' : pendingTitle}</span></div></li>)}
              </ul>
              <div className="hidden overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--dash-card)] md:block">
                <table className="w-full min-w-[570px] text-left text-sm"><thead className="border-b border-[var(--color-border)] text-xs text-[var(--color-text-muted)]"><tr><th scope="col" className="px-5 py-4">Période</th><th scope="col" className="px-5 py-4">Date d’ouverture</th><th scope="col" className="px-5 py-4">{quotaTitle}</th><th scope="col" className="px-5 py-4">Statut</th></tr></thead>
                  <tbody className="divide-y divide-[var(--color-border)]">{periods.map(period => <tr key={period.number} className="hover:bg-emerald-500/[.035]"><td className="px-5 py-4 font-bold">{String(period.number).padStart(2, '0')}</td><td className="px-5 py-4 text-[var(--color-text-muted)]">{displayDate(period.starts_at)}</td><td className="px-5 py-4 font-bold tabular-nums">{formatYem(period.quota)} YEM</td><td className="px-5 py-4"><span className={`inline-flex rounded-lg px-3 py-1 text-xs font-bold ${period.credited ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>{period.credited ? periodTitle : new Date(period.starts_at).getTime() <= Date.now() ? 'En cours de traitement' : pendingTitle}</span></td></tr>)}</tbody>
                </table>
              </div>
            </>}
          </div>
        </> : <>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[.07] p-4"><p className="flex items-center gap-2 text-sm font-bold"><Sparkles size={17} aria-hidden />Aucun crédit périodique, aucun calendrier</p><p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">Retrouvez ici uniquement les achats de YEM que vous avez vous-même effectués.</p></div>
          {topups.isPending && <p className="text-sm text-[var(--color-text-muted)]">Chargement des rechargements…</p>}
          {topups.isError && <p role="alert" className="text-sm text-rose-500">Historique indisponible. <button type="button" onClick={() => void topups.refetch()} className="underline">Réessayer</button></p>}
          {topups.data?.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">Vous n’avez effectué aucun achat de YEM pour ce pack.</p>}
          {topups.data && topups.data.length > 0 && <ul className="divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)] bg-[var(--dash-card)]">{topups.data.map(topup => <li key={topup.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm sm:px-5"><span className="text-[var(--color-text-muted)]">{displayDate(topup.created_at)} · Achat de YEM</span><strong className="tabular-nums">{formatXof(topup.amount_xof)}</strong><StateTag state={topup.credited_at ? 'paid' : topup.status === 'canceled' ? 'canceled' : 'pending'}/></li>)}</ul>}
        </>}
      </>}
    </section>
  )
}

export default function PaymentCalendarPage() {
  const { user } = useAuth()
  const [filter, setFilter] = useState<PaymentFilter>('all')
  const [view, setView] = useState<ViewMode>('payments')
  const [familyFilter, setFamilyFilter] = useState<'ALL' | 'VENDEUR' | 'CONSOMMATEUR' | 'MARCHAND' | 'PERSONNEL'>('ALL')
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
    family: item.family,
    provider: item.provider,
    method: item.payment_method,
    reference: item.provider_reference,
  }))
  const visible = rows.filter((row) => filter === 'all' || filter === row.state)
  const paid = rows.filter((row) => row.state === 'paid')
  const totalPaid = statement.data?.summary.confirmed_total_xof ?? 0
  const selectedPack = (packs.data ?? []).find((item) => item.id === expandedId)
  const visiblePacks = (packs.data ?? []).filter(pack => familyFilter === 'ALL' || pack.family === familyFilter)
  const allowedFamilies = (packs.data ?? []).map(pack => pack.family).filter((family, i, all) => all.indexOf(family) === i)
  const legal = user?.personType === 'legal'
  const unavailable = statement.isError || packs.isError
  return (
    <>
      <Helmet><title>Fiche des règlements — CECT Togo</title></Helmet>
      <PageHeader title="Mes règlements et échéanciers" description={legal
        ? 'Une fiche de suivi pour les paiements et les droits de votre structure.'
        : 'Vos paiements, autorisations de vente, plafonds et crédits YEM, selon vos packs.'}
        actions={<button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--dash-card)] px-4 text-sm font-bold text-[var(--color-text)] hover:border-[var(--color-primary)]"><Download size={16} aria-hidden /> Imprimer la fiche</button>}
      />
      <div className="relative mb-6 overflow-hidden rounded-[26px] bg-[#0a2d23] p-6 text-white sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-12 -top-20 h-60 w-60 rounded-full bg-[#caff2e]/[.11] blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#caff2e]"><ReceiptText size={14} aria-hidden /> Fiche financière personnelle</span>
            <h2 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">{legal ? 'Suivi des règlements de votre entreprise' : 'Votre historique de règlements'}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">Chaque pack payant se règle à la souscription. Vendeur : quotas pour céder vos YEM. Consommateur : crédits YEM utilisables. Marchand : plafonds de rééchange. Personnel : achats libres sans échéancier.</p>
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
          <button type="button" aria-pressed={view === 'credits'} onClick={() => setView('credits')} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${view === 'credits' ? 'bg-emerald-600 text-white' : 'text-[var(--color-text-muted)]'}`}><Wallet2 size={15} className="mr-1.5 inline" aria-hidden /> Droits et échéanciers</button>
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
                      <td className="px-6 py-4">{row.packId ? <button type="button" aria-expanded={expandedId === row.packId} onClick={() => setExpandedId(expandedId === row.packId ? null : row.packId ?? null)} className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-bold text-[var(--color-primary)]">{expandedId === row.packId ? 'Masquer' : row.family === 'VENDEUR' ? 'Voir mes droits de vente' : row.family === 'MARCHAND' ? 'Voir mes plafonds' : row.family === 'PERSONNEL' ? 'Voir mes achats YEM' : 'Voir mes crédits'}{expandedId === row.packId ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}</button> : <span className="text-xs text-[var(--color-text-muted)]">Adhésion</span>}</td>
                    </tr>)}
                  </tbody>
                </table></div>
              )}
              {selectedPack && visible.some((row) => row.packId === selectedPack.id) && <PackSchedule key={selectedPack.id} id={selectedPack.id} />}
            </>
          ) : (
            <div className="p-6">
              <div className="mb-5"><h2 className="text-lg font-extrabold text-[var(--color-text)]">Vos droits et échéanciers par formule</h2><p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">Le type de suivi dépend du pack : Vendeur = droits de vente de vos propres YEM, Consommateur = YEM débloqués, Marchand = capacité de rééchange, Personnel = achats à la demande. Il ne s’agit pas de mensualités à payer.</p></div>
              <div role="group" aria-label="Filtrer les échéanciers par famille" className="mb-5 flex flex-wrap gap-2">
                {(['ALL', ...allowedFamilies] as const).map(family => <button key={family} type="button" aria-pressed={familyFilter === family} onClick={() => { setFamilyFilter(family); setExpandedId(null) }} className={`min-h-11 rounded-xl border px-4 py-2 text-xs font-bold transition ${familyFilter === family ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-[var(--color-border)] bg-[var(--dash-bg)] text-[var(--color-text)] hover:border-emerald-500'}`}>{family === 'ALL' ? 'Tous les packs' : family === 'VENDEUR' ? 'Vendeur · droits de vente' : family === 'CONSOMMATEUR' ? 'Consommateur' : family === 'MARCHAND' ? 'Marchand' : 'Personnel'}</button>)}
              </div>
              {(packs.data ?? []).length === 0 ? <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">Aucun pack souscrit. <Link to="/espace/packs" className="font-bold text-[var(--color-primary)]">Consulter le catalogue <ArrowRight size={13} className="inline" aria-hidden /></Link></div> : visiblePacks.map((pack) => <div key={pack.id} className="mb-4 overflow-hidden rounded-2xl border border-[var(--color-border)] last:mb-0"><button type="button" aria-expanded={expandedId === pack.id} onClick={() => setExpandedId(expandedId === pack.id ? null : pack.id)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left font-bold text-[var(--color-text)] transition hover:bg-emerald-500/[.035]"><span className="min-w-0"><span className="block text-sm font-extrabold sm:text-base">{pack.plan.name} <span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">{pack.family === 'VENDEUR' ? 'Droit de vendre' : pack.family === 'MARCHAND' ? 'Plafonds Marchand' : pack.family === 'PERSONNEL' ? 'Achats libres' : 'Crédits YEM'}</span></span><span className="mt-1 block text-[11px] font-normal text-[var(--color-text-muted)]">Souscrit le {displayDate(pack.activated_at ?? pack.created_at ?? null)} · Contrat {pack.id.slice(-8)}</span></span>{expandedId === pack.id ? <ChevronUp size={19} aria-hidden /> : <ChevronDown size={19} aria-hidden />}</button>{expandedId === pack.id && <PackSchedule id={pack.id} />}</div>)}
            </div>
          )}
        </section>
      )}
    </>
  )
}
