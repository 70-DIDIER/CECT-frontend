import { useRef, useState, type FormEvent } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Building2, Smartphone, CreditCard } from 'lucide-react'
import { Panel } from '@/components/dashboard/Panel'
import { PageHeader } from '@/components/ui/PageHeader'
import { Steps } from '@/components/ui/Steps'
import { FormDialog } from '@/components/ui/FormDialog'
import { ApiError, get, getRaw, newIdempotencyKey, post, put } from '@/lib/api'
import { ExchangeCard, type Exchange } from '@/features/exchanges/ExchangeCard'
import { formatYem } from '@/lib/format'
import { authErrorMessage } from '@/features/auth/errors'
import { methodName, usePaymentMethods } from '@/features/payments/types'
import { usePublicConfig } from '@/features/config/usePublicConfig'
import type { UserPack } from '@/features/packs/types'

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
        <PageHeader title="Vendre mes YEM" description="Réservez une quantité, envoyez-la à la CECT depuis votre portefeuille YEM, puis recevez le montant en FCFA." />

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
                {selected?.balance && <p className="mt-1 text-xs text-[var(--color-text-muted)]">Disponible : {formatYem(selected.balance.available)}</p>}
              </div>
              {error && (
                <p role="alert" className="text-sm text-[var(--color-danger)]">
                  {error}
                </p>
              )}
              <button type="submit" disabled={busy || !selectedPackId} className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60">
                Réserver et obtenir les instructions
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
