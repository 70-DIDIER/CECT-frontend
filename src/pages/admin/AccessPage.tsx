import { useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import * as Dialog from '@radix-ui/react-dialog'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Plus, RefreshCw, ShieldCheck, UserCog, UserPlus, UserRoundCheck, UserRoundX, X } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { Panel } from '@/components/dashboard/Panel'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { FormDialog } from '@/components/ui/FormDialog'
import { authErrorMessage } from '@/features/auth/errors'
import { get, newIdempotencyKey, post, put } from '@/lib/api'

interface StaffUser {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  status: string
  roles: string[]
  created_at: string | null
  last_login_at: string | null
}

interface Role {
  id: number
  name: string
  label: string
  is_system: boolean
  permissions: string[]
  users_count: number
}

interface Permission {
  name: string
  description: string
  reserved_to_superadmin: boolean
}

interface PermissionCatalog {
  permissions: Permission[]
  incompatible_pairs: [string, string][]
}

const roleLabel = (roles: Role[], name: string) => roles.find((role) => role.name === name)?.label ?? name
const btnPrimary = 'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60'
const btnSecondary = 'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--dash-bg)] disabled:opacity-60'

const businessActors = [
  { name: 'Utilisateur', detail: 'Personne physique ou morale · espace membre', kind: 'Compte plateforme' },
  { name: 'Administrateur', detail: 'Gestion opérationnelle, membres, packs et paramétrage', kind: 'Rôle interne' },
  { name: 'Superadmin', detail: 'Gouvernance, permissions et paramètres critiques', kind: 'Rôle interne' },
  { name: 'Validateur', detail: 'Contrôle de la réception YEM · séparation des fonctions', kind: 'Rôle interne' },
  { name: 'Comptabilité', detail: 'Paiements, rapprochements, règlements et reporting', kind: 'Rôle interne' },
  { name: 'Yempay / prestataire', detail: 'Acteur externe intégré par API/webhook, sans session staff', kind: 'Acteur externe' },
] as const

function AccessChecklistDialog({
  title,
  subtitle,
  options,
  selected,
  onClose,
  onSave,
}: {
  title: string
  subtitle: string
  options: { value: string; label: string; description?: string; disabled?: boolean }[]
  selected: string[]
  onClose: () => void
  onSave: (values: string[], reason: string) => Promise<void>
}) {
  const [values, setValues] = useState<string[]>(selected)
  const [reason, setReason] = useState('Mise à jour des accès autorisés')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(value: string) {
    setValues((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]))
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--forest-900)]/60" />
        <Dialog.Content aria-describedby={undefined} className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-[var(--dash-card)] p-6 shadow-2xl outline-none">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-extrabold text-[var(--color-text)]">{title}</Dialog.Title>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">{subtitle}</p>
            </div>
            <Dialog.Close aria-label="Fermer" className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:bg-[var(--chart-track)]">
              <X size={18} />
            </Dialog.Close>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {options.map((option) => (
              <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--color-border)] p-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={values.includes(option.value)}
                  disabled={option.disabled}
                  onChange={() => toggle(option.value)}
                />
                <span>
                  <span className="block text-sm font-semibold text-[var(--color-text)]">{option.label}</span>
                  {option.description && <span className="mt-1 block text-xs leading-relaxed text-[var(--color-text-muted)]">{option.description}</span>}
                </span>
              </label>
            ))}
          </div>

          <div className="mt-5">
            <label htmlFor="access-reason" className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Motif</label>
            <textarea
              id="access-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}

          <button
            type="button"
            className={`${btnPrimary} mt-5 w-full`}
            disabled={busy || values.length === 0 || reason.trim().length < 5}
            onClick={async () => {
              setBusy(true)
              setError(null)
              try {
                await onSave(values, reason.trim())
                onClose()
              } catch (caught) {
                setError(authErrorMessage(caught))
                setBusy(false)
              }
            }}
          >
            Enregistrer
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default function AccessPage() {
  const { can, user } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [createStaff, setCreateStaff] = useState(false)
  const [createRole, setCreateRole] = useState(false)
  const [staffRoles, setStaffRoles] = useState<StaffUser | null>(null)
  const [rolePermissions, setRolePermissions] = useState<Role | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const staff = useQuery({
    queryKey: ['admin-staff', search],
    queryFn: () => get<StaffUser[]>('/admin/staff', { ...(search.trim() ? { search: search.trim() } : {}), per_page: 100 }),
    enabled: can('staff.view'),
    staleTime: 0,
  })
  const roles = useQuery({ queryKey: ['admin-roles'], queryFn: () => get<Role[]>('/admin/roles'), enabled: can('roles.view'), staleTime: 0 })
  const catalog = useQuery({ queryKey: ['admin-permissions'], queryFn: () => get<PermissionCatalog>('/admin/permissions'), enabled: can('roles.view'), staleTime: 0 })

  const roleOptions = useMemo(
    () => (roles.data ?? [])
      .filter((role) => role.name !== 'superadmin' || user?.role === 'superadmin')
      .map((role) => ({ value: role.name, label: role.label || role.name, description: role.is_system ? 'Rôle système' : 'Rôle personnalisé' })),
    [roles.data, user?.role],
  )

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-staff'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-permissions'] }),
    ])
  }

  const suspend = useMutation({
    mutationFn: async (user: StaffUser) => post(`/admin/staff/${user.id}/suspend`, { reason: 'Suspension décidée depuis le back-office CECT' }, newIdempotencyKey()),
    onSuccess: () => void refresh(),
    onError: (error: unknown) => setActionError(authErrorMessage(error)),
  })
  const reactivate = useMutation({
    mutationFn: async (user: StaffUser) => post(`/admin/staff/${user.id}/reactivate`, { reason: 'Réactivation décidée depuis le back-office CECT' }, newIdempotencyKey()),
    onSuccess: () => void refresh(),
    onError: (error: unknown) => setActionError(authErrorMessage(error)),
  })

  return (
    <>
      <Helmet><title>Accès internes — CECT Admin</title></Helmet>
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)]">Accès internes</h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-muted)]">
              Comptes du personnel, rôles et permissions. Les incompatibilités de fonctions et les permissions réservées restent contrôlées par le backend.
            </p>
          </div>
          {can('staff.manage') && (
            <button className={btnPrimary} type="button" onClick={() => setCreateStaff(true)}>
              <UserPlus size={16} /> Nouveau compte interne
            </button>
          )}
        </header>

        {actionError && <p className="rounded-xl bg-[var(--color-danger)]/5 p-4 text-sm text-[var(--color-danger)]">{actionError}</p>}

        <Panel
          title="Acteurs du cahier des charges"
          subtitle="Les six acteurs sont couverts sans confondre comptes humains et intégrations externes."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {businessActors.map((actor) => (
              <div key={actor.name} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <strong className="text-sm text-[var(--color-text)]">{actor.name}</strong>
                  <StatusBadge label={actor.kind} tone={actor.kind === 'Acteur externe' ? 'neutral' : 'info'} />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-muted)]">{actor.detail}</p>
              </div>
            ))}
          </div>
        </Panel>

        {can('staff.view') && (
          <Panel
            title="Personnel"
            subtitle={staff.data ? `${staff.data.length} compte(s)` : 'Chargement…'}
            action={
              <button type="button" className={btnSecondary} onClick={() => void staff.refetch()}>
                <RefreshCw size={15} /> Actualiser
              </button>
            }
            flush
          >
            <div className="px-5 pb-4 sm:px-6">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un nom ou un e-mail"
                className="min-h-[44px] w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            {staff.isPending && <div className="mx-5 mb-4 h-28 animate-pulse rounded-2xl bg-[var(--chart-track)]" />}
            {staff.isError && <p className="px-6 pb-4 text-sm text-[var(--color-danger)]">Impossible de charger les comptes internes.</p>}
            <div className="divide-y divide-[var(--color-border)]">
              {(staff.data ?? []).map((user) => (
                <div key={user.id} className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                    <UserCog size={18} />
                  </div>
                  <div className="min-w-0 flex-1 basis-60">
                    <p className="font-semibold text-[var(--color-text)]">{user.first_name} {user.last_name}</p>
                    <p className="text-sm text-[var(--color-text-muted)]">{user.email}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {user.roles.map((role) => <StatusBadge key={role} label={roleLabel(roles.data ?? [], role)} tone="info" />)}
                      <StatusBadge label={user.status === 'active' ? 'Actif' : user.status} tone={user.status === 'active' ? 'success' : 'warning'} />
                    </div>
                  </div>
                  {can('staff.manage') && (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={btnSecondary} onClick={() => setStaffRoles(user)}><KeyRound size={15} /> Rôles</button>
                      {user.status === 'suspended' ? (
                        <button type="button" className={btnSecondary} disabled={reactivate.isPending} onClick={() => reactivate.mutate(user)}>
                          <UserRoundCheck size={15} /> Réactiver
                        </button>
                      ) : (
                        <button type="button" className={btnSecondary} disabled={suspend.isPending} onClick={() => suspend.mutate(user)}>
                          <UserRoundX size={15} /> Suspendre
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        )}

        {can('roles.view') && (
          <Panel
            title="Rôles et permissions"
            subtitle={roles.data ? `${roles.data.length} rôle(s) configuré(s)` : 'Chargement…'}
            action={can('roles.manage') ? <button className={btnPrimary} type="button" onClick={() => setCreateRole(true)}><Plus size={15} /> Nouveau rôle</button> : null}
            flush
          >
            <div className="divide-y divide-[var(--color-border)]">
              {(roles.data ?? []).map((role) => (
                <div key={role.id} className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]"><ShieldCheck size={18} /></div>
                  <div className="min-w-0 flex-1 basis-64">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm text-[var(--color-text)]">{role.label || role.name}</strong>
                      {role.is_system && <StatusBadge label="Système" tone="neutral" />}
                      {role.name === 'superadmin' && <StatusBadge label="Toutes permissions" tone="violet" />}
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {role.users_count} titulaire(s) · {role.permissions.includes('*') ? 'toutes les permissions' : `${role.permissions.length} permission(s)`}
                    </p>
                  </div>
                  {can('roles.manage') && role.name !== 'superadmin' && (
                    <button type="button" className={btnSecondary} onClick={() => setRolePermissions(role)}><KeyRound size={15} /> Permissions</button>
                  )}
                </div>
              ))}
            </div>

            {catalog.data?.incompatible_pairs.length ? (
              <div className="mx-5 my-4 rounded-xl bg-[var(--dash-bg)] p-4 text-xs text-[var(--color-text-muted)] sm:mx-6">
                <strong className="text-[var(--color-text)]">Séparation des fonctions :</strong>{' '}
                {catalog.data.incompatible_pairs.map(([a, b]) => `${a} ≠ ${b}`).join(' · ')}
              </div>
            ) : null}
          </Panel>
        )}
      </div>

      {createStaff && (
        <FormDialog
          title="Créer un compte interne"
          subtitle="Un code d’activation sera envoyé par e-mail."
          submitLabel="Créer le compte"
          fields={[
            { name: 'first_name', label: 'Prénom', required: true },
            { name: 'last_name', label: 'Nom', required: true },
            { name: 'email', label: 'Adresse e-mail', required: true },
            { name: 'phone', label: 'Téléphone (facultatif)' },
            { name: 'role', label: 'Rôle initial', type: 'select', required: true, options: roleOptions },
          ]}
          onClose={() => setCreateStaff(false)}
          onSubmit={async (values) => {
            await post('/admin/staff', {
              first_name: values.first_name.trim(),
              last_name: values.last_name.trim(),
              email: values.email.trim(),
              phone: values.phone.trim() || null,
              roles: [values.role],
            }, newIdempotencyKey())
            await refresh()
          }}
        />
      )}

      {createRole && (
        <FormDialog
          title="Créer un rôle"
          subtitle="Le rôle est créé sans permission ; configurez-le ensuite."
          submitLabel="Créer le rôle"
          fields={[
            { name: 'name', label: 'Code du rôle (ex. support_n1)', required: true },
            { name: 'label', label: 'Libellé', required: true },
          ]}
          onClose={() => setCreateRole(false)}
          onSubmit={async (values) => {
            await post('/admin/roles', { name: values.name.trim().toLowerCase(), label: values.label.trim(), permissions: [] }, newIdempotencyKey())
            await refresh()
          }}
        />
      )}

      {staffRoles && (
        <AccessChecklistDialog
          title="Rôles du compte"
          subtitle={`${staffRoles.first_name} ${staffRoles.last_name} · ${staffRoles.email}`}
          options={roleOptions}
          selected={staffRoles.roles}
          onClose={() => setStaffRoles(null)}
          onSave={async (values, reason) => {
            await put(`/admin/staff/${staffRoles.id}/roles`, { roles: values, reason }, newIdempotencyKey())
            await refresh()
          }}
        />
      )}

      {rolePermissions && catalog.data && (
        <AccessChecklistDialog
          title={`Permissions · ${rolePermissions.label || rolePermissions.name}`}
          subtitle="Le backend refuse les combinaisons incompatibles et les permissions réservées lorsqu’elles ne sont pas autorisées."
          options={catalog.data.permissions.map((permission) => ({
            value: permission.name,
            label: permission.name,
            description: permission.description,
            disabled: permission.reserved_to_superadmin,
          }))}
          selected={rolePermissions.permissions}
          onClose={() => setRolePermissions(null)}
          onSave={async (values, reason) => {
            await put(`/admin/roles/${rolePermissions.id}/permissions`, { permissions: values, reason }, newIdempotencyKey())
            await refresh()
          }}
        />
      )}
    </>
  )
}
