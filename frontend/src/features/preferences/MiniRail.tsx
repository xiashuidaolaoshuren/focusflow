import type { Rail, RailBlock } from '@/features/plans/railModel'
import { cn } from '@/lib/utils'

type MiniRailProps = {
  rail: Rail
}

const MINI_KIND_CLASSES: Record<RailBlock['kind'], string> = {
  WORK: 'border-l-2 border-l-block-work-edge bg-block-work',
  CADENCE_BREAK:
    'bg-[repeating-linear-gradient(135deg,var(--block-cadence)_0_1px,transparent_1px_6px)]',
  FIXED_BREAK: 'bg-block-fixed',
  COMMITMENT: 'border-[1.5px] border-block-commitment bg-card',
  BUFFER: 'border-[1.5px] border-dotted border-block-buffer bg-transparent',
}

export function MiniRail({ rail }: MiniRailProps) {
  return (
    <div
      data-rail
      className="relative grid grid-cols-[44px_minmax(0,1fr)]"
      style={{ height: rail.totalPx }}
    >
      <div className="relative" aria-hidden="true">
        {rail.hours.map((hour) => (
          <span
            key={hour.label}
            className="absolute right-2 -translate-y-1/2 font-mono text-[11px] leading-4 text-muted-foreground"
            style={{ top: hour.topPx }}
          >
            {hour.label}
          </span>
        ))}
      </div>
      <div className="relative">
        {rail.peak ? (
          <div
            role="img"
            aria-label="Peak window"
            className="absolute inset-x-0 bg-muted/60"
            style={{ top: rail.peak.topPx, height: rail.peak.heightPx }}
          />
        ) : null}
        <div role="list" aria-label="Typical day preview" className="relative">
          {rail.blocks.map((block) => (
            <div
              key={block.id}
              role="listitem"
              aria-label={block.label}
              className={cn(
                'absolute right-0 left-1 rounded-sm',
                MINI_KIND_CLASSES[block.kind],
              )}
              style={{ top: block.topPx + 1, height: block.heightPx }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
