import { useState } from 'react'
import { FlaskConical, Hourglass, RefreshCw, ShieldCheck } from 'lucide-react'
import { ApiError, post } from '@/lib/api'
import { formatXof } from '@/lib/format'
import { authErrorMessage } from '@/features/auth/errors'
import { PAYMENT_FAILURE_LABELS, isInFlight, usePaymentMethods, type PaymentAttempt } from './types'

interface MethodPickerProps {
  value: string
  onChange: (code: string) => void
}

export function MethodPicker({ value, onChange }: MethodPickerProps) {
  const methods = usePaymentMethods()

  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-semibold text-[var(--color-text)]">Moyen à simuler</legend>
      {methods.map((method) => (
        <label
          key={method.code}
          className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors ${
            value === method.code ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5' : 'border-[var(--color-border)] hover:bg-[var(--dash-bg)]'
          }`}
        >
          <input type="radio" name="payment-method" value={method.code} checked={value === method.code} onChange={() => onChange(method.code)} className="accent-[var(--color-primary)]" />
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            <FlaskConical size={17} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-[var(--color-text)]">{method.label}</span>
            <span className="block text-xs text-[var(--color-text-muted)]">{method.hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}

interface AmountBreakdownProps {
  net: number
  fee: number
  total: number
  externalFees?: boolean
}

export function AmountBreakdown({ net, fee, total }: AmountBreakdownProps) {
  return (
    <dl className="space-y-1.5 rounded-xl bg-[var(--dash-bg)] p-4 text-sm">
      <div className="flex justify-between gap-4">
        <dt className="text-[var(--color-text-muted)]">Montant simulé</dt>
        <dd className="font-semibold text-[var(--color-text)]">{formatXof(net)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-[var(--color-text-muted)]">Frais techniques de recette</dt>
        <dd className="text-right font-semibold text-[var(--color-text)]">{formatXof(fee)}</dd>
      </div>
      <div className="flex justify-between gap-4 border-t border-[var(--color-border)] pt-2">
        <dt className="font-bold text-[var(--color-text)]">Total simulé</dt>
        <dd className="text-base font-extrabold text-[var(--color-primary)]">{formatXof(total)}</dd>
      </div>
    </dl>
  )
}

interface PaymentCheckoutProps {
  payment: PaymentAttempt
  onDeclare: (reference: string) => Promise<void>
  onRefresh: () => Promise<void>
  onChangeMethod: () => void
}

type SimulationScenario = 'approved' | 'declined' | 'canceled'

export function PaymentCheckout({ payment, onDeclare, onRefresh, onChangeMethod }: PaymentCheckoutProps) {
  const [reference, setReference] = useState('')
  const [scenario, setScenario] = useState<SimulationScenario>('approved')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (caught) {
      setError(caught instanceof ApiError && caught.code === 'PAYMENT_ATTEMPT_IN_PROGRESS'
        ? 'Une tentative est déjà en cours, patientez un instant.'
        : authErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const failure = PAYMENT_FAILURE_LABELS[payment.status]
  const declared = payment.declared_at !== null
  const simulator = payment.provider === 'fake'

  return (
    <div className="space-y-4">
      <AmountBreakdown net={payment.net_amount} fee={payment.fee_amount} total={payment.amount} />

      <div className="flex items-start gap-3 rounded-xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-4">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[var(--color-primary)]" aria-hidden />
        <div>
          <p className="text-sm font-bold text-[var(--color-text)]">Simulation CECT</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
            Aucun compte, carte, portefeuille Mobile Money ou compte bancaire réel ne sera débité dans cet environnement.
          </p>
        </div>
      </div>

      {failure && <p role="alert" className="rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-4 py-3 text-sm text-[var(--color-danger)]">{failure}</p>}

      {isInFlight(payment.status) && payment.mode === 'psp' && simulator && (
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-[var(--color-text)]">
            Résultat à simuler
            <select
              value={scenario}
              onChange={(event) => setScenario(event.target.value as SimulationScenario)}
              className="mt-2 min-h-[44px] w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)]"
            >
              <option value="approved">Paiement réussi</option>
              <option value="declined">Paiement refusé</option>
              <option value="canceled">Paiement annulé</option>
            </select>
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(async () => {
              await post(`/me/payments/${payment.id}/simulate`, { status: scenario })
              await onRefresh()
            })}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            <FlaskConical size={16} aria-hidden />
            {busy ? 'Simulation…' : 'Simuler le paiement'}
          </button>
        </div>
      )}

      {isInFlight(payment.status) && payment.mode === 'psp' && !simulator && (
        <div className="space-y-3 rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-amber-950">
          <p className="text-sm font-semibold">Ancienne tentative externe désactivée</p>
          <p className="text-xs leading-relaxed">Ce paiement appartient à l’ancien parcours provider. Aucun appel externe ne sera relancé en recette.</p>
          <button type="button" onClick={onChangeMethod} className="inline-flex min-h-[40px] w-full items-center justify-center rounded-xl border border-amber-300 px-4 text-sm font-semibold">
            Repartir avec une simulation
          </button>
        </div>
      )}

      {isInFlight(payment.status) && payment.mode === 'manual' && (
        <div className="space-y-3">
          {payment.instructions && <p className="whitespace-pre-line rounded-xl border border-[var(--color-border)] p-4 text-sm leading-relaxed text-[var(--color-text)]">{payment.instructions}</p>}
          {declared ? (
            <p className="flex items-start gap-2 rounded-xl bg-[var(--color-primary)]/5 px-4 py-3 text-sm text-[var(--color-text)]">
              <Hourglass size={16} className="mt-0.5 shrink-0 text-[var(--color-primary)]" aria-hidden />
              Déclaration simulée enregistrée. Elle attend le contrôle Comptabilité prévu par le workflow de recette.
            </p>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void run(() => onDeclare(reference.trim()))
              }}
              className="space-y-3"
            >
              <div>
                <label htmlFor="declared-reference" className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Référence de simulation</label>
                <input
                  id="declared-reference"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  maxLength={120}
                  placeholder="Ex. TEST-BANK-001"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
              <button type="submit" disabled={busy} className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-[var(--color-border)] px-5 text-sm font-semibold hover:bg-[var(--dash-bg)] disabled:opacity-60">
                Déclarer le paiement simulé
              </button>
            </form>
          )}
        </div>
      )}

      {error && <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p>}

      {!(isInFlight(payment.status) && payment.mode === 'manual' && declared) && !(isInFlight(payment.status) && payment.mode === 'psp' && !simulator) && (
        <button type="button" onClick={onChangeMethod} className="text-sm text-[var(--color-text-muted)] underline-offset-2 hover:underline">
          {failure ? 'Relancer une autre simulation' : 'Changer de moyen simulé'}
        </button>
      )}

      {simulator && isInFlight(payment.status) && (
        <button type="button" disabled={busy} onClick={() => void run(onRefresh)} className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--dash-bg)] disabled:opacity-60">
          <RefreshCw size={14} aria-hidden />
          Actualiser l’état
        </button>
      )}
    </div>
  )
}
