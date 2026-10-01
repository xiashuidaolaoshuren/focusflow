import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboardIcon,
  ListIcon,
  SettingsIcon,
  UserIcon,
} from 'lucide-react'

import { ThemeToggle } from '@/components/theme/ThemeToggle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCurrentUser, useLogout } from '@/features/auth/hooks'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'

export function AppLayout() {
  const location = useLocation()

  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <Sidebar>
        <SidebarHeader className="border-b border-sidebar-border p-4">
          <span className="text-lg font-semibold">FocusFlow</span>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<NavLink to="/dashboard" />}
                    isActive={location.pathname === '/dashboard'}
                    tooltip="Dashboard"
                  >
                    <LayoutDashboardIcon />
                    <span>Dashboard</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<NavLink to="/plans" />}
                    isActive={
                      location.pathname === '/plans' ||
                      location.pathname.startsWith('/plans/')
                    }
                    tooltip="Plans"
                  >
                    <ListIcon />
                    <span>Plans</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<NavLink to="/settings" />}
                    isActive={location.pathname === '/settings'}
                    tooltip="Settings"
                  >
                    <SettingsIcon />
                    <span>Settings</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border p-2">
          <div className="flex items-center justify-between gap-2 px-2 py-1">
            <ThemeToggle />
            <UserMenu />
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b border-border px-4 md:hidden">
          <SidebarTrigger />
          <span className="font-semibold">FocusFlow</span>
        </header>
        <div
          id="main-content"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-5xl flex-1 flex-col p-6"
        >
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function UserMenu() {
  const { user } = useCurrentUser()
  const { mutate, isPending } = useLogout()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex size-8 items-center justify-center rounded-lg border border-border bg-background"
        aria-label="User menu"
      >
        <UserIcon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{user?.email ?? 'Account'}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isPending}
          onClick={() => mutate()}
        >
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
