import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { KeyRound, Lock, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { homeFor, useAuth, type OtpChallenge } from '@/app/AuthContext'
import { ApiError } from '@/lib/api'
import { CodeForm } from '@/features/auth/CodeForm'
import { authErrorMessage } from '@/features/auth/errors'

function OtpStep({ challenge, onBack, purpose }: { challenge: OtpChallenge; onBack: () => void; purpose: 'login' | 'email' }) {
  const navigate = useNavigate()
  const { verifyOtp, verifyEmail, resendOtp } = useAuth()
  const [current, setCurrent] = useState(challenge)

  return (
    <CodeForm
      sentTo={current.sentTo}
      onVerify={async (code) => {
        const { redirectTo } = await (purpose === 'email' ? verifyEmail : verifyOtp)(current.challengeId, code)
        navigate(redirectTo)
      }}
      onResend={async () => setCurrent(await resendOtp(current.challengeId))}
      onBack={onBack}
      backLabel="Changer de compte"
    />
  )
}

const schema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, login } = useAuth()
  const [showPwd, setShowPwd] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null)
  const [purpose, setPurpose] = useState<'login' | 'email'>('login')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const inputClass =
    'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-shadow'

  const onSubmit = async (data: FormData) => {
    setAuthError(null)
    try {
      const result = await login(data.identifier.trim(), data.password)
      if (result.status === 'otp_required') {
        setChallenge(result)
        return
      }
      navigate(result.redirectTo)
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'EMAIL_NOT_VERIFIED' && typeof caught.details.challenge_id === 'string') {
        setPurpose('email')
        setChallenge({ challengeId: caught.details.challenge_id, sentTo: 'votre adresse e-mail', expiresAt: '' })
        return
      }
      setAuthError(authErrorMessage(caught))
    }
  }

  if (user && !challenge) return <Navigate to={homeFor(user)} replace />

  return (
    <>
      <Helmet>
        <title>{t('auth.login.title')} — CECT Togo</title>
      </Helmet>
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">

          {/* Login card */}
          <div className="text-center mb-6">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 mb-3">
              <KeyRound size={26} className="text-[var(--color-primary)]" aria-hidden />
            </div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">{t('auth.login.title')}</h1>
          </div>

          {challenge ? (
            <OtpStep challenge={challenge} purpose={purpose} onBack={() => { setChallenge(null); setPurpose('login') }} />
          ) : (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4 p-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm"
          >
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                {t('auth.login.pernum')}
              </label>
              <input
                {...register('identifier')}
                className={inputClass}
                placeholder="Pernum ou e-mail"
                autoComplete="username"
              />
              {errors.identifier && <p className="mt-1 text-xs text-[var(--color-danger)]">{t('common.required')}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-[var(--color-text)]">{t('auth.login.password')}</label>
                <Link to="/mot-de-passe-oublie" className="text-xs text-[var(--color-primary)] hover:underline">
                  {t('auth.login.forgot')}
                </Link>
              </div>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPwd ? 'text' : 'password'}
                  className={`${inputClass} pr-11`}
                  placeholder="••••••••"
                  autoComplete="current-password"
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
              {errors.password && <p className="mt-1 text-xs text-[var(--color-danger)]">{t('common.required')}</p>}
            </div>

            {authError && (
              <p role="alert" className="text-sm text-center text-[var(--color-danger)] bg-[var(--color-danger)]/5 border border-[var(--color-danger)]/20 rounded-xl px-3 py-2">
                {authError}
              </p>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              <Lock size={16} aria-hidden />
              {t('auth.login.submit')}
            </Button>
          </form>
          )}

          <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
            {t('auth.login.noAccount')}{' '}
            <Link to="/inscription" className="text-[var(--color-primary)] font-medium hover:underline">
              {t('auth.login.register')}
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}
