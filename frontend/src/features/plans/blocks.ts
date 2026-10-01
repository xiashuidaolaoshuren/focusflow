import type {
  LabelledBlockResponse,
  ScheduledBlockResponse,
  WorkBlockResponse,
} from '@/types/api'

export type { LabelledBlockResponse, ScheduledBlockResponse, WorkBlockResponse }

export function parseScheduledBlock(block: ScheduledBlockResponse): ScheduledBlockResponse {
  const { startTime } = block as { startTime: string }

  if (block.kind === 'WORK') {
    if (block.taskSnapshot == null) {
      throw new Error(`invalid work block: task snapshot is required (${startTime})`)
    }
    if (block.label != null) {
      throw new Error(`invalid work block: label must be null (${startTime})`)
    }
    if (block.sessionIndex == null || block.sessionCount == null) {
      throw new Error(`invalid work block: session numbering is required (${startTime})`)
    }
    return block as WorkBlockResponse
  }

  if (block.label == null || block.label === '') {
    throw new Error(`invalid non-work block: label is required (${startTime})`)
  }
  if (block.taskSnapshot != null) {
    throw new Error(`invalid non-work block: task snapshot must be null (${startTime})`)
  }
  if (block.sessionIndex != null || block.sessionCount != null) {
    throw new Error(`invalid non-work block: session numbering must be null (${startTime})`)
  }
  return block as LabelledBlockResponse
}