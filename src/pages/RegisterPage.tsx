import { useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatXof } from '@/lib/format'
import { CountrySelect } from '@/components/ui/CountrySelect'
import { DEFAULT_COUNTRY, findCountry, toInternationalPhone } from '@/lib/countries'
import type { CountryCode } from 'libphonenumber-js/min'
import { homeFor, useAuth } from '@/app/AuthContext'
import { ApiError, newIdempotencyKey, post } from '@/lib/api'
import { CodeForm } from '@/features/auth/CodeForm'
import { usePublicConfig } from '@/features/config/usePublicConfig'
import { authErrorMessage, fieldErrors } from '@/features/auth/errors'

const API_FIELDS: Record<string, keyof FormData> = {
  first_name: 'firstName',
  last_name: 'lastName',
  email: 'email',
  phone: 'phone',
  pernum: 'pernum',
  password: 'password',
  legal_name: 'companyName',
  legal_form: 'legalStatus',
  rccm: 'rccm',
  nif: 'nif',
  signed_place: 'location',
  signed_on: 'date',
}

const schema = z.object({
  personType: z.enum(['physical', 'legal']),
  companyName: z.string().optional(),
  legalStatus: z.string().optional(),
  rccm: z.string().optional(),
  nif: z.string().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  pernum: z.string().trim().regex(/^\d{10}$/, { message: 'invalid_pernum' }),
  country: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email({ message: 'invalid_email' }),
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
  commitment: z.literal(true, { errorMap: () => ({ message: 'required' }) }),
  location: z.string().min(1),
  date: z.string().min(1),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'mismatch',
  path: ['confirmPassword'],
}).refine((d) => d.personType !== 'legal' || Boolean(d.companyName?.trim()), {
  message: 'required',
  path: ['companyName'],
}).refine((d) => toInternationalPhone(d.country as CountryCode, d.phone) !== null, {
  message: 'phone_invalid',
  path: ['phone'],
})

type FormData = z.infer<typeof schema>

const STEP_FIELDS: (keyof FormData)[][] = [
  ['personType', 'firstName', 'lastName', 'pernum', 'country', 'phone', 'email', 'password', 'confirmPassword'],
  ['commitment'],
  ['location', 'date'],
]

const STEPS = ['step1', 'step3', 'step4'] as const

export default function RegisterPage() {
  const { t } = useTranslation()
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const publicFees = usePublicConfig().data?.membership_fees
  const legalForms = usePublicConfig().data?.legal_forms ?? ['SARL', 'SA', 'SAS', 'SASU', 'EURL', 'GIE', 'Association', 'Coopérative', 'Auto-entrepreneur', 'Autre']
  const { user, verifyEmail, resendOtp } = useAuth()
  const [verification, setVerification] = useState<{ challengeId: string; sentTo: string } | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const idempotencyKey = useRef<string | null>(null)
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)

  const { register, handleSubmit, watch, control, setError, getValues, formState: { errors, isSubmitting }, trigger } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { personType: 'physical', country: DEFAULT_COUNTRY, location: 'Lomé', date: new Date().toISOString().slice(0, 10) },
  })

  const personType = watch('personType')
  const country = findCountry(watch('country'))

  /** Vérifie dès la première étape que l'e-mail et le Pernum ne sont pas déjà pris, au lieu de l'apprendre à l'envoi final. */
  const identifiersAvailable = async (): Promise<boolean> => {
    setSubmitError(null)
    try {
      await post('/auth/register/check', { email: getValues('email').trim(), pernum: getValues('pernum').trim() })
      return true
    } catch (caught) {
      const serverFields = fieldErrors(caught)
      let known = false
      for (const [apiField, message] of Object.entries(serverFields)) {
        const field = API_FIELDS[apiField]
        if (!field) continue
        known = true
        setError(field, { message })
      }
      if (!known) setSubmitError(authErrorMessage(caught))
      return false
    }
  }

  const next = async () => {
    const valid = await trigger(STEP_FIELDS[step])
    if (!valid) return
    if (step === 0 && !(await identifiersAvailable())) return
    setStep((s) => s + 1)
  }

  const onSubmit = async (data: FormData) => {
    setSubmitError(null)
    // Même clé tant que l'envoi précédent n'a pas abouti à cause du réseau ; sinon une nouvelle par tentative.
    idempotencyKey.current ??= newIdempotencyKey()
    const legal = data.personType === 'legal'
    try {
      const result = await post<{ verification: { challenge_id: string; sent_to: string } }>(
        '/auth/register',
        {
          person_type: legal ? 'legal' : 'natural',
          first_name: data.firstName.trim(),
          last_name: data.lastName.trim(),
          email: data.email.trim(),
          phone: toInternationalPhone(data.country as CountryCode, data.phone),
          pernum: data.pernum.trim(),
          password: data.password,
          password_confirmation: data.confirmPassword,
          city: data.location.trim(),
          commitment_accepted: true,
          signed_place: data.location.trim(),
          signed_on: `${data.date}T00:00:00Z`,
          ...(legal ? { legal_name: data.companyName?.trim(), legal_form: data.legalStatus || legalForms[0], rccm: data.rccm?.trim() || null, nif: data.nif?.trim() || null } : {}),
        },
        idempotencyKey.current
      )
      idempotencyKey.current = null
      setVerification({ challengeId: result.verification.challenge_id, sentTo: result.verification.sent_to })
    } catch (caught) {
      if (!(caught instanceof ApiError) || caught.code !== 'NETWORK_ERROR') idempotencyKey.current = null
      const serverFields = fieldErrors(caught)
      let firstStep: number | null = null
      for (const [apiField, message] of Object.entries(serverFields)) {
        const field = API_FIELDS[apiField]
        if (!field) continue
        setError(field, { message })
        const stepOfField = STEP_FIELDS.findIndex((fields) => fields.includes(field))
        if (stepOfField >= 0 && (firstStep === null || stepOfField < firstStep)) firstStep = stepOfField
      }
      if (firstStep !== null) setStep(firstStep)
      setSubmitError(Object.keys(serverFields).length > 0 ? Object.values(serverFields).join(' ') : authErrorMessage(caught))
    }
  }

  const inputClass =
    'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-shadow'

  if (user && !verification) return <Navigate to={homeFor(user)} replace />

  if (verification) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <h1 className="mb-2 text-center text-2xl font-bold text-[var(--color-text)]">Vérifiez votre adresse e-mail</h1>
          <p className="mb-6 text-center text-sm text-[var(--color-text-muted)]">Dernière étape avant le paiement de votre adhésion.</p>
          <CodeForm
            sentTo={verification.sentTo}
            onVerify={async (code) => {
              const { redirectTo } = await verifyEmail(verification.challengeId, code)
              navigate(redirectTo)
            }}
            onResend={async () => {
              const next = await resendOtp(verification.challengeId)
              setVerification({ challengeId: next.challengeId, sentTo: next.sentTo })
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <>
      <Helmet><title>{t('auth.register.title')} — CECT Togo</title></Helmet>
      <div className="min-h-[80vh] flex items-start justify-center px-3 sm:px-4 py-8 sm:py-12">
        <div className="w-full max-w-lg">
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)] text-center mb-5 sm:mb-6">
            {t('auth.register.title')}
          </h1>

          {/* Progress */}
          <div className="flex gap-2 mb-6 sm:mb-8">
            {STEPS.map((s, i) => (
              <div key={s} className="flex-1 flex flex-col items-center gap-1">
                <div className={`h-2 w-full rounded-full transition-colors ${i <= step ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'}`} />
                <span className="text-xs text-[var(--color-text-muted)] hidden sm:block">{t(`auth.register.${s}`)}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="p-4 sm:p-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm space-y-4">

              {/* ─── Step 1: Identification ─── */}
              {step === 0 && (
                <>
                  {/* Person type */}
                  <div>
                    <label htmlFor="person-type" className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                      {t('auth.register.personType')} *
                    </label>
                    <select id="person-type" {...register('personType')} className={inputClass}>
                      {(['physical', 'legal'] as const).map((type) => (
                        <option key={type} value={type}>
                          {t(`auth.register.${type}`)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-2xl border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/5 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Frais d'adhésion à la coopérative</div>
                    <div className="mt-1 text-xl font-extrabold text-[var(--color-primary)]" aria-live="polite">
                      {publicFees ? formatXof(personType === 'legal' ? publicFees.legal_person : publicFees.natural_person) : 'Chargement du tarif…'}
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      Tarif défini par le Superadmin. Aucun règlement ici : paiement simulé après vérification de l'e-mail.
                    </p>
                  </div>

                  {personType === 'legal' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t('auth.register.companyName')} *</label>
                        <input {...register('companyName')} className={inputClass} />
                        {errors.companyName && <p className="mt-1 text-xs text-[var(--color-danger)]">{t('common.required')}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t('auth.register.legalStatus')} *</label>
                        <select {...register('legalStatus')} className={inputClass}>
                          {legalForms.map((form) => <option key={form} value={form}>{form}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">RCCM</label>
                          <input {...register('rccm')} className={inputClass} />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">NIF</label>
                          <input {...register('nif')} className={inputClass} />
                        </div>
                      </div>
                    </>
                  )}

                  {/* First name */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t(personType === 'legal' ? 'auth.register.managerFirstName' : 'auth.register.firstName')}</label>
                    <input {...register('firstName')} className={inputClass} placeholder="Jean" />
                    {errors.firstName && <p className="mt-1 text-xs text-[var(--color-danger)]">{t('common.required')}</p>}
                  </div>

                  {/* Last name */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t(personType === 'legal' ? 'auth.register.managerLastName' : 'auth.register.lastName')}</label>
                    <input {...register('lastName')} className={inputClass} placeholder="Dupont" />
                    {errors.lastName && <p className="mt-1 text-xs text-[var(--color-danger)]">{t('common.required')}</p>}
                  </div>

                  {/* Member number */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t('auth.register.pernum')}</label>
                    <input {...register('pernum')} className={inputClass} placeholder="1234567890" inputMode="numeric" maxLength={10} />
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t('auth.register.pernumHint')}</p>
                    {errors.pernum && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.pernum.message === 'invalid_pernum' ? t('auth.register.pernumInvalid') : errors.pernum.message}</p>}
                  </div>

                  {/* Phone — country code + 10-digit number */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t('auth.register.phone')} *</label>
                    <div className="flex">
                      <Controller
                        control={control}
                        name="country"
                        render={({ field }) => <CountrySelect value={field.value} onChange={field.onChange} className="w-[8.5rem] shrink-0" />}
                      />
                      <input
                        {...register('phone')}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel-national"
                        maxLength={20}
                        aria-label={t('auth.register.phone')}
                        className="min-w-0 flex-1 rounded-r-xl rounded-l-none border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-shadow"
                        placeholder={country?.iso === 'TG' ? '90 12 34 56' : 'Numéro de téléphone'}
                      />
                    </div>
                    {errors.phone && (
                      <p className="mt-1 text-xs text-[var(--color-danger)]">
                        {`Numéro invalide pour ${country?.name ?? 'ce pays'}.`}
                      </p>
                    )}
                  </div>

                  {/* Email (required — OTP verification) */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t('auth.register.email')} *</label>
                    <input {...register('email')} type="email" className={inputClass} placeholder="exemple@email.com" />
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t('auth.register.emailHint')}</p>
                    {errors.email && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.email.message === 'invalid_email' ? t('common.emailInvalid', 'Adresse e-mail invalide') : errors.email.message}</p>}
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t('auth.register.password')} *</label>
                    <div className="relative">
                      <input
                        {...register('password')}
                        type={showPwd ? 'text' : 'password'}
                        className={`${inputClass} pr-11`}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                        aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                        tabIndex={-1}
                      >
                        {showPwd ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                      </button>
                    </div>
                    {errors.password && <p className="mt-1 text-xs text-[var(--color-danger)]">{t('common.passwordMin')}</p>}
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t('auth.register.confirmPassword')} *</label>
                    <div className="relative">
                      <input
                        {...register('confirmPassword')}
                        type={showConfirmPwd ? 'text' : 'password'}
                        className={`${inputClass} pr-11`}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPwd((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                        aria-label={showConfirmPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                        tabIndex={-1}
                      >
                        {showConfirmPwd ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="mt-1 text-xs text-[var(--color-danger)]">
                        {errors.confirmPassword.message === 'mismatch'
                          ? t('common.passwordMatch')
                          : t('common.passwordMin')}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* ─── Step 2: Commitment ─── */}
              {step === 1 && (
                <div>
                  <p className="text-sm text-[var(--color-text-muted)] mb-4 leading-relaxed">
                    {t('auth.register.commitment')}
                  </p>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      {...register('commitment')}
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
                    />
                    <span className="text-sm text-[var(--color-text)]">{t('auth.register.commitment')}</span>
                  </label>
                  {errors.commitment && <p className="mt-2 text-xs text-[var(--color-danger)]">{t('common.required')}</p>}
                </div>
              )}

              {/* ─── Step 3: Location + date ─── */}
              {step === 2 && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t('auth.register.location')} *</label>
                    <input {...register('location')} className={inputClass} placeholder="Lomé" />
                    {errors.location && <p className="mt-1 text-xs text-[var(--color-danger)]">{t('common.required')}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{t('auth.register.date')} *</label>
                    <input {...register('date')} type="date" className={inputClass} />
                    {errors.date && <p className="mt-1 text-xs text-[var(--color-danger)]">{t('common.required')}</p>}
                  </div>
                </>
              )}
            </div>

            {submitError && (
              <p role="alert" className="mt-4 rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-3 py-2 text-sm text-[var(--color-danger)]">
                {submitError}
              </p>
            )}

            <div className="flex gap-3 mt-4">
              {step > 0 && (
                <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
                  {t('auth.register.back')}
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button type="button" className="flex-1" onClick={next}>
                  {t('auth.register.next')}
                </Button>
              ) : (
                <Button type="submit" className="flex-1" disabled={isSubmitting}>
                  {t('auth.register.submit')}
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
