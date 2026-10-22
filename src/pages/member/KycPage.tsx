import { useEffect, useState, type FormEvent } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileCheck2, ShieldCheck, UploadCloud, ScanFace, Video } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { ensureCsrfCookie, get, http, post, toApiError } from '@/lib/api'
import { Panel } from '@/components/dashboard/Panel'
import { PageHeader } from '@/components/ui/PageHeader'

interface CaseState {
  account_status: string
  provider: 'manual' | 'didit'
  provider_environment?: 'sandbox' | 'live' | null
  kyc: {
    id: string
    status: 'provider_pending' | 'submitted' | 'approved' | 'rejected' | 'needs_information'
    submitted_at: string
    reviewed_at: string | null
    provider_status?: string | null
    can_resume?: boolean
    review_reason: string | null
  } | null
}

export default function KycPage() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [type, setType] = useState('national_id')
  const [number, setNumber] = useState('')
  const [country, setCountry] = useState('TG')
  const [birthday, setBirthday] = useState('')
  const [address, setAddress] = useState('')
  const [front, setFront] = useState<File | null>(null)
  const [back, setBack] = useState<File | null>(null)
  const [company, setCompany] = useState<File | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [diditAccepted, setDiditAccepted] = useState(false)
  const [diditBusy, setDiditBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isCompany = user?.personType === 'legal'

  const query = useQuery({
    queryKey: ['member-kyc'],
    queryFn: () => get<CaseState>('/me/kyc'),
    refetchInterval: 12000,
  })
  const state = query.data
  const status = state?.kyc?.status

  useEffect(() => {
    if (status !== 'approved') return
    void refresh().then((next) => {
      if (next?.status === 'pending_payment') navigate('/espace/adhesion', { replace: true })
    })
  }, [status, user?.status, refresh, navigate])

  const send = useMutation({
    mutationFn: async () => {
      if (!front || (type !== 'passport' && !back) || (isCompany && !company) || !accepted) {
        throw new Error('Veuillez compléter les pièces et accepter la notice.')
      }
      const form = new FormData()
      form.append('document_type', type)
      form.append('document_number', number)
      form.append('document_country', country.trim().toUpperCase())
      form.append('date_of_birth', birthday)
      form.append('address', address)
      form.append('privacy_notice_accepted', '1')
      form.append('document_front', front)
      if (back) form.append('document_back', back)
      if (company) form.append('company_document', company)
      await ensureCsrfCookie()
      await http.post('/me/kyc', form)
    },
    onSuccess: async () => {
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['member-kyc'] })
    },
    onError: (err: unknown) => setError(toApiError(err).message),
  })

  async function startDidit() {
    if (!diditAccepted) { setError('Acceptez la notice de confidentialité pour continuer.'); return }
    setError(null)
    setDiditBusy(true)
    try {
      const result = await post<{ url: string; status: string }>('/me/kyc/didit/start', {
        privacy_notice_accepted: true,
      })
      // The backend allow-lists Didit's official hosted verification domain.
      window.location.assign(result.url)
    } catch (err) {
      setError(toApiError(err).message)
      setDiditBusy(false)
    }
  }

  async function checkDidit() {
    setDiditBusy(true)
    setError(null)
    try {
      await post('/me/kyc/didit/refresh', {})
      await queryClient.invalidateQueries({ queryKey: ['member-kyc'] })
      await refresh()
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setDiditBusy(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    send.mutate()
  }

  const field = 'min-h-[44px] w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm'
  const label = 'block mb-1.5 text-sm font-semibold text-[var(--color-text)]'
  const fileField = (id: string, title: string, setter: (file: File | null) => void) => (
    <div>
      <label className={label} htmlFor={id}>{title}</label>
      <input id={id} required={id === 'front' || (id === 'back' && type !== 'passport') || (id === 'company' && isCompany)}
        className={field} type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
        onChange={(e) => setter(e.target.files?.[0] ?? null)} />
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">JPG, PNG ou PDF — 2 Mo maximum par fichier.</p>
    </div>
  )

  return (
    <>
      <Helmet><title>Vérification d’identité — CECT</title></Helmet>
      <div className="max-w-2xl space-y-5">
        <PageHeader title="Vérification d'identité (KYC)"
          description="Après la confirmation de votre e-mail, vérifiez votre identité avant de régler vos frais d’adhésion." />
        <Panel title="Étape obligatoire avant l'adhésion">
          <div className="flex items-start gap-3 text-sm text-[var(--color-text-muted)]">
            <ShieldCheck className="shrink-0 text-[var(--color-primary)]" size={24} />
            <p>Vos justificatifs sont conservés en espace privé et accessibles uniquement aux agents habilités.
              Aucun paiement n'est autorisé avant approbation de votre identité.</p>
          </div>
        </Panel>

        {state?.provider === 'didit' && (user?.status === 'pending_kyc' || user?.status === 'pending_payment') && status !== 'approved' && (
          <Panel title={isCompany ? "Vérification de votre entreprise (KYB) avec Didit" : "Contrôle biométrique officiel avec Didit"}>
            <div className="space-y-4 text-sm">
              {state?.provider_environment === 'sandbox' && (
                <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
                  <strong className="block mb-1">Mode test — vérification non officielle</strong>
                  Didit est actuellement connecté en Sandbox. Ne transmettez pas de véritables
                  documents d'identité ni de données biométriques pour cet essai.
                  Un résultat simulé ne valide pas une identité et ne permet ni de payer
                  l'adhésion ni d'accéder aux opérations YEM.
                </div>
              )}
              <div className="flex gap-3 items-start">
                <ScanFace className="shrink-0 text-[var(--color-primary)]" size={24} />
                <p>{isCompany
                  ? "Didit vous guidera dans la vérification du registre de votre société, de ses documents officiels et de ses bénéficiaires effectifs. Les dirigeants concernés effectueront leur propre contrôle d'identité."
                  : "Didit vous guidera pour scanner votre pièce officielle, prendre un selfie en direct, réaliser une vérification vidéo de présence (liveness actif) et comparer votre visage à la photo du document. Votre caméra s'ouvre uniquement pendant la vérification sécurisée."}</p>
              </div>
              <div className="flex gap-3 items-start">
                <Video className="shrink-0 text-[var(--color-primary)]" size={24} />
                <p>Préparez votre document, choisissez un endroit éclairé et autorisez l'accès à la caméra
                  sur la page Didit. En cas de doute, un Validateur CECT examine les résultats.</p>
              </div>
              <label className="flex items-start gap-3">
                <input type="checkbox" className="mt-1" checked={diditAccepted}
                  onChange={e => setDiditAccepted(e.target.checked)} />
                <span>J'ai lu la notice KYC. J'accepte de lancer le contrôle documentaire et biométrique
                  chez Didit, prestataire tiers de CECT, et comprends que des données d'identité et de visage
                  seront traitées selon la notice de confidentialité.</span>
              </label>
              <button type="button" onClick={() => void startDidit()}
                disabled={!diditAccepted || diditBusy}
                className="min-h-11 w-full rounded-xl bg-[var(--color-primary)] px-4 py-3 font-bold text-white disabled:opacity-50">
                {diditBusy ? 'Connexion à Didit…' : status === 'provider_pending' ? 'Reprendre la vérification Didit' : 'Commencer la vérification Didit'}
              </button>
              {!!state.kyc && <button type="button" onClick={() => void checkDidit()} disabled={diditBusy}
                className="min-h-11 w-full rounded-xl border border-[var(--color-border)] px-4 py-3 font-semibold disabled:opacity-50">
                Vérifier le résultat de mon contrôle
              </button>}
              {error && <p role="alert" className="text-[var(--color-danger)]">{error}</p>}
              {status === 'provider_pending' && <p>Vérification en cours ou non terminée. Vous ne pouvez pas payer pour le moment.</p>}
            </div>
          </Panel>
        )}

        {query.isPending && <p role="status">Chargement de votre dossier…</p>}
        {query.isError && <p role="alert">Impossible de consulter le dossier KYC. Actualisez la page.</p>}

        {status === 'submitted' && <Panel title="Dossier en vérification">
          <p className="flex items-center gap-2 text-sm"><FileCheck2 size={20} /> Votre dossier a été reçu. Un Validateur va vérifier vos informations et vos justificatifs.</p>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">Vous pourrez payer les droits d'adhésion après approbation. Cette page se met à jour automatiquement.</p>
        </Panel>}

        {status === 'approved' && <Panel title="Identité validée">
          <p className="text-sm">Votre dossier a été approuvé. Ouverture de la page de paiement…</p>
        </Panel>}

        {(status === 'rejected' || status === 'needs_information') && (
          <p className="rounded-xl border border-[var(--color-border)] p-4 text-sm" role="alert">
            {status === 'rejected' ? 'Votre dossier n’a pas été approuvé.' : 'Des pièces complémentaires ou corrigées sont nécessaires.'}
            {state?.kyc?.review_reason && <strong className="block mt-2">Motif : {state.kyc.review_reason}</strong>}
            Vous pouvez transmettre un dossier corrigé.
          </p>
        )}

        {state?.provider !== 'didit' && !query.isPending && (!status || status === 'rejected' || status === 'needs_information') && (
          <Panel title={status ? 'Corriger le dossier KYC' : 'Soumettre vos justificatifs'}>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label htmlFor="id-type" className={label}>Pièce d'identité</label>
                <select id="id-type" value={type} onChange={e => setType(e.target.value)} className={field}>
                  <option value="national_id">Carte nationale d'identité</option>
                  <option value="passport">Passeport</option>
                  <option value="residence_permit">Carte de séjour</option>
                </select>
              </div>
              <div>
                <label htmlFor="id-number" className={label}>Numéro de la pièce</label>
                <input id="id-number" className={field} required minLength={4} maxLength={60}
                  autoComplete="off" value={number} onChange={e => setNumber(e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="id-country" className={label}>Pays émetteur (code ISO à 2 lettres)</label>
                  <input id="id-country" className={field} required maxLength={2} minLength={2} value={country}
                    onChange={e => setCountry(e.target.value.toUpperCase())} placeholder="TG" />
                </div>
                <div>
                  <label htmlFor="birthdate" className={label}>Date de naissance du titulaire</label>
                  <input id="birthdate" className={field} required type="date" max={new Date().toISOString().slice(0, 10)}
                    value={birthday} onChange={e => setBirthday(e.target.value)} />
                </div>
              </div>
              <div>
                <label htmlFor="address" className={label}>Adresse de résidence</label>
                <textarea id="address" className={field} required minLength={8} maxLength={300} rows={3}
                  value={address} onChange={e => setAddress(e.target.value)} />
              </div>
              {fileField('front', type === 'passport' ? 'Page d’identité du passeport' : 'Recto de la pièce', setFront)}
              {type !== 'passport' && fileField('back', 'Verso de la pièce', setBack)}
              {isCompany && fileField('company', 'Pièce juridique de la société (RCCM ou document officiel)', setCompany)}
              <label className="flex gap-3 items-start text-sm text-[var(--color-text)]">
                <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} required className="mt-1" />
                <span>J'ai pris connaissance de l'usage de mes données pour vérifier mon identité et instruire mon adhésion. Les pièces seront consultées uniquement par des agents habilités.</span>
              </label>
              {error && <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p>}
              <button type="submit" disabled={send.isPending || !accepted} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 text-sm font-bold text-white disabled:opacity-50">
                <UploadCloud size={18} /> {send.isPending ? 'Envoi en cours…' : 'Soumettre le dossier KYC'}
              </button>
            </form>
          </Panel>
        )}
      </div>
    </>
  )
}
