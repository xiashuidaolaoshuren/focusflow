import { labelledBlock, toBlockTime } from '@/features/plans/blockFactory'
import type {
  DailyPlanResponse,
  ScheduledBlockResponse,
  BlockKind,
  TaskSnapshotResponse,
} from '@/types/api'

/** Placeholder snapshot so the preview's work blocks parse like a real plan's. */
const PREVIEW_TASK_SNAPSHOT: TaskSnapshotResponse = {
  sourceTaskId: 0,
  taskReferenceId: null,
  title: 'Focus session',
  priority: 'MEDIUM',
  status: 'OPEN',
  dueDate: null,
  estimatedMinutes: null,
  capturedRemainingEffortMinutes: null,
  mustInclude: false,
  capturedCheckpointId: null,
  neededForTaskId: null,
}

export type TypicalDayInput = {
  workDayStart: string
  workDayEnd: string
  bufferMinutes: number
  cadenceEnabled: boolean
  targetFocusMinutes: number
  breakMinutes: number
  minSessionMinutes: number
  fixedBreaks: { label: string; startTime: string; endTime: string }[]
  peakStart: string | null
  peakEnd: string | null
}

export type TypicalDayPlan = Pick<
  DailyPlanResponse,
  'composedRail' | 'windowStart' | 'windowEnd' | 'peakStart' | 'peakEnd'
>

export type TypicalDayResult = {
  plan: TypicalDayPlan
  focusMinutes: number
  sessions: number
}

type Draft = { kind: BlockKind; start: number; end: number; label: string | null }

function toMinutes(time: string): number {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number)
  return (hours ?? 0) * 60 + (minutes ?? 0)
}

function toBlock(draft: Draft, id: number, session: { index: number; count: number } | null): ScheduledBlockResponse {
  if (draft.kind === 'WORK') {
    return {
      id,
      revisionId: 0,
      outcome: null,
      actualMinutes: null,
      reconciled: false,
      progressVersion: 0,
      displayState: 'ACTIONABLE',
      startTime: toBlockTime(draft.start),
      endTime: toBlockTime(draft.end),
      kind: 'WORK',
      sessionIndex: session?.index ?? 1,
      sessionCount: session?.count ?? 1,
      taskSnapshot: PREVIEW_TASK_SNAPSHOT,
      label: null,
    }
  }
  return labelledBlock(draft.kind, draft.start, draft.end, draft.label ?? '', id)
}

export function typicalDay(input: TypicalDayInput): TypicalDayResult | null {
  const start = toMinutes(input.workDayStart)
  const workEnd = toMinutes(input.workDayEnd)
  if (workEnd <= start) {
    return null
  }
  const end = workEnd - input.bufferMinutes
  const breaks = input.fixedBreaks
    .map((fixed) => ({
      kind: 'FIXED_BREAK' as const,
      start: toMinutes(fixed.startTime),
      end: toMinutes(fixed.endTime),
      label: fixed.label.trim() === '' ? 'Fixed break' : fixed.label.trim(),
    }))
    .sort((a, b) => a.start - b.start)
  const drafts: Draft[] = [...breaks]

  // Free slots between fixed breaks, clipped to the usable window.
  const slots: [number, number][] = []
  let cur = start
  for (const fixed of breaks) {
    if (fixed.end <= cur) continue
    if (fixed.start > cur) slots.push([cur, Math.min(fixed.start, end)])
    cur = Math.max(cur, fixed.end)
  }
  if (cur < end) slots.push([cur, end])

  for (const [slotStart, slotEnd] of slots) {
    let run = 0
    let cursor = slotStart

    while (cursor < slotEnd) {
      if (input.cadenceEnabled && run >= input.targetFocusMinutes) {
        if (slotEnd - cursor >= input.breakMinutes + input.minSessionMinutes) {
          drafts.push({ kind: 'CADENCE_BREAK', start: cursor, end: cursor + input.breakMinutes, label: 'Cadence break' })
          cursor += input.breakMinutes
        }
        run = 0
        if (slotEnd - cursor < input.minSessionMinutes) break
        continue
      }
      const chunk = Math.min(input.targetFocusMinutes, slotEnd - cursor)
      if (chunk < input.minSessionMinutes) break
      drafts.push({ kind: 'WORK', start: cursor, end: cursor + chunk, label: null })
      cursor += chunk
      run += chunk
    }
  }

  if (input.bufferMinutes > 0) {
    drafts.push({ kind: 'BUFFER', start: end, end: workEnd, label: 'Trailing buffer' })
  }
  drafts.sort((a, b) => a.start - b.start)

  const workDrafts = drafts.filter((draft) => draft.kind === 'WORK')
  let workIndex = 0
  const composedRail = drafts.map((draft, index) => {
    if (draft.kind === 'WORK') {
      workIndex += 1
      return toBlock(draft, index + 1, { index: workIndex, count: workDrafts.length })
    }
    return toBlock(draft, index + 1, null)
  })

  return {
    plan: {
      composedRail,
      windowStart: toBlockTime(start),
      windowEnd: toBlockTime(toMinutes(input.workDayEnd)),
      peakStart: input.peakStart ? toBlockTime(toMinutes(input.peakStart)) : null,
      peakEnd: input.peakEnd ? toBlockTime(toMinutes(input.peakEnd)) : null,
    },
    focusMinutes: workDrafts.reduce((total, draft) => total + (draft.end - draft.start), 0),
    sessions: workDrafts.length,
  }
}
