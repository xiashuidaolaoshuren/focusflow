import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Loader2Icon } from 'lucide-react'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AppShell } from '@/components/layout/AppShell'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { UnauthorizedListener } from '@/features/auth/UnauthorizedListener'
import { useCurrentUser } from '@/features/auth/hooks'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { DashboardRedirect } from '@/routes/DashboardRedirect'
import { NotFoundPage } from '@/routes/NotFoundPage'

const DashboardPage = lazy(() =>
  import('@/routes/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
)
const LoginPage = lazy(() =>
  import('@/routes/LoginPage').then((module) => ({
    default: module.LoginPage,
  })),
)
const RegisterPage = lazy(() =>
  import('@/routes/RegisterPage').then((module) => ({
    default: module.RegisterPage,
  })),
)
const PlanHistoryPage = lazy(() =>
  import('@/routes/PlanHistoryPage').then((module) => ({
    default: module.PlanHistoryPage,
  })),
)
const PlanDetailPage = lazy(() =>
  import('@/routes/PlanDetailPage').then((module) => ({
    default: module.PlanDetailPage,
  })),
)
const HorizonPage = lazy(() =>
  import('@/features/horizon/HorizonPage').then((module) => ({
    default: module.HorizonPage,
  })),
)
const SettingsPage = lazy(() =>
  import('@/routes/SettingsPage').then((module) => ({
    default: module.SettingsPage,
  })),
)

function RouteFallback() {
  return (
    <div
      className="flex min-h-svh flex-col items-center justify-center gap-2"
      role="status"
      aria-live="polite"
    >
      <Loader2Icon
        className="size-6 animate-spin text-muted-foreground"
        aria-hidden="true"
      />
      <p className="text-sm text-muted-foreground">Loading session…</p>
    </div>
  )
}

function NotFoundRoute() {
  const { isPending, isAuthenticated } = useCurrentUser()

  if (isPending) {
    return <RouteFallback />
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-svh flex-col justify-center bg-background">
        <NotFoundPage />
      </div>
    )
  }

  return (
    <AppShell>
      <NotFoundPage />
    </AppShell>
  )
}

function HomeRedirect() {
  const { isPending, isAuthenticated } = useCurrentUser()

  if (isPending) {
    return <RouteFallback />
  }

  return <Navigate to={isAuthenticated ? '/today' : '/login'} replace />
}

function App() {
  useDocumentTitle()

  return (
    <ErrorBoundary>
      <UnauthorizedListener />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />

          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/today" element={<DashboardPage />} />
              <Route path="/tasks" element={<DashboardPage />} />
              <Route path="/dashboard" element={<DashboardRedirect />} />
              <Route path="/plans" element={<PlanHistoryPage />} />
              <Route path="/plans/:id" element={<PlanDetailPage />} />
              <Route path="/horizon" element={<HorizonPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundRoute />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

export default App
