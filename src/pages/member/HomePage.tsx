import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { ArrowRight, Boxes, Coins, ScanLine } from 'lucide-react'
import { Panel } from '@/components/dashboard/Panel'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { MemberCard } from '@/components/ui/MemberCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { btnLime, btnOnDark, btnOutline } from '@/components/ui/buttons'
import { useMemberDashboard } from '@/data/useMemberDashboard'
import type { MemberDashboardData } from '@/data/memberDashboard'
import { daysUntil, formatDateMedium, formatYem } from '@/lib/format'

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
          Solde disponible
        </h2>
        <p className="mt-3 flex items-baseline gap-2 text-[52px] font-bold leading-none tracking-tight text-[var(--lime)] [font-variant-numeric:tabular-nums]">
          {value}
          <span className="text-xl font-semibold text-white/80">{unit}</span>
        </p>
        <dl className="mt-7 grid grid-cols-3 gap-4 border-t border-white/10 pt-5 text-sm">
          {[
            ['Réservé', data.balance.reserved],
            ['Crédité', data.balance.total_credited],
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

function MainPack({ data }: { data: MemberDashboardData }) {
  const pack = data.packs[0]
  if (!pack) {
    return (
      <Panel title="Mon pack">
        <EmptyState
          title="Aucun pack actif"
          description="Un pack vous donne un quota de YEM à utiliser chez les marchands du réseau."
          action={
            <Link to="/espace/packs" className={btnOutline}>
              <Boxes size={17} aria-hidden />
              Découvrir les packs
            </Link>
          }
        />
      </Panel>
    )
  }
  const quota = Number.parseFloat(pack.quota_per_period)
  const used = Number.parseFloat(pack.quota_used)
  const ratio = quota > 0 ? Math.min(used / quota, 1) : 0

  return (
    <Panel title={pack.name} subtitle={pack.code} action={<Link to="/espace/packs" className="text-sm font-semibold text-[var(--color-primary)]">Détails</Link>}>
      <p className="text-sm text-[var(--color-text-muted)]">Quota utilisé ou réservé</p>
      <p className="mt-1 text-2xl font-bold text-[var(--color-text)] [font-variant-numeric:tabular-nums]">
        {formatYem(pack.quota_used)} <span className="text-base font-semibold text-[var(--color-text-muted)]">sur {formatYem(pack.quota_per_period)}</span>
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--chart-track)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)} aria-label="Quota utilisé">
        <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${ratio * 100}%` }} />
      </div>
      {pack.period && (
        <p className="mt-4 text-sm text-[var(--color-text-muted)]">
          Prochain crédit dans <strong className="text-[var(--color-text)]">{daysUntil(pack.period.next_credit_at)} jours</strong> ({formatDateMedium(pack.period.next_credit_at)})
        </p>
      )}
    </Panel>
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
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
            <Movements data={data} />
            <MainPack data={data} />
          </div>
        </div>
      )}
    </>
  )
}
