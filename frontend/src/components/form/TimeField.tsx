import { useId, useState, type KeyboardEvent } from 'react'

import { parseTimeInput, stepTime } from '@/components/form/timeInput'
import { cn } from '@/lib/utils'

const timeInputClassName =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 font-mono text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40'

export type TimeFieldProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

export function TimeField({
  id: idProp,
  value,
  onChange,
  disabled,
  placeholder = 'HH:MM',
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: TimeFieldProps) {
  const generatedId = useId()
  const id = idProp ?? generatedId
  const [draft, setDraft] = useState(value)
  const [trackedValue, setTrackedValue] = useState(value)
  const [blurred, setBlurred] = useState(false)

  // Adopt a value changed from outside without an effect.
  if (value !== trackedValue) {
    setTrackedValue(value)
    setDraft(value)
  }

  const invalid =
    ariaInvalid === true ||
    (draft.trim() !== '' && parseTimeInput(draft) === null)

  const commitFromValue = (raw: string) => {
    const normalized = parseTimeInput(raw)
    if (normalized !== null) {
      setDraft(normalized)
      onChange(normalized)
      return
    }
    setDraft(raw)
    onChange(raw)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      commitFromValue(stepTime(draft, event.key === 'ArrowUp' ? 1 : -1, event.shiftKey))
      return
    }
    if (event.key === 'Enter') {
      const normalized = parseTimeInput(draft)
      if (normalized !== null && normalized !== draft) {
        event.preventDefault()
        commitFromValue(draft)
      }
    }
  }

  // Explain a bad time only after the field is left, and only when the parent is not already showing an error.
  const showHint =
    blurred && ariaInvalid !== true && draft.trim() !== '' && parseTimeInput(draft) === null
  const hintId = `${id}-hint`

  return (
    <>
      <input
        data-slot="input"
        id={id}
        inputMode="numeric"
        disabled={disabled}
        placeholder={placeholder}
        value={draft}
        className={cn(timeInputClassName)}
        aria-invalid={invalid || undefined}
        aria-describedby={showHint ? hintId : ariaDescribedBy}
        onChange={(event) => {
          setBlurred(false)
          setDraft(event.target.value)
          onChange(event.target.value)
        }}
        onBlur={() => {
          commitFromValue(draft)
          setBlurred(true)
        }}
        onKeyDown={onKeyDown}
      />
      {showHint ? (
        <p id={hintId} role="alert" className="text-xs leading-4 text-destructive">
          Use 24-hour HH:MM, e.g. 09:30.
        </p>
      ) : null}
    </>
  )
}
