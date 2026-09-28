import { useEffect, useId, useState, type FormEvent } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useSchedulingPreferences,
  useUpdateSchedulingPreferences,
} from '@/features/preferences/hooks'
import { ApiError } from '@/lib/api'
import type {
  FixedBreakRequest,
  SchedulingPreferencesRequest,
  SchedulingPreferencesResponse,
} from '@/types/api'

type FixedBreakField = {
  clientId: string
  label: string
  startTime: string
  endTime: string
}

function toTimeInputValue(apiTime: string): string {
  return apiTime.slice(0, 5)
}

function toApiTime(timeInput: string): string {
  if (timeInput.length === 5) {
    return `${timeInput}:00`
  }
  return timeInput
}

function getFieldError(
  error: Error | null,
  fieldName: string,
): string | undefined {
  if (!(error instanceof ApiError) || !error.details) {
    return undefined
  }
  return error.details[fieldName]?.[0]
}

function preferencesToFormState(preferences: SchedulingPreferencesResponse) {
  return {
    workDayStart: toTimeInputValue(preferences.workDayStart),
    workDayEnd: toTimeInputValue(preferences.workDayEnd),
    cadenceEnabled: preferences.cadenceEnabled,
    targetFocusMinutes: preferences.targetFocusMinutes,
    breakMinutes: preferences.breakMinutes,
    minSessionMinutes: preferences.minSessionMinutes,
    bufferMinutes: preferences.bufferMinutes,
    peakStart:
      preferences.peakStart != null
        ? toTimeInputValue(preferences.peakStart)
        : '',
    peakEnd:
      preferences.peakEnd != null ? toTimeInputValue(preferences.peakEnd) : '',
    fixedBreaks: preferences.fixedBreaks.map((fixedBreak, index) => ({
      clientId: `break-${index}`,
      label: fixedBreak.label,
      startTime: toTimeInputValue(fixedBreak.startTime),
      endTime: toTimeInputValue(fixedBreak.endTime),
    })),
    persisted: preferences.persisted,
  }
}

function buildRequest(
  formState: ReturnType<typeof preferencesToFormState>,
): SchedulingPreferencesRequest {
  const fixedBreaks: FixedBreakRequest[] = formState.fixedBreaks.map(
    (fixedBreak) => ({
      label: fixedBreak.label,
      startTime: toApiTime(fixedBreak.startTime),
      endTime: toApiTime(fixedBreak.endTime),
    }),
  )

  return {
    workDayStart: toApiTime(formState.workDayStart),
    workDayEnd: toApiTime(formState.workDayEnd),
    cadenceEnabled: formState.cadenceEnabled,
    targetFocusMinutes: formState.targetFocusMinutes,
    breakMinutes: formState.breakMinutes,
    minSessionMinutes: formState.minSessionMinutes,
    bufferMinutes: formState.bufferMinutes,
    peakStart: formState.peakStart.trim() === '' ? null : toApiTime(formState.peakStart),
    peakEnd: formState.peakEnd.trim() === '' ? null : toApiTime(formState.peakEnd),
    fixedBreaks,
  }
}

export function SchedulingPreferencesForm() {
  const formId = useId()
  const { preferences, isPending, isError, error: loadError } =
    useSchedulingPreferences()
  const saveMutation = useUpdateSchedulingPreferences()

  const [workDayStart, setWorkDayStart] = useState('09:00')
  const [workDayEnd, setWorkDayEnd] = useState('18:00')
  const [cadenceEnabled, setCadenceEnabled] = useState(true)
  const [targetFocusMinutes, setTargetFocusMinutes] = useState(50)
  const [breakMinutes, setBreakMinutes] = useState(10)
  const [minSessionMinutes, setMinSessionMinutes] = useState(15)
  const [bufferMinutes, setBufferMinutes] = useState(0)
  const [peakStart, setPeakStart] = useState('')
  const [peakEnd, setPeakEnd] = useState('')
  const [fixedBreaks, setFixedBreaks] = useState<FixedBreakField[]>([])
  const [persisted, setPersisted] = useState(true)
  const [nextBreakId, setNextBreakId] = useState(0)

  useEffect(() => {
    if (preferences == null) {
      return
    }

    const formState = preferencesToFormState(preferences)
    setWorkDayStart(formState.workDayStart)
    setWorkDayEnd(formState.workDayEnd)
    setCadenceEnabled(formState.cadenceEnabled)
    setTargetFocusMinutes(formState.targetFocusMinutes)
    setBreakMinutes(formState.breakMinutes)
    setMinSessionMinutes(formState.minSessionMinutes)
    setBufferMinutes(formState.bufferMinutes)
    setPeakStart(formState.peakStart)
    setPeakEnd(formState.peakEnd)
    setFixedBreaks(formState.fixedBreaks)
    setPersisted(formState.persisted)
    setNextBreakId(formState.fixedBreaks.length)
  }, [preferences])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const request = buildRequest({
      workDayStart,
      workDayEnd,
      cadenceEnabled,
      targetFocusMinutes,
      breakMinutes,
      minSessionMinutes,
      bufferMinutes,
      peakStart,
      peakEnd,
      fixedBreaks,
      persisted,
    })

    saveMutation.mutate(request)
  }

  function handleAddFixedBreak() {
    const clientId = `new-break-${nextBreakId}`
    setNextBreakId((current) => current + 1)
    setFixedBreaks((current) => [
      ...current,
      {
        clientId,
        label: '',
        startTime: '12:00',
        endTime: '13:00',
      },
    ])
  }

  function handleRemoveFixedBreak(clientId: string) {
    setFixedBreaks((current) =>
      current.filter((fixedBreak) => fixedBreak.clientId !== clientId),
    )
  }

  function updateFixedBreak(
    clientId: string,
    patch: Partial<Omit<FixedBreakField, 'clientId'>>,
  ) {
    setFixedBreaks((current) =>
      current.map((fixedBreak) =>
        fixedBreak.clientId === clientId
          ? { ...fixedBreak, ...patch }
          : fixedBreak,
      ),
    )
  }

  if (isPending) {
    return <p>Loading scheduling preferences…</p>
  }

  if (isError && loadError instanceof Error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{loadError.message}</AlertDescription>
      </Alert>
    )
  }

  const saveError = saveMutation.error

  return (
    <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-6">
      {!persisted ? (
        <p className="text-sm text-muted-foreground">
          These defaults apply until you save your scheduling preferences.
        </p>
      ) : null}

      {saveMutation.isError &&
      saveError instanceof Error &&
      !(saveError instanceof ApiError && saveError.details) ? (
        <Alert variant="destructive">
          <AlertDescription>{saveError.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="workDayStart">Work day start</Label>
          <Input
            id="workDayStart"
            name="workDayStart"
            type="time"
            value={workDayStart}
            onChange={(event) => setWorkDayStart(event.target.value)}
            aria-invalid={Boolean(getFieldError(saveError, 'workDayStart'))}
            required
          />
          {saveMutation.isError && getFieldError(saveError, 'workDayStart') ? (
            <p className="text-sm text-destructive">
              {getFieldError(saveError, 'workDayStart')}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="workDayEnd">Work day end</Label>
          <Input
            id="workDayEnd"
            name="workDayEnd"
            type="time"
            value={workDayEnd}
            onChange={(event) => setWorkDayEnd(event.target.value)}
            aria-invalid={Boolean(getFieldError(saveError, 'workDayEnd'))}
            required
          />
          {saveMutation.isError && getFieldError(saveError, 'workDayEnd') ? (
            <p className="text-sm text-destructive">
              {getFieldError(saveError, 'workDayEnd')}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="cadenceEnabled"
          name="cadenceEnabled"
          type="checkbox"
          checked={cadenceEnabled}
          onChange={(event) => setCadenceEnabled(event.target.checked)}
          className="size-4 rounded border border-input"
        />
        <Label htmlFor="cadenceEnabled">Enable focus cadence</Label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="targetFocusMinutes">Target focus (minutes)</Label>
          <Input
            id="targetFocusMinutes"
            name="targetFocusMinutes"
            type="number"
            min={1}
            value={targetFocusMinutes}
            onChange={(event) =>
              setTargetFocusMinutes(Number.parseInt(event.target.value, 10))
            }
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="breakMinutes">Break minutes</Label>
          <Input
            id="breakMinutes"
            name="breakMinutes"
            type="number"
            min={1}
            value={breakMinutes}
            onChange={(event) =>
              setBreakMinutes(Number.parseInt(event.target.value, 10))
            }
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="minSessionMinutes">Minimum session (minutes)</Label>
          <Input
            id="minSessionMinutes"
            name="minSessionMinutes"
            type="number"
            min={1}
            value={minSessionMinutes}
            onChange={(event) =>
              setMinSessionMinutes(Number.parseInt(event.target.value, 10))
            }
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bufferMinutes">Trailing buffer (minutes)</Label>
          <Input
            id="bufferMinutes"
            name="bufferMinutes"
            type="number"
            min={0}
            value={bufferMinutes}
            onChange={(event) =>
              setBufferMinutes(Number.parseInt(event.target.value, 10))
            }
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          The peak window is visual only and does not affect how tasks are
          scheduled.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="peakStart">Peak start</Label>
            <Input
              id="peakStart"
              name="peakStart"
              type="time"
              value={peakStart}
              onChange={(event) => setPeakStart(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="peakEnd">Peak end</Label>
            <Input
              id="peakEnd"
              name="peakEnd"
              type="time"
              value={peakEnd}
              onChange={(event) => setPeakEnd(event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Fixed breaks</h2>
          <Button type="button" variant="outline" onClick={handleAddFixedBreak}>
            Add break
          </Button>
        </div>
        {fixedBreaks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No fixed breaks yet.</p>
        ) : (
          fixedBreaks.map((fixedBreak) => (
            <div
              key={fixedBreak.clientId}
              className="grid gap-4 rounded-md border p-4 sm:grid-cols-[1fr_auto_auto_auto]"
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${fixedBreak.clientId}-label`}>Label</Label>
                <Input
                  id={`${fixedBreak.clientId}-label`}
                  value={fixedBreak.label}
                  onChange={(event) =>
                    updateFixedBreak(fixedBreak.clientId, {
                      label: event.target.value,
                    })
                  }
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${fixedBreak.clientId}-start`}>Start</Label>
                <Input
                  id={`${fixedBreak.clientId}-start`}
                  type="time"
                  value={fixedBreak.startTime}
                  onChange={(event) =>
                    updateFixedBreak(fixedBreak.clientId, {
                      startTime: event.target.value,
                    })
                  }
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${fixedBreak.clientId}-end`}>End</Label>
                <Input
                  id={`${fixedBreak.clientId}-end`}
                  type="time"
                  value={fixedBreak.endTime}
                  onChange={(event) =>
                    updateFixedBreak(fixedBreak.clientId, {
                      endTime: event.target.value,
                    })
                  }
                  required
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => handleRemoveFixedBreak(fixedBreak.clientId)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Button type="submit" disabled={saveMutation.isPending}>
        {saveMutation.isPending ? 'Saving…' : 'Save preferences'}
      </Button>
    </form>
  )
}
