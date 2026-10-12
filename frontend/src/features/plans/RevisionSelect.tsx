import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PlanRevisionResponse } from '@/types/api'

const CURRENT_VALUE = 'current'

type RevisionSelectProps = {
  revisions: PlanRevisionResponse[]
  selectedRevisionId: number | null
  onSelect: (revisionId: number | null) => void
}

export function RevisionSelect({
  revisions,
  selectedRevisionId,
  onSelect,
}: RevisionSelectProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label>Revision</Label>
      <Select
        value={
          selectedRevisionId == null ? CURRENT_VALUE : String(selectedRevisionId)
        }
        onValueChange={(value) =>
          onSelect(
            value == null || value === CURRENT_VALUE
              ? null
              : Number.parseInt(value, 10),
          )
        }
      >
        <SelectTrigger aria-label="Revision" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value={CURRENT_VALUE}>Current (composed day)</SelectItem>
            {revisions.map((revision) => (
              <SelectItem key={revision.id} value={String(revision.id)}>
                Revision {revision.revisionNumber}
                {revision.cutoff != null
                  ? ` · from ${revision.cutoff.slice(0, 5)}`
                  : ''}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
