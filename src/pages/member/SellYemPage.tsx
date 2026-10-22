import { useRef, useState, type FormEvent } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Building2, Smartphone, CreditCard, Coins, Wallet, Clock3, CheckCircle2, ArrowRight, Calculator } from 'lucide-react'
import { Panel } from '@/components/dashboard/Panel'
import { PageHeader } from '@/components/ui/PageHeader'
import { Steps } from '@/components/ui/Steps'
import { FormDialog } from '@/components/ui/FormDialog'
import { ApiError, get, getRaw, newIdempotencyKey, post, put } from '@/lib/api'
import { ExchangeCard, type Exchange } from '@/features/exchanges/ExchangeCard'
import { formatYem, formatXof } from '@/lib/format'
import { authErrorMessage } from '@/features/auth/errors'
import { methodName, usePaymentMethods } from '@/features/payments/types'
import { usePublicConfig } from '@/features/config/usePublicConfig'
import type { UserPack } from '@/features/packs/types'
import { useMemberDashboard } from '@/data/useMemberDashboard'
import { Link } from 'react-router-dom'

interface PayoutDestination {
  method: string
  phone: string | null
  country?: string | null
  bank_name: string | null
  account_holder: string | null
  account_number: string | null
}

const QUANTITY_PATTERN = /^\d{1,22}([.,]\d{1,6})?$/
const INPUT = 'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]'

function describeDestination(destination: PayoutDestination): string {
  const parts = destination.method === 'BANK_TRANSFER' ? [destination.bank_name, destination.account_number] : [destination.phone]
  return [methodName(destination.method), ...parts].filter(Boolean).join(' · ')
}

export default function SellYemPage() {
  const queryClient = useQueryClient()
  const [editingDestination, setEditingDestination] = useState(false)
  const [payoutCountry, setPayoutCountry] = useState('TG')
  const publicConfig = usePublicConfig().data
  const dashboard = useMemberDashboard().data
  const methods = usePaymentMethods(payoutCountry).filter(method => method.code !== 'CARD_SIM')
  const canBank = publicConfig?.payment_methods.some(method => method.code === 'BANK_TRANSFER' && method.channel === 'manual') ?? false
  const payoutChoices = [...methods.map(method => ({ value: method.code, label: method.label })), ...(canBank ? [{ value: 'BANK_TRANSFER', label: 'Virement bancaire' }] : [])]
  const profile = useQuery({ queryKey: ['member-user-profile'], queryFn: () => get<{ phone: string | null }>('/me'), staleTime: 60_000 })
  const [packId, setPackId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const key = useRef(newIdempotencyKey())

  const destination = useQuery({
    queryKey: ['payout-destination'],
    queryFn: async () => {
      try {
        return await get<PayoutDestination>('/me/payout-destination')
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 404) return null
        throw caught
      }
    },
    staleTime: 0,
  })
  const packs = useQuery({ queryKey: ['my-packs'], queryFn: () => get<UserPack[]>('/me/packs'), staleTime: 0 })
  const exchanges = useQuery({ queryKey: ['exchanges'], queryFn: () => getRaw<{ data: Exchange[] }>('/me/exchange-requests', { per_page: 20 }).then((body) => body.data), staleTime: 0 })

  const openExchange = exchanges.data?.find((exchange) => exchange.status === 'awaiting_transfer' || exchange.status === 'declared_sent' || exchange.status === 'yem_received')
  const step = openExchange ? (openExchange.status === 'awaiting_transfer' ? 2 : 3) : destination.data ? 1 : 0

  const sellable = (packs.data ?? []).filter((pack) => pack.status === 'active' && pack.family === 'VENDEUR')
  const selectedPackId = packId || sellable[0]?.id || ''
  const selected = sellable.find((pack) => pack.id === selectedPackId)
  const ledger = dashboard?.packs.find(pack => pack.id === selectedPackId)
  const sellRate = publicConfig?.rates_xof_per_yem.purchase
  const parsed = Number(quantity.replace(',', '.'))
  const calculated = Number.isFinite(parsed) && parsed > 0 && sellRate ? Math.floor(parsed * sellRate) : 0
  const hasBalance = Number(selected?.balance?.available ?? 0) > 0
  const validAmount = QUANTITY_PATTERN.test(quantity.trim()) && parsed > 0 && parsed <= Number(selected?.balance?.available ?? 0)

  async function refreshAll() {
    await queryClient.invalidateQueries({ queryKey: ['exchanges'] })
    await queryClient.invalidateQueries({ queryKey: ['my-packs'] })
    await queryClient.invalidateQueries({ queryKey: ['member-dashboard'] })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!QUANTITY_PATTERN.test(quantity.trim())) {
      setError('Saisissez une quantité valide (6 décimales au plus).')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await post('/me/exchange-requests', { user_pack_id: selectedPackId, quantity: quantity.trim().replace(',', '.') }, key.current)
      key.current = newIdempotencyKey()
      setQuantity('')
      await refreshAll()
    } catch (caught) {
      key.current = newIdempotencyKey()
      setError(caught instanceof ApiError && caught.code === 'PAYOUT_DESTINATION_REQUIRED' ? 'Renseignez d’abord votre moyen de réception ci-dessus.' : authErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>Vendre mes YEM — CECT Togo</title>
      </Helmet>

      <div className="max-w-3xl space-y-6">
        <PageHeader title="Vendre mes YEM" description="Sélectionnez votre pack Vendeur, indiquez vos YEM débloqués et suivez le transfert jusqu’au versement en FCFA." />
        <section className="overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-[var(--dash-card)] p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[var(--color-primary)]">Votre capacité de vente</p><h2 className="mt-1 text-lg font-extrabold">{selected?.plan.name ?? 'Choisissez votre pack Vendeur'}</h2></div><Wallet size={26} className="text-[var(--color-primary)]" aria-hidden /></div>
          {selected ? <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { title: 'Crédité (contrat)', value: ledger?.contractual_total ?? ledger?.credited ?? '0', icon: Coins },
              { title: 'Disponible', value: selected.balance?.available ?? '0', icon: Wallet },
              { title: 'Réservé', value: selected.balance?.reserved ?? '0', icon: Clock3 },
              { title: 'Déjà vendu', value: selected.balance?.consumed ?? '0', icon: CheckCircle2 },
            ].map(({title,value,icon:Icon}) => <div key={title} className="min-w-0 rounded-xl bg-[var(--dash-bg)] p-3"><p className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]"><Icon size={13} aria-hidden />{title}</p><strong className="mt-2 block text-base font-extrabold tabular-nums">{formatYem(value)} <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">YEM</span></strong></div>)}
          </div> : <p className="mt-4 text-sm text-[var(--color-text-muted)]">Vous devez d’abord souscrire une formule Vendeur.</p>}
          <p className="mt-3 text-xs leading-5 text-[var(--color-text-muted)]">Le crédit contractuel correspond aux droits prévus pour la durée du pack. Vous ne pouvez vendre que les YEM effectivement débloqués et disponibles.</p>
          {!hasBalance && <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/[.08] p-3 text-xs leading-5 text-[var(--color-text)]">Aucun YEM disponible pour une nouvelle vente. Les crédits sont débloqués aux dates de votre calendrier. <Link to="/espace/calendrier" className="font-bold text-[var(--color-primary)] underline">Voir mes prochains crédits</Link>.</p>}
        </section>

        <Steps steps={['Réception', 'Quantité', 'Envoi des YEM', 'Versement']} current={step} />

        <Panel
          title="Moyen de réception"
          subtitle="Où recevoir vos versements"
          action={
            <button type="button" onClick={() => { setPayoutCountry(destination.data?.country ?? 'TG'); setEditingDestination(true) }} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[var(--color-border)] px-3 text-sm font-semibold hover:bg-[var(--dash-bg)]">
              <Pencil size={14} aria-hidden /> {destination.data ? 'Modifier' : 'Renseigner'}
            </button>
          }
        >
          <p className="text-sm text-[var(--color-text)]">{destination.data ? describeDestination(destination.data) : 'Aucun moyen de réception enregistré.'}</p>
        </Panel>

        {packs.data && sellable.length === 0 ? (
          <p className="rounded-2xl border border-[var(--color-border)] bg-[var(--dash-card)] p-5 text-sm">Il vous faut un pack Vendeur actif pour vendre des YEM.</p>
        ) : (
          <Panel title="Nouvelle vente">
            <form onSubmit={(event) => void submit(event)} className="space-y-4">
              <div>
                <label htmlFor="sell-pack" className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">
                  Pack Vendeur
                </label>
                <select id="sell-pack" value={selectedPackId} onChange={(event) => setPackId(event.target.value)} className={INPUT}>
                  {sellable.map((pack) => (
                    <option key={pack.id} value={pack.id}>
                      {pack.plan.name} — {pack.balance ? formatYem(pack.balance.available) : '0 YEM'} disponibles
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="sell-quantity" className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">
                  Quantité de YEM à vendre
                </label>
                <input id="sell-quantity" value={quantity} onChange={(event) => setQuantity(event.target.value)} inputMode="decimal" required className={INPUT} />
                {selected?.balance && <p className="mt-1 text-xs text-[var(--color-text-muted)]">Disponible à vendre : {formatYem(selected.balance.available)} YEM</p>}
                <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[.055] p-4">
                  <p className="flex items-center gap-2 text-xs font-bold text-[var(--color-primary)]"><Calculator size={16} aria-hidden />Simulation du montant à recevoir</p>
                  <div className="mt-3 flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs text-[var(--color-text-muted)]">Cours de rachat actuel</p><p className="mt-1 text-sm font-bold">{sellRate ? `${formatXof(sellRate)} par YEM` : 'Cours indisponible'}</p></div><div className="text-right"><p className="text-xs text-[var(--color-text-muted)]">Estimation brute</p><p className="mt-1 text-xl font-extrabold text-[var(--color-primary)] tabular-nums">{sellRate ? formatXof(calculated) : '—'}</p></div></div>
                  <p className="mt-2 text-[11px] leading-5 text-[var(--color-text-muted)]">Le versement définitif et les éventuels frais sont confirmés par la CECT lors de la transaction. Cette estimation n’est pas un paiement.</p>
                </div>
              </div>
              {error && (
                <p role="alert" className="text-sm text-[var(--color-danger)]">
                  {error}
                </p>
              )}
              <button type="submit" disabled={busy || !selectedPackId || !validAmount} className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60">
                Vérifier ma vente et obtenir les instructions <ArrowRight size={16} className="ml-2 inline" aria-hidden />
              </button>
            </form>
          </Panel>
        )}

        <Panel title="Mes ventes">
          {exchanges.data && exchanges.data.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">Aucune vente pour le moment.</p>}
          <div className="space-y-4">
            {exchanges.data?.map((exchange) => (
              <ExchangeCard key={exchange.id} exchange={exchange} onChanged={refreshAll} />
            ))}
          </div>
        </Panel>
      </div>

      {editingDestination && (
        <FormDialog
          title="Moyen de réception"
          subtitle="Choisissez d’abord votre pays et votre mode de réception. Seuls les champs nécessaires s'affichent ; un code e-mail protège chaque modification."
          submitLabel="Enregistrer mon moyen de réception"
          onFieldChange={(name,value) => { if (name === 'country') setPayoutCountry(value) }}
          fields={[
            { name: 'country', label: 'Pays de réception', type: 'select',
              initial: destination.data?.country ?? 'TG',
              options: (publicConfig?.payout_countries ?? []).map(country => ({ value: country.code, label: country.name + ' (+' + country.dial_code + ')' })) },
            { name: 'method', label: 'Moyen de réception', type: 'select', required: true,
              initial: destination.data?.method && payoutChoices.some(choice => choice.value === destination.data?.method)
                ? destination.data.method : payoutChoices[0]?.value ?? 'BANK_TRANSFER',
              options: payoutChoices },
            { name: 'phone', label: 'Numéro Mobile Money avec indicatif (ex. +22890123456)',
              hideWhen: { name: 'method', value: 'BANK_TRANSFER' }, required: true,
              initial: destination.data?.phone ?? profile.data?.phone ?? '' },
            { name: 'bank_name', label: 'Banque', showWhen: { name: 'method', value: 'BANK_TRANSFER' }, required: true,
              initial: destination.data?.bank_name ?? '' },
            { name: 'account_holder', label: 'Nom complet du titulaire', showWhen: { name: 'method', value: 'BANK_TRANSFER' }, required: true,
              initial: destination.data?.account_holder ?? '' },
            { name: 'account_number', label: 'IBAN / numéro de compte', showWhen: { name: 'method', value: 'BANK_TRANSFER' }, required: true,
              initial: destination.data?.account_number ?? '' },
          ]}
          onClose={() => setEditingDestination(false)}
          onSubmit={async (values) => {
            if (!payoutChoices.some(choice => choice.value === values.method)) {
              throw new Error('Ce moyen de réception n’est pas disponible dans le pays sélectionné.')
            }
            await put('/me/payout-destination', {
              method: values.method,
              country: values.country,
              phone: values.method === 'BANK_TRANSFER' ? null : values.phone.trim() || null,
              bank_name: values.method === 'BANK_TRANSFER' ? values.bank_name.trim() : null,
              account_holder: values.method === 'BANK_TRANSFER' ? values.account_holder.trim() : null,
              account_number: values.method === 'BANK_TRANSFER' ? values.account_number.trim() : null,
            })
            await queryClient.invalidateQueries({ queryKey: ['payout-destination'] })
          }}
        >
          <div className="mb-4 grid grid-cols-3 gap-2 rounded-xl border border-[var(--color-border)] p-3 text-center text-xs">
            <span className="flex flex-col items-center gap-1"><Smartphone size={20} className="text-[var(--color-primary)]"/> Mobile Money</span>
            <span className="flex flex-col items-center gap-1"><Building2 size={20} className="text-[var(--color-primary)]"/> Virement</span>
            <span className="flex flex-col items-center gap-1 opacity-50"><CreditCard size={20}/> Carte : bientôt</span>
          </div>
          <p className="mb-3 text-xs text-[var(--color-text-muted)]">Le versement sur carte bancaire nécessitera un prestataire compatible. Aucun numéro de carte ne sera conservé ici.</p>
        </FormDialog>
      )}
    </>
  )
}
