import { Navigate, Route, Routes } from 'react-router-dom'

import { AppLayout } from '@/components/layout/AppLayout'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { DashboardPage } from '@/routes/DashboardPage'
import { LoginPage } from '@/routes/LoginPage'
import { PlanDetailPage } from '@/routes/PlanDetailPage'
import { PlanHistoryPage } from '@/routes/PlanHistoryPage'
import { RegisterPage } from '@/routes/RegisterPage'
import { SettingsPage } from '@/routes/SettingsPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route element={<PublicLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/plans" element={<PlanHistoryPage />} />
          <Route path="/plans/:id" element={<PlanDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
