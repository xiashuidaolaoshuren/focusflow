import {
  useCallback,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
} from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import {
  MONTH_NAMES,
  WEEKDAY_SHORT,
  addDays,
  addMonths,
  buildMonthGrid,
  parseIso,
} from '@/components/form/calendarMath'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { formatDateLabel } from '@/lib/format'
import { getLocalDateString } from '@/lib/planningDate'
import { cn } from '@/lib/utils'

export type DateFieldProps = {
  id?: string
  value: string
  onChange: (iso: string) => void
  min?: string
  max?: string
  disabled?: boolean
  placeholder?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

function monthAnchor(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`
}

function labelForIso(iso: string): string {
  const parsed = parseIso(iso)
  if (!parsed) {
    return iso
  }
  return `${parsed.day} ${MONTH_NAMES[parsed.monthIndex]} ${parsed.year}`
}

export function DateField({
  id: idProp,
  value,
  onChange,
  min,
  max,
  disabled,
  placeholder = 'Select date',
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: DateFieldProps) {
  const generatedId = useId()
  const id = idProp ?? generatedId
  const today = getLocalDateString()
  const [open, setOpen] = useState(false)

  const seeded = parseIso(value !== '' ? value : today)
  const [viewYear, setViewYear] = useState(seeded?.year ?? 2026)
  const [viewMonthIndex, setViewMonthIndex] = useState(seeded?.monthIndex ?? 0)
  const [focusedIso, setFocusedIso] = useState(value !== '' ? value : today)

  const [trackedValue, setTrackedValue] = useState(value)

  // Adopt a value changed from outside without an effect.
  if (value !== trackedValue) {
    setTrackedValue(value)
    const parsed = parseIso(value)
    if (parsed) {
      setViewYear(parsed.year)
      setViewMonthIndex(parsed.monthIndex)
      setFocusedIso(value)
    }
  }

  const grid = useMemo(
    () => buildMonthGrid(viewYear, viewMonthIndex),
    [viewYear, viewMonthIndex],
  )

  const isDisabled = useCallback(
    (iso: string) => {
      if (min !== undefined && iso < min) {
        return true
      }
      if (max !== undefined && iso > max) {
        return true
      }
      return false
    },
    [min, max],
  )

  const selectDay = (iso: string) => {
    if (isDisabled(iso)) {
      return
    }
    onChange(iso)
    setOpen(false)
  }

  const shiftMonth = (delta: number) => {
    const next = addMonths(monthAnchor(viewYear, viewMonthIndex), delta)
    const parsed = parseIso(next)
    if (parsed) {
      setViewYear(parsed.year)
      setViewMonthIndex(parsed.monthIndex)
    }
  }

  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    let next = focusedIso
    if (event.key === 'ArrowRight') {
      next = addDays(focusedIso, 1)
    } else if (event.key === 'ArrowLeft') {
      next = addDays(focusedIso, -1)
    } else if (event.key === 'ArrowDown') {
      next = addDays(focusedIso, 7)
    } else if (event.key === 'ArrowUp') {
      next = addDays(focusedIso, -7)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      selectDay(focusedIso)
      return
    } else {
      return
    }
    event.preventDefault()
    setFocusedIso(next)
    const parsed = parseIso(next)
    if (parsed) {
      setViewYear(parsed.year)
      setViewMonthIndex(parsed.monthIndex)
    }
    queueMicrotask(() => {
      const label = labelForIso(next)
      const candidate = document.querySelector(
        `button[aria-label="${label}"]`,
      )
      if (candidate instanceof HTMLElement) {
        candidate.focus()
      }
    })
  }

  const display = value !== '' ? formatDateLabel(value) : placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        type="button"
        disabled={disabled}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        className={cn(
          buttonVariants({ variant: 'outline' }),
          'w-full justify-start font-normal',
        )}
      >
        {display}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" onKeyDown={onGridKeyDown}>
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft />
          </Button>
          <h2 className="text-sm font-medium">
            {MONTH_NAMES[viewMonthIndex]} {viewYear}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 p-2 text-center text-xs text-muted-foreground">
          {WEEKDAY_SHORT.map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 p-2 pt-0" role="grid">
          {grid.map((cell) => {
            const parsed = parseIso(cell.iso)
            const selected = value === cell.iso
            const isToday = cell.iso === today
            const focused = cell.iso === focusedIso
            const dayDisabled = isDisabled(cell.iso)
            return (
              <button
                key={cell.iso}
                type="button"
                role="gridcell"
                tabIndex={focused ? 0 : -1}
                disabled={dayDisabled}
                aria-label={labelForIso(cell.iso)}
                aria-selected={selected}
                data-today={isToday ? 'true' : undefined}
                className={cn(
                  'h-8 w-8 rounded-md text-sm',
                  !cell.inMonth && 'text-muted-foreground',
                  selected && 'bg-primary text-primary-foreground',
                  isToday && !selected && 'ring-1 ring-ring',
                )}
                onClick={() => selectDay(cell.iso)}
                onFocus={() => setFocusedIso(cell.iso)}
              >
                {parsed?.day}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
