import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, HelpCircle, Newspaper, Pencil, Store } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { Panel } from '@/components/dashboard/Panel'
import { FormDialog } from '@/components/ui/FormDialog'
import { get, newIdempotencyKey, put } from '@/lib/api'

interface Setting {
  key: string
  group: string
  type: string
  description: string
  edit_level: string
  is_sensitive: boolean
  current_value: unknown
}

const META: Record<string, { title: string; description: string; icon: typeof FileText }> = {
  'content.key_figures': {
    title: 'Chiffres clés',
    description: 'Indicateurs affichés sur le site public.',
    icon: FileText,
  },
  'content.faq': {
    title: 'FAQ',
    description: 'Questions et réponses publiées en français et en anglais.',
    icon: HelpCircle,
  },
  'content.news': {
    title: 'Actualités',
    description: 'Articles et annonces affichés dans la rubrique Actualités.',
    icon: Newspaper,
  },
  'content.partners': {
    title: 'Partenaires',
    description: 'Partenaires institutionnels ou commerciaux affichés publiquement.',
    icon: Store,
  },
}

function countItems(value: unknown): number {
  return Array.isArray(value) ? value.length : 0
}

export default function ContentPage() {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Setting | null>(null)

  const query = useQuery({
    queryKey: ['settings'],
    queryFn: () => get<Setting[]>('/admin/settings'),
    staleTime: 0,
  })

  const settings = (query.data ?? []).filter((setting) => setting.group === 'content')

  return (
    <>
      <Helmet><title>Contenus publics — CECT Admin</title></Helmet>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)]">Contenus publics</h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-muted)]">
            Les actualités, FAQ, partenaires et chiffres clés du site ne sont plus codés en dur : ils sont versionnés dans le paramétrage CECT.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {settings.map((setting) => {
            const meta = META[setting.key] ?? { title: setting.key, description: setting.description, icon: FileText }
            const Icon = meta.icon
            return (
              <article key={setting.key} className="rounded-3xl border border-[var(--color-border)] bg-[var(--dash-card)] p-5 shadow-[var(--shadow-card)]">
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                    <Icon size={20} aria-hidden />
                  </span>
                  <span className="rounded-full bg-[var(--chart-track)] px-2.5 py-1 text-xs font-bold text-[var(--color-text-muted)]">
                    {countItems(setting.current_value)} élément(s)
                  </span>
                </div>
                <h2 className="mt-4 text-base font-bold text-[var(--color-text)]">{meta.title}</h2>
                <p className="mt-1 min-h-10 text-sm text-[var(--color-text-muted)]">{meta.description}</p>
                <code className="mt-3 block text-xs text-[var(--color-text-muted)]">{setting.key}</code>
                {can('settings.update') && (
                  <button
                    type="button"
                    onClick={() => setEditing(setting)}
                    className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--dash-bg)]"
                  >
                    <Pencil size={15} aria-hidden />
                    Modifier
                  </button>
                )}
              </article>
            )
          })}
        </div>

        <Panel title="Règles de publication" subtitle="Chaque changement est contrôlé par le backend et enregistré dans l’audit.">
          <ul className="space-y-2 text-sm text-[var(--color-text-muted)]">
            <li>• Utilisez <code className="font-mono">published: true</code> pour rendre une FAQ, actualité ou partenaire visible.</li>
            <li>• Les identifiants et slugs doivent rester uniques dans chaque collection.</li>
            <li>• Le site public relit automatiquement ces contenus depuis l’API de configuration.</li>
          </ul>
        </Panel>
      </div>

      {editing && (
        <FormDialog
          title={META[editing.key]?.title ?? editing.key}
          subtitle="Éditeur JSON validé par le serveur"
          submitLabel="Enregistrer et publier"
          fields={[
            {
              name: 'value',
              label: 'Contenu JSON',
              type: 'textarea',
              required: true,
              initial: JSON.stringify(editing.current_value ?? [], null, 2),
            },
            { name: 'reason', label: 'Motif de la modification', type: 'textarea', required: true },
          ]}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            let value: unknown
            try {
              value = JSON.parse(values.value)
            } catch {
              throw new Error('Le JSON est invalide.')
            }
            await put('/admin/settings/' + editing.key, { value, reason: values.reason, effective_from: null }, newIdempotencyKey())
            await queryClient.invalidateQueries({ queryKey: ['settings'] })
            await queryClient.invalidateQueries({ queryKey: ['public-config'] })
          }}
        />
      )}
    </>
  )
}
