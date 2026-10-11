import { useState, type FormEvent } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ApiError, post } from '@/lib/api'
import { authErrorMessage } from '@/features/auth/errors'

interface ActivationForm {
  email: string
  code: string
  password: string
  passwordConfirmation: string
}

export default function StaffActivationPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<ActivationForm>({ email: '', code: '', password: '', passwordConfirmation: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const inputClass = 'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]'

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!/^\d{6}$/.test(form.code)) {
      setError('Le code doit contenir exactement 6 chiffres.')
      return
    }
    if (form.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (form.password !== form.passwordConfirmation) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setBusy(true)
    try {
      await post('/auth/staff/activate', {
        email: form.email.trim(),
        code: form.code,
        password: form.password,
        password_confirmation: form.passwordConfirmation,
      })
      setDone(true)
    } catch (caught) {
      setError(caught instanceof ApiError ? authErrorMessage(caught) : 'Activation impossible pour le moment.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <>
        <Helmet><title>Compte activé — CECT Togo</title></Helmet>
        <div className="flex min-h-[75vh] items-center justify-center px-4 py-10">
          <div className="w-full max-w-md rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7 text-center shadow-sm">
            <CheckCircle2 className="mx-auto text-[var(--color-success)]" size={42} aria-hidden />
            <h1 className="mt-4 text-2xl font-extrabold text-[var(--color-text)]">Compte interne activé</h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
              Votre mot de passe est enregistré. À chaque connexion interne, un OTP e-mail reste obligatoire.
            </p>
            <Button className="mt-6 w-full" size="lg" onClick={() => navigate('/connexion')}>
              Aller à la connexion
            </Button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Helmet><title>Activation du compte interne — CECT Togo</title></Helmet>
      <div className="flex min-h-[80vh] items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10">
              <ShieldCheck size={27} className="text-[var(--color-primary)]" aria-hidden />
            </div>
            <h1 className="text-2xl font-extrabold text-[var(--color-text)]">Activer un compte interne</h1>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Utilisez le code reçu par e-mail lors de la création du compte.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
            <div>
              <label htmlFor="staff-activation-email" className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Adresse e-mail</label>
              <input
                id="staff-activation-email"
                type="email"
                autoComplete="username"
                required
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="staff-activation-code" className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Code d’activation</label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" aria-hidden />
                <input
                  id="staff-activation-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  value={form.code}
                  onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  className={inputClass + ' pl-10 tracking-[0.25em]'}
                  placeholder="000000"
                />
              </div>
            </div>

            <div>
              <label htmlFor="staff-activation-password" className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Nouveau mot de passe</label>
              <div className="relative">
                <input
                  id="staff-activation-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  className={inputClass + ' pr-11'}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
                </button>
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">Majuscules, minuscules et chiffres requis.</p>
            </div>

            <div>
              <label htmlFor="staff-activation-password-confirmation" className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Confirmer le mot de passe</label>
              <input
                id="staff-activation-password-confirmation"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={form.passwordConfirmation}
                onChange={(event) => setForm((current) => ({ ...current, passwordConfirmation: event.target.value }))}
                className={inputClass}
              />
            </div>

            {error && <p role="alert" className="rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}

            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy ? 'Activation…' : 'Activer mon compte'}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-[var(--color-text-muted)]">
            Déjà activé ? <Link className="font-semibold text-[var(--color-primary)] hover:underline" to="/connexion">Se connecter</Link>
          </p>
        </div>
      </div>
    </>
  )
}
