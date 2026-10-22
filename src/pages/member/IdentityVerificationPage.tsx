import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { Camera, CheckCircle2, Clock3, ShieldCheck } from 'lucide-react'
import { Panel } from '@/components/dashboard/Panel'
import { PageHeader } from '@/components/ui/PageHeader'
import { get, post } from '@/lib/api'
import { authErrorMessage } from '@/features/auth/errors'

interface DocumentType { value: string; label: string; requires_back_side: boolean }
interface Verification {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  document_label: string
  rejection_reason: string | null
  submitted_at: string
}
interface VerificationStatus {
  status: 'not_submitted' | 'pending' | 'approved' | 'rejected'
  identity_verified_at: string | null
  document_types: DocumentType[]
  latest: Verification | null
}

const stateLabels: Record<VerificationStatus['status'], string> = {
  not_submitted: 'Dossier à constituer',
  pending: 'En cours de vérification',
  approved: 'Identité vérifiée',
  rejected: 'Documents à corriger',
}

export default function IdentityVerificationPage() {
  const query = useQuery({ queryKey: ['identity-verification'], queryFn: () => get<VerificationStatus>('/me/identity-verification'), staleTime: 0 })
  const [documentType, setDocumentType] = useState('')
  const [number, setNumber] = useState('')
  const [front, setFront] = useState<File | null>(null)
  const [back, setBack] = useState<File | null>(null)
  const [selfie, setSelfie] = useState<File | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const video = useRef<HTMLVideoElement>(null)
  const cameraStream = useRef<MediaStream | null>(null)

  const type = query.data?.document_types.find((item) => item.value === documentType)
  const canSubmit = Boolean(type && front && selfie && (!type.requires_back_side || back))
  const canResubmit = query.data?.status === 'not_submitted' || query.data?.status === 'rejected'

  function closeCamera() {
    cameraStream.current?.getTracks().forEach((track) => track.stop())
    cameraStream.current = null
    setCameraActive(false)
  }

  useEffect(() => () => {
    cameraStream.current?.getTracks().forEach((track) => track.stop())
    cameraStream.current = null
  }, [])

  useEffect(() => {
    if (cameraActive && video.current && cameraStream.current) {
      video.current.srcObject = cameraStream.current
      void video.current.play().catch(() => setError('La caméra ne peut pas démarrer. Vérifiez ses autorisations.'))
    }
  }, [cameraActive])

  async function openCamera() {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('La caméra nécessite un navigateur compatible et une connexion HTTPS.')
      return
    }
    try {
      closeCamera()
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      cameraStream.current = stream
      setCameraActive(true)
      if (video.current) {
        video.current.srcObject = stream
        await video.current.play()
      }
    } catch {
      closeCamera()
      setError('Impossible d’accéder à la caméra. Autorisez son utilisation dans le navigateur.')
    }
  }

  async function takeSelfie() {
    const source = video.current
    if (!source || !source.videoWidth || !source.videoHeight) {
      setError('La caméra n’est pas encore prête. Réessayez.')
      return
    }
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 960 / source.videoWidth)
    canvas.width = Math.round(source.videoWidth * scale)
    canvas.height = Math.round(source.videoHeight * scale)
    canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!blob) {
      setError('La capture de la photo a échoué.')
      return
    }
    setSelfie(new File([blob], 'selfie.jpg', { type: 'image/jpeg' }))
    closeCamera()
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    const body = new FormData()
    body.append('document_type', documentType)
    if (number.trim()) body.append('document_number', number.trim())
    body.append('front', front!)
    if (type?.requires_back_side) body.append('back', back!)
    body.append('selfie', selfie!)
    try {
      await post('/me/identity-verification', body)
      setFront(null)
      setBack(null)
      setSelfie(null)
      await query.refetch()
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Helmet><title>Vérification d’identité — CECT Togo</title></Helmet>
      <div className="max-w-2xl space-y-6">
        <PageHeader title="Vérification d’identité" description="Déposez une pièce d’identité et prenez votre selfie avec la caméra. Un agent habilité vérifiera votre dossier avant la souscription aux packs." />
        {query.isPending && <p role="status">Chargement de votre dossier…</p>}
        {query.isError && <p role="alert">Impossible de récupérer votre statut. <button type="button" onClick={() => void query.refetch()} className="underline">Réessayer</button></p>}
        {query.data && (
          <Panel title={stateLabels[query.data.status]}>
            <div className="flex items-start gap-3">
              {query.data.status === 'approved' ? <CheckCircle2 className="shrink-0 text-[var(--color-primary)]" aria-hidden /> : query.data.status === 'pending' ? <Clock3 className="shrink-0" aria-hidden /> : <ShieldCheck className="shrink-0" aria-hidden />}
              <div className="space-y-2 text-sm text-[var(--color-text-muted)]">
                {query.data.status === 'approved' && <p>Votre identité est validée. Vous pouvez souscrire aux packs auxquels vous êtes éligible.</p>}
                {query.data.status === 'pending' && <p>Votre dossier a été reçu. Aucune nouvelle soumission n’est nécessaire pendant son examen.</p>}
                {query.data.status === 'not_submitted' && <p>Complétez les informations ci-dessous pour demander une vérification.</p>}
                {query.data.status === 'rejected' && <p role="alert">Motif du rejet : {query.data.latest?.rejection_reason || 'Contactez l’administration pour plus d’informations.'} Vous pouvez déposer un nouveau dossier.</p>}
                {query.data.latest && <p>Document : {query.data.latest.document_label} · Envoyé le {new Date(query.data.latest.submitted_at).toLocaleDateString('fr-FR')}</p>}
              </div>
            </div>
          </Panel>
        )}
        {canResubmit && (
          <Panel title="Envoyer mes justificatifs">
            <form onSubmit={(event) => void submit(event)} className="space-y-5">
              <div>
                <label htmlFor="document-type" className="mb-2 block text-sm font-semibold">Type de pièce</label>
                <select id="document-type" value={documentType} onChange={(event) => { setDocumentType(event.target.value); setBack(null) }} required className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                  <option value="">Sélectionner une pièce</option>
                  {query.data?.document_types.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="document-number" className="mb-2 block text-sm font-semibold">Numéro de pièce (facultatif)</label>
                <input id="document-number" value={number} maxLength={60} onChange={(event) => setNumber(event.target.value)} className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3" />
              </div>
              <div>
                <label htmlFor="identity-front" className="mb-2 block text-sm font-semibold">Recto / page principale (5 Mo maximum)</label>
                <input id="identity-front" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required onChange={(event) => setFront(event.target.files?.[0] ?? null)} className="block w-full text-sm" />
              </div>
              {type?.requires_back_side && (
                <div>
                  <label htmlFor="identity-back" className="mb-2 block text-sm font-semibold">Verso (obligatoire pour cette pièce)</label>
                  <input id="identity-back" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required onChange={(event) => setBack(event.target.files?.[0] ?? null)} className="block w-full text-sm" />
                </div>
              )}
              <section className="space-y-3" aria-label="Selfie pris en direct">
                <p className="text-sm font-semibold">Selfie en direct (caméra obligatoire)</p>
                {cameraActive && <video ref={video} autoPlay playsInline muted className="w-full max-w-sm rounded-xl bg-black" aria-label="Aperçu de la caméra" />}
                {selfie && <p role="status" className="text-sm text-[var(--color-primary)]">Photo capturée. Vous pouvez la reprendre avant l’envoi.</p>}
                <div className="flex flex-wrap gap-3">
                  {!cameraActive ? <button type="button" onClick={() => void openCamera()} className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2"><Camera size={18} aria-hidden /> {selfie ? 'Reprendre le selfie' : 'Activer la caméra'}</button> : <>
                    <button type="button" onClick={() => void takeSelfie()} className="rounded-xl bg-[var(--color-primary)] px-4 py-2 font-semibold text-white">Prendre la photo</button>
                    <button type="button" onClick={closeCamera} className="rounded-xl border border-[var(--color-border)] px-4 py-2">Annuler</button>
                  </>}
                </div>
              </section>
              <p className="text-xs text-[var(--color-text-muted)]">Vos justificatifs sont transmis à l’espace privé de vérification et ne sont pas publiés.</p>
              {error && <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p>}
              <button type="submit" disabled={busy || !canSubmit} className="w-full rounded-xl bg-[var(--color-primary)] px-5 py-3 font-semibold text-white disabled:opacity-60">
                {busy ? 'Envoi en cours…' : 'Soumettre le dossier'}
              </button>
            </form>
          </Panel>
        )}
      </div>
    </>
  )
}
