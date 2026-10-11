import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, RouterProvider, useParams } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MemberLayout } from '@/components/layout/MemberLayout'

const HomePage         = lazy(() => import('@/pages/HomePage'))
const ServicesPage     = lazy(() => import('@/pages/ServicesPage'))
const YemPage          = lazy(() => import('@/pages/YemPage'))
const PacksPage        = lazy(() => import('@/pages/PacksPage'))
const AboutPage        = lazy(() => import('@/pages/AboutPage'))
const PartnersPage     = lazy(() => import('@/pages/PartnersPage'))
const MerchantsPage    = lazy(() => import('@/pages/MerchantsPage'))
const NewsPage         = lazy(() => import('@/pages/NewsPage'))
const FaqPage          = lazy(() => import('@/pages/FaqPage'))
const ContactPage      = lazy(() => import('@/pages/ContactPage'))
const LoginPage        = lazy(() => import('@/pages/LoginPage'))
const RegisterPage     = lazy(() => import('@/pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'))
const StaffActivationPage = lazy(() => import('@/pages/StaffActivationPage'))
const DocumentsPage    = lazy(() => import('@/pages/DocumentsPage'))
const LegalPage        = lazy(() => import('@/pages/LegalPage'))
const MemberHomePage   = lazy(() => import('@/pages/member/HomePage'))
const ActivityPage     = lazy(() => import('@/pages/member/ActivityPage'))
const ProfilePage      = lazy(() => import('@/pages/member/ProfilePage'))
const MembershipPage   = lazy(() => import('@/pages/member/MembershipPage'))
const PacksCatalogPage = lazy(() => import('@/pages/member/PacksCatalogPage'))
const PayMerchantPage  = lazy(() => import('@/pages/member/PayMerchantPage'))
const SellYemPage      = lazy(() => import('@/pages/member/SellYemPage'))
const MerchantPage     = lazy(() => import('@/pages/member/MerchantPage'))
const NotificationsPage = lazy(() => import('@/pages/member/NotificationsPage'))
const NotFoundPage     = lazy(() => import('@/pages/NotFoundPage'))

// Admin pages
const AdminHomePage      = lazy(() => import('@/pages/admin/AdminHomePage'))
const MembresPage        = lazy(() => import('@/pages/admin/MembresPage'))
const ValidationsPage    = lazy(() => import('@/pages/admin/ValidationsPage'))
const FinancePage        = lazy(() => import('@/pages/admin/FinancePage'))
const ConfigurationPage  = lazy(() => import('@/pages/admin/ConfigurationPage'))
const PacksAdminPage     = lazy(() => import('@/pages/admin/PacksAdminPage'))
const AccessPage         = lazy(() => import('@/pages/admin/AccessPage'))
const AuditPage          = lazy(() => import('@/pages/admin/AuditPage'))
const ContentPage        = lazy(() => import('@/pages/admin/ContentPage'))
const MerchantDirectoryAdminPage = lazy(() => import('@/pages/admin/MerchantDirectoryAdminPage'))
const ExportPage         = lazy(() => import('@/pages/admin/ExportPage'))

function Loading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
    </div>
  )
}

function MerchantQrRedirect() {
  const { code } = useParams()
  return <Navigate to={`/espace/payer?code=${encodeURIComponent(code ?? '')}`} replace />
}

function S({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Loading />}>{children}</Suspense>
}

const router = createBrowserRouter([
  // ── Public site (uses Navbar + Footer via Layout) ──────────────────────────
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true,            element: <S><HomePage /></S> },
      { path: 'services',       element: <S><ServicesPage /></S> },
      { path: 'services/:slug', element: <S><ServicesPage /></S> },
      { path: 'le-yem',         element: <S><YemPage /></S> },
      { path: 'packs',          element: <S><PacksPage /></S> },
      { path: 'a-propos',       element: <S><AboutPage /></S> },
      { path: 'partenaires',    element: <S><PartnersPage /></S> },
      { path: 'marchands',      element: <S><MerchantsPage /></S> },
      { path: 'actualites',     element: <S><NewsPage /></S> },
      { path: 'faq',            element: <S><FaqPage /></S> },
      { path: 'contact',        element: <S><ContactPage /></S> },
      { path: 'connexion',      element: <S><LoginPage /></S> },
      { path: 'inscription',    element: <S><RegisterPage /></S> },
      { path: 'mot-de-passe-oublie', element: <S><ForgotPasswordPage /></S> },
      { path: 'activation-compte-interne', element: <S><StaffActivationPage /></S> },
      { path: 'documents',      element: <S><DocumentsPage /></S> },
      { path: 'mentions-legales', element: <S><LegalPage /></S> },
      { path: 'confidentialite', element: <S><LegalPage /></S> },
      { path: 'conditions',     element: <S><LegalPage /></S> },
      { path: 'espace-membre',  element: <Navigate to="/espace" replace /> },
      { path: '*',              element: <S><NotFoundPage /></S> },
    ],
  },

  { path: '/pay/m/:code', element: <MerchantQrRedirect /> },

  // ── Member area (standalone MemberLayout — sidebar, no public Navbar / Footer) ─
  {
    path: '/espace',
    element: <MemberLayout />,
    children: [
      { index: true, element: <S><MemberHomePage /></S> },
      { path: 'activite', element: <S><ActivityPage /></S> },
      { path: 'profil', element: <S><ProfilePage /></S> },
      { path: 'adhesion', element: <S><MembershipPage /></S> },
      { path: 'packs', element: <S><PacksCatalogPage /></S> },
      { path: 'payer', element: <S><PayMerchantPage /></S> },
      { path: 'vendre', element: <S><SellYemPage /></S> },
      { path: 'marchand', element: <S><MerchantPage /></S> },
      { path: 'notifications', element: <S><NotificationsPage /></S> },
    ],
  },

  // ── Admin section (standalone AdminLayout — no Navbar / Footer) ────────────
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true,              element: <S><AdminHomePage /></S> },
      { path: 'validations',      element: <S><ValidationsPage /></S> },
      { path: 'membres',          element: <S><MembresPage /></S> },
      { path: 'packs',            element: <S><PacksAdminPage /></S> },
      { path: 'finance',          element: <S><FinancePage /></S> },
      { path: 'access',           element: <S><AccessPage /></S> },
      { path: 'audit',            element: <S><AuditPage /></S> },
      { path: 'contenus',         element: <S><ContentPage /></S> },
      { path: 'marchands',        element: <S><MerchantDirectoryAdminPage /></S> },
      { path: 'configuration',    element: <S><ConfigurationPage /></S> },
      { path: 'export',           element: <S><ExportPage /></S> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
