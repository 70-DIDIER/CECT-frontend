import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MapPin, Pencil, RefreshCw, Search, Store } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { Panel } from '@/components/dashboard/Panel'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { FormDialog } from '@/components/ui/FormDialog'
import { get, put } from '@/lib/api'

interface MerchantDirectoryEntry {
  user_id: string
  listed: boolean
  display_name: string
  activity: string | null
  city: string | null
  address: string | null
  public_phone: string | null
  description: string | null
  listed_at: string | null
  updated_at: string | null
  merchant: {
    id: string
    email: string
    name: string
    status: string
    member_number: string | null
  }
}

const btnSecondary =
  'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--dash-bg)] disabled:opacity-60'

export default function MerchantDirectoryAdminPage() {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [listed, setListed] = useState<'all' | 'true' | 'false'>('all')
  const [editing, setEditing] = useState<MerchantDirectoryEntry | null>(null)

  const query = useQuery({
    queryKey: ['admin-merchant-directory', search, listed],
    queryFn: () =>
      get<MerchantDirectoryEntry[]>('/admin/merchant-directory', {
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(listed !== 'all' ? { listed: listed === 'true' ? 1 : 0 } : {}),
        per_page: 200,
      }),
    staleTime: 0,
  })

  return (
    <>
      <Helmet>
        <title>Annuaire marchands — CECT Admin</title>
      </Helmet>

      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)]">Annuaire des marchands</h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-muted)]">
            Modérez les fiches publiques du réseau. Les marchands restent propriétaires de leur fiche ; toute correction administrative est tracée dans l’audit.
          </p>
        </header>

        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-0 flex-1 basis-64">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" aria-hidden />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nom, activité ou e-mail"
              className="min-h-[44px] w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>
          <select
            value={listed}
            onChange={(event) => setListed(event.target.value as 'all' | 'true' | 'false')}
            className="min-h-[44px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm"
          >
            <option value="all">Toutes les fiches</option>
            <option value="true">Publiées</option>
            <option value="false">Masquées</option>
          </select>
          <button type="button" className={btnSecondary} onClick={() => void query.refetch()}>
            <RefreshCw size={15} aria-hidden /> Actualiser
          </button>
        </div>

        <Panel title="Fiches marchands" subtitle={query.data ? `${query.data.length} fiche(s)` : 'Chargement…'} flush>
          {query.isPending && <div className="mx-5 mb-4 h-40 animate-pulse rounded-2xl bg-[var(--chart-track)]" />}
          {query.isError && <p className="px-6 pb-5 text-sm text-[var(--color-danger)]">Impossible de charger l’annuaire.</p>}
          {query.data?.length === 0 && <p className="px-6 pb-5 text-sm text-[var(--color-text-muted)]">Aucune fiche ne correspond aux filtres.</p>}

          <div className="divide-y divide-[var(--color-border)]">
            {query.data?.map((entry) => (
              <div key={entry.user_id} className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                  <Store size={19} aria-hidden />
                </span>
                <div className="min-w-0 flex-1 basis-64">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm text-[var(--color-text)]">{entry.display_name}</strong>
                    <StatusBadge label={entry.listed ? 'Publié' : 'Masqué'} tone={entry.listed ? 'success' : 'neutral'} />
                    {entry.merchant.status !== 'active' && <StatusBadge label={entry.merchant.status} tone="warning" />}
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {entry.activity ?? 'Activité non renseignée'} · {entry.merchant.member_number ?? 'Sans numéro membre'} · {entry.merchant.email}
                  </p>
                  {(entry.city || entry.address) && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                      <MapPin size={12} aria-hidden /> {[entry.address, entry.city].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                {can('settings.update') && (
                  <button type="button" className={btnSecondary} onClick={() => setEditing(entry)}>
                    <Pencil size={15} aria-hidden /> Modifier
                  </button>
                )}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {editing && (
        <FormDialog
          title="Modifier la fiche marchand"
          subtitle={editing.merchant.name}
          submitLabel="Enregistrer"
          fields={[
            {
              name: 'listed',
              label: 'Visibilité',
              type: 'select',
              required: true,
              initial: editing.listed ? 'true' : 'false',
              options: [
                { value: 'true', label: 'Publiée dans l’annuaire' },
                { value: 'false', label: 'Masquée de l’annuaire' },
              ],
            },
            { name: 'display_name', label: 'Nom affiché', required: true, initial: editing.display_name },
            { name: 'activity', label: 'Activité', initial: editing.activity ?? '' },
            { name: 'city', label: 'Ville', initial: editing.city ?? '' },
            { name: 'address', label: 'Adresse', initial: editing.address ?? '' },
            { name: 'public_phone', label: 'Téléphone public', initial: editing.public_phone ?? '' },
            { name: 'description', label: 'Description', type: 'textarea', initial: editing.description ?? '' },
            { name: 'reason', label: 'Motif de la correction administrative', type: 'textarea', required: true },
          ]}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            await put(`/admin/merchant-directory/${editing.user_id}`, {
              listed: values.listed === 'true',
              display_name: values.display_name.trim(),
              activity: values.activity.trim() || null,
              city: values.city.trim() || null,
              address: values.address.trim() || null,
              public_phone: values.public_phone.trim() || null,
              description: values.description.trim() || null,
              reason: values.reason.trim(),
            })
            await queryClient.invalidateQueries({ queryKey: ['admin-merchant-directory'] })
          }}
        />
      )}
    </>
  )
}
