import { usePublicConfig } from '@/features/config/usePublicConfig'

export type PaymentStatus = 'created' | 'pending' | 'approved' | 'declined' | 'canceled' | 'expired' | 'failed' | 'mismatch'

export interface PaymentAttempt {
  id: string
  reference: string
  provider: string
  method: string | null
  mode: 'psp' | 'manual'
  status: PaymentStatus
  net_amount: number
  fee_amount: number
  amount: number
  currency: string
  checkout_url: string | null
  instructions: string | null
  declared_reference: string | null
  declared_at: string | null
  validated_at: string | null
  created_at: string
}

export const PAYMENT_METHODS: ReadonlyArray<{ code: string; label: string; hint: string; countries: string[] }> = [
  { code: 'TMONEY', label: 'T-Money (simulation)', hint: 'Canal Togo simulé · aucun débit réel', countries: ['TG'] },
  { code: 'FLOOZ', label: 'Flooz (simulation)', hint: 'Canal Togo simulé · aucun débit réel', countries: ['TG'] },
  { code: 'BANK_TRANSFER', label: 'Virement bancaire (simulation)', hint: 'Aucun virement réel en recette', countries: [] },
  { code: 'CASH', label: 'Espèces (simulation)', hint: 'Aucun encaissement réel en recette', countries: [] },
]

export function usePaymentMethods(): ReadonlyArray<{ code: string; label: string; hint: string; countries: string[] }> {
  const config = usePublicConfig().data
  if (!config) return PAYMENT_METHODS

  const methods = config.payment_methods.map((method) => ({
    code: method.code,
    label: method.label,
    hint: method.channel === 'mobile_money'
      ? 'Simulation interne CECT · aucun portefeuille réel débité'
      : 'Simulation interne CECT · contrôle manuel sans mouvement d’argent',
    countries: method.countries ?? [],
  }))

  return methods.length > 0 ? methods : PAYMENT_METHODS
}

export function usePayoutMethods(): ReadonlyArray<{ code: string; label: string; hint: string; countries: string[] }> {
  return usePaymentMethods()
}

export function methodName(code: string | null): string {
  if (code === null) return '—'
  return PAYMENT_METHODS.find((method) => method.code === code)?.label ?? code
}

export function isInFlight(status: PaymentStatus): boolean {
  return status === 'created' || status === 'pending'
}

export const PAYMENT_FAILURE_LABELS: Partial<Record<PaymentStatus, string>> = {
  declined: 'Scénario simulé : paiement refusé.',
  canceled: 'Scénario simulé : paiement annulé.',
  expired: 'La tentative simulée a expiré.',
  failed: 'La simulation a échoué.',
  mismatch: 'Le montant simulé reçu ne correspond pas au montant attendu.',
}
