import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { ArrowRight, Boxes, Coins, ScanLine, Clock3, ShoppingBag, Store, Wallet2 } from 'lucide-react'
import { Panel } from '@/components/dashboard/Panel'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { MemberCard } from '@/components/ui/MemberCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { btnLime, btnOnDark, btnOutline } from '@/components/ui/buttons'
import { useMemberDashboard } from '@/data/useMemberDashboard'
import type { MemberDashboardData } from '@/data/memberDashboard'
import { formatDateMedium, formatYem } from '@/lib/format'

function amountParts(quantity: string): { value: string; unit: string } {
  const [value = '0', unit = 'YEM'] = formatYem(quantity).split(' ')
  return { value, unit }
}

function Balance({ data }: { data: MemberDashboardData }) {
  const families = new Set(data.packs.map((pack) => pack.family))
  const canPay = families.has('CONSOMMATEUR') || families.has('PERSONNEL')
  const { value, unit } = amountParts(data.balance.available)

  return (
    <section aria-labelledby="balance-title" className="flex flex-col justify-between rounded-[24px] bg-[var(--forest-900)] p-7 text-white">
      <div>
        <h2 id="balance-title" className="text-sm font-semibold text-[var(--sidebar-muted)]">
          Solde utilisable chez les marchands
        </h2>
        <p className="mt-3 flex items-baseline gap-2 text-[52px] font-bold leading-none tracking-tight text-[var(--lime)] [font-variant-numeric:tabular-nums]">
          {value}
          <span className="text-xl font-semibold text-white/80">{unit}</span>
        </p>
        <p className="mt-3 text-xs text-white/50">Packs Consommateur et Personnel uniquement · les quotas Vendeur sont suivis à part</p>
        <dl className="mt-7 grid grid-cols-3 gap-4 border-t border-white/10 pt-5 text-sm">
          {[
            ['Crédité', data.balance.total_credited],
            ['Réservé', data.balance.reserved],
            ['Dépensé', data.balance.total_spent],
          ].map(([label, quantity]) => (
            <div key={label}>
              <dt className="text-xs text-[var(--sidebar-muted)]">{label}</dt>
              <dd className="mt-1 font-bold [font-variant-numeric:tabular-nums]">{formatYem(quantity ?? '0')}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
        <Link to={canPay ? '/espace/payer' : '/espace/packs'} className={`${btnLime} w-full sm:w-auto`}>
          <ScanLine size={17} aria-hidden />
          {canPay ? 'Payer un marchand' : 'Choisir un pack'}
        </Link>
        <Link to={families.has('VENDEUR') ? '/espace/vendre' : '/espace/packs'} className={`${btnOnDark} w-full sm:w-auto`}>
          <Coins size={17} aria-hidden />
          Vendre mes YEM
        </Link>
      </div>
    </section>
  )
}

function Todo({ data }: { data: MemberDashboardData }) {
  const awaitingPayments = data.notifications.filter((notification) => notification.id.startsWith('pay-'))
  const operations = data.operations_in_progress.slice(0, 3)
  const hidden = data.operations_in_progress.length - operations.length
  if (awaitingPayments.length === 0 && operations.length === 0) return null

  return (
    <Panel title="À faire" subtitle="Ce qui attend une action de votre part ou une décision de la CECT">
      <ul className="divide-y divide-[var(--color-border)]">
        {awaitingPayments.map((notification) => (
          <li key={notification.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-text)]">{notification.title}</p>
              <p className="text-sm text-[var(--color-text-muted)]">{notification.detail}</p>
            </div>
            <Link to="/espace/packs" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)]">
              Ouvrir <ArrowRight size={15} aria-hidden />
            </Link>
          </li>
        ))}
        {operations.map((operation) => (
          <li key={operation.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-text)]">{operation.label}</p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {operation.reference} · {formatYem(operation.quantity)} · étape « {operation.steps[operation.step]?.label ?? 'en cours'} »
              </p>
            </div>
            <Link to={operation.kind === 'merchant_payment' ? '/espace/payer' : '/espace/vendre'} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)]">
              Suivre <ArrowRight size={15} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      {hidden > 0 && <p className="mt-4 border-t border-[var(--color-border)] pt-4 text-sm text-[var(--color-text-muted)]">et {hidden} autre{hidden > 1 ? 's' : ''} opération{hidden > 1 ? 's' : ''} en cours (voir Payer ou Vendre).</p>}
    </Panel>
  )
}

function Movements({ data }: { data: MemberDashboardData }) {
  const entries = data.ledger.slice(0, 5)
  return (
    <Panel
      title="Derniers mouvements"
      action={
        <Link to="/espace/activite" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)]">
          Voir tout <ArrowRight size={15} aria-hidden />
        </Link>
      }
      flush
    >
      {entries.length === 0 ? (
        <EmptyState title="Aucun mouvement" description="Vos crédits de quota, achats et réservations apparaîtront ici." />
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-4 px-6 py-3.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--color-text)]">{entry.label}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{formatDateMedium(entry.date)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {entry.state === 'reserved' && <StatusBadge label="Réservé" tone="warning" />}
                <span className={`text-sm font-bold [font-variant-numeric:tabular-nums] ${entry.direction === 'credit' ? 'text-[var(--tone-success-fg)]' : 'text-[var(--color-text)]'}`}>
                  {entry.direction === 'credit' ? '+' : '−'}
                  {formatYem(entry.quantity)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

const FAMILY_DETAILS = {
  VENDEUR: { label: 'Vendeur', Icon: Coins, description: 'Droit de cession YEM vers la CECT', accent: 'text-amber-400', bg: 'bg-amber-500/10' },
  CONSOMMATEUR: { label: 'Consommateur', Icon: ShoppingBag, description: 'Solde pour payer chez les marchands', accent: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  PERSONNEL: { label: 'Personnel', Icon: Wallet2, description: 'Solde rechargeable à la demande', accent: 'text-sky-400', bg: 'bg-sky-500/10' },
  MARCHAND: { label: 'Marchand', Icon: Store, description: 'Droits d’encaissement et de rééchange', accent: 'text-violet-400', bg: 'bg-violet-500/10' },
} as const

function CreditCountdown({ date }: { date: string }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const seconds = Math.max(0, Math.ceil((new Date(date).getTime() - now) / 1000))
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor(seconds % 86400 / 3600)
  const minutes = Math.floor(seconds % 3600 / 60)
  const remainder = seconds % 60
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]" aria-live="off">
      <Clock3 size={15} aria-hidden/>
      <span>Prochain crédit</span>
      <strong className="font-mono text-sm font-bold tabular-nums text-[var(--color-text)]">
        {seconds === 0 ? 'Échéance atteinte' : `${days}j ${String(hours).padStart(2,'0')}h ${String(minutes).padStart(2,'0')}m ${String(remainder).padStart(2,'0')}s`}
      </strong>
      <span className="opacity-70">· {formatDateMedium(date)}</span>
    </div>
  )
}

function MainPack({ data }: { data: MemberDashboardData }) {
  if (data.packs.length === 0) {
    return (
      <Panel title="Mes packs">
        <EmptyState title="Aucun pack actif" description="Choisissez une formule Vendeur, Consommateur ou Personnel selon votre activité."
          action={<Link to="/espace/packs" className={btnOutline}><Boxes size={17}/> Explorer les packs</Link>}/>
      </Panel>
    )
  }
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-lg font-extrabold tracking-tight">Mes packs et mes droits</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Soldes séparés pour chaque souscription, sans confusion entre vendre et dépenser.</p></div>
        <Link to="/espace/packs" className="text-sm font-semibold text-[var(--color-primary)]">Tous mes packs <ArrowRight size={15} className="inline"/></Link>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {data.packs.map((pack) => {
          const meta = FAMILY_DETAILS[pack.family]
          const Icon = meta.Icon
          const limit = Number(pack.quota_per_period)
          const used = Number(pack.quota_used)
          const progress = limit > 0 ? Math.min(100, Math.round(100 * used / limit)) : 0
          return (
            <article key={pack.id} className="overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-[var(--dash-card)] p-5 shadow-[var(--shadow-card)]">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${meta.bg} ${meta.accent}`}><Icon size={22}/></div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">{meta.label} · {pack.code}</p>
                    <h3 className="truncate text-base font-extrabold">{pack.name}</h3>
                  </div>
                </div>
                <StatusBadge label="Actif" tone="success"/>
              </div>
              <p className="mb-4 text-xs text-[var(--color-text-muted)]">{meta.description}</p>
              <div className="rounded-2xl bg-[var(--dash-bg)] p-4">
                <p className="text-xs text-[var(--color-text-muted)]">{pack.family === 'VENDEUR' ? 'Quota de vente disponible' : pack.family === 'MARCHAND' ? 'Quota du pack' : 'YEM disponibles'}</p>
                <p className="mt-1 text-3xl font-extrabold tracking-tight tabular-nums">{formatYem(pack.available)}</p>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--color-border)] pt-3">
                  {[
                    ['Crédité', pack.credited],
                    ['Réservé', pack.reserved],
                    [pack.family === 'VENDEUR' ? 'Vendu' : 'Utilisé', pack.consumed],
                  ].map(([label, value]) => (
                    <div key={label}><p className="text-[11px] text-[var(--color-text-muted)]">{label}</p>
                      <p className="mt-1 text-sm font-bold tabular-nums">{formatYem(value)}</p>
                    </div>
                  ))}
                </div>
                {pack.family === 'CONSOMMATEUR' && Number(pack.credited_cashback) > 0 &&
                  <p className="mt-3 text-xs text-[var(--color-primary)]">Dont {formatYem(pack.credited_cashback)} de bonus YEM offerts.</p>}
              </div>
              {limit > 0 && <div className="mt-4">
                <div className="mb-2 flex justify-between text-xs text-[var(--color-text-muted)]"><span>Quota par période</span><strong>{formatYem(pack.quota_per_period)}</strong></div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--chart-track)]" role="progressbar" aria-label={`Utilisation du quota ${pack.code}`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                  <div style={{width: `${progress}%`}} className="h-full rounded-full bg-[var(--color-primary)] transition-all"/>
                </div>
              </div>}
              {pack.period && <div className="mt-4 border-t border-[var(--color-border)] pt-4"><CreditCountdown date={pack.period.next_credit_at}/></div>}
              <div className="mt-5 flex flex-wrap gap-2">
                <Link to={pack.family === 'VENDEUR' ? '/espace/vendre' : pack.family === 'MARCHAND' ? '/espace/marchand' : pack.family === 'PERSONNEL' ? '/espace/packs' : '/espace/payer'}
                  className={`${btnOutline} text-xs`}>{pack.family === 'VENDEUR' ? 'Vendre mes YEM' : pack.family === 'MARCHAND' ? 'Encaisser / rééchanger' : pack.family === 'PERSONNEL' ? 'Recharger / gérer' : 'Payer un marchand'} <ArrowRight size={14}/></Link>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default function HomePage() {
  const query = useMemberDashboard()
  const data = query.data
  const firstName = data?.profile.name.split(' ')[0] ?? ''

  return (
    <>
      <Helmet>
        <title>Accueil — CECT Togo</title>
      </Helmet>

      <PageHeader title={firstName ? `Bonjour, ${firstName}` : 'Bonjour'} description="Votre solde, vos opérations en cours et vos derniers mouvements." />

      {query.isPending && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]" aria-busy>
          <div className="aspect-[1.65/1] animate-pulse rounded-[24px] bg-[var(--chart-track)]" />
          <div className="min-h-[220px] animate-pulse rounded-[24px] bg-[var(--chart-track)]" />
        </div>
      )}

      {query.isError && (
        <p role="alert" className="rounded-[18px] border border-[var(--color-border)] bg-[var(--dash-card)] p-6 text-sm">
          Impossible de charger votre espace.{' '}
          <button type="button" onClick={() => void query.refetch()} className="font-semibold text-[var(--color-primary)] underline">
            Réessayer
          </button>
        </p>
      )}

      {data && (
        <div className="space-y-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
            <MemberCard name={data.profile.name} pernum={data.profile.pernum} memberNumber={data.profile.member_number} memberSince={data.profile.member_since} active={data.membership.status === 'active'} />
            <Balance data={data} />
          </div>
          <Todo data={data} />
          <MainPack data={data} />
          <Movements data={data} />
        </div>
      )}
    </>
  )
}
