import { useEffect, useState, type FormEvent } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, CheckCircle2, Clock3, CalendarDays, Boxes, ArrowRight, RefreshCw, X, Timer, Coins, ShoppingBag, HandCoins, Wallet, ShieldCheck, Sparkles } from 'lucide-react'
import { SegmentedControl } from '@/components/dashboard/SegmentedControl'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { PageHeader } from '@/components/ui/PageHeader'
import { btnPrimary } from '@/components/ui/buttons'
import { useMemberDashboard } from '@/data/useMemberDashboard'
import type { MemberPack } from '@/data/memberDashboard'
import { get, newIdempotencyKey, post } from '@/lib/api'
import { formatBps, formatDateMedium, formatXof, formatYem } from '@/lib/format'
import { authErrorMessage } from '@/features/auth/errors'
import { AmountBreakdown, MethodPicker, PaymentCheckout } from '@/features/payments/PaymentCheckout'
import { type PaymentAttempt } from '@/features/payments/types'
import { FAMILIES, packFacts, type PackPlan, type SubscribeResult, type UserPack } from '@/features/packs/types'
import { usePublicConfig } from '@/features/config/usePublicConfig'

type Step = { name: 'method' } | { name: 'checkout'; result: SubscribeResult } | { name: 'done'; pack: UserPack }

function SubscribeDialog({ plan, onClose }: { plan: PackPlan; onClose: () => void }) {
  const queryClient = useQueryClient()
  const free = (plan.current_version?.price_xof ?? 0) === 0
  const [method, setMethod] = useState('TMONEY')
  const [step, setStep] = useState<Step>({ name: 'method' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const pendingPack = step.name === 'checkout' ? step.result.user_pack : null
  const status = useQuery({
    queryKey: ['user-pack', pendingPack?.id],
    queryFn: () => get<UserPack>(`/me/packs/${pendingPack?.id}`),
    enabled: pendingPack !== null,
    refetchInterval: 4000,
    staleTime: 0,
  })

  useEffect(() => {
    if (status.data?.status === 'active') {
      void queryClient.invalidateQueries({ queryKey: ['my-packs'] })
      void queryClient.invalidateQueries({ queryKey: ['member-dashboard'] })
      setStep({ name: 'done', pack: status.data })
    }
  }, [status.data, queryClient])

  async function subscribe() {
    setBusy(true)
    setError(null)
    try {
      const result = await post<SubscribeResult>('/me/packs', { plan_id: plan.id, ...(free ? {} : { method }) }, newIdempotencyKey())
      if (result.payment === null || result.user_pack.status === 'active') {
        void queryClient.invalidateQueries({ queryKey: ['my-packs'] })
        void queryClient.invalidateQueries({ queryKey: ['member-dashboard'] })
        setStep({ name: 'done', pack: result.user_pack })
      } else {
        setStep({ name: 'checkout', result })
      }
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  function patchPayment(patch: Partial<PaymentAttempt>) {
    setStep((current) => (current.name === 'checkout' && current.result.payment ? { name: 'checkout', result: { ...current.result, payment: { ...current.result.payment, ...patch } } } : current))
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--forest-900)]/60" />
        <Dialog.Content aria-describedby={undefined} className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-[var(--dash-card)] p-6 shadow-2xl outline-none">
          <div className="mb-4 flex items-start justify-between gap-3">
            <Dialog.Title className="text-lg font-extrabold tracking-tight text-[var(--color-text)]">{plan.name}</Dialog.Title>
            <Dialog.Close aria-label="Fermer" className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:bg-[var(--chart-track)]">
              <X size={18} aria-hidden />
            </Dialog.Close>
          </div>

          {step.name === 'method' && (
            <div className="space-y-4">
              {plan.payment_quote && !free && <AmountBreakdown net={plan.payment_quote.net_amount} fee={plan.payment_quote.fee_amount} total={plan.payment_quote.total_amount} />}
              {free ? <p className="text-sm text-[var(--color-text-muted)]">Ce pack est gratuit : il sera activé immédiatement.</p> : <MethodPicker value={method} onChange={setMethod} />}
              {error && (
                <p role="alert" className="text-sm text-[var(--color-danger)]">
                  {error}
                </p>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => void subscribe()}
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
              >
                {free ? 'Activer le pack' : 'Continuer'}
              </button>
            </div>
          )}

          {step.name === 'checkout' && step.result.payment && (
            <PaymentCheckout
              payment={step.result.payment}
              onRefresh={async () => {
                await status.refetch()
              }}
              onDeclare={async (reference) => {
                await post(`/me/payments/${step.result.payment?.id}/declare`, { reference: reference || null })
                patchPayment({ declared_at: new Date().toISOString() })
              }}
              onSimulate={async () => {
                await post(`/me/payments/${step.name === 'checkout' ? step.result.payment?.id : ''}/simulate`)
                await status.refetch()
              }}
              onChangeMethod={() => setStep({ name: 'method' })}
            />
          )}

          {step.name === 'done' && (
            <div className="space-y-4 text-center">
              <CheckCircle2 size={44} className="mx-auto text-[var(--color-primary)]" aria-hidden />
              <p className="text-base font-bold text-[var(--color-text)]">Votre pack {step.pack.plan.name} est actif.</p>
              <button type="button" onClick={onClose} className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]">
                Terminer
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

interface Topup {
  id: string
  status: string
  amount_xof: number
  quantity: string
  discount_bps: number
  credited_at: string | null
}

function TopupDialog({ pack, minimum, onClose }: { pack: UserPack; minimum: number; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState(String(minimum || ''))
  const publicConfig = usePublicConfig().data
  const saleRate = publicConfig?.rates_xof_per_yem.sale
  const estimatedYem = saleRate && Number.isFinite(Number(amount)) ? Math.max(0, Number(amount) / saleRate) : null
  const [method, setMethod] = useState('TMONEY')
  const [state, setState] = useState<{ topup: Topup; payment: PaymentAttempt } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const topups = useQuery({
    queryKey: ['topups', pack.id],
    queryFn: () => get<Topup[]>(`/me/packs/${pack.id}/topups`),
    enabled: state !== null,
    refetchInterval: 4000,
    staleTime: 0,
  })
  const credited = state ? topups.data?.find((topup) => topup.id === state.topup.id)?.credited_at != null : false

  useEffect(() => {
    if (!credited) return
    void queryClient.invalidateQueries({ queryKey: ['my-packs'] })
    void queryClient.invalidateQueries({ queryKey: ['member-dashboard'] })
  }, [credited, queryClient])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const value = Number.parseInt(amount, 10)
    if (!Number.isFinite(value) || value < minimum) {
      setError(`Le rechargement minimum est de ${formatXof(minimum)}.`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      setState(await post<{ topup: Topup; payment: PaymentAttempt }>(`/me/packs/${pack.id}/topups`, { amount_xof: value, method }, newIdempotencyKey()))
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--forest-900)]/60" />
        <Dialog.Content aria-describedby={undefined} className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-[var(--dash-card)] p-6 shadow-2xl outline-none">
          <div className="mb-4 flex items-start justify-between gap-3">
            <Dialog.Title className="text-lg font-extrabold tracking-tight text-[var(--color-text)]">Acheter des YEM · {pack.plan.name}</Dialog.Title>
            <Dialog.Close aria-label="Fermer" className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:bg-[var(--chart-track)]">
              <X size={18} aria-hidden />
            </Dialog.Close>
          </div>

          {credited && state ? (
            <div className="space-y-4 text-center">
              <CheckCircle2 size={44} className="mx-auto text-[var(--color-primary)]" aria-hidden />
              <p className="text-base font-bold text-[var(--color-text)]">{formatYem(state.topup.quantity)} crédités sur votre pack.</p>
              <button type="button" onClick={onClose} className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-white">
                Terminer
              </button>
            </div>
          ) : state ? (
            <div className="space-y-4">
              <p className="text-sm text-[var(--color-text-muted)]">
                {formatYem(state.topup.quantity)} seront crédités une fois le paiement confirmé (remise de {formatBps(state.topup.discount_bps)} incluse).
              </p>
              <PaymentCheckout
                  payment={state.payment}
                  onRefresh={async () => {
                    await topups.refetch()
                  }}
                  onDeclare={async (reference) => {
                    await post(`/me/payments/${state.payment.id}/declare`, { reference: reference || null })
                    setState({ ...state, payment: { ...state.payment, declared_at: new Date().toISOString() } })
                  }}
                  onSimulate={async () => {
                    await post(`/me/payments/${state.payment.id}/simulate`)
                    await topups.refetch()
                  }}
                  onChangeMethod={() => setState(null)}
                />
            </div>
          ) : (
            <form onSubmit={(event) => void submit(event)} className="space-y-4">
              <div>
                <label htmlFor="topup-amount" className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">
                  Montant à payer (FCFA)
                </label>
                <input
                  id="topup-amount"
                  type="number"
                  min={minimum}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">Minimum : {formatXof(minimum)}. Sans calendrier ni mensualité : achetez à votre rythme.</p>
                <div className="mt-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[.06] p-4">
                  <p className="text-xs font-semibold text-[var(--color-text-muted)]">YEM estimés pour ce paiement</p>
                  <p className="mt-1 text-2xl font-extrabold text-[var(--color-primary)]">{estimatedYem === null ? 'Cours indisponible' : `${formatYem(String(estimatedYem))} YEM`}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">{saleRate ? `${formatXof(saleRate)} / YEM` : 'Cours non disponible'} · hors frais et bonus éventuel. La quantité définitive est confirmée par le backend.</p>
                </div>
              </div>
              <MethodPicker value={method} onChange={setMethod} />
              {error && (
                <p role="alert" className="text-sm text-[var(--color-danger)]">
                  {error}
                </p>
              )}
              <button type="submit" disabled={busy} className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60">
                Continuer
              </button>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function PlanCard({ plan, owned, sellerSlotsUsed, onSelect, onTopup }: { plan: PackPlan; owned: UserPack | undefined; sellerSlotsUsed: number; onSelect: () => void; onTopup: () => void }) {
  const version = plan.current_version
  if (!version) return null
  const hasActive = owned?.status === 'active'
  const pending = owned?.status === 'pending_payment'
  const isDemo = plan.code.startsWith('TST-')
  const locked = plan.eligible === false
  const sellerLimitReached = plan.family === 'VENDEUR' && sellerSlotsUsed >= 2
  const cannotResubscribe = hasActive && plan.family === 'MARCHAND'
  const facts = packFacts(version).filter((fact) => fact.label !== 'Prix')
  const price = version.price_xof === 0 ? (plan.family === 'PERSONNEL' ? 'Ouverture gratuite' : 'Gratuit') : formatXof(version.price_xof)

  return (
    <article className={`flex flex-col rounded-[22px] border p-4 sm:p-6 ${isDemo ? 'border-amber-500/45 bg-gradient-to-br from-amber-500/[.075] to-[var(--dash-card)]' : 'border-[var(--color-border)] bg-[var(--dash-card)]'}`}>
      {isDemo && <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-amber-500"> <span aria-hidden>◈</span> Démonstration · Paiement fictif</div>}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">{FAMILIES.find((family) => family.family === plan.family)?.title}</p>
          <h3 className="text-base font-bold text-[var(--color-text)]">{plan.name}</h3>
        </div>
        {hasActive && <StatusBadge label="Souscrit" tone="success" icon={BadgeCheck} />}
        {pending && <StatusBadge label="Paiement en attente" tone="warning" icon={Clock3} />}
      </div>
      <p className="mt-3 text-[28px] font-bold leading-8 tracking-tight text-[var(--color-text)] [font-variant-numeric:tabular-nums]">{price}</p>
      {isDemo && <p className="mt-1 text-xs font-bold text-amber-500">Montant de test uniquement · aucun débit réel</p>}
      {plan.description && <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">{plan.description}</p>}
      <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold text-[var(--color-text-muted)]">
        <span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-[var(--color-primary)]">{plan.family === 'PERSONNEL' ? 'Sans calendrier' : `${version.period?.cycles ?? 0} crédits · ${version.period?.unit === 'half_month' ? 'Par quinzaine' : version.period?.unit === 'week' ? 'Par semaine' : version.period?.unit === 'month' ? 'Par mois' : 'Selon le contrat'}`}</span>
        {version.rules.cashback?.enabled && <span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-[var(--color-primary)]">Bonus YEM inclus</span>}
      </div>
      <dl className="mt-4 space-y-2 text-xs sm:text-sm">
        {facts.filter(fact => ['Quota','Premier crédit YEM','Quota total'].includes(fact.label)).map(fact => <div key={fact.label} className="flex flex-wrap items-center justify-between gap-2"><dt className="text-[var(--color-text-muted)]">{fact.label}</dt><dd className="max-w-full text-right font-bold text-[var(--color-text)]">{fact.value}</dd></div>)}
      </dl>
      <details className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--dash-bg)] p-3 text-xs"><summary className="cursor-pointer font-bold text-[var(--color-primary)]">Afficher toutes les conditions du pack</summary><dl className="mt-3 divide-y divide-[var(--color-border)]">{facts.map(fact => <div key={fact.label} className="flex items-start justify-between gap-4 py-2"><dt className="text-[var(--color-text-muted)]">{fact.label}</dt><dd className="text-right font-semibold text-[var(--color-text)]">{fact.value}</dd></div>)}</dl></details>
      <div className="mt-auto pt-5">
        {locked ? (
          <p className="text-sm text-[var(--color-text-muted)]">Ce pack n’est pas ouvert à votre type de compte.</p>
        ) : (
          <button type="button" disabled={sellerLimitReached || cannotResubscribe} onClick={hasActive && plan.family === 'PERSONNEL' ? onTopup : onSelect} className={`${btnPrimary} w-full`}>
            {sellerLimitReached ? 'Limite : 2 packs Vendeur' : hasActive ? (plan.family === 'PERSONNEL' ? 'Recharger' : plan.family === 'MARCHAND' ? 'Pack Marchand actif' : isDemo ? 'Reprendre un test de vente' : 'Souscrire à nouveau') : pending ? 'Reprendre le paiement' : isDemo ? 'Tester la souscription' : version.price_xof === 0 ? (plan.family === 'PERSONNEL' ? 'Ouvrir mon portefeuille YEM' : 'Activer gratuitement') : plan.payment_quote ? `Souscrire · ${formatXof(plan.payment_quote.total_amount)}` : 'Souscrire'}
          </button>
        )}
      </div>
    </article>
  )
}

function NextCreditCountdown({ date }: { date: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(id)
  }, [])
  const difference = new Date(date).getTime() - now
  if (!Number.isFinite(difference)) return null
  if (difference <= 0) return <span className="text-emerald-400">Crédit à traiter · actualiser</span>
  const days = Math.floor(difference / 86400000)
  const hours = Math.floor(difference / 3600000) % 24
  const minutes = Math.floor(difference / 60000) % 60
  return <span className="tabular-nums">Dans {days} j {String(hours).padStart(2, '0')} h {String(minutes).padStart(2, '0')} min</span>
}

function MyPackCard({ pack, detail, plan, onResume, onTopup }: { pack: UserPack; detail: MemberPack | undefined; plan: PackPlan | undefined; onResume: () => void; onTopup: () => void }) {
  const active = pack.status === 'active'
  const personal = pack.family === 'PERSONNEL'
  const isDemo = pack.plan.code.startsWith('TST-')
  const familyName = FAMILIES.find(family => family.family === pack.family)?.title ?? pack.family
  const contractual = personal ? (detail?.credited ?? '0') : (detail?.contractual_total ?? detail?.credited ?? '0')
  const unlocked = detail?.credited ?? '0'
  const total = Number.parseFloat(contractual)
  const unlockedNumber = Number.parseFloat(unlocked)
  const progress = Number.isFinite(total) && total > 0 ? Math.min(100, Math.max(0, unlockedNumber / total * 100)) : 0
  const metrics = [
    { label: pack.family === 'VENDEUR' ? 'Droit contractuel' : pack.family === 'MARCHAND' ? 'Plafond contrat' : 'Crédité', value: contractual, help: pack.family === 'VENDEUR' ? 'Capacité à céder vos propres YEM sur le contrat, et non des YEM reçus' : personal ? 'Total de YEM déjà achetés et crédités' : 'Droits YEM prévus sur toute la durée du contrat', icon: Coins },
    { label: pack.family === 'VENDEUR' ? 'Cessible' : 'Disponible', value: pack.balance?.available ?? '0', help: pack.family === 'VENDEUR' ? 'Droit de vente déjà ouvert et non réservé, à exercer sur vos propres YEM' : 'YEM débloqués, immédiatement utilisables', icon: Wallet },
    { label: 'Réservé', value: pack.balance?.reserved ?? '0', help: 'YEM engagés dans des opérations en cours', icon: Clock3 },
    { label: pack.family === 'VENDEUR' ? 'Déjà cédé' : 'Consommé', value: pack.balance?.consumed ?? '0', help: 'YEM déjà utilisés ou cédés définitivement', icon: CheckCircle2 },
  ]
  return (
    <article className="group relative min-w-0 overflow-hidden rounded-[26px] border border-[var(--color-border)] bg-[var(--dash-card)] shadow-[var(--shadow-card)] transition-all hover:border-emerald-500/45 hover:shadow-[0_18px_60px_rgba(0,0,0,.12)]">
      <div aria-hidden className="absolute right-0 top-0 h-32 w-44 rounded-full bg-emerald-500/[.055] blur-3xl" />
      <div className="relative p-4 sm:p-6">
        {isDemo && <span className="mb-4 inline-flex rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-extrabold uppercase text-amber-500">Démonstration · Droits fictifs</span>}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[var(--color-primary)]">{familyName} · {personal ? 'Sans échéance' : 'Crédits périodiques'}</p>
            <h3 className="mt-1 text-xl font-extrabold tracking-tight text-[var(--color-text)]">{pack.plan.name}</h3>
          </div>
          <StatusBadge label={active ? 'Actif' : 'Paiement en attente'} tone={active ? 'success' : 'warning'} icon={active ? BadgeCheck : Clock3} />
        </div>
        {active && <>
          <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {metrics.map(({ label, value, help, icon: Icon }) => (
              <div key={label} title={help} className="min-w-0 rounded-2xl border border-[var(--color-border)] bg-[var(--dash-bg)] p-3">
                <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-text-muted)]"><Icon size={13} aria-hidden />{label}</dt>
                <dd className="mt-2 text-[19px] font-extrabold tracking-tight text-[var(--color-text)] tabular-nums sm:text-lg">{formatYem(value)}<span className="ml-1 text-[10px] font-semibold text-[var(--color-text-muted)]">YEM</span></dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-[11px] leading-5 text-[var(--color-text-muted)]">{personal ? 'Crédité = achats confirmés. Aucun blocage lié au calendrier.' : pack.family === 'VENDEUR' ? 'Le droit contractuel n’est pas un versement de YEM : c’est la quantité de vos propres YEM que la CECT vous autorise à céder. Seul le droit ouvert est cessible.' : 'Crédité = quota prévu sur le contrat, et non le solde utilisable. Le disponible se débloque au rythme prévu.'}</p>
          {personal ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-emerald-500/[.075] p-4">
              <Sparkles className="mt-0.5 shrink-0 text-[var(--color-primary)]" size={20} aria-hidden />
              <div><p className="text-sm font-bold text-[var(--color-text)]">Vos YEM, à votre rythme</p><p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">Achetez quand vous le souhaitez au cours en vigueur ; vos YEM sont disponibles dès confirmation du paiement. Aucun calendrier ni quota de consommation par période.</p></div>
            </div>
          ) : (
            <div className="mt-4 space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--dash-bg)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="font-bold text-[var(--color-text)]">Débloqué à ce jour</span><span className="font-extrabold tabular-nums text-[var(--color-primary)]">{formatYem(unlocked)} / {formatYem(contractual)} YEM</span></div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[var(--chart-track)]" role="progressbar" aria-label="Progression des crédits YEM débloqués" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><div className="h-full rounded-full bg-[var(--color-primary)] transition-all" style={{ width: `${progress}%` }} /></div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3 text-xs">
                <div><p className="font-bold text-[var(--color-text)]">{detail?.period ? `Période ${detail.period.number} / ${detail.period.cycles}` : 'Calendrier contractuel'}</p><p className="mt-1 text-[var(--color-text-muted)]">{detail?.quota_per_period ? `${formatYem(detail.quota_per_period)} YEM par période` : 'Consultez vos crédits'}</p></div>
                {detail?.period?.next_credit_at && <div className="flex min-w-0 items-center gap-2 rounded-xl bg-emerald-500/[.08] px-3 py-2 text-[var(--color-primary)]"><Timer size={17} aria-hidden /><div><p className="font-extrabold">Prochain crédit</p><p className="mt-1 font-semibold"><NextCreditCountdown date={detail.period.next_credit_at}/></p><p className="text-[10px] opacity-80">{formatDateMedium(detail.period.next_credit_at)}</p></div></div>}
              </div>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/espace/calendrier" className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-3 text-xs font-bold text-[var(--color-text)] transition hover:border-[var(--color-primary)]"><CalendarDays size={16} aria-hidden />{personal ? 'Mes règlements' : 'Échéancier'}</Link>
            {pack.family === 'VENDEUR' && <Link to="/espace/vendre" className={`${btnPrimary} min-h-11 flex-1 justify-center text-xs`}><HandCoins size={16} aria-hidden />Vendre des YEM</Link>}
            {pack.family === 'CONSOMMATEUR' && <Link to="/espace/payer" className={`${btnPrimary} min-h-11 flex-1 justify-center text-xs`}><ShoppingBag size={16} aria-hidden />Payer un marchand</Link>}
            {personal && <button type="button" onClick={onTopup} className={`${btnPrimary} min-h-11 flex-1 justify-center text-xs`}><Coins size={16} aria-hidden />Acheter des YEM</button>}
            {personal && <Link to="/espace/payer" className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-3 text-xs font-bold text-[var(--color-text)] hover:border-[var(--color-primary)]"><ShoppingBag size={16} aria-hidden />Utiliser mes YEM</Link>}
            {pack.family === 'MARCHAND' && <Link to="/espace/marchand" className={`${btnPrimary} min-h-11 flex-1 justify-center text-xs`}><ShieldCheck size={16} aria-hidden />Espace Marchand</Link>}
          </div>
        </>}
        {!active && plan && <button type="button" onClick={onResume} className={`${btnPrimary} mt-5 w-full`}>Reprendre le paiement</button>}
      </div>
    </article>
  )
}

type Tab = 'mine' | 'catalog'

export default function PacksCatalogPage() {
  const [tab, setTab] = useState<Tab>('mine')
  const [familyFilter, setFamilyFilter] = useState<'TOUS' | 'VENDEUR' | 'CONSOMMATEUR' | 'PERSONNEL' | 'MARCHAND'>('TOUS')
  const [packSearch, setPackSearch] = useState('')
  const [selected, setSelected] = useState<PackPlan | null>(null)
  const [topupFor, setTopupFor] = useState<{ pack: UserPack; minimum: number } | null>(null)
  const catalog = useQuery({ queryKey: ['packs-catalog'], queryFn: () => get<PackPlan[]>('/me/catalog-packs'), staleTime: 0 })
  const mine = useQuery({ queryKey: ['my-packs'], queryFn: () => get<UserPack[]>('/me/packs'), staleTime: 0 })
  const dashboard = useMemberDashboard()
  const isLegal = dashboard.data?.profile.kind === 'legal'

  const ownedByPlan = new Map<string, UserPack>()
  for (const pack of mine.data ?? []) {
    const existing = ownedByPlan.get(pack.plan.id)
    if (!existing || (existing.status !== 'active' && pack.status === 'active')) ownedByPlan.set(pack.plan.id, pack)
  }

  const myPacks = (mine.data ?? []).filter((pack) => pack.status === 'active' || pack.status === 'pending_payment')
  const sellerSlotsUsed = myPacks.filter(pack => pack.family === 'VENDEUR').length
  const planById = new Map((catalog.data ?? []).map((plan) => [plan.id, plan]))
  const filteredCatalog = (catalog.data ?? []).filter(plan => (familyFilter === 'TOUS' || plan.family === familyFilter) && (plan.name + ' ' + plan.description + ' ' + plan.code).toLocaleLowerCase('fr').includes(packSearch.trim().toLocaleLowerCase('fr')))
  const availableFilters = isLegal ? (['TOUS', 'MARCHAND'] as const) : (['TOUS', 'CONSOMMATEUR', 'PERSONNEL', 'VENDEUR'] as const)

  function topup(pack: UserPack) {
    setTopupFor({ pack, minimum: planById.get(pack.plan.id)?.current_version?.rules.min_topup_xof ?? 0 })
  }

  return (
    <>
      <Helmet>
        <title>Mes packs — CECT Togo</title>
      </Helmet>

      <PageHeader
        title="Mes packs"
        description="Vos souscriptions et les formules proposées par la CECT."
        actions={
          <SegmentedControl
            label="Affichage"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'mine', label: 'Mes packs' },
              { value: 'catalog', label: 'Catalogue' },
            ]}
          />
        }
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[var(--color-border)] bg-[var(--dash-card)] px-5 py-4">
        <div className="flex items-center gap-3"><CalendarDays size={20} className="text-[var(--color-primary)]" aria-hidden /><div><p className="text-sm font-bold text-[var(--color-text)]">Calendrier des règlements et crédits</p><p className="text-xs text-[var(--color-text-muted)]">Retrouvez vos paiements et les dates de crédit de chaque formule.</p></div></div>
        <Link to="/espace/calendrier" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700">Ouvrir ma fiche <ArrowRight size={16} aria-hidden /></Link>
      </div>

      {tab === 'mine' && (
        <div className="space-y-6">
          {mine.isPending && <div className="h-48 animate-pulse rounded-[18px] bg-[var(--chart-track)]" />}
          {mine.data && myPacks.length === 0 && (
            <section aria-labelledby="no-pack-title" className="relative overflow-hidden rounded-[26px] border border-[var(--color-border)] bg-[var(--dash-card)] px-6 py-9 shadow-[var(--shadow-card)] sm:px-10">
              <div aria-hidden className="pointer-events-none absolute -right-10 -top-20 h-60 w-60 rounded-full bg-emerald-500/[.07] blur-3xl" />
              <div className="relative flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-[var(--color-primary)]"><Boxes size={28} aria-hidden /></span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--color-primary)]">Votre prochaine étape</p>
                    <h2 id="no-pack-title" className="mt-2 text-xl font-extrabold tracking-tight text-[var(--color-text)]">Aucun pack actif pour le moment</h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--color-text-muted)]">{dashboard.data?.profile.kind === 'legal' ? 'Choisissez une formule accessible à votre personne morale pour activer les opérations adaptées à votre activité.' : 'Choisissez une formule selon votre objectif : vendre des YEM ou payer chez les marchands.'}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setTab('catalog')} className={btnPrimary}>Explorer le catalogue <ArrowRight size={16} aria-hidden /></button>
              </div>
            </section>
          )}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {myPacks.map((pack) => (
              <MyPackCard key={pack.id} pack={pack} detail={dashboard.data?.packs.find((item) => item.id === pack.id)} plan={planById.get(pack.plan.id)} onResume={() => setSelected(planById.get(pack.plan.id) ?? null)} onTopup={() => topup(pack)} />
            ))}
          </div>
        </div>
      )}

      {tab === 'catalog' && (
        <div className="space-y-10">
          {isLegal ? (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--dash-card)] p-5">
              <div><p className="font-bold text-[var(--color-text)]">Catalogue Personne morale · Marchand uniquement</p>
                <p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">Votre entreprise accède uniquement aux formules Marchand publiées par la CECT. Les packs Vendeur, Consommateur et Personnel sont réservés aux personnes physiques.</p>
              </div><span className="rounded-xl bg-violet-500/10 px-4 py-2 text-xs font-bold text-violet-500">Espace PM</span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--dash-card)] p-5">
              <div><p className="font-bold text-[var(--color-text)]">Vos packs Vendeur : {sellerSlotsUsed} sur 2</p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">Deux formules Vendeur maximum, identiques ou différentes. Consommateur ne compte pas dans cette limite ; Personnel se recharge. Marchand est réservé aux entreprises.</p>
              </div><span className="rounded-xl bg-emerald-700/10 px-4 py-2 text-sm font-bold text-[var(--color-primary)]">{Math.max(0, 2 - sellerSlotsUsed)} place(s) Vendeur</span>
            </div>
          )}
          <section aria-label="Filtres du catalogue" className="space-y-3 rounded-[22px] border border-[var(--color-border)] bg-[var(--dash-card)] p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-extrabold text-[var(--color-text)]">Choisissez selon votre objectif</p><span className="text-xs text-[var(--color-text-muted)]">{filteredCatalog.length} formule(s)</span></div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Catégories de packs">
              {availableFilters.map(value => <button key={value} type="button" aria-pressed={familyFilter === value} onClick={() => setFamilyFilter(value)} className={`min-h-11 rounded-xl border px-3 py-2 text-xs font-bold transition sm:text-sm ${familyFilter === value ? 'border-emerald-500 bg-emerald-600 text-white shadow-sm' : 'border-[var(--color-border)] bg-[var(--dash-bg)] text-[var(--color-text-muted)] hover:border-emerald-500'}`}>{value === 'TOUS' ? 'Tous les packs' : FAMILIES.find(item => item.family === value)?.title ?? value}</button>)}
            </div>
            <label className="block"><span className="sr-only">Rechercher un pack</span><input value={packSearch} onChange={e => setPackSearch(e.target.value)} placeholder="Rechercher une formule, un prix ou une catégorie…" className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--dash-bg)] px-4 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" /></label>
          </section>
          {catalog.isPending && <div className="h-48 animate-pulse rounded-[18px] bg-[var(--chart-track)]" />}
          {catalog.isError && (
            <p role="alert" className="rounded-[18px] border border-[var(--color-border)] bg-[var(--dash-card)] p-6 text-sm">
              Impossible de charger le catalogue.{' '}
              <button type="button" onClick={() => void catalog.refetch()} className="font-semibold text-[var(--color-primary)] underline">
                Réessayer
              </button>
            </p>
          )}
          {catalog.data && catalog.data.length === 0 && (
            <section aria-labelledby="empty-catalog-title" className="rounded-[26px] border border-dashed border-[var(--color-border)] bg-[var(--dash-card)] px-6 py-10 text-center sm:px-10">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-[var(--color-primary)]"><Boxes size={30} aria-hidden /></div>
              <h2 id="empty-catalog-title" className="mt-5 text-xl font-extrabold text-[var(--color-text)]">Le catalogue n’est pas encore publié</h2>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-[var(--color-text-muted)]">Aucune formule n’est actuellement proposée par la CECT. Le catalogue et les prix sont configurés par l’administration. Aucun montant ni droit n’est attribué avant publication.</p>
              <button type="button" onClick={() => void catalog.refetch()} className={btnPrimary + ' mt-6'}><RefreshCw size={16} aria-hidden /> Actualiser les formules</button>
            </section>
          )}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {FAMILIES.flatMap(({ family }) => filteredCatalog.filter((plan) => plan.family === family)).map((plan) => (
              <PlanCard key={plan.id} plan={plan} owned={ownedByPlan.get(plan.id)} sellerSlotsUsed={sellerSlotsUsed} onSelect={() => setSelected(plan)} onTopup={() => { const pack = ownedByPlan.get(plan.id); if (pack) topup(pack) }} />
            ))}
          </div>
        </div>
      )}

      {selected && <SubscribeDialog plan={selected} onClose={() => setSelected(null)} />}
      {topupFor && <TopupDialog pack={topupFor.pack} minimum={topupFor.minimum} onClose={() => setTopupFor(null)} />}
    </>
  )
}
