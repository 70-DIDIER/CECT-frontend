import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { FileText, Download } from 'lucide-react'
import { get, downloadFile } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'

interface MemberDocument {
  type: string
  title: string
  description: string
  format: string
}

export default function MemberDocumentsPage() {
  const query = useQuery({
    queryKey: ['member-documents'],
    queryFn: () => get<MemberDocument[]>('/me/documents'),
    staleTime: 60_000,
  })

  const documents = query.data ?? []

  return (
    <>
      <Helmet><title>Mes documents — CECT</title></Helmet>
      <div className="space-y-6">
        <PageHeader title="Mes documents" description="Reçus, fiche d’adhésion et relevés générés à partir des données enregistrées par la plateforme." />

        {query.isPending && <div className="h-40 animate-pulse rounded-2xl bg-[var(--chart-track)]" />}
        {query.isError && <p role="alert" className="rounded-2xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 p-4 text-sm text-[var(--color-danger)]">Impossible de charger vos documents.</p>}

        {!query.isPending && !query.isError && documents.length === 0 && (
          <EmptyState icon={FileText} title="Aucun document disponible" description="Les documents apparaîtront ici au fur et à mesure de votre activité." />
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {documents.map((document) => (
            <article key={document.type} className="rounded-2xl border border-[var(--color-border)] bg-[var(--dash-card)] p-5">
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                  <FileText size={20} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-extrabold text-[var(--color-text)]">{document.title}</h2>
                    <span className="rounded-full bg-[var(--chart-track)] px-2 py-0.5 text-[11px] font-bold text-[var(--color-text-muted)]">{document.format}</span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">{document.description}</p>
                  <button
                    type="button"
                    onClick={() => void downloadFile(`/me/documents/${document.type}.pdf`, `cect-${document.type}.pdf`)}
                    className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--dash-bg)]"
                  >
                    <Download size={15} aria-hidden />
                    Télécharger
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  )
}
