import {
  BanIcon,
  CircleCheckIcon,
  CircleDotIcon,
  CircleOffIcon,
  CircleSlashIcon,
  ClockIcon,
  PlayIcon,
} from 'lucide-react'
import type { ComponentType } from 'react'

import type { OutcomeTone, OutcomeView } from '@/features/plans/railModel'
import { cn } from '@/lib/utils'

const ICONS: Record<OutcomeTone, ComponentType<{ className?: string }>> = {
  done: CircleCheckIcon,
  partly: CircleDotIcon,
  skipped: CircleSlashIcon,
  gone: CircleOffIcon,
  current: PlayIcon,
  log: ClockIcon,
  commitment: BanIcon,
}

const TONE_CLASSES: Record<OutcomeTone, string> = {
  done: 'text-outcome-done',
  partly: 'text-outcome-partly',
  skipped: 'text-outcome-skipped',
  gone: 'text-muted-foreground',
  current: 'text-status-in-progress',
  log: 'text-muted-foreground',
  commitment: 'text-block-commitment',
}

export function RailOutcome({ outcome }: { outcome: OutcomeView }) {
  const Icon = ICONS[outcome.tone]

  return (
    <span
      className={cn(
        'inline-flex flex-none items-center gap-1 text-xs leading-[18px] font-medium tracking-[0.01em] whitespace-nowrap',
        TONE_CLASSES[outcome.tone],
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {outcome.text}
    </span>
  )
}
