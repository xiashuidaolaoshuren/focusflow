import { Outlet } from 'react-router-dom'

import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { useCurrentUser } from '@/features/auth/hooks'

export function AuthLayout() {
  useCurrentUser()

  return (
    <div className="relative grid min-h-svh place-items-center bg-background px-4 py-8 text-foreground">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <main className="w-full max-w-[400px]">
        <Outlet />
      </main>
    </div>
  )
}
