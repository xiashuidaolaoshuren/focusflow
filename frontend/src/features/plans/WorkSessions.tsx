import { RailOutcome } from '@/features/plans/RailOutcome'
import { buildWorkSessions } from '@/features/plans/workSessionsModel'
import { formatDuration } from '@/lib/format'
import type { ScheduledBlockResponse } from '@/types/api'

/** Recorded, not recorded and no longer needed sessions for one plan revision. */
export function WorkSessions({ blocks }: { blocks: ScheduledBlockResponse[] }) {
  const groups = buildWorkSessions(blocks)
  const total = groups.reduce((count, group) => count + group.items.length, 0)

  return (
    <section
      aria-labelledby="work-sessions-title"
      className="rounded-lg border border-border bg-card"
    >
      <div className="flex min-h-12 items-center gap-2 border-b border-border px-4 py-2">
        <h2
          id="work-sessions-title"
          className="text-base leading-5 font-semibold"
        >
          Work sessions
        </h2>
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {total}
        </span>
      </div>
      {groups.map((group) => (
        <div key={group.label} className="py-2">
          <h3 className="flex items-center gap-2 px-4 pb-1 text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
            {group.label}
            <span className="font-mono">{group.items.length}</span>
          </h3>
          <ul>
            {group.items.map((item) => (
              <li
                key={item.blockId}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <span className="inline-flex flex-none">
                  <RailOutcome outcome={item.status} iconOnly />
                  <span className="sr-only">{item.status.text}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm leading-[18px] font-medium">
                    {item.title}
                  </span>
                  <span className="text-xs leading-4 text-muted-foreground">
                    <span className="font-mono">{item.range}</span> &middot;{' '}
                    {item.status.text}
                  </span>
                </span>
                <span className="flex-none text-right font-mono text-sm">
                  {item.minutes != null ? formatDuration(item.minutes) : '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
