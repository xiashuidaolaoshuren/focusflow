import {
  BanIcon,
  CircleCheckIcon,
  CircleOffIcon,
  ClockIcon,
  PlayIcon,
} from 'lucide-react'
import type { ComponentType } from 'react'

import type { OutcomeTone, OutcomeView } from '@/features/plans/railModel'
import { cn } from '@/lib/utils'

type GlyphProps = { className?: string | undefined }

/** DESIGN: a half-filled circle, so partly done never reads as "in progress" (a dot). */
function HalfCircleGlyph({ className }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** DESIGN: a double chevron for a skipped block. */
function DoubleChevronGlyph({ className }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M3.5 4l4 4-4 4M8.5 4l4 4-4 4" />
    </svg>
  )
}

const ICONS: Record<OutcomeTone, ComponentType<GlyphProps>> = {
  done: CircleCheckIcon,
  partly: HalfCircleGlyph,
  skipped: DoubleChevronGlyph,
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

export function RailOutcome({
  outcome,
  iconOnly = false,
  className,
}: {
  outcome: OutcomeView
  iconOnly?: boolean
  className?: string
}) {
  const Icon = ICONS[outcome.tone]

  return (
    <span
      className={cn(
        'inline-flex flex-none items-center gap-1 text-xs leading-[18px] font-medium tracking-[0.01em] whitespace-nowrap',
        TONE_CLASSES[outcome.tone],
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {iconOnly ? null : outcome.text}
    </span>
  )
}
