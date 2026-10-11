import { useMemo } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BadgeCheck, Bell, Boxes, Coins, LayoutDashboard, LineChart, ScanLine, Store, UserRound } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { usePublicConfig } from '@/features/config/usePublicConfig'
import { isAdminRole } from '@/lib/roles'
import { AppShell, type NavSection } from './AppShell'
import { FullPageLoader } from './FullPageLoader'

const SECTIONS: NavSection[] = [
  {
    title: 'Mon espace',
    items: [
      { label: 'Accueil', icon: LayoutDashboard, to: '/espace', end: true, tab: true },
      { label: 'Mes packs', icon: Boxes, to: '/espace/packs', tab: true },
      { label: 'Activité', icon: LineChart, to: '/espace/activite', tab: true },
      { label: 'Notifications', icon: Bell, to: '/espace/notifications' },
    ],
  },
  {
    title: 'Opérations',
    items: [
      { label: 'Payer un marchand', icon: ScanLine, to: '/espace/payer', tab: true, tabLabel: 'Payer' },
      { label: 'Vendre mes YEM', icon: Coins, to: '/espace/vendre' },
      { label: 'Espace marchand', icon: Store, to: '/espace/marchand' },
    ],
  },
  {
    title: 'Compte',
    items: [{ label: 'Profil et sécurité', icon: UserRound, to: '/espace/profil' }],
  },
]

const ONBOARDING_SECTIONS: NavSection[] = [{ title: 'Compte', items: [{ label: 'Adhésion', icon: BadgeCheck, to: '/espace/adhesion' }] }]

const TITLES: Record<string, string> = {
  '/espace': 'Accueil',
  '/espace/packs': 'Mes packs',
  '/espace/activite': 'Activité',
  '/espace/notifications': 'Notifications',
  '/espace/payer': 'Payer un marchand',
  '/espace/vendre': 'Vendre mes YEM',
  '/espace/marchand': 'Espace marchand',
  '/espace/profil': 'Profil et sécurité',
  '/espace/adhesion': 'Adhésion',
}

export function MemberLayout() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const publicConfig = usePublicConfig()
  const isLegal = user?.personType === 'legal'

  const sections = useMemo(() => SECTIONS.map((section) => ({ ...section, items: section.items.filter((item) => item.to !== '/espace/marchand' || isLegal) })), [isLegal])

  if (loading) return <FullPageLoader />
  if (!user) return <Navigate to="/connexion" replace />
  if (isAdminRole(user.role)) return <Navigate to="/admin" replace />
  const onboarding = user.status !== 'active'
  if (onboarding && location.pathname !== '/espace/adhesion') return <Navigate to="/espace/adhesion" replace />

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  return (
    <AppShell
      brand={{ title: 'Espace membre', subtitle: 'Coopérative CECT Togo' }}
      sections={onboarding ? ONBOARDING_SECTIONS : sections}
      user={{ name: user.name, roleLabel: isLegal ? 'Personne morale' : 'Membre' }}
      onLogout={() => void handleLogout()}
      pageTitle={TITLES[location.pathname] ?? 'Espace membre'}
    >
      {publicConfig.data?.test_mode && (
        <div role="status" className="mb-5 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>Mode recette :</strong> les paiements et règlements utilisent uniquement des mécanismes de test/simulation. Aucun paiement réel ne doit être exécuté depuis cet environnement.
        </div>
      )}
      <Outlet />
    </AppShell>
  )
}
