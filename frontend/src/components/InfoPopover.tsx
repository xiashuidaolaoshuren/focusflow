import type { ReactNode } from 'react'
import { InfoIcon } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type InfoPopoverProps = {
  label: string
  title: string
  children: ReactNode
  align?: 'start' | 'center' | 'end'
}

/**
 * A short explanation behind an ⓘ button. The trigger is keyboard operable; Escape
 * closes the panel and returns focus to the trigger.
 */
export function InfoPopover({ label, title, children, align = 'start' }: InfoPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={label}
        className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <InfoIcon className="size-4" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[280px] space-y-2 text-sm">
        <p className="text-sm leading-5 font-semibold">{title}</p>
        <div className="text-xs leading-5 text-muted-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  )
}
