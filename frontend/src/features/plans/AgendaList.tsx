import { SHARED_BLOCK_KIND_CLASSES } from '@/features/plans/blockKindStyles'
import { RailOutcome } from '@/features/plans/RailOutcome'
import type { Rail, RailBlock } from '@/features/plans/railModel'
import { cn } from '@/lib/utils'

type AgendaListProps = {
  rail: Rail
  /** Omit (or pass undefined) for a read-only rail: blocks open nothing. */
  onSelect?: ((blockId: number) => void) | undefined
}

const ITEM_CLASSES: Record<RailBlock['kind'], string> = {
  ...SHARED_BLOCK_KIND_CLASSES,
  CADENCE_BREAK:
    'min-h-7 bg-[repeating-linear-gradient(135deg,var(--block-cadence)_0_1px,transparent_1px_6px)]',
}

const KIND_SUBTITLE: Partial<Record<RailBlock['kind'], string>> = {
  COMMITMENT: 'Commitment · unavailable',
  FIXED_BREAK: 'Fixed break',
  BUFFER: 'Trailing buffer',
}

function startHour(block: RailBlock): number {
  return Math.floor(block.startMinutes / 60)
}

function NowRow({ label }: { label: string }) {
  return (
    <div
      role="img"
      aria-label={`Now ${label}`}
      className="my-1 flex items-center gap-2"
    >
      <span className="rounded-sm bg-now-strong px-1.5 py-px font-mono text-xs leading-4 font-medium text-now-foreground">
        {label}
      </span>
      <span className="h-0.5 flex-1 rounded-[1px] bg-now" />
    </div>
  )
}

function AgendaItem({
  block,
  onSelect,
}: {
  block: RailBlock
  onSelect: AgendaListProps['onSelect']
}) {
  const [start = '', end = ''] = block.range.split('–')
  const className = cn(
    'grid min-h-12 w-full grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-3 py-2 text-left text-foreground outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring',
    ITEM_CLASSES[block.kind],
    block.isCurrent && 'outline-1 -outline-offset-1 outline-block-work-edge',
    block.outcome?.tone === 'skipped' && 'opacity-60',
  )
  const time = (
    <span className="flex flex-col font-mono text-xs leading-4 text-muted-foreground">
      <span>{start}</span>
      <span>{end}</span>
    </span>
  )

  if (block.kind === 'CADENCE_BREAK') {
    return (
      <div role="listitem" tabIndex={0} aria-label={block.label} className={className}>
        {time}
        <span className="text-xs text-muted-foreground">Cadence break</span>
        <span />
      </div>
    )
  }

  const subtitle =
    block.kind === 'WORK' ? block.sessionLabel : (KIND_SUBTITLE[block.kind] ?? null)
  const body = (
    <>
      {time}
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm leading-[18px] font-medium">
          {block.title}
        </span>
        {subtitle ? (
          <span className="truncate text-xs leading-4 text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
      </span>
      {block.outcome ? <RailOutcome outcome={block.outcome} /> : <span />}
    </>
  )

  if (block.recordable && onSelect) {
    return (
      <div role="listitem">
        <button
          type="button"
          aria-label={`${block.label}. Record outcome`}
          className={className}
          onClick={() => onSelect(block.id)}
        >
          {body}
        </button>
      </div>
    )
  }

  return (
    <div role="listitem" tabIndex={0} aria-label={block.label} className={className}>
      {body}
    </div>
  )
}

export function AgendaList({ rail, onSelect }: AgendaListProps) {
  const groups = new Map<number, RailBlock[]>()
  for (const block of rail.blocks) {
    const hour = startHour(block)
    groups.set(hour, [...(groups.get(hour) ?? []), block])
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => a - b)

  const nowLabel = rail.nowLabel
  const nowMinutes = rail.nowMinutes
  const showNow = nowLabel != null && nowMinutes != null
  const nowBefore = showNow
    ? ordered
        .flatMap(([, blocks]) => blocks)
        .find((block) => block.startMinutes > nowMinutes)
    : undefined

  return (
    <div className="p-3">
      {ordered.map(([hour, blocks]) => (
        <section key={hour} className="not-first:mt-4">
          <h3 className="px-1 pb-1 text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
            {String(hour).padStart(2, '0')}:00
          </h3>
          <div role="list" className="grid gap-1.5">
            {blocks.map((block) => (
              <div key={block.id} className="contents">
                {block === nowBefore && nowLabel != null ? (
                  <NowRow label={nowLabel} />
                ) : null}
                <AgendaItem block={block} onSelect={onSelect} />
              </div>
            ))}
          </div>
        </section>
      ))}
      {showNow && nowBefore == null ? <NowRow label={nowLabel} /> : null}
    </div>
  )
}
