import { useState } from 'react'
import { CheckCircle2, Loader2, Smartphone } from 'lucide-react'
import { formatXof } from '@/lib/format'
import { authErrorMessage } from '@/features/auth/errors'
import { methodName } from './types'

/**
 * Affiché uniquement lorsque l'API confirme qu'un paiement est simulable en staging.
 * La confirmation passe par l'API protégée du paiement courant, sans argent réel.
 */
const PROCESSING_DELAY_MS = 3000

type Step = 'phone' | 'processing' | 'done'

interface SimulatedMobilePaymentProps {
  method: string
  amount: number
  onConfirmed: () => Promise<void>
  onChangeMethod: () => void
  paymentPhone?: string | null
}

export function SimulatedMobilePayment({ method, amount, onConfirmed, onChangeMethod, paymentPhone }: SimulatedMobilePaymentProps) {
  const [step, setStep] = useState<Step>('phone')
  const [error, setError] = useState<string | null>(null)

  async function pay() {
    setError(null)
    setStep('processing')
    try {
      await new Promise((resolve) => setTimeout(resolve, PROCESSING_DELAY_MS))
      await onConfirmed()
      setStep('done')
    } catch (caught) {
      setError(authErrorMessage(caught))
      setStep('phone')
    }
  }

  if (step === 'processing') {
    return (
      <div role="status" className="flex flex-col items-center gap-3 py-6 text-center">
        <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" aria-hidden />
        <p className="text-sm font-semibold text-[var(--color-text)]">Confirmation du paiement de démonstration</p>
        <p className="text-xs text-[var(--color-text-muted)]">
          Simulation interne de {formatXof(amount)} pour {methodName(method)} {paymentPhone ? `(${paymentPhone})` : ''}. Aucun SMS ou débit réel.
        </p>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <p role="status" className="flex items-center gap-2 rounded-2xl bg-[var(--color-primary)]/5 p-5 text-sm font-semibold text-[var(--color-text)]">
        <CheckCircle2 size={18} className="text-[var(--color-primary)]" aria-hidden />
        Paiement reçu, activation en cours…
      </p>
    )
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void pay()
      }}
      className="space-y-4"
    >
      <p className="flex items-start gap-2 text-sm text-[var(--color-text-muted)]">
        <Smartphone size={16} className="mt-0.5 shrink-0" aria-hidden />
Ce paiement {methodName(method)} est une simulation interne : aucun transfert d’argent n’aura lieu.
      </p>
      {paymentPhone && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--dash-bg)] px-4 py-3 text-sm">
          <span className="text-[var(--color-text-muted)]">Numéro de paiement : </span>
          <strong className="text-[var(--color-text)]">{paymentPhone}</strong>
          <button type="button" onClick={onChangeMethod} className="ml-2 font-semibold text-[var(--color-primary)] underline-offset-2 hover:underline">
            Modifier
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}
      <button
        type="submit"

        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
      >
        Payer {formatXof(amount)}
      </button>
      <button type="button" onClick={onChangeMethod} className="text-sm text-[var(--color-text-muted)] underline-offset-2 hover:underline">
        Changer de moyen de paiement
      </button>
    </form>
  )
}
