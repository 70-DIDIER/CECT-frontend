import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Pencil, ShieldCheck, Smartphone } from 'lucide-react'
import { Panel } from '@/components/dashboard/Panel'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/app/AuthContext'
import { ApiError, get, newIdempotencyKey, post } from '@/lib/api'
import { formatXof } from '@/lib/format'
import { authErrorMessage } from '@/features/auth/errors'
import { AmountBreakdown, MethodPicker, PaymentCheckout } from '@/features/payments/PaymentCheckout'
import { isInFlight, usePaymentMethods, type PaymentAttempt } from '@/features/payments/types'
import { CountrySelect } from '@/components/ui/CountrySelect'
import { DEFAULT_COUNTRY, findCountry, fromInternationalPhone, toInternationalPhone } from '@/lib/countries'
import type { CountryCode } from 'libphonenumber-js/min'

interface MembershipState {
  status: string
  fee_due: number
  payment_quote: { net_amount: number; fee_amount: number; total_amount: number } | null
  payment_attempts: PaymentAttempt[]
  sandbox_preview?: boolean
  payment_enabled?: boolean
  demo_checkout?: boolean
}

const QUERY_KEY = ['membership']

export default function MembershipPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, refresh } = useAuth()
  const originalPhone = fromInternationalPhone(user?.phone)
  const [countryCode, setCountryCode] = useState<string>(originalPhone?.country ?? DEFAULT_COUNTRY)
  const [nationalPhone, setNationalPhone] = useState<string>(originalPhone?.national ?? '')
  const [editingPhone, setEditingPhone] = useState(!originalPhone)
  const [method, setMethod] = useState('TMONEY')
  const [choosing, setChoosing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const availableMethods = usePaymentMethods(countryCode)
  const selectedMethod = availableMethods.some((item) => item.code === method) ? method : (availableMethods[0]?.code ?? '')
  const phoneE164 = toInternationalPhone(countryCode as CountryCode, nationalPhone)
  const country = findCountry(countryCode)

  useEffect(() => {
    const initial = fromInternationalPhone(user?.phone)
    if (!initial) return
    setCountryCode(initial.country)
    setNationalPhone(initial.national)
    setEditingPhone(false)
  }, [user?.phone])

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => get<MembershipState>('/me/membership'),
    staleTime: 0,
    refetchInterval: (state) => {
      const attempt = state.state.data?.payment_attempts[0]
      return attempt && isInFlight(attempt.status) ? 4000 : false
    },
  })

  const state = query.data
  const attempt = state?.payment_attempts[0]
  const active = state?.status === 'active' || user?.status === 'active'
  const sandboxPreview = state?.sandbox_preview === true && state?.payment_enabled === false
  const demoCheckout = state?.demo_checkout === true

  useEffect(() => {
    if (!active) return
    void refresh().then(() => {
      queryClient.clear()
      navigate('/espace', { replace: true })
    })
  }, [active, navigate, queryClient, refresh])

  useEffect(() => {
    // A pending-KYC member who has not completed the document test has no
    // authorization even to preview this step. Redirect to the KYC page.
    if (user?.status === 'pending_kyc'
      && query.isError && query.error instanceof ApiError && query.error.status === 403) {
      navigate('/espace/kyc', { replace: true })
    }
  }, [user?.status, query.isError, query.error, navigate])

  const startPayment = useMutation({
    mutationFn: () => {
      if (sandboxPreview) return Promise.reject(new Error('Le paiement est bloqué tant que la vérification réelle n’est pas approuvée.'))
      if (!phoneE164 || !selectedMethod) return Promise.reject(new Error('Numéro ou moyen de paiement invalide.'))
      return post<PaymentAttempt>('/me/membership/payments', { method: selectedMethod, payment_phone: phoneE164 }, newIdempotencyKey())
    },
    onSuccess: () => {
      setChoosing(false)
      setError(null)
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
    onError: (caught) => setError(authErrorMessage(caught)),
  })

  const showCheckout = attempt && !choosing && (isInFlight(attempt.status) || attempt.status !== 'approved')

  return (
    <>
      <Helmet>
        <title>Adhésion — CECT Togo</title>
      </Helmet>

      <div className="max-w-xl space-y-6">
        <PageHeader
          title={sandboxPreview ? 'Adhésion — aperçu de test' : 'Finalisez votre adhésion'}
          description={sandboxPreview
            ? "Votre contrôle documentaire de test est terminé. Retrouvez ci-dessous le parcours habituel d’adhésion, sans paiement ni activation réelle."
            : "Votre e-mail est vérifié. Réglez les frais d’adhésion pour activer votre compte et accéder aux packs."}
        />
        {sandboxPreview && (
          <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <strong className="block mb-1">Parcours de démonstration uniquement</strong>
            Le contrôle documentaire Sandbox ne valide pas réellement votre identité.
            Vous pouvez consulter le montant et les moyens d’adhésion, mais aucun paiement,
            débit Mobile Money ou accès aux YEM n’est autorisé.
          </div>
        )}

        {query.isPending && <div className="h-64 animate-pulse rounded-3xl bg-[var(--chart-track)]" />}

        {query.isError && (
          <p role="alert" className="rounded-2xl border border-[var(--color-border)] p-5 text-sm">
            Impossible de charger votre adhésion.{' '}
            <button type="button" onClick={() => void query.refetch()} className="font-semibold text-[var(--color-primary)] underline">
              Réessayer
            </button>
          </p>
        )}

        {active && (
          <p role="status" className="flex items-center gap-2 rounded-2xl bg-[var(--color-primary)]/5 p-5 text-sm font-semibold text-[var(--color-text)]">
            <CheckCircle2 size={18} className="text-[var(--color-primary)]" aria-hidden />
            Adhésion activée, redirection vers votre espace…
          </p>
        )}

        {state && !active && (
          <Panel title="Frais d’adhésion" subtitle={`Montant : ${formatXof(state.fee_due)}`}>
            {showCheckout ? (
              <PaymentCheckout
                payment={attempt}
                onRefresh={async () => {
                  await post(`/me/membership/payments/${attempt.id}/refresh`)
                  await query.refetch()
                }}
                onDeclare={async (reference) => {
                  await post(`/me/payments/${attempt.id}/declare`, { reference: reference || null })
                  await query.refetch()
                }}
                onSimulate={async () => {
                  await post(`/me/payments/${attempt.id}/simulate`)
                  await query.refetch()
                }}
                onChangeMethod={() => setChoosing(true)}
                paymentPhone={phoneE164}
              />
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  startPayment.mutate()
                }}
                className="space-y-4"
              >
                {state.payment_quote && <AmountBreakdown net={state.payment_quote.net_amount} fee={state.payment_quote.fee_amount} total={state.payment_quote.total_amount} />}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="membership-payment-phone" className="text-sm font-semibold text-[var(--color-text)]">
                      Numéro qui servira au paiement
                    </label>
                    {!editingPhone && (
                      <button type="button" onClick={() => setEditingPhone(true)}
                        aria-label="Modifier le numéro de paiement"
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10">
                        <Pencil size={14} aria-hidden /> Modifier
                      </button>
                    )}
                  </div>
                  <div className="flex">
                    <CountrySelect value={countryCode} onChange={(next) => {
                      setCountryCode(next)
                      setNationalPhone('')
                      setEditingPhone(true)
                      setError(null)
                    }} className="w-[8.5rem] shrink-0" />
                    <input id="membership-payment-phone" type="tel" inputMode="tel" autoComplete="tel-national"
                      value={nationalPhone} readOnly={!editingPhone}
                      onChange={(event) => { setNationalPhone(event.target.value); setError(null) }}
                      placeholder={countryCode === 'TG' ? '90 12 34 56' : 'Numéro national'}
                      className={'min-w-0 flex-1 rounded-r-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]' + (!editingPhone ? ' opacity-90' : '')} />
                  </div>
                  {!phoneE164 ? (
                    <p role="alert" className="text-xs text-[var(--color-danger)]">
                      Saisissez un numéro valide pour {country?.name ?? 'le pays choisi'}.
                    </p>
                  ) : (
                    <p className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                      <Smartphone size={13} aria-hidden /> {phoneE164} · {editingPhone ? 'Numéro modifiable pour ce paiement' : 'Prérempli depuis votre inscription'}
                    </p>
                  )}
                </div>
                <MethodPicker value={selectedMethod} onChange={setMethod} country={countryCode} demoCheckout={demoCheckout} />
                <p className="flex items-center gap-2 rounded-xl bg-[var(--color-primary)]/5 p-3 text-xs text-[var(--color-text-muted)]">
                  <ShieldCheck size={16} className="shrink-0 text-[var(--color-primary)]" aria-hidden />
                  Paiement sécurisé en simulation : aucune somme ne sera débitée.
                </p>
                {error && (
                  <p role="alert" className="text-sm text-[var(--color-danger)]">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={sandboxPreview || startPayment.isPending || !phoneE164 || !selectedMethod}
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
                >
                  {sandboxPreview ? 'Paiement indisponible en mode test' : 'Continuer'}
                </button>
              </form>
            )}
          </Panel>
        )}
      </div>
    </>
  )
}
