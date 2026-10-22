import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Boxes,
  Building2,
  CheckCircle2,
  CircleDashed,
  Coins,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Store,
  WalletCards,
} from 'lucide-react'
import type { MemberDashboardData } from '@/data/memberDashboard'
import { formatYem } from '@/lib/format'

interface Props {
  data: MemberDashboardData
}

export function MemberExperienceHero({ data }: Props) {
  const legal = data.profile.kind === 'legal'
  const hasPack = data.packs.length > 0
  const membershipActive = data.membership.status === 'active'
  const hasConsumerRights = data.packs.some((pack) => pack.family === 'CONSOMMATEUR' || pack.family === 'PERSONNEL')
  const hasVendorRights = data.packs.some((pack) => pack.family === 'VENDEUR')
  const hasMerchantRights = data.packs.some((pack) => pack.family === 'MARCHAND')
  const activePacks = data.packs.length
  const pendingOperations = data.operations_in_progress.length
  const headline = legal ? 'Votre activité marchande, sous contrôle.' : 'Votre coopérative, à portée de main.'
  const primaryTarget = !hasPack ? '/espace/packs' : legal ? '/espace/marchand' : hasConsumerRights ? '/espace/payer' : hasVendorRights ? '/espace/vendre' : '/espace/packs'
  const primaryLabel = !hasPack ? 'Découvrir les formules' : legal ? 'Gérer mon activité' : hasConsumerRights ? 'Payer un marchand' : hasVendorRights ? 'Vendre mes YEM' : 'Gérer mes packs'
  const journey = [
    { label: 'Compte', complete: true },
    { label: 'Adhésion', complete: membershipActive },
    { label: 'Pack', complete: hasPack },
    { label: 'Opérations', complete: legal ? hasMerchantRights : hasConsumerRights || hasVendorRights },
  ]

  return (
    <section aria-label="Vue d’ensemble de votre espace" className="relative isolate overflow-hidden rounded-[28px] border border-emerald-300/15 bg-[#09291f] p-5 text-white shadow-[0_22px_70px_rgba(2,24,18,.20)] sm:p-8 xl:p-9">
      <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-48 h-[430px] w-[430px] rounded-full bg-[#83f4ab]/[.12] blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-1/3 h-40 w-72 rounded-full bg-emerald-600/10 blur-3xl" />
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(250px,310px)] lg:gap-10">
        <div>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.16em] text-emerald-100">
              {legal ? <Building2 size={13} aria-hidden /> : <Sparkles size={13} aria-hidden />}
              {legal ? 'Espace personne morale' : 'Espace personne physique'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#caff2e] px-3 py-1.5 text-xs font-bold text-[#102518]">
              <BadgeCheck size={13} aria-hidden />
              {membershipActive ? 'Adhésion active' : 'Adhésion en attente'}
            </span>
          </div>

          <h2 className="max-w-[620px] text-[29px] font-extrabold leading-[1.12] tracking-[-.035em] sm:text-[38px] xl:text-[43px]">
            {headline}
          </h2>
          <p className="mt-4 max-w-[555px] text-sm leading-7 text-white/70 sm:text-[15px]">
            {legal
              ? 'Suivez vos droits marchands, vos encaissements et vos opérations YEM dans un espace dédié à votre structure.'
              : 'Suivez vos droits, accédez à vos formules et pilotez chaque opération YEM depuis un seul endroit.'}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={primaryTarget} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#caff2e] px-5 text-sm font-extrabold text-[#102518] shadow-[0_6px_25px_rgba(202,255,46,.17)] transition hover:-translate-y-0.5 hover:bg-[#ddff75] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              {primaryLabel}<ArrowUpRight size={17} aria-hidden />
            </Link>
            <Link to="/espace/profil" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Mon dossier <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </div>

        <div className="self-stretch rounded-[22px] border border-white/15 bg-white/[.07] p-5 backdrop-blur-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.16em] text-emerald-200/80">Votre parcours</p>
              <p className="mt-1 text-base font-bold">Prêt pour la prochaine étape</p>
            </div>
            <ShieldCheck size={25} className="text-[#caff2e]" aria-hidden />
          </div>
          <ol className="space-y-4">
            {journey.map((step, index) => (
              <li key={step.label} className="flex items-center gap-3">
                <span className={step.complete
                  ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#caff2e] text-[#102518]'
                  : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white/70'}>
                  {step.complete ? <CheckCircle2 size={19} aria-hidden /> : <CircleDashed size={19} aria-hidden />}
                </span>
                <span className="min-w-0 flex-1 text-sm font-semibold">{index + 1}. {step.label}</span>
                <span className={step.complete ? 'text-xs font-semibold text-[#caff2e]' : 'text-xs text-white/55'}>
                  {step.complete ? 'Validé' : 'À réaliser'}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-5 text-white/60">
            Les opérations deviennent disponibles selon les packs activés et les règles de la CECT.
          </p>
        </div>
      </div>
      <div className="relative mt-8 grid gap-3 border-t border-white/10 pt-6 sm:grid-cols-3">
        {[
          { Icon: Boxes, title: 'Packs actifs', value: String(activePacks), caption: activePacks ? 'Vos formules en cours' : 'Choisissez votre première formule', to: '/espace/packs' },
          { Icon: Coins, title: legal ? 'Droits marchands' : 'Quota marchand disponible', value: legal ? (hasMerchantRights ? 'Activés' : 'À activer') : formatYem(data.balance.available), caption: legal ? 'Selon votre formule Marchand' : 'Packs Consommateur et Personnel', to: legal ? '/espace/marchand' : '/espace/payer' },
          { Icon: WalletCards, title: 'Opérations en cours', value: String(pendingOperations), caption: pendingOperations ? 'À suivre dans votre espace' : 'Aucune opération en attente', to: '/espace/activite' },
        ].map(({ Icon, title, value, caption, to }) => (
          <Link key={title} to={to} className="group flex min-w-0 items-start gap-3 rounded-2xl border border-white/10 bg-white/[.06] px-4 py-4 transition hover:border-[#caff2e]/40 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#caff2e]/10 text-[#caff2e]"><Icon size={19} aria-hidden /></span>
            <span className="min-w-0">
              <span className="block text-xs text-white/65">{title}</span>
              <strong className="mt-1 block truncate text-xl font-extrabold tracking-tight">{value}</strong>
              <span className="mt-1 block text-[11px] leading-4 text-white/55">{caption}</span>
            </span>
            <ArrowUpRight className="ml-auto shrink-0 text-white/30 transition group-hover:text-[#caff2e]" size={14} aria-hidden />
          </Link>
        ))}
      </div>
    </section>
  )
}

export function MemberNextSteps({ data }: Props) {
  if (data.packs.length !== 0) return null
  const legal = data.profile.kind === 'legal'
  const cards = legal
    ? [
      { Icon: Store, title: 'Activer votre espace marchand', copy: 'Sélectionnez une formule éligible pour accéder aux encaissements et aux demandes de rééchange.', to: '/espace/packs', action: 'Consulter les formules' },
      { Icon: ShieldCheck, title: 'Vérifier votre dossier', copy: 'Retrouvez les informations de votre structure et les coordonnées déclarées à la CECT.', to: '/espace/profil', action: 'Mon dossier' },
    ]
    : [
      { Icon: ScanLine, title: 'Consommer avec vos YEM', copy: 'Une formule Consommateur ou Personnel donne accès au paiement chez les marchands partenaires.', to: '/espace/packs', action: 'Voir les formules' },
      { Icon: Coins, title: 'Vendre des YEM à la CECT', copy: 'Une formule Vendeur active ouvre le parcours de vente, dans la limite de vos droits disponibles.', to: '/espace/packs', action: 'Découvrir les droits' },
    ]
  return (
    <section aria-labelledby="next-steps-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[.17em] text-[var(--color-primary)]">Pour bien démarrer</p>
          <h2 id="next-steps-title" className="text-xl font-extrabold tracking-tight text-[var(--color-text)]">
            {legal ? 'Développez votre activité avec la CECT' : 'À vous de choisir votre prochain objectif'}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Les fonctionnalités s’activent uniquement après souscription aux formules correspondantes.</p>
        </div>
        <Link to="/espace/packs" className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-primary)]">Catalogue <ArrowRight size={16} aria-hidden /></Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map(({ Icon, title, copy, to, action }) => (
          <Link to={to} key={title} className="group relative flex min-h-[178px] flex-col justify-between overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-[var(--dash-card)] p-6 shadow-[var(--shadow-card)] transition duration-200 hover:-translate-y-1 hover:border-[var(--color-primary)]">
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-emerald-400/[.055] blur-xl" />
            <div className="relative flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-[var(--color-primary)]"><Icon size={24} aria-hidden /></div>
              <div>
                <h3 className="text-base font-extrabold text-[var(--color-text)]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">{copy}</p>
              </div>
            </div>
            <span className="relative mt-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--color-primary)]">{action} <ArrowRight size={16} aria-hidden className="transition group-hover:translate-x-1" /></span>
          </Link>
        ))}
      </div>
    </section>
  )
}
