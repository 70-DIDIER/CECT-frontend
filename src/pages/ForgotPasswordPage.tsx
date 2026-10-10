import { useState, type FormEvent } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ApiError, post } from '@/lib/api'
import { authErrorMessage, fieldErrors } from '@/features/auth/errors'

const schema = z.object({
  pernum: z.string().min(1),
  email: z.string().email(),
})
type FormData = z.infer<typeof schema>

const inputClass =
  'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-shadow'

function ResetStep({ email }: { email: string }) {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (password !== confirmation) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    setBusy(true)
    try {
      await post('/auth/password/reset', { email, code: code.trim(), password, password_confirmation: confirmation })
      navigate('/connexion', { replace: true })
    } catch (caught) {
      const fields = fieldErrors(caught)
      setError(Object.values(fields)[0] ?? authErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
      <p className="text-sm text-[var(--color-text-muted)]">
        Si un compte correspond à <strong className="text-[var(--color-text)]">{email}</strong>, un code à 6 chiffres vient d’y être envoyé. Saisissez-le avec votre nouveau mot de passe.
      </p>
      <div>
        <label htmlFor="reset-code" className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">
          Code reçu par e-mail
        </label>
        <input id="reset-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required className={inputClass} />
      </div>
      <div>
        <label htmlFor="reset-password" className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">
          Nouveau mot de passe
        </label>
        <input id="reset-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} className={inputClass} />
      </div>
      <div>
        <label htmlFor="reset-confirmation" className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">
          Confirmer le mot de passe
        </label>
        <input id="reset-confirmation" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={8} className={inputClass} />
      </div>
      {error && (
        <p role="alert" className="rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-3 py-2 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" size="lg" disabled={busy || code.length !== 6}>
        Changer le mot de passe
      </Button>
    </form>
  )
}

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [requestedFor, setRequestedFor] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    setRequestError(null)
    try {
      await post('/auth/password/forgot', { email: data.email.trim(), pernum: data.pernum.trim() })
      setRequestedFor(data.email.trim())
    } catch (caught) {
      setRequestError(caught instanceof ApiError && caught.code === 'VALIDATION_FAILED' ? 'Vérifiez les informations saisies.' : authErrorMessage(caught))
    }
  }

  return (
    <>
      <Helmet>
        <title>{t('auth.forgotPassword.title')} — CECT Togo</title>
      </Helmet>
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10">
              <KeyRound size={28} className="text-[var(--color-primary)]" aria-hidden />
            </div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">{t('auth.forgotPassword.title')}</h1>
          </div>

          {requestedFor ? (
            <ResetStep email={requestedFor} />
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">{t('auth.forgotPassword.pernum')}</label>
                <input {...register('pernum')} className={inputClass} placeholder="CECT123" />
                {errors.pernum && <p className="mt-1 text-xs text-[var(--color-danger)]">{t('common.required')}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">{t('auth.forgotPassword.email')}</label>
                <input {...register('email')} type="email" className={inputClass} placeholder="exemple@email.com" />
                {errors.email && <p className="mt-1 text-xs text-[var(--color-danger)]">{t('common.invalidEmail')}</p>}
              </div>
              {requestError && (
                <p role="alert" className="text-sm text-[var(--color-danger)]">
                  {requestError}
                </p>
              )}
              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {t('auth.forgotPassword.submit')}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm">
            <Link to="/connexion" className="text-[var(--color-primary)] hover:underline">
              {t('auth.forgotPassword.backToLogin')}
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}
