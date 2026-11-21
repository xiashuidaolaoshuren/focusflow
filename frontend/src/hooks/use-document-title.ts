import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Today',
  '/today': 'Today',
  '/tasks': 'Tasks',
  '/horizon': 'Horizon',
  '/plans': 'Plans',
  '/settings': 'Settings',
  '/login': 'Sign in',
  '/register': 'Create account',
}

function titleFor(pathname: string): string | null {
  if (pathname.startsWith('/plans/')) {
    return 'Plan'
  }
  return ROUTE_TITLES[pathname] ?? null
}

export function useDocumentTitle() {
  const { pathname } = useLocation()
  const title = titleFor(pathname)

  useEffect(() => {
    document.title = title ? `${title} — FocusFlow` : 'FocusFlow'
  }, [title])
}
