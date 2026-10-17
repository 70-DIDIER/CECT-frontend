import { usePublicConfig } from '@/features/config/usePublicConfig'
import AFRICAN_NETWORK_NAMES from '@/data/africanMobileMoneyNames.json'

export type PaymentStatus = 'created' | 'pending' | 'approved' | 'declined' | 'canceled' | 'expired' | 'failed' | 'mismatch'

export interface PaymentAttempt {
  id: string
  reference: string
  provider: string
  simulation_available: boolean
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

export interface PaymentMethodOption {
  code: string
  label: string
  hint: string
  logo: string | null
}

// Les logos sont hébergés dans le frontend : aucune dépendance à un CDN au règlement.
const NETWORK_BRANDS: Record<string, { label: string; logo: string }> = {
  TMONEY: { label: 'Mixx', logo: '/payment-logos/mixx.svg' },
  FLOOZ: { label: 'Flooz', logo: '/payment-logos/flooz.png' },
  WAVE: { label: 'Wave', logo: '/payment-logos/wave.png' },
  ORANGE_MONEY: { label: 'Orange Money', logo: '/payment-logos/orange-money.svg' },
  MPESA: { label: 'M-Pesa', logo: '/payment-logos/mpesa.svg' },
  MTN_MOMO: { label: 'MTN Mobile Money', logo: '/payment-logos/mtn.svg' },
  AIRTEL_MONEY: { label: 'Airtel Money', logo: '/payment-logos/airtel.svg' },
  CORIS_MONEY: { label: 'Coris Money', logo: '/payment-logos/coris.svg' },
}

export const PAYMENT_METHODS: ReadonlyArray<PaymentMethodOption> = [
  { code: 'TMONEY', label: 'Mixx', hint: 'Paiement mobile simulé', logo: NETWORK_BRANDS.TMONEY.logo },
  { code: 'FLOOZ', label: 'Flooz', hint: 'Paiement mobile simulé', logo: NETWORK_BRANDS.FLOOZ.logo },
  { code: 'WAVE', label: 'Wave', hint: 'Paiement mobile simulé', logo: NETWORK_BRANDS.WAVE.logo },
  { code: 'ORANGE_MONEY', label: 'Orange Money', hint: 'Paiement mobile simulé', logo: NETWORK_BRANDS.ORANGE_MONEY.logo },
]

export function usePaymentMethods(country: string = 'TG'): ReadonlyArray<PaymentMethodOption> {
  const config = usePublicConfig().data
  if (!config) return country === 'TG' ? PAYMENT_METHODS.slice(0, 2) : []
  const mobile = config.payment_methods
    .filter((method) => method.channel === 'mobile_money'
      && method.countries.includes(country)
      && method.code !== 'AFRICA_WALLET_TEST')
    .map((method) => ({
      code: method.code,
      label: NETWORK_BRANDS[method.code]?.label ?? (AFRICAN_NETWORK_NAMES as Record<string, string>)[method.code] ?? method.label.replace(/\s*\(simulation(?: uniquement)?\)/gi, ''),
      hint: 'Paiement Mobile Money simulé',
      logo: NETWORK_BRANDS[method.code]?.logo ?? null,
    }))
  // All countries may choose the safe test-only card simulator as an alternative.
  const cardEnabled = config.test_mode && config.payment_methods.some((method) =>
    method.code === 'CARD_SIM' && method.channel === 'card')
  const card: PaymentMethodOption = {
    code: 'CARD_SIM',
    label: 'Autres moyens de paiement — Carte bancaire',
    hint: 'Visa · Mastercard · American Express — simulation',
    logo: '/payment-logos/visa.svg',
  }
  return cardEnabled ? [...mobile, card] : mobile
}

export function methodName(code: string | null): string {
  return (code === 'CARD_SIM' ? 'Carte bancaire' : undefined) ?? PAYMENT_METHODS.find((method) => method.code === code)?.label ?? (code ? (AFRICAN_NETWORK_NAMES as Record<string, string>)[code] ?? (code === 'AFRICA_WALLET_TEST' ? 'Autre portefeuille mobile' : code) : '—')
}

export function isInFlight(status: PaymentStatus): boolean {
  return status === 'created' || status === 'pending'
}

export const PAYMENT_FAILURE_LABELS: Partial<Record<PaymentStatus, string>> = {
  declined: 'Le paiement a été refusé.',
  canceled: 'Le paiement a été annulé.',
  expired: 'Le paiement a expiré.',
  failed: 'Le paiement a échoué.',
  mismatch: 'Le montant reçu ne correspond pas au montant dû : la CECT va vous contacter.',
}
