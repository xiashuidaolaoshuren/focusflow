import type { ReactNode } from 'react'

import { RailOutcome } from '@/features/plans/RailOutcome'
import type { Rail, RailBlock } from '@/features/plans/railModel'
import { cn } from '@/lib/utils'

type DayRailProps = {
  rail: Rail
  /** Omit (or pass undefined) for a read-only rail: blocks open nothing. */
  onSelect?: ((blockId: number) => void) | undefined
}

const KIND_CLASSES: Record<RailBlock['kind'], string> = {
  WORK: 'border-l-[3px] border-l-block-work-edge bg-block-work',
  CADENCE_BREAK:
    'z-1 rounded-sm bg-[repeating-linear-gradient(135deg,var(--block-cadence)_0_1px,transparent_1px_6px)]',
  FIXED_BREAK: 'bg-block-fixed',
  COMMITMENT: 'border-[1.5px] border-block-commitment bg-card',
  BUFFER: 'border-[1.5px] border-dotted border-block-buffer bg-transparent',
}

const BLOCK_BASE =
  'absolute right-0 left-2 z-2 m-0 block w-auto rounded-md p-0 text-left text-foreground outline-none focus-visible:z-6 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring'

function BlockBody({ block }: { block: RailBlock }) {
  const meta =
    block.kind === 'WORK' ? [block.range, block.sessionLabel] : [block.range]
  const end = block.outcome ? <RailOutcome outcome={block.outcome} /> : null

  if (block.layout === 'row') {
    return (
      <span className="flex h-full items-center gap-2 overflow-hidden px-2.5">
        <span className="min-w-0 flex-1 truncate text-sm leading-[18px] font-medium">
          {block.title}
        </span>
        <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">
          {block.range}
        </span>
        {end}
      </span>
    )
  }

  return (
    <span className="flex h-full items-start gap-2 overflow-hidden px-2.5 py-[5px]">
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            'truncate text-sm leading-[18px] font-medium',
            block.kind === 'BUFFER' && 'font-normal text-muted-foreground',
          )}
        >
          {block.title}
        </span>
        <span className="truncate font-mono text-xs leading-4 text-muted-foreground">
          {meta.filter(Boolean).join(' · ')}
        </span>
      </span>
      {end}
    </span>
  )
}

function RailBlockNode({
  block,
  onSelect,
}: {
  block: RailBlock
  onSelect: DayRailProps['onSelect']
}): ReactNode {
  const style = { top: block.topPx + 1, height: block.heightPx }
  const className = cn(
    BLOCK_BASE,
    KIND_CLASSES[block.kind],
    block.isCurrent && 'outline-1 -outline-offset-1 outline-block-work-edge',
    block.outcome?.tone === 'skipped' && 'opacity-60',
  )

  if (block.kind === 'CADENCE_BREAK') {
    return (
      <div
        role="listitem"
        tabIndex={0}
        aria-label={block.label}
        className={cn(className, 'group')}
        style={style}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-sm border border-border bg-popover px-2 py-0.5 text-xs leading-4 whitespace-nowrap text-popover-foreground opacity-0 shadow-popover transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          Cadence break &middot; <span className="font-mono">{block.range}</span>
        </span>
      </div>
    )
  }

  if (block.recordable && onSelect) {
    return (
      <div
        role="listitem"
        className={cn(className, 'hover:bg-block-work/80')}
        style={style}
      >
        <button
          type="button"
          aria-label={`${block.label}. Record outcome`}
          className="block h-full w-full cursor-pointer rounded-md text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          onClick={() => onSelect(block.id)}
        >
          <BlockBody block={block} />
        </button>
      </div>
    )
  }

  return (
    <div
      role="listitem"
      tabIndex={0}
      aria-label={block.label}
      className={className}
      style={style}
    >
      <BlockBody block={block} />
    </div>
  )
}

export function DayRail({ rail, onSelect }: DayRailProps) {
  return (
    <div className="pt-4 pr-4 pb-5">
      <div
        data-rail
        className="relative grid grid-cols-[64px_minmax(0,1fr)]"
        style={{ height: rail.totalPx }}
      >
        <div className="relative" aria-hidden="true">
          {rail.hours.map((hour) => (
            <span
              key={hour.label}
              className={cn(
                'absolute right-3 -translate-y-1/2 font-mono text-xs leading-4 text-muted-foreground transition-opacity',
                hour.nearNow && 'opacity-0',
              )}
              style={{ top: hour.topPx }}
            >
              {hour.label}
            </span>
          ))}
          {rail.peak ? (
            <span
              className="absolute right-0 w-[3px] rounded-sm bg-peak-edge"
              style={{ top: rail.peak.topPx, height: rail.peak.heightPx }}
            />
          ) : null}
        </div>
        <div role="list" aria-label="Daily plan blocks" className="relative">
          {rail.lines.map((line) => (
            <span
              key={line.topPx}
              aria-hidden="true"
              className={cn(
                'absolute right-0 left-0 border-t border-border',
                line.half && 'border-dotted',
              )}
              style={{ top: line.topPx }}
            />
          ))}
          {rail.peak ? (
            <span
              aria-hidden="true"
              className="absolute right-0 left-0 bg-peak"
              style={{ top: rail.peak.topPx, height: rail.peak.heightPx }}
            />
          ) : null}
          {rail.blocks.map((block) => (
            <RailBlockNode key={block.id} block={block} onSelect={onSelect} />
          ))}
        </div>
        {rail.nowTopPx != null && rail.nowLabel != null ? (
          <div
            role="img"
            aria-label={`Now ${rail.nowLabel}`}
            className="pointer-events-none absolute inset-x-0 top-0 z-5 h-0 transition-transform duration-200 ease-linear motion-reduce:transition-none"
            style={{ transform: `translateY(${rail.nowTopPx}px)` }}
          >
            <span className="absolute top-0 left-1.5 -translate-y-1/2 rounded-sm bg-now-strong px-1.5 py-px font-mono text-xs leading-4 font-medium text-now-foreground">
              {rail.nowLabel}
            </span>
            <span className="absolute top-[-1px] right-0 left-16 h-0.5 bg-now before:absolute before:top-[-3px] before:left-[-4px] before:size-2 before:rounded-full before:bg-now" />
          </div>
        ) : null}
      </div>
    </div>
  )
}
