import { MoonIcon, SunIcon } from 'lucide-react'

import { useTheme } from '@/components/theme/ThemeProvider'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const { theme, toggleTheme } = useTheme()
  const label = theme === 'dark' ? 'Light theme' : 'Dark theme'

  return (
    <Button
      type="button"
      variant="ghost"
      size={withLabel ? 'default' : 'icon'}
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className={cn(
        withLabel &&
          'w-full justify-start gap-2.5 px-2.5 text-sm font-medium text-muted-foreground group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:px-0',
      )}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      {withLabel ? (
        <span className="group-data-[state=collapsed]:hidden">{label}</span>
      ) : null}
    </Button>
  )
}
