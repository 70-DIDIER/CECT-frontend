import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Panel } from '@/components/dashboard/Panel'
import { PageHeader } from '@/components/ui/PageHeader'
import { btnOutline } from '@/components/ui/buttons'
import { ApiError, get, post } from '@/lib/api'
import { formatDateMedium } from '@/lib/format'
import { authErrorMessage } from '@/features/auth/errors'
import { methodName } from '@/features/payments/types'
import { useMemberDashboard } from '@/data/useMemberDashboard'

interface PayoutDestination {
  method: string
  phone: string | null
  bank_name: string | null
  account_number: string | null
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-[var(--color-text)]">{value || '—'}</dd>
    </div>
  )
}

export default function ProfilePage() {
  const dashboard = useMemberDashboard()
  const profile = dashboard.data?.profile
  const [feedback, setFeedback] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const destination = useQuery({
    queryKey: ['payout-destination'],
    queryFn: async () => {
      try {
        return await get<PayoutDestination>('/me/payout-destination')
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 404) return null
        throw caught
      }
    },
    staleTime: 0,
  })

  async function revokeOthers() {
    setBusy(true)
    setFeedback(null)
    try {
      const result = await post<{ revoked: number }>('/me/sessions/revoke-others')
      setFeedback(result.revoked > 0 ? `${result.revoked} appareil(s) déconnecté(s).` : 'Aucun autre appareil n’était connecté.')
    } catch (caught) {
      setFeedback(authErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>Profil et sécurité — CECT Togo</title>
      </Helmet>

      <PageHeader title="Profil et sécurité" description="Vos informations, votre moyen de réception et vos connexions." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Identité">
          {profile ? (
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Nom" value={profile.name} />
              <Field label="Type de compte" value={profile.kind === 'legal' ? 'Personne morale' : 'Personne physique'} />
              <Field label="Pernum" value={profile.pernum} />
              <Field label="Numéro de membre" value={profile.member_number ?? ''} />
              <Field label="E-mail" value={profile.email} />
              <Field label="Téléphone" value={profile.phone} />
              <Field label="Ville" value={profile.city} />
              <Field label="Membre depuis" value={profile.member_since ? formatDateMedium(profile.member_since) : ''} />
            </dl>
          ) : (
            <div className="h-40 animate-pulse rounded-xl bg-[var(--chart-track)]" />
          )}
          <Link to="/espace/verification-identite" className={`${btnOutline} mt-4`}>Vérifier mon identité</Link>
        </Panel>

        <div className="space-y-6">
          <Panel title="Moyen de réception" subtitle="Où la CECT vous verse le produit de vos ventes de YEM">
            <p className="text-sm font-semibold text-[var(--color-text)]">
              {destination.data ? [methodName(destination.data.method), destination.data.method === 'BANK_TRANSFER' ? destination.data.bank_name : destination.data.phone].filter(Boolean).join(' · ') : 'Aucun moyen enregistré'}
            </p>
            <Link to="/espace/vendre" className={`${btnOutline} mt-4`}>
              {destination.data ? 'Modifier' : 'Renseigner'}
            </Link>
          </Panel>

          <Panel title="Connexions" subtitle="Vous êtes connecté sur cet appareil. Fermez les sessions ouvertes ailleurs si vous avez un doute.">
            <button type="button" onClick={() => void revokeOthers()} disabled={busy} className={btnOutline}>
              Déconnecter les autres appareils
            </button>
            {feedback && (
              <p role="status" className="mt-3 text-sm text-[var(--color-text-muted)]">
                {feedback}
              </p>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}
