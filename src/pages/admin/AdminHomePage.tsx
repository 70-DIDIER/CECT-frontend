import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  Banknote,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleCheck,
  Coins,
  Download,
  Hourglass,
  Landmark,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Store,
  Settings,
  TrendingUp,
  UserPlus,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { AreaChart } from '@/components/dashboard/AreaChart'
import { Avatar } from '@/components/dashboard/Avatar'
import { DonutChart } from '@/components/dashboard/DonutChart'
import { HBarList } from '@/components/dashboard/HBarList'
import { Panel } from '@/components/dashboard/Panel'
import { SegmentedControl } from '@/components/dashboard/SegmentedControl'
import { Skeleton } from '@/components/dashboard/Skeleton'
import { StatCard } from '@/components/dashboard/StatCard'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { TONES, type Tone } from '@/components/dashboard/tones'
import { fetchAdminDashboard, type AdminDashboardData, type PeriodDays } from '@/data/adminDashboard'
import { formatBps, formatDateLong, formatRelativeDay, formatXof } from '@/lib/format'
import type { UserRole } from '@/lib/roles'

const PERIOD_OPTIONS = [
  { value: 7 as PeriodDays, label: '7 jours' },
  { value: 30 as PeriodDays, label: '30 jours' },
  { value: 90 as PeriodDays, label: '90 jours' },
]

const SOURCE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

const METHOD_ICONS: Record<string, LucideIcon> = {
  'T-Money (simulation)': Smartphone,
  'Flooz (simulation)': Smartphone,
  'Espèces (simulation)': Banknote,
  'Virement bancaire (simulation)': Landmark,
  'T-Money': Smartphone,
  Flooz: Smartphone,
  Espèces: Banknote,
  'Virement bancaire': Landmark,
}

const GREETING_BY_ROLE: Record<UserRole, string> = {
  administrateur: 'Gérez les membres, le catalogue, les contenus et le paramétrage métier autorisé.',
  superadmin: 'Pilotez la gouvernance, la sécurité, les accès, les paramètres critiques et la santé globale.',
  validateur: 'Contrôlez uniquement les réceptions YEM attendues, leurs preuves et les anomalies associées.',
  comptabilite: 'Supervisez les paiements simulés, les contre-valeurs, les payouts et les rapprochements.',
  utilisateur: '',
}

function firstNameOf(name: string): string {
  return name.split(' ')[0] ?? name
}

function LoadingState() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Chargement du tableau de bord">
      <Skeleton className="h-40 rounded-3xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-36 rounded-3xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Skeleton className="h-80 rounded-3xl xl:col-span-2" />
        <Skeleton className="h-80 rounded-3xl" />
      </div>
    </div>
  )
}

interface PendingRowProps {
  icon: LucideIcon
  label: string
  hint: string
  count: number
  tone: Tone
}

function PendingRow({ icon: Icon, label, hint, count, tone }: PendingRowProps) {
  const style = TONES[tone]
  return (
    <li>
      <Link
        to="/admin/validations"
        className="group flex min-h-[64px] items-center gap-3 rounded-2xl border border-transparent p-2.5 transition-colors hover:border-[var(--color-border)] hover:bg-[var(--dash-bg)]"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: style.bg, color: style.fg }}>
          <Icon size={19} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-[var(--color-text)]">{label}</span>
          <span className="block truncate text-xs text-[var(--color-text-muted)]">{hint}</span>
        </span>
        <span
          className="flex h-8 min-w-[2rem] items-center justify-center rounded-full px-2 text-sm font-extrabold"
          style={count > 0 ? { background: style.bg, color: style.fg } : { background: 'var(--chart-track)', color: 'var(--color-text-muted)' }}
        >
          {count}
        </span>
        <ChevronRight size={16} aria-hidden className="shrink-0 text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  )
}

function Dashboard({ data, days, onChangeDays, role, name }: { data: AdminDashboardData; days: PeriodDays; onChangeDays: (days: PeriodDays) => void; role: UserRole; name: string }) {
  const canReport = data.access.report
  const canValidate = data.access.paymentsToValidate || data.access.yemToValidate
  const isSuperadmin = data.access.health
  const { kpis, series } = data
  const totalPending = data.pending_validations.payments + data.pending_validations.yem + data.pending_validations.merchant

  return (
    <div className="space-y-6">
      {/* Bannière d'accueil */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl px-6 py-7 text-white shadow-[var(--shadow-pop)] sm:px-8 sm:py-8"
        style={{ background: 'linear-gradient(120deg, var(--brand-green-900) 0%, var(--color-primary) 62%, color-mix(in srgb, var(--color-primary) 70%, var(--color-secondary)) 130%)' }}
      >
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-24 h-72 w-72 rounded-full" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--color-secondary) 45%, transparent), transparent 68%)' }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-white/5" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">{formatDateLong(new Date())}</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Bonjour, {firstNameOf(name)}</h1>
            <p className="mt-1.5 max-w-xl text-sm text-white/80">{GREETING_BY_ROLE[role]}</p>
            {role === 'superadmin' && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider text-white backdrop-blur">
                <ShieldCheck size={14} aria-hidden />
                Superadmin · accès complet
              </div>
            )}
            {canValidate && totalPending > 0 && (
              <Link
                to="/admin/validations"
                className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[var(--color-secondary)] px-4 text-sm font-bold text-[var(--brand-green-900)] shadow-lg transition-transform hover:-translate-y-0.5"
              >
                <Hourglass size={16} aria-hidden />
                {totalPending} élément{totalPending > 1 ? 's' : ''} à traiter
                <ArrowRight size={15} aria-hidden />
              </Link>
            )}
          </div>
          {canReport && (
            <div className="flex flex-wrap items-center gap-3">
              <SegmentedControl options={PERIOD_OPTIONS} value={days} onChange={onChangeDays} label="Période affichée" onDark />
              <Link
                to="/admin/export"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-4 text-sm font-semibold backdrop-blur transition-colors hover:bg-white/20"
              >
                <Download size={16} aria-hidden />
                Exporter
              </Link>
            </div>
          )}
        </div>
      </motion.section>

      {role === 'superadmin' && (
        <Panel
          title="Centre de contrôle Superadmin"
          subtitle="Gouvernance, sécurité et paramétrage global de la plateforme."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              { to: '/admin/access', label: 'Accès & rôles', hint: 'Comptes internes, RBAC et permissions', icon: UserCog },
              { to: '/admin/configuration', label: 'Configuration critique', hint: 'Taux, limites, politiques et paramètres globaux', icon: Settings },
              { to: '/admin/audit', label: 'Audit & sécurité', hint: 'Événements, intégrité et supervision', icon: ShieldCheck },
              { to: '/admin/packs', label: 'Catalogue des packs', hint: 'Créer, versionner, publier et retirer', icon: Boxes },
              { to: '/admin/finance', label: 'Finance & versements', hint: 'Paiements, rapprochements et payouts', icon: Landmark },
              { to: '/admin/export', label: 'Rapports & exports', hint: 'Exports, snapshots, PDF et Excel', icon: Download },
            ].map(({ to, label, hint, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="group flex min-h-[88px] items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 transition-all hover:-translate-y-0.5 hover:border-[var(--color-primary)]/40 hover:shadow-sm"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                  <Icon size={20} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm text-[var(--color-text)]">{label}</strong>
                  <span className="mt-1 block text-xs leading-relaxed text-[var(--color-text-muted)]">{hint}</span>
                </span>
                <ChevronRight size={16} aria-hidden className="shrink-0 text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </Panel>
      )}

      {role === 'validateur' && (
        <Panel title="Poste de travail Validateur" subtitle="Confirmer uniquement l’arrivée réelle des YEM sur le Pernum CECT ; ne jamais fixer la contre-valeur FCFA ni marquer un payout payé.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link to="/admin/validations" className="flex min-h-[82px] items-center gap-3 rounded-2xl border border-[var(--color-border)] p-4 transition-colors hover:bg-[var(--dash-bg)]">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: TONES.info.bg, color: TONES.info.fg }}>
                <CircleCheck size={20} aria-hidden />
              </span>
              <span className="flex-1">
                <strong className="block text-sm">Réceptions YEM à contrôler</strong>
                <span className="mt-1 block text-xs text-[var(--color-text-muted)]">Quantité reçue, référence externe, preuve, rejet ou litige</span>
              </span>
              <ChevronRight size={16} aria-hidden />
            </Link>
            <div className="flex min-h-[82px] items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--dash-bg)] p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: TONES.success.bg, color: TONES.success.fg }}>
                <ShieldCheck size={20} aria-hidden />
              </span>
              <span className="flex-1">
                <strong className="block text-sm">Séparation des tâches active</strong>
                <span className="mt-1 block text-xs text-[var(--color-text-muted)]">Les paiements et règlements appartiennent à Comptabilité.</span>
              </span>
            </div>
          </div>
        </Panel>
      )}

      {role === 'comptabilite' && (
        <Panel title="Poste de travail Comptabilité" subtitle="Contrôler les paiements simulés, traiter les contre-valeurs éligibles et assurer le rapprochement.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link to="/admin/validations" className="flex min-h-[82px] items-center gap-3 rounded-2xl border border-[var(--color-border)] p-4 transition-colors hover:bg-[var(--dash-bg)]">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: TONES.gold.bg, color: TONES.gold.fg }}>
                <ReceiptText size={20} aria-hidden />
              </span>
              <span className="flex-1">
                <strong className="block text-sm">Paiements à contrôler</strong>
                <span className="mt-1 block text-xs text-[var(--color-text-muted)]">Banque / espèces simulées et écarts de montant</span>
              </span>
              <ChevronRight size={16} aria-hidden />
            </Link>
            <Link to="/admin/finance" className="flex min-h-[82px] items-center gap-3 rounded-2xl border border-[var(--color-border)] p-4 transition-colors hover:bg-[var(--dash-bg)]">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: TONES.info.bg, color: TONES.info.fg }}>
                <Landmark size={20} aria-hidden />
              </span>
              <span className="flex-1">
                <strong className="block text-sm">Payouts & rapprochement</strong>
                <span className="mt-1 block text-xs text-[var(--color-text-muted)]">Reste dû, échecs, retries et règlements manuels</span>
              </span>
              <ChevronRight size={16} aria-hidden />
            </Link>
          </div>
        </Panel>
      )}

      {/* Indicateurs */}
      {canReport ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard index={0} label="Total collecté" value={kpis.total_collected_xof} format={formatXof} icon={Wallet} tone="primary" trend={data.trend} spark={series.collected_xof} />
          <StatCard
            index={1}
            label="Nouveaux membres"
            value={kpis.new_members}
            icon={UserPlus}
            tone="violet"
            hint={`${kpis.registrations} inscriptions sur la période`}
            spark={series.new_members}
          />
          <StatCard
            index={2}
            label="Paiements confirmés"
            value={kpis.confirmed_payments}
            icon={ReceiptText}
            tone="info"
            hint={`Panier moyen : ${formatXof(kpis.average_payment_xof)}`}
            spark={series.collected_xof.map((value) => Math.round(value / 100_000))}
          />
          <StatCard
            index={3}
            label="YEM en circulation"
            value={kpis.yem_in_circulation}
            format={(value) => `${Math.round(value).toLocaleString('fr-FR')} YEM`}
            icon={Coins}
            tone="gold"
            hint={`${data.overview.members} membres, ${data.overview.active_members} actifs`}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard index={0} label="Paiements à valider" value={data.pending_validations.payments} icon={Banknote} tone="gold" hint="Espèces, dépôts, virements" />
          <StatCard index={1} label="YEM à contrôler" value={data.pending_validations.yem} icon={Coins} tone="info" hint="Réception sur le Pernum CECT" />
          <StatCard index={2} label="Paiements marchands" value={data.pending_validations.merchant} icon={Store} tone="violet" hint="Litiges et confirmations" />
        </div>
      )}

      {/* Graphiques */}
      {canReport && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Panel
            title="Encaissements"
            subtitle={`Montants nets par jour, ${days} derniers jours`}
            className="xl:col-span-2"
            action={
              data.trend && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold"
                  style={{ background: TONES.success.bg, color: TONES.success.fg }}
                >
                  <TrendingUp size={14} aria-hidden />
                  {data.trend.direction === 'up' ? '+' : '−'}
                  {data.trend.percent} %
                </span>
              )
            }
          >
            <AreaChart
              data={series.days.map((label, index) => ({ label, value: series.collected_xof[index] ?? 0 }))}
              ariaLabel={`Encaissements des ${days} derniers jours : ${formatXof(kpis.total_collected_xof)} au total. Utilisez les flèches pour parcourir les jours.`}
              formatValue={formatXof}
            />
          </Panel>

          <Panel title="Origine des encaissements" subtitle="Répartition par type d’opération">
            <DonutChart
              centerLabel="Total"
              centerValue={formatXof(kpis.total_collected_xof)}
              segments={data.by_source.map((source, index) => ({
                key: source.key,
                label: source.label,
                value: source.amount_xof,
                valueLabel: formatXof(source.amount_xof),
                color: SOURCE_COLORS[index % SOURCE_COLORS.length] ?? 'var(--chart-1)',
              }))}
            />
          </Panel>
        </div>
      )}

      {/* Actions, moyens de paiement, meilleurs membres */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {canValidate && (
          <Panel
            title="À traiter"
            subtitle="Décisions en attente"
            action={
              <Link to="/admin/validations" className="inline-flex min-h-[36px] items-center gap-1 rounded-xl px-2.5 text-sm font-semibold text-[var(--tone-success-fg)] hover:bg-[var(--tone-success-bg)]">
                Tout voir <ArrowRight size={14} aria-hidden />
              </Link>
            }
          >
            {totalPending === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: TONES.success.bg, color: TONES.success.fg }}>
                  <CheckCircle2 size={28} aria-hidden />
                </span>
                <p className="font-bold text-[var(--color-text)]">Tout est à jour</p>
                <p className="text-sm text-[var(--color-text-muted)]">Aucune décision en attente.</p>
              </div>
            ) : (
              <ul className="-mx-1 space-y-1">
                {role !== 'validateur' && <PendingRow icon={Banknote} label="Paiements manuels simulés" hint="Banque / espèces à contrôler" count={data.pending_validations.payments} tone="gold" />}
                {role !== 'comptabilite' && <PendingRow icon={Coins} label="Réceptions de YEM" hint="Arrivée sur le Pernum CECT" count={data.pending_validations.yem} tone="info" />}
                {role !== 'comptabilite' && <PendingRow icon={Store} label="Flux marchands à vérifier" hint="Anomalies et confirmations autorisées" count={data.pending_validations.merchant} tone="violet" />
              </ul>
            )}
          </Panel>
        )}

        {canReport && (
          <>
            <Panel title="Moyens de paiement" subtitle="Part des encaissements">
              <HBarList
                items={data.by_method.map((method, index) => ({
                  key: method.key,
                  label: method.label,
                  value: method.amount_xof,
                  valueLabel: formatXof(method.amount_xof),
                  note: formatBps(method.share_bps),
                  color: SOURCE_COLORS[index % SOURCE_COLORS.length] ?? 'var(--chart-1)',
                }))}
              />
            </Panel>

            <Panel title="Meilleurs membres" subtitle="Les plus actifs sur la période" className="lg:col-span-2 xl:col-span-1">
              <ol className="space-y-1">
                {data.top_members.map((member, index) => (
                  <li key={member.id} className="flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-[var(--dash-bg)]">
                    <span className="w-5 text-center text-sm font-extrabold text-[var(--color-text-muted)]">{index + 1}</span>
                    <Avatar name={member.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-[var(--color-text)]">{member.name}</span>
                      <span className="block text-xs text-[var(--color-text-muted)]">{member.member_number}</span>
                    </span>
                    <span className="shrink-0 text-sm font-bold text-[var(--color-text)]">{formatXof(member.amount_xof)}</span>
                  </li>
                ))}
              </ol>
            </Panel>
          </>
        )}
      </div>

      {/* Derniers paiements, versements, santé */}
      {canReport && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Panel title="Derniers paiements" subtitle="Paiements confirmés" className="xl:col-span-2" flush>
            <ul className="divide-y divide-[var(--color-border)]">
              {data.recent_payments.map((payment) => {
                const MethodIcon = (payment.method && METHOD_ICONS[payment.method]) || Wallet
                return (
                  <li key={payment.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 transition-colors hover:bg-[var(--dash-bg)] sm:px-6">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl" style={{ background: TONES.primary.bg, color: TONES.primary.fg }}>
                      <MethodIcon size={18} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 basis-40">
                      <span className="block truncate text-sm font-bold text-[var(--color-text)]">{payment.label}</span>
                      <span className="block truncate text-xs text-[var(--color-text-muted)]">
                        {payment.method ? `${payment.member} · ${payment.method}` : payment.member}
                      </span>
                    </span>
                    <span className="ml-auto text-right">
                      <span className="block text-sm font-extrabold text-[var(--color-text)]">{formatXof(payment.amount_xof)}</span>
                      <span className="block text-xs text-[var(--color-text-muted)]">{formatRelativeDay(payment.date)}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </Panel>

          <div className="space-y-6">
            <Panel
              title="Versements"
              subtitle="Contre-valeurs en FCFA"
              action={
                <Link to="/admin/finance" className="inline-flex min-h-[36px] items-center gap-1 rounded-xl px-2.5 text-sm font-semibold text-[var(--tone-success-fg)] hover:bg-[var(--tone-success-bg)]">
                  Ouvrir <ArrowRight size={14} aria-hidden />
                </Link>
              }
            >
              <dl className="space-y-3 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[var(--color-text-muted)]">Reste dû aux membres</dt>
                  <dd className="text-base font-extrabold text-[var(--color-text)]">{formatXof(data.payouts.owed_xof)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--color-text-muted)]">Versements en cours</dt>
                  <dd>
                    <StatusBadge label={`${data.payouts.in_progress} en cours`} tone="info" icon={RefreshCw} />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--color-text-muted)]">Nécessitent une action</dt>
                  <dd>
                    {data.payouts.needing_action > 0 ? (
                      <StatusBadge label={`${data.payouts.needing_action} à relancer`} tone="warning" icon={Hourglass} />
                    ) : (
                      <StatusBadge label="Aucun" tone="success" icon={CheckCircle2} />
                    )}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-t border-[var(--color-border)] pt-3">
                  <dt className="text-[var(--color-text-muted)]">Versé sur la période</dt>
                  <dd className="font-bold text-[var(--color-text)]">{formatXof(data.payouts.paid_xof)}</dd>
                </div>
              </dl>
            </Panel>

            {isSuperadmin && (
              <Panel title="Santé de la plateforme" subtitle="Contrôles automatiques">
                <ul className="space-y-2.5">
                  {data.health.map((check) => (
                    <li key={check.key} className="flex items-center gap-3 text-sm">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                        style={check.ok ? { background: TONES.success.bg, color: TONES.success.fg } : { background: TONES.danger.bg, color: TONES.danger.fg }}
                      >
                        {check.ok ? <ShieldCheck size={15} aria-hidden /> : <Activity size={15} aria-hidden />}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-semibold text-[var(--color-text)]">{check.label}</span>
                      <span className="shrink-0 text-xs text-[var(--color-text-muted)]">{check.detail}</span>
                      <span className="sr-only">{check.ok ? 'Contrôle réussi' : 'Contrôle en échec'}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        </div>
      )}

      {!canReport && (
        <Panel title="Accès rapide" subtitle="Vos outils">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link to="/admin/validations" className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-[var(--color-border)] p-4 transition-colors hover:bg-[var(--dash-bg)]">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: TONES.gold.bg, color: TONES.gold.fg }}>
                <CircleCheck size={20} aria-hidden />
              </span>
              <span className="flex-1 text-sm font-bold">Ouvrir la file de validation</span>
              <ChevronRight size={16} aria-hidden />
            </Link>
            {role === 'validateur' ? (
              <div className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--dash-bg)] p-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: TONES.success.bg, color: TONES.success.fg }}>
                  <ShieldCheck size={20} aria-hidden />
                </span>
                <span className="flex-1 text-sm font-bold">Aucun accès financier : validation YEM uniquement</span>
              </div>
            ) : (
              <Link to="/admin/membres" className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-[var(--color-border)] p-4 transition-colors hover:bg-[var(--dash-bg)]">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: TONES.info.bg, color: TONES.info.fg }}>
                  <Users size={20} aria-hidden />
                </span>
                <span className="flex-1 text-sm font-bold">Consulter un membre</span>
                <ChevronRight size={16} aria-hidden />
              </Link>
            )}
          </div>
        </Panel>
      )}
    </div>
  )
}

export default function AdminHomePage() {
  const { user } = useAuth()
  const [days, setDays] = useState<PeriodDays>(30)
  const query = useQuery({
    queryKey: ['admin-dashboard', days],
    queryFn: () => fetchAdminDashboard(days),
    placeholderData: keepPreviousData,
  })

  if (!user) return null

  return (
    <>
      <Helmet>
        <title>Tableau de bord — CECT Admin</title>
      </Helmet>

      {query.isPending && <LoadingState />}

      {query.isError && (
        <div role="alert" className="rounded-3xl border border-[var(--color-border)] bg-[var(--dash-card)] p-8 text-center shadow-[var(--shadow-card)]">
          <p className="text-lg font-bold">Impossible de charger le tableau de bord</p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Vérifiez votre connexion puis réessayez.</p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
          >
            <RefreshCw size={16} aria-hidden />
            Réessayer
          </button>
        </div>
      )}

      {query.data && <Dashboard data={query.data} days={days} onChangeDays={setDays} role={user.role} name={user.name} />}
    </>
  )
}