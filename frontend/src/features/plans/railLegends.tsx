import { RailOutcome } from '@/features/plans/RailOutcome'
import { KIND_LABELS, type OutcomeTone } from '@/features/plans/railModel'
import type { BlockKind } from '@/types/api'

const SWATCHES: Record<BlockKind, string> = {
  WORK: 'border-l-[3px] border-l-block-work-edge bg-block-work',
  CADENCE_BREAK:
    'bg-[repeating-linear-gradient(135deg,var(--block-cadence)_0_1px,transparent_1px_6px)]',
  FIXED_BREAK: 'bg-block-fixed',
  COMMITMENT: 'border border-block-commitment bg-card',
  BUFFER: 'border border-dotted border-block-buffer bg-transparent',
}

const BLOCK_KIND_ORDER: BlockKind[] = [
  'WORK',
  'CADENCE_BREAK',
  'FIXED_BREAK',
  'COMMITMENT',
  'BUFFER',
]

/** Every kind of block the rail can draw, with the swatch it uses. */
export function BlockKindLegend() {
  return (
    <ul className="grid gap-1.5">
      {BLOCK_KIND_ORDER.map((kind) => (
        <li key={kind} className="grid grid-cols-[32px_minmax(0,1fr)] items-center gap-2.5">
          <span
            aria-hidden="true"
            className={`h-3.5 w-8 rounded-sm ${SWATCHES[kind]}`}
          />
          <span>{KIND_LABELS[kind]}</span>
        </li>
      ))}
    </ul>
  )
}

const OUTCOME_ROWS: { tone: OutcomeTone; text: string }[] = [
  { tone: 'done', text: 'Done' },
  { tone: 'partly', text: 'Partly done' },
  { tone: 'skipped', text: 'Skipped' },
  { tone: 'current', text: 'In progress' },
  { tone: 'log', text: 'Log outcome' },
]

/** What each outcome glyph and word on the rail means. */
export function OutcomeLegend() {
  return (
    <ul className="grid gap-1.5">
      {OUTCOME_ROWS.map((outcome) => (
        <li key={outcome.tone}>
          <RailOutcome outcome={outcome} />
        </li>
      ))}
    </ul>
  )
}
