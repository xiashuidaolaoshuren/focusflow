import type { RailBlock } from '@/features/plans/railModel'

/**
 * Fill and edge classes for each block kind, shared by the desktop rail and the mobile agenda so a
 * state change cannot drift between them. Cadence breaks differ in geometry per view and are
 * supplied locally.
 */
export const SHARED_BLOCK_KIND_CLASSES: Record<
  Exclude<RailBlock['kind'], 'CADENCE_BREAK'>,
  string
> = {
  WORK: 'border-l-[3px] border-l-block-work-edge bg-block-work',
  FIXED_BREAK: 'bg-block-fixed',
  COMMITMENT: 'border-[1.5px] border-block-commitment bg-card',
  BUFFER: 'border-[1.5px] border-dotted border-block-buffer bg-transparent',
}
