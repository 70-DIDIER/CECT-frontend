import { useState } from 'react'
import { CheckCircle2, CreditCard, LockKeyhole, Loader2, ShieldCheck } from 'lucide-react'
import { formatXof } from '@/lib/format'
import { authErrorMessage } from '@/features/auth/errors'

// Only publicly documented sandbox numbers are allowed in this demonstration.
// No real card data is accepted or sent to Laravel, a provider, or analytics.
type Brand = 'visa' | 'mastercard' | 'amex' | null
const TEST_NUMBERS: Record<string, Brand> = {
  '4242424242424242': 'visa',
  '5555555555554444': 'mastercard',
  '378282246310005': 'amex',
}
const LOGOS: Record<Exclude<Brand, null>, string> = {
  visa: '/payment-logos/visa.svg',
  mastercard: '/payment-logos/mastercard.svg',
  amex: '/payment-logos/american-express.svg',
}
const NAMES: Record<Exclude<Brand, null>, string> = {
  visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express',
}
export function detectCardBrand(raw: string): Brand {
  const digits = raw.replace(/\D/g, '')
  if (/^4/.test(digits)) return 'visa'
  const first2 = Number(digits.slice(0, 2))
  const first4 = Number(digits.slice(0, 4))
  if ((digits.length >= 2 && first2 >= 51 && first2 <= 55) || (digits.length >= 4 && first4 >= 2221 && first4 <= 2720)) return 'mastercard'
  if (digits.length >= 2 && (first2 === 34 || first2 === 37)) return 'amex'
  return null
}
export function validLuhn(input: string): boolean {
  const digits = input.replace(/\D/g, '')
  if (!/^\d{13,19}$/.test(digits)) return false
  let sum = 0
  for (let i = digits.length - 1, alternate = false; i >= 0; i--, alternate = !alternate) {
    let digit = Number(digits[i])
    if (alternate) { digit *= 2; if (digit > 9) digit -= 9 }
    sum += digit
  }
  return sum % 10 === 0
}
function expiryValid(value: string): boolean {
  if (!/^\d{2}\/\d{2}$/.test(value)) return false
  const [month, year] = value.split('/').map(Number)
  const now = new Date()
  const currentYear = now.getFullYear() % 100
  return month >= 1 && month <= 12 && (year > currentYear || (year === currentYear && month >= now.getMonth() + 1)) && year <= currentYear + 12
}
interface Props {
  amount: number
  onConfirmed: () => Promise<void>
  onChangeMethod: () => void
}
export function SimulatedCardPayment({ amount, onConfirmed, onChangeMethod }: Props) {
  const [number, setNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const digits = number.replace(/\D/g, '')
  const brand = detectCardBrand(digits)
  const cardMatchesTest = !!brand && TEST_NUMBERS[digits] === brand && validLuhn(digits)
  const valid = cardMatchesTest && expiryValid(expiry)
    && new RegExp(brand === 'amex' ? '^\\d{4}$' : '^\\d{3}$').test(cvv)
    && name.trim().length >= 2

  async function simulate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    try {
      // The request is exclusively the authenticated attempt ID handled by
      // PaymentCheckout. PAN, expiry, CVV and name stay in ephemeral browser state.
      await onConfirmed()
      setNumber('')
      setExpiry('')
      setCvv('')
      setName('')
      setDone(true)
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  if (done) return (
    <p role="status" className="flex items-center gap-2 rounded-xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-4 text-sm font-semibold">
      <CheckCircle2 size={19} aria-hidden /> Simulation approuvée — activation en cours.
    </p>
  )
  return (
    <form onSubmit={(event) => void simulate(event)} autoComplete="off" className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-[#183b35] via-[#0f6d4b] to-[#0c2723] p-5 text-white shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-white/80">CECT · carte de démonstration</span>
          {brand ? <img src={LOGOS[brand]} alt={NAMES[brand]} className="h-9 w-16 rounded-md bg-white p-1 object-contain" /> : <CreditCard size={30} aria-hidden />}
        </div>
        <div className="mt-9 font-mono text-lg tracking-[0.12em]">
          {digits ? `•••• •••• •••• ${digits.slice(-4)}` : '•••• •••• •••• ••••'}
        </div>
        <div className="mt-5 flex items-end justify-between gap-3">
          <div><p className="text-[10px] uppercase text-white/65">Titulaire fictif</p><p className="text-xs font-semibold uppercase">{name || 'NOM DE TEST'}</p></div>
          <div><p className="text-[10px] uppercase text-white/65">Expire</p><p className="text-xs font-semibold">{expiry || 'MM/AA'}</p></div>
        </div>
      </div>

      <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs font-medium text-[var(--color-text)]">
        <ShieldCheck size={15} className="mr-1 inline-block" aria-hidden />
        Mode test : utilisez uniquement les numéros de démonstration ci-dessous. Ne saisissez jamais votre vraie carte bancaire.
      </p>
      <div className="flex flex-wrap gap-2">
        {Object.entries(TEST_NUMBERS).map(([testNumber, testBrand]) => (
          <button key={testNumber} type="button" onClick={() => { setNumber(testNumber.replace(/(.{4})/g, '$1 ').trim()); setCvv(testBrand === 'amex' ? '1234' : '123'); setError(null) }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:border-emerald-500">
            {testBrand && <img src={LOGOS[testBrand]} alt="" className="h-5 w-7 object-contain" />}
            Carte {testBrand ? NAMES[testBrand] : 'test'}
          </button>
        ))}
      </div>
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Numéro de carte de test</span>
        <span className="relative block">
          <input type="text" inputMode="numeric" autoComplete="off" spellCheck={false} value={number}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, '').slice(0, 19)
              setNumber(d.replace(/(.{4})/g, '$1 ').trim())
              setError(null)
            }}
            placeholder="0000 0000 0000 0000" aria-label="Numéro de carte de test"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 pr-24 font-mono text-sm" />
          {brand && <img src={LOGOS[brand]} alt={NAMES[brand]} className="absolute right-3 top-1/2 h-8 w-16 -translate-y-1/2 rounded bg-white p-1 object-contain" />}
        </span>
        {!!digits && <span role="status" className="text-xs text-[var(--color-text-muted)]">
          {brand ? `Réseau reconnu automatiquement : ${NAMES[brand]}` : 'Réseau non identifié'}
          {validLuhn(digits) && !cardMatchesTest ? ' — carte réelle ou numéro non autorisé en simulation.' : ''}
        </span>}
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Nom du titulaire de test</span>
        <input type="text" autoComplete="off" value={name} onChange={(e) => setName(e.target.value.slice(0, 55))}
          placeholder="CLIENT DEMO" className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1.5"><span className="text-sm font-semibold">Expiration de test</span>
          <input type="text" inputMode="numeric" autoComplete="off" value={expiry}
            onChange={(e) => { const d = e.target.value.replace(/\D/g, '').slice(0,4); setExpiry(d.length > 2 ? `${d.slice(0,2)}/${d.slice(2)}` : d) }}
            placeholder="MM/AA" className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm" />
        </label>
        <label className="block space-y-1.5"><span className="text-sm font-semibold">CVV fictif</span>
          <input type="text" inputMode="numeric" autoComplete="off" value={cvv}
            onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0,4))}
            placeholder={brand === 'amex' ? '4 chiffres' : '3 chiffres'}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm" />
        </label>
      </div>
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <LockKeyhole size={15} aria-hidden /> Aucune donnée de carte n'est envoyée ou enregistrée. Aucun débit n'est effectué.
      </div>
      {error && <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p>}
      <button type="submit" disabled={!valid || busy}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <LockKeyhole size={17} aria-hidden />}
        {busy ? 'Validation simulée…' : `Simuler le paiement de ${formatXof(amount)}`}
      </button>
      <button type="button" onClick={onChangeMethod} className="w-full text-sm font-semibold text-[var(--color-text-muted)] underline-offset-2 hover:underline">
        Modifier le moyen de paiement
      </button>
    </form>
  )
}
