import {
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { PanelLeftIcon } from 'lucide-react'

import {
  HorizonNavIcon,
  PlansNavIcon,
  SettingsNavIcon,
  TasksNavIcon,
  TodayNavIcon,
} from '@/components/layout/navIcons'

import { BrandMark } from '@/components/brand/BrandMark'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
 
} from '@/components/ui/sidebar'
import { useSidebar } from '@/components/ui/sidebar-context'
import { useCurrentUser, useLogout } from '@/features/auth/hooks'
import { useSchedulingPreferences } from '@/features/preferences/hooks'
import { formatClock, formatDateLabel } from '@/lib/format'
import { getLocalDateString, isWorkingDay } from '@/lib/planningDate'

const NAV_ITEMS = [
  { to: '/today', label: 'Today', icon: TodayNavIcon, exact: true },
  { to: '/tasks', label: 'Tasks', icon: TasksNavIcon, exact: true },
  { to: '/horizon', label: 'Horizon', icon: HorizonNavIcon, exact: true },
  { to: '/plans', label: 'Plans', icon: PlansNavIcon, exact: false },
  { to: '/settings', label: 'Settings', icon: SettingsNavIcon, exact: true },
] as const

const ACTIVE_ITEM_CLASSES =
  'relative [&[aria-current=page]]:before:absolute [&[aria-current=page]]:before:top-2 [&[aria-current=page]]:before:bottom-2 [&[aria-current=page]]:before:left-0 [&[aria-current=page]]:before:w-0.5 [&[aria-current=page]]:before:rounded-full [&[aria-current=page]]:before:bg-primary'

export function AppShell({ children }: { children?: ReactNode }) {
  const location = useLocation()

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': '14rem',
          '--sidebar-width-icon': '4rem',
        } as CSSProperties
      }
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-100 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <Sidebar collapsible="icon">
        <SidebarHeader className="group-data-[state=collapsed]:flex-row group-data-[state=collapsed]:justify-center border-b border-sidebar-border px-3 py-4">
          <div className="flex min-h-8 items-center justify-between gap-2 group-data-[state=collapsed]:flex-col">
            <Link
              to="/today"
              aria-label="FocusFlow, Today"
              className="flex min-w-0 items-center gap-2 px-2 text-foreground outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring group-data-[state=collapsed]:px-0"
            >
              <BrandMark className="size-5 shrink-0" />
              <span className="font-display text-lg leading-7 font-medium tracking-[-0.01em] whitespace-nowrap group-data-[state=collapsed]:hidden">
                FocusFlow
              </span>
            </Link>
            <CollapseButton />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <nav aria-label="Main">
            <SidebarGroup className="px-3 py-4">
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {NAV_ITEMS.map((item) => {
                  const isActive = item.exact
                    ? location.pathname === item.to
                    : location.pathname === item.to ||
                      location.pathname.startsWith(`${item.to}/`)
                  const Icon = item.icon

                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        render={<NavLink to={item.to} />}
                        isActive={isActive}
                        tooltip={item.label}
                        className={`h-9 gap-2.5 rounded-md px-3 text-base font-medium text-muted-foreground hover:bg-secondary hover:text-foreground data-[active=true]:bg-accent data-[active=true]:font-semibold data-[active=true]:text-foreground ${ACTIVE_ITEM_CLASSES}`}
                      >
                        <Icon className="size-4" />
                        <span className="group-data-[state=collapsed]:hidden">
                          {item.label}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </nav>
        </SidebarContent>
        <SidebarFooter className="mt-auto gap-2 p-2">
          <ThemeToggle withLabel />
          <UserMenu />
          <div className="group-data-[state=collapsed]:hidden">
            <SidebarFooterInfo />
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-30 flex h-[52px] items-center gap-2 border-b border-border bg-background px-3 md:hidden">
          <MobileMenuButton />
          <Link
            to="/today"
            aria-label="FocusFlow, Today"
            className="flex min-w-0 items-center gap-2 text-foreground"
          >
            <BrandMark className="size-5 shrink-0" />
            <span className="font-display text-md leading-6 font-medium tracking-[-0.01em]">
              FocusFlow
            </span>
          </Link>
          <span className="flex-1" />
          <ThemeToggle />
        </header>
        <div
          id="main-content"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-[1376px] flex-1 flex-col px-4 pt-6 pb-12 md:px-8"
        >
          {children ?? <Outlet />}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function CollapseButton() {
  const { state, setOpen, isMobile } = useSidebar()

  if (isMobile) {
    return null
  }

  const collapsed = state === 'collapsed'

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-expanded={!collapsed}
      aria-controls="sidebar"
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      onClick={() => setOpen(collapsed)}
    >
      <PanelLeftIcon />
    </Button>
  )
}

function SidebarFooterInfo() {
  const { preferences } = useSchedulingPreferences()

  if (!preferences) {
    return null
  }

  return (
    <div className="flex flex-col gap-0.5 border-t border-sidebar-border px-2 pt-3 pb-2 text-sm">
      <span className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
        Working day
      </span>
      <span>{formatDateLabel(getLocalDateString())}</span>
      <span className="text-muted-foreground">
        Work window{' '}
        <span className="font-mono">
          {formatClock(preferences.workDayStart)}–
          {formatClock(preferences.workDayEnd)}
        </span>
      </span>
      {isWorkingDay(new Date(), preferences.workingDays) ? null : (
        <span className="text-muted-foreground">Not a Working day</span>
      )}
    </div>
  )
}

function MobileMenuButton() {
  const { openMobile, toggleSidebar } = useSidebar()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (wasOpen.current && !openMobile) {
      buttonRef.current?.focus()
    }
    wasOpen.current = openMobile
  }, [openMobile])

  return (
    <Button
      ref={buttonRef}
      variant="ghost"
      size="icon-sm"
      aria-label="Open navigation"
      aria-expanded={openMobile}
      aria-controls="sidebar"
      onClick={toggleSidebar}
    >
      <PanelLeftIcon />
    </Button>
  )
}

function UserMenu() {
  const { user } = useCurrentUser()
  const { mutate, isPending } = useLogout()
  const initials = (user?.username || user?.email || '?')
    .slice(0, 2)
    .toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-11 w-full items-center gap-2.5 rounded-md px-2 text-left outline-hidden transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring group-data-[state=collapsed]:h-8 group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:px-0"
        aria-label="User menu"
      >
        <span
          className="inline-grid size-7 shrink-0 place-items-center rounded-full border border-input bg-card text-xs font-semibold tracking-[0.02em]"
          aria-hidden="true"
        >
          {initials}
        </span>
        <span className="flex min-w-0 flex-col group-data-[state=collapsed]:hidden">
          <span className="truncate text-sm leading-[18px] font-medium">
            {user?.username ?? 'Account'}
          </span>
          <span className="truncate text-xs leading-4 text-muted-foreground">
            {user?.email ?? ''}
          </span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{user?.email ?? 'Account'}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuItem render={<Link to="/settings" />}>
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={isPending} onClick={() => mutate()}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
