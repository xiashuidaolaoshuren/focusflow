import type { PlanRevisionResponse } from '@/types/api'

type PlanRevisionSwitchProps = {
  revisions: PlanRevisionResponse[]
  selectedRevisionId: number | null
  onSelect: (revisionId: number | null) => void
}

/** Segmented revision picker. Shown only when a plan has more than one revision. */
export function PlanRevisionSwitch({
  revisions,
  selectedRevisionId,
  onSelect,
}: PlanRevisionSwitchProps) {
  if (revisions.length < 2) {
    return null
  }

  const checkedValue = selectedRevisionId == null ? 'current' : String(selectedRevisionId)

  return (
    <fieldset className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-muted p-1">
      <legend className="sr-only">Revision</legend>
      <RevisionOption
        value="current"
        label="Current"
        checked={checkedValue === 'current'}
        onSelect={() => onSelect(null)}
      />
      {revisions.map((revision) => (
        <RevisionOption
          key={revision.id}
          value={String(revision.id)}
          label={`Rev ${revision.revisionNumber}`}
          checked={checkedValue === String(revision.id)}
          onSelect={() => onSelect(revision.id)}
        />
      ))}
    </fieldset>
  )
}

type RevisionOptionProps = {
  value: string
  label: string
  checked: boolean
  onSelect: () => void
}

function RevisionOption({ value, label, checked, onSelect }: RevisionOptionProps) {
  return (
    <label
      className={`cursor-pointer rounded-md px-3 py-1 text-sm font-medium has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 ${
        checked ? 'bg-background text-foreground' : 'text-muted-foreground'
      }`}
    >
      <input
        type="radio"
        name="plan-revision"
        value={value}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      {label}
    </label>
  )
}
