import { Navigate, useLocation } from 'react-router-dom'

/** Keeps the planning date when the old dashboard URL is bookmarked. */
export function DashboardRedirect() {
  const { search } = useLocation()

  return <Navigate to={{ pathname: '/today', search }} replace />
}
