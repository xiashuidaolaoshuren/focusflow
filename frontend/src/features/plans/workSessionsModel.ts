import type { OutcomeView } from '@/features/plans/railModel'
import { formatClock } from '@/lib/format'
import type { ScheduledBlockResponse, WorkBlockResponse } from '@/types/api'

export type SessionLabel = 'Recorded' | 'Not recorded' | 'No longer needed'

export type SessionRow = {
  blockId: number
  title: string
  range: string
  status: OutcomeView
  minutes: number | null
}

export type SessionGroup = {
  label: SessionLabel
  items: SessionRow[]
}

const GROUP_ORDER: SessionLabel[] = [
  'Recorded',
  'Not recorded',
  'No longer needed',
]

const OUTCOME_STATUS = {
  DONE: { tone: 'done', text: 'Done' },
  PARTLY_DONE: { tone: 'partly', text: 'Partly done' },
  SKIPPED: { tone: 'skipped', text: 'Skipped' },
} as const

const GONE_STATUS: OutcomeView = { tone: 'gone', text: 'No longer needed' }
const NOT_RECORDED_STATUS: OutcomeView = { tone: 'log', text: 'Not recorded' }

function groupOf(block: WorkBlockResponse): SessionLabel {
  if (block.displayState === 'NO_LONGER_NEEDED') {
    return 'No longer needed'
  }
  return block.outcome != null ? 'Recorded' : 'Not recorded'
}

function toRow(block: WorkBlockResponse): SessionRow {
  const group = groupOf(block)
  const status: OutcomeView =
    group === 'No longer needed'
      ? GONE_STATUS
      : block.outcome != null
        ? OUTCOME_STATUS[block.outcome]
        : NOT_RECORDED_STATUS

  return {
    blockId: block.id,
    title: block.taskSnapshot.title,
    range: `${formatClock(block.startTime)}–${formatClock(block.endTime)}`,
    status,
    minutes: group === 'Recorded' ? (block.actualMinutes ?? 0) : null,
  }
}

function startMinutes(block: WorkBlockResponse): number {
  return Number(block.startTime.slice(0, 2)) * 60 + Number(block.startTime.slice(3, 5))
}

/**
 * Work sessions for a plan revision: an outcome is recorded, a block without one is not, and a
 * block the plan dropped is no longer needed. Non-work blocks never appear here.
 */
export function buildWorkSessions(
  blocks: ScheduledBlockResponse[],
): SessionGroup[] {
  const work = blocks
    .filter((block): block is WorkBlockResponse => block.kind === 'WORK')
    .sort((left, right) => startMinutes(left) - startMinutes(right))

  return GROUP_ORDER.map((label) => ({
    label,
    items: work.filter((block) => groupOf(block) === label).map(toRow),
  })).filter((group) => group.items.length > 0)
}
